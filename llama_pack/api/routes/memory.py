from __future__ import annotations

from typing import Any

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from llama_pack.api.dependencies import get_config, get_memory_store
from llama_pack.api.http_headers import LLAMA_PACK_API_KEY_HEADER
from llama_pack.core.config import AppConfig

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


@router.get("/entries")
async def memory_entries(
    store: Any = Depends(get_memory_store),
) -> dict[str, Any]:
    if store.disabled:
        raise HTTPException(status_code=503, detail="Memory subsystem is not enabled on this node")
    entries = await store.entries()
    return {"ok": True, "entries": entries, "count": len(entries)}


@router.delete("/entries/{entry_id}")
async def memory_delete(
    entry_id: str,
    store: Any = Depends(get_memory_store),
) -> dict[str, Any]:
    if store.disabled:
        raise HTTPException(status_code=503, detail="Memory subsystem is not enabled on this node")
    deleted = await store.delete(entry_id)
    if not deleted:
        raise HTTPException(status_code=404, detail=f"Memory entry not found: {entry_id}")
    return {"ok": True, "id": entry_id, "deleted": True}


@router.post("/embeddings")
async def memory_embeddings(
    body: MemoryEmbeddingsRequest,
    config: AppConfig = Depends(get_config),
    store: Any = Depends(get_memory_store),
) -> dict[str, Any]:
    inputs = [item.strip() for item in body.input if item.strip()]
    if not inputs:
        raise HTTPException(status_code=422, detail="input must contain at least one non-empty string")
    if config.mode == "agent":
        return await _controller_memory_embeddings(config, inputs)
    if store.disabled:
        raise HTTPException(status_code=503, detail="Memory subsystem is not enabled on this node")
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


async def _controller_memory_embeddings(config: AppConfig, inputs: list[str]) -> dict[str, Any]:
    if not config.controller_url:
        raise HTTPException(status_code=503, detail="Controller embeddings require controller_url in agent config")
    url = f"{config.controller_url.rstrip('/')}/lm-api/v1/memory/embeddings"
    headers = {LLAMA_PACK_API_KEY_HEADER: config.agent_api_key} if config.agent_api_key else {}
    try:
        async with httpx.AsyncClient(timeout=30, verify=True) as client:
            response = await client.post(url, json={"input": inputs}, headers=headers)
            response.raise_for_status()
            payload = response.json()
    except httpx.HTTPStatusError as exc:
        detail = exc.response.text or str(exc)
        raise HTTPException(status_code=exc.response.status_code, detail=detail) from exc
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=503, detail=f"Controller embeddings request failed: {exc}") from exc
    if not isinstance(payload, dict):
        raise HTTPException(status_code=502, detail="Controller embeddings response was not a JSON object")
    return payload
