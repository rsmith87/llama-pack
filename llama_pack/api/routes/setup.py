from __future__ import annotations

import secrets
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field


router = APIRouter(prefix="/setup", tags=["setup"])
SESSION_TTL_HOURS = 12


class BootstrapAdminRequest(BaseModel):
    username: str = Field(min_length=1, max_length=80)


def _auth_enabled(request: Request) -> bool:
    return bool(request.app.state.config.agent_api_key or request.app.state.auth_store.has_active_keys())


@router.get("/status")
def setup_status(request: Request) -> dict[str, object]:
    auth_enabled = _auth_enabled(request)
    config = request.app.state.config
    catalog = request.app.state.model_catalog_service
    models_count = len(catalog.list_registered_models())
    has_nodes = bool(config.nodes)
    return {
        "mode": config.mode,
        "auth_bootstrap_required": not auth_enabled,
        "auth_enabled": auth_enabled,
        "setup_recommended": not auth_enabled,
        "models_count": models_count,
        "has_nodes": has_nodes,
    }


@router.post("/bootstrap-admin")
def bootstrap_admin(body: BootstrapAdminRequest, request: Request) -> dict[str, object]:
    if request.app.state.config.agent_api_key:
        raise HTTPException(status_code=409, detail="Static authentication is already configured")
    if request.app.state.auth_store.has_active_keys():
        raise HTTPException(status_code=409, detail="Authentication is already bootstrapped")

    created = request.app.state.auth_store.create_key(body.username, "admin")
    token = secrets.token_urlsafe(24)
    now = datetime.now(UTC)
    expires_at = (now + timedelta(hours=SESSION_TTL_HOURS)).isoformat()
    request.app.state.ui_sessions[token] = {
        "username": body.username,
        "created_at": now.isoformat(),
        "expires_at": expires_at,
        "role": "admin",
    }
    request.app.state.audit_store.create_event(
        actor=body.username,
        event_type="auth_bootstrap_admin_create",
        dry_run=False,
        target=body.username,
        route="setup",
        payload={"key_id": created["id"], "role": "admin"},
    )
    return {
        "token": token,
        "username": body.username,
        "expires_at": expires_at,
        "role": "admin",
        "key": created["key"],
        "key_hint": created["key_hint"],
    }


@router.get("/current-config")
def current_config(request: Request) -> dict[str, object]:
    config = request.app.state.config
    catalog = request.app.state.model_catalog_service

    # First model (if any) — no secrets in model configs
    first_model: dict[str, object] | None = None
    registered_models = catalog.list_registered_models()
    if registered_models:
        alias = str(registered_models[0]["model_name"])
        m = catalog.runtime_model(alias)
        first_model = {
            "alias": alias,
            "path": str(m.path),
            "port": m.port,
            "gpu_layers": m.gpu_layers,
            "ctx": m.ctx,
            "strengths": m.strengths,
            "cost_tier": m.cost_tier or "low",
        }

    # Nodes — api_key masked
    nodes = [
        {
            "name": name,
            "url": node.url,
            "api_key": "***" if node.api_key else "",
            "default_model": node.default_model or "",
        }
        for name, node in config.nodes.items()
    ]

    # First hf_models root (if any)
    model_roots = config.model_roots
    hf_models_dir = str(model_roots[0]) if model_roots else ""

    return {
        "mode": config.mode,
        "log_dir": str(config.log_dir),
        "controller_registration_key": "***" if config.controller_registration_key else "",
        "node_heartbeat_timeout_seconds": config.node_heartbeat_timeout_seconds,
        "controller_instance_id": config.controller_instance_id,
        "memory": {
            "enabled": config.memory.enabled,
            "path": str(config.memory.path),
            "embedding_model_path": str(config.memory.embedding_model_path)
            if config.memory.embedding_model_path
            else "",
            "auto_inject": config.memory.auto_inject,
            "top_k": config.memory.top_k,
        },
        "nodes": nodes,
        "controller_url": config.controller_url or "",
        "node_name": config.node_name or "",
        "agent_url": config.agent_url or "",
        "agent_api_key": "***" if config.agent_api_key else "",
        "controller_registration_key_outbound": "***"
        if config.controller_registration_key_outbound
        else "",
        "llama_server_bin": config.llama_server_bin,
        "llama_cpp_dir": str(config.llama_cpp_dir),
        "python_bin": config.python_bin,
        "hf_models_dir": hf_models_dir,
        "agent_worker_enabled": config.agent_worker_enabled,
        "agent_worker_max_jobs": config.agent_worker_max_jobs,
        "agent_worker_labels": {k: str(v) for k, v in config.agent_worker_labels.items()},
        "first_model": first_model,
    }
