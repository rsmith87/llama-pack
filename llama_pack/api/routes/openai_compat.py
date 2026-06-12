from __future__ import annotations

import json
from typing import Any, Literal

from collections.abc import AsyncIterator

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field

from llama_pack.api.dependencies import get_chat_proxy, get_chat_scheduler, get_config, get_node_registry, get_process_manager, get_profile_activation_service, get_thread_service
from llama_pack.api.routes.compat_chat import CompatChatHTTPError, controller_chat, controller_stream, extract_openai_sse_json, stream_payload_has_tool_call
from llama_pack.api.routes.external_usage_audit import audit_external_chat_completion
from llama_pack.core.agent_tools.registry import ToolRegistry
from llama_pack.api.routes.chat.common import (
    ChatMessage,
    ChatRequestBody,
    raise_proxy_http_exception,
    resolve_profile_model,
    track_model_if_local,
)
from llama_pack.core.chat.profile_activation import ProfileActivationService
from llama_pack.core.chat.proxy import ChatProxy
from llama_pack.core.chat.scheduler import ChatAdmissionError, ChatScheduler
from llama_pack.core.agent_tools.runtime import AgentToolLoop
from llama_pack.core.config import AppConfig
from llama_pack.core.nodes.registry import NodeRegistry
from llama_pack.core.runtime.process_manager import ProcessManager
from llama_pack.core.threads.service import ThreadService


router = APIRouter(prefix="/v1")


class OpenAIChatCompletionsRequest(BaseModel):
    model: str = Field(min_length=1)
    messages: list[ChatMessage] = Field(min_length=1)
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    max_tokens: int = Field(default=512, ge=1, le=32768)
    n_predict: int | None = Field(default=None, ge=1, le=32768)
    top_p: float | None = Field(default=None, ge=0.0, le=1.0)
    top_k: int | None = Field(default=None, ge=0)
    min_p: float | None = Field(default=None, ge=0.0, le=1.0)
    repeat_penalty: float | None = Field(default=None, ge=0.0)
    seed: int | None = None
    stop: str | list[str] | None = None
    json_schema: dict[str, object] | None = None
    grammar: str | None = None
    reasoning: bool = False
    target: str = "auto"
    cache_prompt: bool | None = None
    slot_id: int | None = None
    stream: bool = False
    thread_id: str | None = None
    request_type: str | None = None
    metadata: dict[str, Any] | None = None
    model_family: str | None = None
    context_profile: str | None = None
    tool_runtime: Literal["agent"] | None = None
    tool_choice: dict[str, Any] | str | None = None


class ClientChatDiagnosticsRequest(BaseModel):
    model: str = Field(min_length=1)
    request_type: str | None = None
    stream: bool = False
    message: str = "Llama Pack client diagnostic: reply with ok."
    target: str = "auto"


@router.get("/models")
async def openai_models(request: Request, registry: NodeRegistry = Depends(get_node_registry)):
    return {"object": "list", "data": await _client_safe_models(request, registry)}


@router.get("/client/session")
async def openai_client_session(request: Request, registry: NodeRegistry = Depends(get_node_registry)):
    return {
        "auth": _client_auth_payload(request),
        "capabilities": {
            "openaiChatCompletions": True,
            "streaming": True,
            "serverHistory": False,
        },
        "models": await _client_safe_models(request, registry),
    }


@router.post("/client/diagnostics/chat")
async def openai_client_chat_diagnostics(
    body: ClientChatDiagnosticsRequest,
    request: Request,
    config: AppConfig = Depends(get_config),
    scheduler: ChatScheduler = Depends(get_chat_scheduler),
    manager: ProcessManager = Depends(get_process_manager),
    thread_service: ThreadService = Depends(get_thread_service),
):
    payload: dict[str, Any] = {
        "messages": [{"role": "user", "content": body.message}],
        "temperature": 0.0,
        "max_tokens": 16,
        "target": body.target,
    }
    try:
        if body.stream:
            stream, headers = await controller_stream(
                request=request,
                config=config,
                service=thread_service,
                proxy=scheduler,
                model=body.model,
                messages=payload["messages"],
                payload=payload,
                thread_id=None,
                request_type=body.request_type,
                metadata={"diagnostic": True},
                target=body.target,
            )
            if config.mode != "controller":
                stream = _track_stream(manager, body.model, stream)
            async for _chunk in stream:
                pass
            return _diagnostic_payload(body, headers, chat_ok=True, streaming_ok=True)

        response, headers = await controller_chat(
            request=request,
            config=config,
            service=thread_service,
            proxy=scheduler,
            model=body.model,
            messages=payload["messages"],
            payload=payload,
            thread_id=None,
            request_type=body.request_type,
            metadata={"diagnostic": True},
            target=body.target,
        )
        return _diagnostic_payload(body, headers, chat_ok=bool(response), streaming_ok=None)
    except CompatChatHTTPError as exc:
        return _diagnostic_payload(
            body,
            exc.headers,
            chat_ok=False,
            streaming_ok=False if body.stream else None,
            error={"status": exc.status_code, "detail": exc.detail},
        )
    except ChatAdmissionError as exc:
        return _diagnostic_payload(
            body,
            {},
            chat_ok=False,
            streaming_ok=False if body.stream else None,
            error={"status": exc.status_code, "detail": str(exc)},
        )
    except Exception as exc:
        return _diagnostic_payload(
            body,
            {},
            chat_ok=False,
            streaming_ok=False if body.stream else None,
            error={"status": 502, "detail": str(exc)},
        )


