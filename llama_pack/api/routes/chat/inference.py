from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse, StreamingResponse

from collections.abc import AsyncIterator

from llama_pack.api.http_headers import LEGACY_LLAMA_MANAGER_ROUTE_HEADER, LLAMA_PACK_ROUTE_HEADER
from llama_pack.api.dependencies import get_chat_proxy, get_chat_scheduler, get_config, get_node_registry, get_process_manager, get_profile_activation_service, get_thread_service
from llama_pack.api.routes.chat.common import (
    ChatRequestBody,
    EmbeddingsRequestBody,
    raise_context_budget_exception,
    raise_proxy_http_exception,
    resolve_profile_model,
    track_model_if_local,
)
from llama_pack.api.routes.compat_chat import compatibility_headers
from llama_pack.core.chat.profile_activation import ProfileActivationService
from llama_pack.core.chat.proxy import ChatProxy
from llama_pack.core.chat.scheduler import ChatAdmissionError, ChatScheduler
from llama_pack.core.config import AppConfig
from llama_pack.core.nodes.registry import NodeRegistry
from llama_pack.core.runtime.process_manager import ProcessManager
from llama_pack.core.threads.service import ThreadChatError, ThreadService


router = APIRouter(prefix="/chat")


def _route_headers(route: str, profile_headers: dict[str, str] | None = None) -> dict[str, str]:
    return {
        LLAMA_PACK_ROUTE_HEADER: route,
        LEGACY_LLAMA_MANAGER_ROUTE_HEADER: route,
        **(profile_headers or {}),
    }


@router.post("/{model_name}/embeddings")
async def chat_embeddings(
    model_name: str,
    body: EmbeddingsRequestBody,
    proxy: ChatProxy = Depends(get_chat_proxy),
):
    try:
        values = [body.input] if isinstance(body.input, str) else body.input
        payload, meta = await proxy.embeddings_with_meta(model_name, values, body.target)
        return JSONResponse(content=payload, headers=_route_headers(meta.get("route", "unknown")))
    except Exception as exc:
        raise_proxy_http_exception(exc)


@router.post("/{model_name}/inspect")
async def chat_inspect(
    model_name: str,
    body: ChatRequestBody,
    proxy: ChatProxy = Depends(get_chat_proxy),
):
    try:
        return proxy.inspect_prompt(model_name, body.model_dump())
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/{model_name}/context-budget")
async def chat_context_budget(
    model_name: str,
    body: ChatRequestBody,
    request: Request,
    config: AppConfig = Depends(get_config),
    node_registry: NodeRegistry = Depends(get_node_registry),
    profile_activation: ProfileActivationService = Depends(get_profile_activation_service),
    proxy: ChatProxy = Depends(get_chat_proxy),
    thread_service: ThreadService = Depends(get_thread_service),
):
    try:
        request_payload = body.model_dump()
        if config.mode == "controller":
            compat = await thread_service.prepare_compat_chat_async(
                thread_id=None,
                messages=[message.model_dump() for message in body.messages],
                model=model_name,
                model_family=body.model_family,
                context_profile=body.context_profile,
                target=body.target,
                metadata={"request_type": body.request_type} if body.request_type else {},
                created_by=getattr(request.state, "ui_user", None),
            )
            upstream_payload = {**request_payload, "target": compat["target"]}
            return JSONResponse(
                content=await node_registry.request_node(
                    str(compat["route"]["node"]),
                    "POST",
                    f"/lm-api/v1/chat/{compat['model']}/context-budget",
                    upstream_payload,
                ),
                headers=compatibility_headers(compat["thread_id"], compat["route"]),
            )
        resolved_model, _ = resolve_profile_model(model_name, request_payload, profile_activation)
        return proxy.context_budget(resolved_model, request_payload)
    except ThreadChatError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/capabilities/{model_name}")
async def chat_capabilities(
    model_name: str,
    proxy: ChatProxy = Depends(get_chat_proxy),
):
    try:
        return proxy.capabilities(model_name)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/{model_name}")
async def chat(
    model_name: str,
    body: ChatRequestBody,
    request: Request,
    scheduler: ChatScheduler = Depends(get_chat_scheduler),
    manager: ProcessManager = Depends(get_process_manager),
    profile_activation: ProfileActivationService = Depends(get_profile_activation_service),
):
    try:
        request_payload = body.model_dump()
        _add_admission_session(request_payload, request)
        resolved_model, profile_headers = resolve_profile_model(model_name, request_payload, profile_activation)
        with track_model_if_local(manager, resolved_model):
            payload, meta = await scheduler.chat_with_meta(resolved_model, request_payload)
        return JSONResponse(content=payload, headers=_route_headers(meta.get("route", "unknown"), profile_headers))
    except ChatAdmissionError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc
    except Exception as exc:
        raise_context_budget_exception(exc)
        raise_proxy_http_exception(exc)


@router.post("/{model_name}/stream")
async def chat_stream(
    model_name: str,
    body: ChatRequestBody,
    request: Request,
    scheduler: ChatScheduler = Depends(get_chat_scheduler),
    manager: ProcessManager = Depends(get_process_manager),
    profile_activation: ProfileActivationService = Depends(get_profile_activation_service),
):
    try:
        request_payload = body.model_dump()
        _add_admission_session(request_payload, request)
        resolved_model, profile_headers = resolve_profile_model(model_name, request_payload, profile_activation)
        stream, meta = await scheduler.stream_with_meta(resolved_model, request_payload)
        return StreamingResponse(
            _track_stream(manager, resolved_model, stream),
            media_type="text/event-stream",
            headers=_route_headers(meta.get("route", "unknown"), profile_headers),
        )
    except ChatAdmissionError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc
    except Exception as exc:
        raise_context_budget_exception(exc)
        raise_proxy_http_exception(exc)


async def _track_stream(manager: ProcessManager, model_name: str, stream: AsyncIterator[bytes]) -> AsyncIterator[bytes]:
    with track_model_if_local(manager, model_name):
        async for chunk in stream:
            yield chunk


def _add_admission_session(payload: dict, request: Request) -> None:
    session_id = getattr(request.state, "test_chat_visitor_id", None)
    if session_id:
        payload["_admission_session_id"] = session_id
