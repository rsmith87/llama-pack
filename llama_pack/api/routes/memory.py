from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from llama_pack.api.dependencies import get_memory_store

router = APIRouter(prefix="/memory")


class MemoryWriteRequest(BaseModel):
    text: str = Field(min_length=1, max_length=32768)
    tier: str = "durable"
    topic: str | None = None
    tags: list[str] = Field(default_factory=list)


class MemoryWriteResponse(BaseModel):
    ok: bool
    id: str | None = None
    detail: str | None = None


class MemorySearchRequest(BaseModel):
    query: str = Field(min_length=1, max_length=4096)
    top_k: int = Field(default=5, ge=1, le=20)


class MemoryEmbeddingsRequest(BaseModel):
    input: list[str] = Field(min_length=1, max_length=128)


@router.post("/write", response_model=MemoryWriteResponse, status_code=201)
async def memory_write(
    body: MemoryWriteRequest,
    store: Any = Depends(get_memory_store),
) -> MemoryWriteResponse:
    if store.disabled:
        raise HTTPException(status_code=503, detail="Memory subsystem is not enabled on this node")
    if body.tier not in {"permanent", "durable", "ephemeral"}:
        raise HTTPException(status_code=422, detail="tier must be one of: permanent, durable, ephemeral")
    entry_id = await store.write(
        text=body.text,
        tier=body.tier,
        topic=body.topic,
        tags=body.tags,
    )
    if entry_id is None:
        return MemoryWriteResponse(ok=False, detail="write failed")
    return MemoryWriteResponse(ok=True, id=entry_id)


@router.post("/search")
async def memory_search(
    body: MemorySearchRequest,
    store: Any = Depends(get_memory_store),
) -> dict[str, Any]:
    if store.disabled:
        raise HTTPException(status_code=503, detail="Memory subsystem is not enabled on this node")
    results = await store.search(body.query, top_k=body.top_k)
    return {"ok": True, "results": results, "count": len(results)}


@router.post("/embeddings")
async def memory_embeddings(
    body: MemoryEmbeddingsRequest,
    store: Any = Depends(get_memory_store),
) -> dict[str, Any]:
    if store.disabled:
        raise HTTPException(status_code=503, detail="Memory subsystem is not enabled on this node")
    inputs = [item.strip() for item in body.input if item.strip()]
    if not inputs:
        raise HTTPException(status_code=422, detail="input must contain at least one non-empty string")
    embeddings = await store.embeddings(inputs)
    if not embeddings:
        raise HTTPException(status_code=503, detail="Memory embedding model did not return vectors")
    model_path = getattr(getattr(store, "config", None), "embedding_model_path", None)
    model_name = model_path.name if model_path is not None else "controller-memory"
    return {
        "object": "list",
        "model": model_name,
        "data": [
            {
                "object": "embedding",
                "index": index,
                "embedding": embedding,
                "id": f"memory-emb-{index}",
            }
            for index, embedding in enumerate(embeddings)
        ],
        "usage": {"prompt_tokens": len(inputs), "total_tokens": len(inputs)},
    }
