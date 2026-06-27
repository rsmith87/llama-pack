from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from llama_pack.core.offline.setup import OfflineSetupService


router = APIRouter(prefix="/offline")


class OfflineReadinessRequest(BaseModel):
    source_node: str
    model: str
    target_nodes: list[str] = Field(min_length=1)


class OfflineDistributeRequest(BaseModel):
    source_node: str
    source_file_id: str
    target_nodes: list[str] = Field(min_length=1)


def get_offline_setup_service(request: Request) -> OfflineSetupService:
    return request.app.state.offline_setup_service


@router.post("/readiness")
async def offline_readiness(
    body: OfflineReadinessRequest,
    service: OfflineSetupService = Depends(get_offline_setup_service),
):
    return await service.readiness(body.source_node, body.model, body.target_nodes)


@router.post("/distribute")
async def offline_distribute(
    body: OfflineDistributeRequest,
    service: OfflineSetupService = Depends(get_offline_setup_service),
):
    try:
        return await service.distribute(body.source_node, body.source_file_id, body.target_nodes)
    except RuntimeError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