@router.post("/chat/completions")
async def openai_chat_completions(
    body: OpenAIChatCompletionsRequest,
    request: Request,
    config: AppConfig = Depends(get_config),
    proxy: ChatProxy = Depends(get_chat_proxy),
    scheduler: ChatScheduler = Depends(get_chat_scheduler),
    manager: ProcessManager = Depends(get_process_manager),
    profile_activation: ProfileActivationService = Depends(get_profile_activation_service),
    thread_service: ThreadService = Depends(get_thread_service),
):
    try:
        model_name = body.model
        payload: dict[str, Any] = ChatRequestBody.model_validate(
            body.model_dump(exclude={"model", "stream", "thread_id", "request_type", "metadata", "tool_runtime"})
        ).model_dump()
        if body.tool_choice is not None:
            payload["tool_choice"] = body.tool_choice
        profile_headers: dict[str, str] = {}
        if config.mode != "controller":
            model_name, profile_headers = resolve_profile_model(model_name, payload, profile_activation)
        if body.tool_runtime == "agent" and config.mode == "agent":
            if not config.agent_tools.enabled:
                raise HTTPException(status_code=400, detail="agent tool runtime is not enabled")
            if body.stream:
                tool_payload = {**payload, "tools": ToolRegistry(config.agent_tools).openai_tools()}
                stream, headers = await scheduler.stream_with_meta(model_name, tool_payload)
                return StreamingResponse(
                    _agent_tool_detection_stream(stream),
                    media_type="text/event-stream",
                    headers={"X-Llama-Manager-Route": headers.get("route", "local"), **profile_headers},
                )
            with track_model_if_local(manager, model_name):
                response, headers = await AgentToolLoop(
                    config, scheduler, process_manager=manager, memory_store=getattr(request.app.state, "memory_store", None)
                ).run(model_name, payload)
            return JSONResponse(
                content=response,
                headers={"X-Llama-Manager-Route": headers.get("route", "local"), **profile_headers},
            )
        if body.stream:
            stream, headers = await controller_stream(
                request=request,
                config=config,
                service=thread_service,
                proxy=scheduler,
                model=model_name,
                messages=[message.model_dump() for message in body.messages],
                payload=payload,
                thread_id=body.thread_id,
                request_type=body.request_type,
                metadata=body.metadata,
                target=body.target,
            )
            if config.mode != "controller":
                stream = _track_stream(manager, model_name, stream)
            audit_external_chat_completion(
                request=request,
                endpoint="/v1/chat/completions",
                model=model_name,
                request_type=body.request_type,
                stream=True,
                headers=headers,
            )
            return StreamingResponse(
                stream,
                media_type="text/event-stream",
                headers={**headers, **profile_headers},
            )
        if config.mode != "controller":
            with track_model_if_local(manager, model_name):
                response, headers = await controller_chat(
                    request=request,
                    config=config,
                    service=thread_service,
                    proxy=scheduler,
                    model=model_name,
                    messages=[message.model_dump() for message in body.messages],
                    payload=payload,
                    thread_id=body.thread_id,
                    request_type=body.request_type,
                    metadata=body.metadata,
                    target=body.target,
                )
        else:
            response, headers = await controller_chat(
                request=request,
                config=config,
                service=thread_service,
                proxy=scheduler,
                model=model_name,
                messages=[message.model_dump() for message in body.messages],
                payload=payload,
                thread_id=body.thread_id,
                request_type=body.request_type,
                metadata=body.metadata,
                target=body.target,
            )
        audit_external_chat_completion(
            request=request,
            endpoint="/v1/chat/completions",
            model=model_name,
            request_type=body.request_type,
            stream=False,
            headers=headers,
        )
        return JSONResponse(content=response, headers={**headers, **profile_headers})
    except CompatChatHTTPError as exc:
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail}, headers=exc.headers)
    except ChatAdmissionError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise_proxy_http_exception(exc)


async def _track_stream(manager: ProcessManager, model_name: str, stream: AsyncIterator[bytes]) -> AsyncIterator[bytes]:
    with track_model_if_local(manager, model_name):
        async for chunk in stream:
            yield chunk


async def _agent_tool_detection_stream(stream: AsyncIterator[bytes]) -> AsyncIterator[bytes]:
    async for chunk in stream:
        for payload in extract_openai_sse_json(chunk):
            if stream_payload_has_tool_call(payload):
                event = {
                    "type": "tool_call",
                    "error": "streamed agent tool execution is not supported yet",
                }
                yield f"data: {json.dumps(event)}\n\n".encode()
                yield b"data: [DONE]\n\n"
                return
        yield chunk


