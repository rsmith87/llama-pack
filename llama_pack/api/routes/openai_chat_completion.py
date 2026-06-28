from __future__ import annotations

import asyncio
import json
from collections.abc import AsyncIterator, Awaitable
from dataclasses import asdict
from typing import Any, Literal
from uuid import uuid4

from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field

from llama_pack.api.http_headers import LEGACY_LLAMA_MANAGER_ROUTE_HEADER, LLAMA_PACK_ROUTE_HEADER
from llama_pack.api.routes.chat.common import (
    ChatMessage,
    ChatRequestBody,
    raise_proxy_http_exception,
    resolve_profile_model,
    track_model_if_local,
)
from llama_pack.api.routes.compat_chat import (
    CompatChatHTTPError,
    controller_chat,
    controller_stream,
)
from llama_pack.api.routes.external_usage_audit import audit_external_chat_completion
from llama_pack.core.agent_tools.prompt_builder import PromptBuilder
from llama_pack.core.agent_tools.runtime import AgentToolLoop, MalformedToolCallArgumentsError
from llama_pack.core.agent_tools.tracing import RuntimeTraceRecorder
from llama_pack.core.chat.profile_activation import ProfileActivationService
from llama_pack.core.chat.proxy import ChatSummarizationError
from llama_pack.core.chat.scheduler import ChatAdmissionError, ChatScheduler
from llama_pack.core.code_graph.tools import ProjectGraphToolContext
from llama_pack.core.config import AppConfig
from llama_pack.core.config.models import AGENT_TOOL_MAX_ITERATIONS_LIMIT
from llama_pack.core.document_collections.service import DocumentCollectionService
from llama_pack.core.persistence.project_graph_store_orm import ProjectGraphStoreOrm
from llama_pack.core.persistence.project_store_orm import ProjectStoreOrm
from llama_pack.core.runtime.process_manager import ProcessManager
from llama_pack.core.threads.service import ThreadService


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
    agent_tool_max_iterations: int | None = Field(default=None, ge=1, le=AGENT_TOOL_MAX_ITERATIONS_LIMIT)
    project_id: str | None = None
    document_collection_ids: list[str] | None = Field(default=None, min_length=1, max_length=20)


