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
