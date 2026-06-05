from __future__ import annotations

import httpx
from fastapi import HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from llama_manager.core.network.tls_diagnostics import network_error_text


class NodeRegistrationRequest(BaseModel):
    name: str
    url: str
    api_key: str | None = None
    verify_tls: bool = True
    registration_key: str | None = None


class NodeUpdateRequest(BaseModel):
    url: str
    api_key: str | None = None
    verify_tls: bool = True


def platform_from_path(path: str | None) -> str:
    if not path:
        return "unknown"
    normalized = path.replace("\\", "/")
    if len(path) >= 2 and path[1] == ":":
        return "windows"
    if normalized.startswith("/Users/") or normalized.startswith("/Volumes/") or normalized.startswith("/opt/"):
        return "macos"
    return "unknown"


def upstream_error_text(exc: Exception) -> str:
    return network_error_text(exc)


def stale_node_payload(node: dict, include_models: bool) -> dict:
    payload = {**node, "reachable": False, "error": "stale heartbeat"}
    if include_models:
        payload.update(
            {
                "models": [],
                "agent_config_source": None,
                "models_source": "unknown",
            }
        )
    return payload


def failed_node_payload(node: dict, exc: Exception, include_models: bool) -> dict:
    payload = {**node, "reachable": False, "error": upstream_error_text(exc)}
    if include_models:
        payload.update(
            {
                "models": [],
                "agent_config_source": None,
                "models_source": "unknown",
            }
        )
    return payload


def annotate_model_sources(models: list[dict]) -> str:
    models_source = "unknown"
    for model in models:
        model_platform = platform_from_path(model.get("model_path"))
        model["model_source"] = model_platform
        if model_platform in {"windows", "macos"}:
            models_source = model_platform
    return models_source


async def proxy_node_request(registry, node: str, method: str, path: str):
    try:
        return await registry.request_node(node, method, path)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except httpx.HTTPStatusError as exc:
        raise HTTPException(
            status_code=502,
            detail={
                "upstream_status": exc.response.status_code,
                "text": exc.response.text,
            },
        ) from exc
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


async def stream_node_request(registry, node: str, path: str) -> StreamingResponse:
    try:
        node_config = registry.get_node_config(node)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    url = f"{node_config.url.rstrip('/')}/{path.lstrip('/')}"
    headers: dict[str, str] = {}
    if node_config.api_key:
        headers["X-Llama-Manager-Key"] = node_config.api_key

    async def relay():
        try:
            async with httpx.AsyncClient(timeout=None, verify=node_config.verify_tls) as client:
                async with client.stream("GET", url, headers=headers) as response:
                    response.raise_for_status()
                    async for chunk in response.aiter_bytes():
                        if chunk:
                            yield chunk
        except httpx.HTTPStatusError as exc:
            yield f"event: error\ndata: {exc.response.text!r}\n\n".encode()
        except httpx.HTTPError as exc:
            yield f"event: error\ndata: {str(exc)!r}\n\n".encode()

    return StreamingResponse(relay(), media_type="text/event-stream")