class OpenAIChatCompletionService:
    def __init__(
        self,
        config: AppConfig,
        scheduler: ChatScheduler,
        manager: ProcessManager,
        profile_activation: ProfileActivationService,
        thread_service: ThreadService,
        project_store: ProjectStoreOrm,
        project_graph_store: ProjectGraphStoreOrm,
    ) -> None:
        self.config = config
        self.scheduler = scheduler
        self.manager = manager
        self.profile_activation = profile_activation
        self.thread_service = thread_service
        self.project_store = project_store
        self.project_graph_store = project_graph_store

    async def execute(self, body: OpenAIChatCompletionsRequest, request: Request) -> JSONResponse | StreamingResponse:
        try:
            return await self._execute(body, request)
        except CompatChatHTTPError as exc:
            return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail}, headers=exc.headers)
        except ChatAdmissionError as exc:
            raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc
        except MalformedToolCallArgumentsError as exc:
            return JSONResponse(status_code=502, content={"detail": _agent_tool_error_payload(exc)})
        except KeyError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        except Exception as exc:
            raise_proxy_http_exception(exc)

    async def _execute(self, body: OpenAIChatCompletionsRequest, request: Request) -> JSONResponse | StreamingResponse:
        model_name = body.model
        payload: dict[str, Any] = ChatRequestBody.model_validate(
            body.model_dump(
                exclude={
                    "model",
                    "stream",
                    "thread_id",
                    "request_type",
                    "metadata",
                    "agent_tool_max_iterations",
                    "document_collection_ids",
                }
            )
        ).model_dump()
        if body.tool_runtime is not None:
            payload["tool_runtime"] = body.tool_runtime
        if body.tool_choice is not None:
            payload["tool_choice"] = body.tool_choice
        if body.agent_tool_max_iterations is not None:
            payload["agent_tool_max_iterations"] = body.agent_tool_max_iterations
        if body.project_id is not None:
            payload["project_id"] = body.project_id
        document_citations: list[dict[str, object]]
        payload, document_citations = apply_document_collection_context(
            payload=payload,
            document_collection_ids=body.document_collection_ids,
            document_collection_service=getattr(request.app.state, "document_collection_service", None),
        )
        profile_headers: dict[str, str] = {}
        if self.config.mode != "controller":
            model_name, profile_headers = resolve_profile_model(model_name, payload, self.profile_activation)
        if body.tool_runtime == "agent" and self.config.mode == "agent":
            return await self._execute_agent_tool_chat(body, request, model_name, payload, profile_headers)
        if body.stream:
            return await self._execute_stream_chat(body, request, model_name, payload, profile_headers)
        return await self._execute_non_stream_chat(body, request, model_name, payload, document_citations, profile_headers)

    async def _execute_agent_tool_chat(
        self,
        body: OpenAIChatCompletionsRequest,
        request: Request,
        model_name: str,
        payload: dict[str, Any],
        profile_headers: dict[str, str],
    ) -> JSONResponse | StreamingResponse:
        if not self.config.agent_tools.enabled:
            raise HTTPException(status_code=400, detail="agent tool runtime is not enabled")
        project_graph_context = _project_graph_context(body.project_id, self.project_store, self.project_graph_store)
        payload = {
            **payload,
            "messages": PromptBuilder().build_agent_messages(
                payload["messages"],
                project_graph_enabled=project_graph_context is not None,
            ),
        }
        if body.stream:
            recorder = RuntimeTraceRecorder(trace_id=str(uuid4()), source="agent_tool_loop", scope="chat_completion")

            async def run_agent_loop() -> tuple[dict[str, Any], dict[str, Any]]:
                with track_model_if_local(self.manager, model_name):
                    return await AgentToolLoop(
                        self.config,
                        self.scheduler,
                        process_manager=self.manager,
                        memory_store=getattr(request.app.state, "memory_store", None),
                        trace_recorder=recorder,
                        project_graph_context=project_graph_context,
                    ).run(model_name, payload)

            return StreamingResponse(
                _agent_tool_progress_stream(recorder, run_agent_loop()),
                media_type="text/event-stream",
                headers={
                    LLAMA_PACK_ROUTE_HEADER: "local",
                    LEGACY_LLAMA_MANAGER_ROUTE_HEADER: "local",
                    **profile_headers,
                },
            )
        with track_model_if_local(self.manager, model_name):
            response, headers = await AgentToolLoop(
                self.config,
                self.scheduler,
                process_manager=self.manager,
                memory_store=getattr(request.app.state, "memory_store", None),
                project_graph_context=project_graph_context,
            ).run(model_name, payload)
        return JSONResponse(
            content=response,
            headers={
                LLAMA_PACK_ROUTE_HEADER: headers.get("route", "local"),
                LEGACY_LLAMA_MANAGER_ROUTE_HEADER: headers.get("route", "local"),
                **profile_headers,
            },
        )

    async def _execute_stream_chat(
        self,
        body: OpenAIChatCompletionsRequest,
        request: Request,
        model_name: str,
        payload: dict[str, Any],
        profile_headers: dict[str, str],
    ) -> StreamingResponse:
        stream, headers = await controller_stream(
            request=request,
            config=self.config,
            service=self.thread_service,
            proxy=self.scheduler,
            model=model_name,
            messages=[message.model_dump() for message in body.messages],
            payload=payload,
            thread_id=body.thread_id,
            request_type=body.request_type,
            metadata=body.metadata,
            target=body.target,
            include_thread_event=True,
        )
        if self.config.mode != "controller":
            stream = track_stream_for_local_model(self.manager, model_name, stream)
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

    async def _execute_non_stream_chat(
        self,
        body: OpenAIChatCompletionsRequest,
        request: Request,
        model_name: str,
        payload: dict[str, Any],
        document_citations: list[dict[str, object]],
        profile_headers: dict[str, str],
    ) -> JSONResponse:
        if self.config.mode != "controller":
            with track_model_if_local(self.manager, model_name):
                response, headers = await controller_chat(
                    request=request,
                    config=self.config,
                    service=self.thread_service,
                    proxy=self.scheduler,
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
                config=self.config,
                service=self.thread_service,
                proxy=self.scheduler,
                model=model_name,
                messages=[message.model_dump() for message in body.messages],
                payload=payload,
                thread_id=body.thread_id,
                request_type=body.request_type,
                metadata=body.metadata,
                target=body.target,
            )
        if document_citations:
            response_metadata = response.get("metadata")
            if not isinstance(response_metadata, dict):
                response_metadata = {}
            response_metadata["document_citations"] = document_citations
            response["metadata"] = response_metadata
        audit_external_chat_completion(
            request=request,
            endpoint="/v1/chat/completions",
            model=model_name,
            request_type=body.request_type,
            stream=False,
            headers=headers,
        )
        return JSONResponse(content=response, headers={**headers, **profile_headers})


