from __future__ import annotations

import httpx
from fastapi import APIRouter, Depends

from llama_manager.api.dependencies import get_node_registry
from llama_manager.api.routes.nodes.common import (
    annotate_model_sources,
    failed_node_payload,
    stale_node_payload,
    upstream_error_text,
)
from llama_manager.core.network.cert_probe import probe_cert_expiry_seconds
from llama_manager.core.nodes.registry import NodeRegistry
from llama_manager.core.runtime.profile_catalog import build_profile_catalog


router = APIRouter()


async def _fetch_node_snapshot(registry: NodeRegistry, node: dict, include_models: bool) -> dict:
    cert_expires_in_seconds = await probe_cert_expiry_seconds(node.get("url", ""))
    if not node["heartbeat_fresh"]:
        payload = stale_node_payload(node, include_models=include_models)
        return {**payload, "cert_expires_in_seconds": cert_expires_in_seconds}
    try:
        health = await registry.request_node(node["name"], "GET", "/health")
        if not include_models:
            return {**node, "reachable": True, "health": health, "cert_expires_in_seconds": cert_expires_in_seconds}
        models = await registry.request_node(node["name"], "GET", "/lm-api/v1/models")
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
    return [await _fetch_node_snapshot(registry, node, include_models=False) for node in registry.list_nodes()]


@router.get("/nodes/models")
async def node_models(registry: NodeRegistry = Depends(get_node_registry)):
    return [await _fetch_node_snapshot(registry, node, include_models=True) for node in registry.list_nodes()]


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
    return [await _fetch_node_gguf_snapshot(registry, node) for node in registry.list_nodes()]


@router.get("/nodes/models/profiles")
async def node_model_profiles(registry: NodeRegistry = Depends(get_node_registry)):
    snapshots = [await _fetch_node_snapshot(registry, node, include_models=True) for node in registry.list_nodes()]
    statuses = []
    for snapshot in snapshots:
        if not snapshot.get("reachable") or not isinstance(snapshot.get("models"), list):
            continue
        node_name = snapshot.get("name")
        for model in snapshot["models"]:
            if isinstance(model, dict):
                statuses.append({**model, "node": node_name, "route": f"node:{node_name}"})
    return build_profile_catalog(statuses)
