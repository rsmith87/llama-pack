from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import FileResponse

from llama_manager.core.plugins.loader import load_configured_plugin

router = APIRouter(prefix="/plugins", tags=["plugins"])
assets_router = APIRouter()

LM_API_PREFIX = "/lm-api/v1"


@router.get("/enabled")
async def enabled_plugins(request: Request):
    return request.app.state.plugin_registry.enabled_metadata()


@router.get("/status")
async def plugin_status(request: Request):
    return await request.app.state.plugin_registry.status_payload_async()


@router.post("/{plugin_id}/activate")
async def activate_plugin(plugin_id: str, request: Request):
    try:
        record = load_configured_plugin(request.app.state.plugin_registry, request.app.state.config, plugin_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Plugin is not configured") from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    _include_plugin_routers(request.app, record)
    return _record_payload(record)


@router.post("/{plugin_id}/deactivate")
async def deactivate_plugin(plugin_id: str, request: Request):
    record = request.app.state.plugin_registry.deactivate(plugin_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Plugin is not configured")
    return _record_payload(record)


@router.get("/{plugin_id}/migrations/status")
async def plugin_migration_status(plugin_id: str, request: Request):
    payload = request.app.state.plugin_registry.migration_status_payload(plugin_id)
    if payload is None:
        raise HTTPException(status_code=404, detail="Not Found")
    return payload


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
    return FileResponse(candidate, headers={"Cache-Control": "no-store"})


def _include_plugin_routers(app, record) -> None:
    included = getattr(app.state, "plugin_routers_included", None)
    if included is None:
        included = set()
        app.state.plugin_routers_included = included
    for route_prefix, plugin_router in record.routers:
        key = (record.id, route_prefix)
        if key in included:
            continue
        app.include_router(plugin_router, prefix=f"{LM_API_PREFIX}/plugins{route_prefix}")
        included.add(key)


def _record_payload(record) -> dict[str, object]:
    return {
        "id": record.id,
        "status": record.status,
        "version": record.version,
        "warnings": record.warnings,
        "errors": record.errors,
    }
