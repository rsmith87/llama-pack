from __future__ import annotations

import json
from typing import Any, Literal

from collections.abc import AsyncIterator

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field

from llama_manager.api.dependencies import get_chat_proxy, get_chat_scheduler, get_config, get_process_manager, get_profile_activation_service, get_thread_service
from llama_manager.api.routes.compat_chat import CompatChatHTTPError, controller_chat, controller_stream, extract_openai_sse_json, stream_payload_has_tool_call
from llama_manager.api.routes.external_usage_audit import audit_external_chat_completion
from llama_manager.core.agent_tools.registry import ToolRegistry
from llama_manager.api.routes.chat.common import (
    ChatMessage,
    ChatRequestBody,
    raise_proxy_http_exception,
    resolve_profile_model,
    track_model_if_local,
)
from llama_manager.core.chat.profile_activation import ProfileActivationService
from llama_manager.core.chat.proxy import ChatProxy
from llama_manager.core.chat.scheduler import ChatScheduler
from llama_manager.core.agent_tools.runtime import AgentToolLoop
from llama_manager.core.config import AppConfig
from llama_manager.core.runtime.process_manager import ProcessManager
from llama_manager.core.threads.service import ThreadService


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
                stream, headers = await proxy.stream_with_meta(model_name, tool_payload)
                return StreamingResponse(
                    _agent_tool_detection_stream(stream),
                    media_type="text/event-stream",
                    headers={"X-Llama-Manager-Route": headers.get("route", "local"), **profile_headers},
                )
            with track_model_if_local(manager, model_name):
                response, headers = await AgentToolLoop(
                    config, proxy, process_manager=manager, memory_store=getattr(request.app.state, "memory_store", None)
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