def apply_document_collection_context(
    payload: dict[str, Any],
    document_collection_ids: list[str] | None,
    document_collection_service: DocumentCollectionService | None,
) -> tuple[dict[str, Any], list[dict[str, object]]]:
    if not document_collection_ids:
        return payload, []
    if document_collection_service is None:
        raise HTTPException(
            status_code=503,
            detail=(
                "Document Collections are unavailable because controller memory embeddings are not configured. "
                "Enable memory.embedding_model_path and run migrations."
            ),
        )
    query = _last_user_text(payload.get("messages"))
    if not query:
        return payload, []
    results = document_collection_service.search(query, document_collection_ids, top_k=5)
    if not results:
        return payload, []
    context_message = {
        "role": "system",
        "content": _render_document_collection_context([asdict(result) for result in results]),
    }
    messages = payload.get("messages")
    if not isinstance(messages, list):
        return payload, []
    return {**payload, "messages": [context_message, *messages]}, [asdict(result) for result in results]


def _last_user_text(messages: object) -> str:
    if not isinstance(messages, list):
        return ""
    for message in reversed(messages):
        if not isinstance(message, dict):
            continue
        if message.get("role") != "user":
            continue
        return _message_content_text(message.get("content")).strip()
    return ""


def _message_content_text(content: object) -> str:
    if isinstance(content, str):
        return content
    if not isinstance(content, list):
        return ""
    parts: list[str] = []
    for item in content:
        if isinstance(item, dict) and item.get("type") == "text":
            text = item.get("text")
            if isinstance(text, str):
                parts.append(text)
    return "\n".join(parts)


def _render_document_collection_context(citations: list[dict[str, object]]) -> str:
    lines = [
        "Relevant document collection context",
        "Use these excerpts only when they are relevant. Cite the bracketed source labels in the answer.",
    ]
    for index, citation in enumerate(citations, start=1):
        label = f"[D{index}]"
        collection_name = str(citation["collection_name"])
        filename = str(citation["filename"])
        chunk_index = int(citation["chunk_index"])
        text = str(citation["text"])
        lines.append(f"{label} {collection_name} / {filename} chunk {chunk_index}: {text}")
    return "\n".join(lines)


async def track_stream_for_local_model(manager: ProcessManager, model_name: str, stream: AsyncIterator[bytes]) -> AsyncIterator[bytes]:
    with track_model_if_local(manager, model_name):
        async for chunk in stream:
            yield chunk


async def _agent_tool_progress_stream(
    recorder: RuntimeTraceRecorder,
    runner: Awaitable[tuple[dict[str, Any], dict[str, Any]]],
) -> AsyncIterator[bytes]:
    async def run_and_close() -> tuple[dict[str, Any], dict[str, Any]]:
        try:
            return await runner
        finally:
            recorder.close()

    task = asyncio.create_task(run_and_close())
    async for event in recorder.stream():
        yield _agent_tool_sse({"type": "trace_event", **event})
    try:
        response, _headers = await task
    except Exception as exc:
        yield _agent_tool_sse(_agent_tool_error_payload(exc))
        yield b"data: [DONE]\n\n"
        return
    verification = _agent_tool_verification_payload(response)
    if verification is not None:
        yield _agent_tool_sse(verification)
    yield _agent_tool_sse({"type": "final", **response})
    yield b"data: [DONE]\n\n"


def _agent_tool_verification_payload(response: dict[str, Any]) -> dict[str, Any] | None:
    metadata = response.get("llama_pack")
    if not isinstance(metadata, dict):
        return None
    verification = metadata.get("verification")
    if not isinstance(verification, dict):
        return None
    return {"type": "verification", "llama_pack": {"verification": verification}}


def _agent_tool_error_payload(exc: Exception) -> dict[str, Any]:
    if isinstance(exc, MalformedToolCallArgumentsError):
        return {
            "type": "error",
            "error_type": "malformed_tool_call_arguments",
            "error": str(exc),
            "tool_name": exc.tool_name,
            "tool_call_id": exc.tool_call_id,
            "detail": exc.detail,
        }
    if isinstance(exc, ChatSummarizationError):
        return {
            "type": "error",
            "error_type": "chat_summarization_failed",
            "error": str(exc),
            "model": exc.model_name,
            "detail": exc.detail,
        }
    return {"type": "error", "error_type": "agent_tool_runtime_error", "error": str(exc)}


def _agent_tool_sse(payload: dict[str, Any]) -> bytes:
    return f"data: {json.dumps(payload)}\n\n".encode()


def _project_graph_context(
    project_id: str | None,
    project_store: ProjectStoreOrm,
    project_graph_store: ProjectGraphStoreOrm,
) -> ProjectGraphToolContext | None:
    if project_id is None:
        return None
    if project_store.get_project(project_id) is None:
        raise HTTPException(status_code=404, detail="Project not found")
    if project_graph_store.get_active_snapshot(project_id) is None:
        raise HTTPException(status_code=409, detail="Project graph is not indexed")
    return ProjectGraphToolContext(project_id=project_id, store=project_graph_store)
