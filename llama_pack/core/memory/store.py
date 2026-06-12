from __future__ import annotations

import asyncio
import logging
import math
import time
import uuid
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from llama_pack.core.config.models import MemoryConfig

logger = logging.getLogger(__name__)

MemoryTier = str  # "permanent" | "durable" | "ephemeral"

_TIER_TTL: dict[str, float | None] = {
    "permanent": None,
    "durable": None,   # set from config at cleanup time
    "ephemeral": None, # set from config at cleanup time
}

_SIMILARITY_DEDUP_THRESHOLD = 0.92


class ChromaMemoryStore:
    """
    Persistent semantic memory store backed by ChromaDB + sentence-transformers.

    Designed for the controller node only.  If ChromaDB or sentence-transformers
    are not installed, or the embedding model path does not exist, the store marks
    itself disabled and all public methods become silent no-ops / return empty
    results.  It never raises.
    """

    def __init__(self, config: MemoryConfig) -> None:
        self.config = config
        self._disabled = False
        self._client: Any = None
        self._collection: Any = None
        self._model: Any = None
        self._lock = asyncio.Lock()

        if not config.enabled:
            self._disabled = True
            return

        try:
            self._init_store()
        except Exception as exc:
            logger.warning("ChromaMemoryStore: disabled — failed to initialise: %s", exc)
            self._disabled = True

    # ------------------------------------------------------------------
    # Initialisation (blocking, called once at startup in __init__)
    # ------------------------------------------------------------------

    def _init_store(self) -> None:
        import chromadb  # noqa: PLC0415
        from sentence_transformers import SentenceTransformer  # noqa: PLC0415

        model_path = self.config.embedding_model_path
        if model_path is None or not model_path.exists():
            raise FileNotFoundError(
                f"Embedding model not found at {model_path}. "
                "Run scripts/install_embedding_model.sh first."
            )

        self.config.path.mkdir(parents=True, exist_ok=True)
        self._client = chromadb.PersistentClient(path=str(self.config.path))
        self._collection = self._client.get_or_create_collection(
            name="agent_memory",
            metadata={"hnsw:space": "cosine"},
        )
        self._model = SentenceTransformer(str(model_path))
        logger.info(
            "ChromaMemoryStore: ready — %d entries, model=%s",
            self._collection.count(),
            model_path.name,
        )

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    @property
    def disabled(self) -> bool:
        return self._disabled

    async def search(self, query: str, top_k: int | None = None) -> list[dict[str, Any]]:
        """Return top-K memory entries most relevant to *query*."""
        if self._disabled:
            return []
        k = top_k if top_k is not None else self.config.top_k
        try:
            return await asyncio.to_thread(self._search_sync, query, k)
        except Exception as exc:
            logger.warning("ChromaMemoryStore.search failed: %s", exc)
            return []

    async def write(
        self,
        text: str,
        tier: MemoryTier = "durable",
        topic: str | None = None,
        tags: list[str] | None = None,
    ) -> str | None:
        """
        Embed *text* and upsert into the collection.

        If a very similar entry already exists (cosine similarity ≥ threshold)
        the existing entry is updated in place rather than duplicated.
        Returns the entry ID, or None if the store is disabled.
        """
        if self._disabled:
            return None
        if not text.strip():
            return None
        try:
            return await asyncio.to_thread(self._write_sync, text, tier, topic, tags or [])
        except Exception as exc:
            logger.warning("ChromaMemoryStore.write failed: %s", exc)
            return None

    async def cleanup(self) -> int:
        """
        Remove expired and low-scoring entries.

        Returns the number of entries deleted.
        """
        if self._disabled:
            return 0
        try:
            return await asyncio.to_thread(self._cleanup_sync)
        except Exception as exc:
            logger.warning("ChromaMemoryStore.cleanup failed: %s", exc)
            return 0

    # ------------------------------------------------------------------
    # Synchronous internals (run via asyncio.to_thread)
    # ------------------------------------------------------------------

    def _embed(self, text: str) -> list[float]:
        embedding = self._model.encode(text, normalize_embeddings=True)
        return embedding.tolist() if hasattr(embedding, "tolist") else list(embedding)

    def _search_sync(self, query: str, top_k: int) -> list[dict[str, Any]]:
        count = self._collection.count()
        if count == 0:
            return []
        n = min(top_k, count)
        embedding = self._embed(query)
        results = self._collection.query(
            query_embeddings=[embedding],
            n_results=n,
            include=["documents", "metadatas", "distances"],
        )
        entries = []
        for doc, meta, dist in zip(
            results["documents"][0],
            results["metadatas"][0],
            results["distances"][0],
        ):
            entries.append({
                "text": doc,
                "tier": meta.get("tier", "durable"),
                "topic": meta.get("topic"),
                "tags": meta.get("tags", "").split(",") if meta.get("tags") else [],
                "score": round(1.0 - dist, 4),
                "id": meta.get("entry_id"),
            })
        return entries

    def _write_sync(
        self,
        text: str,
        tier: MemoryTier,
        topic: str | None,
        tags: list[str],
    ) -> str:
        embedding = self._embed(text)

        # Deduplication: check nearest neighbour
        existing_id: str | None = None
        count = self._collection.count()
        if count > 0:
            result = self._collection.query(
                query_embeddings=[embedding],
                n_results=1,
                include=["metadatas", "distances"],
            )
            raw_distances = result["distances"][0]
            if raw_distances:
                similarity = 1.0 - raw_distances[0]
                if similarity >= _SIMILARITY_DEDUP_THRESHOLD:
                    existing_id = result["ids"][0][0]

        now = time.time()
        metadata: dict[str, Any] = {
            "tier": tier,
            "topic": topic or "",
            "tags": ",".join(tags),
            "created_at": now,
            "last_accessed": now,
            "retrieval_count": 0,
        }

        if existing_id:
            # Update existing — keep original created_at, bump last_accessed
            existing = self._collection.get(ids=[existing_id], include=["metadatas"])
            if existing["metadatas"]:
                old_meta = existing["metadatas"][0]
                metadata["created_at"] = old_meta.get("created_at", now)
                metadata["retrieval_count"] = int(old_meta.get("retrieval_count", 0))
            metadata["entry_id"] = existing_id
            self._collection.update(
                ids=[existing_id],
                embeddings=[embedding],
                documents=[text],
                metadatas=[metadata],
            )
            return existing_id

        entry_id = str(uuid.uuid4())
        metadata["entry_id"] = entry_id
        self._collection.add(
            ids=[entry_id],
            embeddings=[embedding],
            documents=[text],
            metadatas=[metadata],
        )
        self._maybe_evict()
        return entry_id

    def _score(self, meta: dict[str, Any]) -> float:
        days_since = max((time.time() - float(meta.get("last_accessed", 0))) / 86400, 0.01)
        retrieval_count = int(meta.get("retrieval_count", 0))
        return (1.0 / days_since) + math.log1p(retrieval_count)

    def _maybe_evict(self) -> None:
        """Evict lowest-scoring ephemeral entries when over the soft cap."""
        count = self._collection.count()
        if count <= self.config.soft_cap:
            return

        all_entries = self._collection.get(include=["metadatas"])
        candidates = [
            (entry_id, meta)
            for entry_id, meta in zip(all_entries["ids"], all_entries["metadatas"])
            if meta.get("tier") == "ephemeral"
        ]
        if not candidates:
            return

        # Sort by score ascending — lowest score evicted first
        candidates.sort(key=lambda x: self._score(x[1]))
        to_delete = count - self.config.soft_cap
        ids_to_delete = [c[0] for c in candidates[:to_delete]]
        if ids_to_delete:
            self._collection.delete(ids=ids_to_delete)

    def _cleanup_sync(self) -> int:
        now = time.time()
        ephemeral_cutoff = now - self.config.ephemeral_ttl_days * 86400
        durable_cutoff = now - self.config.durable_ttl_days * 86400

        all_entries = self._collection.get(include=["metadatas"])
        to_delete = []
        for entry_id, meta in zip(all_entries["ids"], all_entries["metadatas"]):
            tier = meta.get("tier", "durable")
            if tier == "permanent":
                continue
            last_accessed = float(meta.get("last_accessed", 0))
            cutoff = ephemeral_cutoff if tier == "ephemeral" else durable_cutoff
            if last_accessed < cutoff:
                to_delete.append(entry_id)

        if to_delete:
            self._collection.delete(ids=to_delete)
            logger.info("ChromaMemoryStore.cleanup: evicted %d expired entries", len(to_delete))

        return len(to_delete)
