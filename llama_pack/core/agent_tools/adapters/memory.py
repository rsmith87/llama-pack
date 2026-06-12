from __future__ import annotations

import asyncio
from typing import TYPE_CHECKING

from llama_pack.core.config.models import AgentToolDefinitionConfig

if TYPE_CHECKING:
    from llama_pack.core.memory.store import ChromaMemoryStore


class MemorySearchToolAdapter:
    """Semantic search over the controller memory store."""

    def __init__(self, memory_store: ChromaMemoryStore) -> None:
        self._store = memory_store

    async def execute(self, tool: AgentToolDefinitionConfig, arguments: dict[str, object]) -> dict[str, object]:
        query = str(arguments.get("query") or "").strip()
        if not query:
            return {"ok": False, "error": "memory_search requires a non-empty 'query' argument"}
        raw_top_k = arguments.get("top_k")
        top_k: int | None = int(raw_top_k) if raw_top_k is not None else None
        results = await self._store.search(query, top_k=top_k)
        return {"ok": True, "results": results, "count": len(results)}


class MemoryWriteToolAdapter:
    """Fire-and-forget write to the controller memory store."""

    def __init__(self, memory_store: ChromaMemoryStore) -> None:
        self._store = memory_store

    async def execute(self, tool: AgentToolDefinitionConfig, arguments: dict[str, object]) -> dict[str, object]:
        text = str(arguments.get("text") or "").strip()
        if not text:
            return {"ok": False, "error": "memory_write requires a non-empty 'text' argument"}
        tier = str(arguments.get("tier") or "durable")
        topic = str(arguments.get("topic") or "") or None
        raw_tags = arguments.get("tags")
        tags: list[str] = [str(t) for t in raw_tags] if isinstance(raw_tags, list) else []
        # Schedule write as a background task — returns immediately
        asyncio.ensure_future(self._store.write(text, tier=tier, topic=topic, tags=tags))  # type: ignore[arg-type]
        return {"ok": True, "queued": True}
