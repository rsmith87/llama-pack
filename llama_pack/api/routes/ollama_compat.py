from __future__ import annotations

from collections.abc import AsyncIterator
import json
from typing import Any

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field

from llama_pack.api.dependencies import get_chat_scheduler, get_config, get_process_manager, get_profile_activation_service, get_thread_service
from llama_pack.api.routes.chat.common import ChatMessage, raise_proxy_http_exception, resolve_profile_model, track_model_if_local
from llama_pack.api.routes.compat_chat import CompatChatHTTPError, controller_chat, controller_stream, extract_openai_sse_content
from llama_pack.api.routes.external_usage_audit import audit_external_chat_completion
from llama_pack.core.chat.profile_activation import ProfileActivationService
from llama_pack.core.chat.scheduler import ChatScheduler
from llama_pack.core.config import AppConfig
from llama_pack.core.runtime.process_manager import ProcessManager
from llama_pack.core.threads.service import ThreadService


router = APIRouter(prefix="/api")


class OllamaChatRequest(BaseModel):
    model: str = Field(min_length=1)
    messages: list[ChatMessage] = Field(min_length=1)
    stream: bool = True
    format: str | dict[str, Any] | None = None
    options: dict[str, Any] = Field(default_factory=dict)
    keep_alive: str | int | None = None
    target: str = "auto"
    thread_id: str | None = None
    request_type: str | None = None
    metadata: dict[str, Any] | None = None
    model_family: str | None = None
    context_profile: str | None = None


@router.post("/chat")
async def ollama_chat(
    body: OllamaChatRequest,
    request: Request,
    config: AppConfig = Depends(get_config),
    scheduler: ChatScheduler = Depends(get_chat_scheduler),
    manager: ProcessManager = Depends(get_process_manager),
    profile_activation: ProfileActivationService = Depends(get_profile_activation_service),
    thread_service: ThreadService = Depends(get_thread_service),
):
    payload = _ollama_payload(body)
    messages = [message.model_dump() for message in body.messages]
    try:
        model_name = body.model
        profile_headers: dict[str, str] = {}
        if config.mode != "controller":
            model_name, profile_headers = resolve_profile_model(model_name, payload, profile_activation)
        if body.stream:
            stream, headers = await controller_stream(
                request=request,
                config=config,
                service=thread_service,
                proxy=scheduler,
                model=model_name,
                messages=messages,
                payload=payload,
                thread_id=body.thread_id,
                request_type=body.request_type,
                metadata=body.metadata,
                target=body.target,
                include_thread_event=False,
            )
            if config.mode != "controller":
                stream = _track_stream(manager, model_name, stream)
            audit_external_chat_completion(
                request=request,
                endpoint="/api/chat",
                model=model_name,
                request_type=body.request_type,
                stream=True,
                headers=headers,
            )
            return StreamingResponse(
                _ollama_stream(model_name, stream),
                media_type="application/x-ndjson",
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
                    messages=messages,
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
                messages=messages,
                payload=payload,
                thread_id=body.thread_id,
                request_type=body.request_type,
                metadata=body.metadata,
                target=body.target,
            )
        audit_external_chat_completion(
            request=request,
            endpoint="/api/chat",
            model=model_name,
            request_type=body.request_type,
            stream=False,
            headers=headers,
        )
        return JSONResponse(
            content={
                "model": model_name,
                "message": {
                    "role": "assistant",
                    "content": _assistant_content(response),
                },
                "done": True,
            },
            headers={**headers, **profile_headers},
        )
    except CompatChatHTTPError as exc:
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail}, headers=exc.headers)
    except Exception as exc:
        raise_proxy_http_exception(exc)


def _ollama_payload(body: OllamaChatRequest) -> dict[str, Any]:
    payload: dict[str, Any] = {"messages": [message.model_dump() for message in body.messages]}
    if body.model_family:
        payload["model_family"] = body.model_family
    if body.context_profile:
        payload["context_profile"] = body.context_profile
    if body.target:
        payload["target"] = body.target
    options = body.options or {}
    mapping = {
        "temperature": "temperature",
        "num_predict": "max_tokens",
        "top_p": "top_p",
        "top_k": "top_k",
        "min_p": "min_p",
        "repeat_penalty": "repeat_penalty",
        "seed": "seed",
        "stop": "stop",
    }
    for source, target in mapping.items():
        if source in options and options[source] is not None:
            payload[target] = options[source]
    if body.format == "json":
        payload["json_schema"] = {}
    return payload


async def _track_stream(manager: ProcessManager, model_name: str, stream: AsyncIterator[bytes]) -> AsyncIterator[bytes]:
    with track_model_if_local(manager, model_name):
        async for chunk in stream:
            yield chunk


async def _ollama_stream(model: str, stream: AsyncIterator[bytes]) -> AsyncIterator[bytes]:
    async for chunk in stream:
        emitted = False
        for content in extract_openai_sse_content(chunk):
            emitted = True
            yield _json_line({"model": model, "message": {"role": "assistant", "content": content}, "done": False})
        if b"data: [DONE]" in chunk:
            emitted = True
            yield _json_line({"model": model, "message": {"role": "assistant", "content": ""}, "done": True})
        if not emitted:
            yield chunk


def _assistant_content(response: dict[str, Any]) -> str:
    try:
        content = response["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError):
        return ""
    return content if isinstance(content, str) else str(content)


def _json_line(payload: dict[str, Any]) -> bytes:
    return (json.dumps(payload, separators=(",", ":")) + "\n").encode("utf-8")
