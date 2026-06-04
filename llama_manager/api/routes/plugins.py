from __future__ import annotations

from fastapi import APIRouter, Request

router = APIRouter(prefix="/plugins", tags=["plugins"])


@router.get("/enabled")
async def enabled_plugins(request: Request):
    return request.app.state.plugin_registry.enabled_metadata()


@router.get("/status")
async def plugin_status(request: Request):
    return request.app.state.plugin_registry.status_payload()
