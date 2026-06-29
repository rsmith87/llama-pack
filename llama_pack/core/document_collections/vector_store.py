from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol, cast

from llama_pack.core.config.models import MemoryConfig


DOCUMENT_COLLECTION_MIN_SIMILARITY_SCORE = 0.35


@dataclass(frozen=True)
class DocumentChunkInput:
    chunk_id: str
    document_id: str
    collection_id: str
    filename: str
    chunk_index: int
    text: str


@dataclass(frozen=True)
class DocumentChunkSearchResult:
    chunk_id: str
    document_id: str
    collection_id: str
    filename: str
    chunk_index: int
    text: str
    score: float


class _EmbeddingModel(Protocol):
    def encode(self, text: str, normalize_embeddings: bool) -> object:
        ...


class _VectorCollection(Protocol):
    def add(
        self,
        ids: list[str],
        embeddings: list[list[float]],
        documents: list[str],
        metadatas: list[dict[str, object]],
    ) -> None:
        ...

    def query(
        self,
        query_embeddings: list[list[float]],
        n_results: int,
        include: list[str],
        where: dict[str, object] | None,
    ) -> dict[str, object]:
        ...

    def delete(self, ids: list[str] | None = None, where: dict[str, object] | None = None) -> None:
        ...


class DocumentCollectionVectorStore:
    def __init__(self, config: MemoryConfig) -> None:
        self.config = config
        self._model = self._init_model()
        self._collection = self._init_collection()

    def add_chunks(self, chunks: list[DocumentChunkInput]) -> None:
        if not chunks:
            return
        self._collection.add(
            ids=[chunk.chunk_id for chunk in chunks],
            embeddings=[self._embed(chunk.text) for chunk in chunks],
            documents=[chunk.text for chunk in chunks],
            metadatas=[self._metadata(chunk) for chunk in chunks],
        )

    def search(self, query: str, collection_ids: list[str], top_k: int) -> list[DocumentChunkSearchResult]:
        if not query.strip():
            raise ValueError("Document collection search query must contain non-whitespace content")
        if not collection_ids:
            raise ValueError("Document collection search requires at least one collection_id")
        if top_k <= 0:
            raise ValueError("Document collection search top_k must be greater than 0")

        raw_results = self._collection.query(
            query_embeddings=[self._embed(query)],
            n_results=top_k * max(len(collection_ids), 1),
            include=["documents", "metadatas", "distances"],
            where={"collection_id": {"$in": collection_ids}},
        )
        return self._search_results(raw_results, collection_ids, top_k)

    def delete_document_chunks(self, document_id: str) -> None:
        self._collection.delete(where={"document_id": document_id})

    def _init_collection(self) -> _VectorCollection:
        import chromadb  # noqa: PLC0415

        self.config.path.mkdir(parents=True, exist_ok=True)
        client = chromadb.PersistentClient(path=str(self.config.path))
        return cast(
            _VectorCollection,
            client.get_or_create_collection(
                name="document_collection_chunks",
                metadata={"hnsw:space": "cosine"},
            ),
        )

    def _init_model(self) -> _EmbeddingModel:
        model_path = self.config.embedding_model_path
        if model_path is None or not model_path.exists():
            raise FileNotFoundError(
                f"Document collection embedding model not found at {model_path}. "
                "Run scripts/install_embedding_model.sh or configure memory.embedding_model_path."
            )
        from sentence_transformers import SentenceTransformer  # noqa: PLC0415

        return cast(_EmbeddingModel, SentenceTransformer(str(model_path)))

    def _embed(self, text: str) -> list[float]:
        embedding = self._model.encode(text, normalize_embeddings=True)
        if hasattr(embedding, "tolist"):
            values = embedding.tolist()
        else:
            values = embedding
        if not isinstance(values, list):
            raise TypeError("Document collection embedding model returned a non-list vector")
        return [float(value) for value in values]

    def _metadata(self, chunk: DocumentChunkInput) -> dict[str, object]:
        return {
            "chunk_id": chunk.chunk_id,
            "document_id": chunk.document_id,
            "collection_id": chunk.collection_id,
            "filename": chunk.filename,
            "chunk_index": chunk.chunk_index,
        }

    def _search_results(
        self,
        raw_results: dict[str, object],
        collection_ids: list[str],
        top_k: int,
    ) -> list[DocumentChunkSearchResult]:
        documents = self._first_result_list(raw_results, "documents")
        metadatas = self._first_result_list(raw_results, "metadatas")
        distances = self._first_result_list(raw_results, "distances")
        results: list[DocumentChunkSearchResult] = []
        for document, metadata, distance in zip(documents, metadatas, distances):
            if not isinstance(metadata, dict):
                raise TypeError("Document collection vector metadata was not an object")
            collection_id = str(metadata.get("collection_id", ""))
            if collection_id not in collection_ids:
                continue
            score = 1.0 - float(distance)
            if score < DOCUMENT_COLLECTION_MIN_SIMILARITY_SCORE:
                continue
            results.append(
                DocumentChunkSearchResult(
                    chunk_id=str(metadata.get("chunk_id", "")),
                    document_id=str(metadata.get("document_id", "")),
                    collection_id=collection_id,
                    filename=str(metadata.get("filename", "")),
                    chunk_index=int(metadata.get("chunk_index", 0)),
                    text=str(document),
                    score=round(score, 4),
                )
            )
            if len(results) >= top_k:
                break
        return results

    def _first_result_list(self, raw_results: dict[str, object], key: str) -> list[object]:
        value = raw_results.get(key)
        if not isinstance(value, list) or not value:
            return []
        first = value[0]
        if not isinstance(first, list):
            raise TypeError(f"Document collection vector query returned invalid {key}")
        return first
