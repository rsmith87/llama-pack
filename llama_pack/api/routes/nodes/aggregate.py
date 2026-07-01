from __future__ import annotations

import asyncio
import httpx
from urllib.parse import urlparse
from fastapi import APIRouter, Depends, Request

from llama_pack.api.dependencies import get_node_registry
from llama_pack.api.routes.nodes.common import (
    annotate_model_sources,
    failed_node_payload,
    stale_node_payload,
    upstream_error_text,
)
from llama_pack.core.network.cert_probe import probe_cert_expiry_seconds
from llama_pack.core.nodes.registry import NodeRegistry
from llama_pack.core.runtime.profile_catalog import build_profile_catalog


router = APIRouter()


def _sync_remote_deployments(request_node: dict, models: object, store: object | None) -> None:
    if store is None or not isinstance(models, list):
        return
    node_name = str(request_node.get("name") or "").strip()
    if not node_name:
        return
    host = urlparse(str(request_node.get("url") or "")).hostname or node_name
    for model in models:
        if not isinstance(model, dict):
            continue
        family = str(model.get("family") or "").strip()
        name = str(model.get("name") or "").strip()
        base_name = family or name.partition(":")[0].strip()
        if not base_name:
            continue
        model_row = store.get_model_by_name(base_name)
        if model_row is None:
            continue
        profile_key = str(model.get("profile") or "").strip() or None
        suffix = profile_key or "default"
        port = model.get("port")
        if not isinstance(port, int):
            continue
        store.upsert_model_deployment(
            model_id=str(model_row["model_id"]),
            deployment_name=f"remote:{node_name}:{suffix}",
            node_name=node_name,
            host=host,
            port=port,
            profile_key=profile_key,
            enabled=True,
        )


async def _fetch_node_snapshot(registry: NodeRegistry, node: dict, include_models: bool, store: object | None = None) -> dict:
    cert_expires_in_seconds = await probe_cert_expiry_seconds(node.get("url", ""))
    if not node["heartbeat_fresh"]:
        payload = stale_node_payload(node, include_models=include_models)
        return {**payload, "cert_expires_in_seconds": cert_expires_in_seconds}
    try:
        health = await registry.request_node(node["name"], "GET", "/health")
        if not include_models:
            return {**node, "reachable": True, "health": health, "cert_expires_in_seconds": cert_expires_in_seconds}
        models = await registry.request_node(node["name"], "GET", "/lm-api/v1/models")
        _sync_remote_deployments(node, models, store)
        models_source = annotate_model_sources(models)
        return {
            **node,
            "reachable": True,
            "models": models,
            "agent_config_source": health.get("config_source"),
            "models_source": models_source,
            "cert_expires_in_seconds": cert_expires_in_seconds,
        }
    except httpx.HTTPStatusError as exc:
        payload = failed_node_payload(node, exc, include_models=include_models)
        return {**payload, "cert_expires_in_seconds": cert_expires_in_seconds}
    except httpx.HTTPError as exc:
        payload = failed_node_payload(node, exc, include_models=include_models)
        return {**payload, "cert_expires_in_seconds": cert_expires_in_seconds}
    except Exception as exc:
        payload = failed_node_payload(node, exc, include_models=include_models)
        return {**payload, "cert_expires_in_seconds": cert_expires_in_seconds}


@router.get("/nodes/status")
async def node_status(registry: NodeRegistry = Depends(get_node_registry)):
    nodes = registry.list_nodes()
    return await asyncio.gather(
        *(_fetch_node_snapshot(registry, node, include_models=False) for node in nodes)
    )


@router.get("/nodes/models")
async def node_models(request: Request, registry: NodeRegistry = Depends(get_node_registry)):
    store = getattr(request.app.state, "model_asset_store", None)
    nodes = registry.list_nodes()
    return await asyncio.gather(
        *(_fetch_node_snapshot(registry, node, include_models=True, store=store) for node in nodes)
    )


async def _fetch_node_gguf_snapshot(registry: NodeRegistry, node: dict) -> dict:
    if not node["heartbeat_fresh"]:
        return {**node, "reachable": False, "files": [], "error": "stale heartbeat"}
    try:
        payload = await registry.request_node(node["name"], "GET", "/lm-api/v1/library/ggufs")
        files = payload if isinstance(payload, list) else payload.get("files") or payload.get("ggufs") or []
        return {**node, "reachable": True, "files": files}
    except Exception as exc:
        return {**node, "reachable": False, "files": [], "error": upstream_error_text(exc)}


@router.get("/nodes/ggufs")
async def node_ggufs(registry: NodeRegistry = Depends(get_node_registry)):
    nodes = registry.list_nodes()
    return await asyncio.gather(*(_fetch_node_gguf_snapshot(registry, node) for node in nodes))


@router.get("/nodes/models/profiles")
async def node_model_profiles(registry: NodeRegistry = Depends(get_node_registry)):
    nodes = registry.list_nodes()
    snapshots = await asyncio.gather(
        *(_fetch_node_snapshot(registry, node, include_models=True) for node in nodes)
    )
    statuses = []
    for snapshot in snapshots:
        if not snapshot.get("reachable") or not isinstance(snapshot.get("models"), list):
            continue
        node_name = snapshot.get("name")
        for model in snapshot["models"]:
            if isinstance(model, dict):
                statuses.append({**model, "node": node_name, "route": f"node:{node_name}"})
    return build_profile_catalog(statuses)
