from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import FileResponse

router = APIRouter(prefix="/plugins", tags=["plugins"])
assets_router = APIRouter()


@router.get("/enabled")
async def enabled_plugins(request: Request):
    return request.app.state.plugin_registry.enabled_metadata()


@router.get("/status")
async def plugin_status(request: Request):
    return request.app.state.plugin_registry.status_payload()


@assets_router.get("/plugin-assets/{plugin_id}/{asset_path:path}", include_in_schema=False)
async def plugin_asset(plugin_id: str, asset_path: str, request: Request):
    record = request.app.state.plugin_registry.records.get(plugin_id)
    if record is None or record.status != "enabled" or record.static_dir is None:
        raise HTTPException(status_code=404, detail="Not Found")
    root = record.static_dir.resolve()
    candidate = (root / asset_path).resolve()
    try:
        candidate.relative_to(root)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid plugin asset path") from exc
    if not candidate.is_file():
        raise HTTPException(status_code=404, detail="Not Found")
    return FileResponse(candidate)
