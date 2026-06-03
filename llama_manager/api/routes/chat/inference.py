from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse, StreamingResponse

from collections.abc import AsyncIterator

from llama_manager.api.dependencies import get_chat_proxy, get_chat_scheduler, get_process_manager, get_profile_activation_service
from llama_manager.api.routes.chat.common import (
    ChatRequestBody,
    EmbeddingsRequestBody,
    raise_proxy_http_exception,
    resolve_profile_model,
    track_model_if_local,
)
from llama_manager.core.chat.profile_activation import ProfileActivationService
from llama_manager.core.chat.proxy import ChatProxy
from llama_manager.core.chat.scheduler import ChatAdmissionError, ChatScheduler
from llama_manager.core.runtime.process_manager import ProcessManager


router = APIRouter(prefix="/chat")


@router.post("/{model_name}/embeddings")
async def chat_embeddings(
    model_name: str,
    body: EmbeddingsRequestBody,
    proxy: ChatProxy = Depends(get_chat_proxy),
):
    try:
        values = [body.input] if isinstance(body.input, str) else body.input
        payload, meta = await proxy.embeddings_with_meta(model_name, values, body.target)
        return JSONResponse(content=payload, headers={"X-Llama-Manager-Route": meta.get("route", "unknown")})
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
        return JSONResponse(content=payload, headers={"X-Llama-Manager-Route": meta.get("route", "unknown"), **profile_headers})
    except ChatAdmissionError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc
    except Exception as exc:
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
            headers={"X-Llama-Manager-Route": meta.get("route", "unknown"), **profile_headers},
        )
    except ChatAdmissionError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc
    except Exception as exc:
        raise_proxy_http_exception(exc)


async def _track_stream(manager: ProcessManager, model_name: str, stream: AsyncIterator[bytes]) -> AsyncIterator[bytes]:
    with track_model_if_local(manager, model_name):
        async for chunk in stream:
            yield chunk


def _add_admission_session(payload: dict, request: Request) -> None:
    session_id = getattr(request.state, "test_chat_visitor_id", None)
    if session_id:
        payload["_admission_session_id"] = session_id