def _client_auth_payload(request: Request) -> dict[str, str]:
    role = getattr(request.state, "ui_role", "")
    username = getattr(request.state, "ui_user", "")
    if role == "external":
        return {"method": "external_key", "role": role, "username": username}
    if role:
        return {"method": "ui_session", "role": role, "username": username}
    return {"method": "none", "role": "", "username": ""}


async def _client_safe_models(request: Request, registry: NodeRegistry | None = None) -> list[dict[str, Any]]:
    config = request.app.state.config
    models: dict[str, dict[str, Any]] = {}
    if config.mode == "controller":
        for node in config.nodes.values():
            if node.default_model:
                _ensure_client_model(models, node.default_model)
            for request_type, route in node.request_types.items():
                if route.model:
                    _ensure_client_model(models, route.model)["request_types"].add(request_type)
        await _merge_live_controller_models(models, registry or request.app.state.node_registry)
    else:
        for status in request.app.state.process_manager.list_statuses():
            name = str(status.get("name") or "")
            if name:
                entry = _ensure_client_model(models, name)
                entry["capabilities"] = _status_capabilities(status)

    return [
        {
            "id": model_id,
            "object": "model",
            "owned_by": "llama-pack",
            "metadata": _client_model_metadata(model_id, values),
        }
        for model_id, values in sorted(models.items())
    ]


async def _merge_live_controller_models(models: dict[str, dict[str, Any]], registry: NodeRegistry) -> None:
    for node in registry.list_nodes():
        if not node.get("heartbeat_fresh"):
            continue
        node_name = str(node.get("name") or "")
        if not node_name:
            continue
        try:
            statuses = await registry.request_node(node_name, "GET", "/lm-api/v1/models")
        except Exception:
            continue
        if not isinstance(statuses, list):
            continue
        for status in statuses:
            if not isinstance(status, dict):
                continue
            name = str(status.get("name") or "")
            if not name:
                continue
            entry = _ensure_client_model(models, name)
            entry["capabilities"].update(_status_capabilities(status))


def _status_capabilities(status: dict[str, Any]) -> dict[str, bool]:
    return {
        "streaming": True,
        "json_schema": bool(status.get("supports_json_schema")),
        "grammar": bool(status.get("supports_grammar")),
        "vision": bool(status.get("vision")),
    }


def _ensure_client_model(models: dict[str, dict[str, Any]], model_id: str) -> dict[str, Any]:
    if model_id not in models:
        models[model_id] = {
            "request_types": set(),
            "capabilities": {"streaming": True, "json_schema": False, "grammar": False, "vision": False},
        }
    return models[model_id]


def _client_model_metadata(model_id: str, values: dict[str, Any]) -> dict[str, Any]:
    request_types = sorted(values.get("request_types") or [])
    family, profile = _split_context_identity(model_id)
    return {
        "display_label": model_id,
        "request_types": request_types,
        "default_request_type": request_types[0] if request_types else None,
        "context_identity": model_id,
        "model_family": family,
        "context_profile": profile,
        "capabilities": dict(values.get("capabilities") or {}),
    }


def _split_context_identity(model_id: str) -> tuple[str, str | None]:
    family, separator, profile = model_id.partition(":")
    if not separator:
        return model_id, None
    return family, profile


def _diagnostic_payload(
    body: ClientChatDiagnosticsRequest,
    headers: dict[str, str],
    *,
    chat_ok: bool,
    streaming_ok: bool | None,
    error: dict[str, Any] | None = None,
) -> dict[str, Any]:
    route = _diagnostic_route(headers)
    route_resolved = route is not None
    checks = {
        "auth": True,
        "modelUsable": _diagnostic_model_usable(body, route, error),
        "routeResolved": route_resolved,
        "chat": chat_ok,
        "streaming": streaming_ok,
    }
    return {
        "ok": all(value is not False for value in checks.values()),
        "model": body.model,
        "requestType": body.request_type,
        "checks": checks,
        "route": route,
        "error": error,
    }


def _diagnostic_route(headers: dict[str, str]) -> dict[str, str] | None:
    route = headers.get("X-Llama-Manager-Route")
    node = headers.get("X-Llama-Manager-Node")
    model = headers.get("X-Llama-Manager-Model")
    if not route:
        return None
    payload = {"route": route}
    if node:
        payload["node"] = node
    if model:
        payload["model"] = model
    return payload


def _diagnostic_model_usable(
    body: ClientChatDiagnosticsRequest,
    route: dict[str, str] | None,
    error: dict[str, Any] | None,
) -> bool:
    if route is not None:
        return True
    if not error:
        return False
    detail = str(error.get("detail", "")).lower()
    return (
        "no eligible route" in detail
        or "no eligible running model" in detail
        or "not running" in detail
        or "unavailable" in detail
    )
