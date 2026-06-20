from __future__ import annotations

import asyncio
import json
from typing import Any, Literal
from uuid import uuid4

from collections.abc import AsyncIterator, Awaitable

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, ConfigDict, Field, model_validator

from llama_pack.api.http_headers import (
    LEGACY_LLAMA_MANAGER_ROUTE_HEADER,
    LLAMA_PACK_ROUTE_HEADER,
    get_model_header,
    get_node_header,
    get_route_header,
)
from llama_pack.api.dependencies import get_chat_proxy, get_chat_scheduler, get_config, get_node_registry, get_process_manager, get_profile_activation_service, get_project_graph_store, get_project_store, get_thread_service
from llama_pack.api.routes.projects import (
    SAFE_ROOT_STATUSES,
    CreateProjectRequest,
    UpdateProjectRequest,
    UpsertProjectNodeRootRequest,
)
from llama_pack.api.routes.compat_chat import CompatChatHTTPError, controller_chat, controller_stream, extract_openai_sse_json, stream_payload_has_tool_call
from llama_pack.api.routes.external_usage_audit import audit_external_chat_completion
from llama_pack.core.agent_tools.registry import ToolRegistry
from llama_pack.core.agent_tools.prompt_builder import PromptBuilder
from llama_pack.core.agent_tools.tracing import RuntimeTraceRecorder
from llama_pack.core.code_graph.tools import ProjectGraphToolContext, project_graph_tool_definitions
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
from llama_pack.core.persistence.project_graph_store_orm import ProjectGraphStoreOrm
from llama_pack.core.persistence.project_store_orm import ProjectStoreOrm
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
    agent_tool_max_iterations: int | None = Field(default=None, ge=1, le=16)
    project_id: str | None = None


class ClientChatDiagnosticsRequest(BaseModel):
    model: str = Field(min_length=1)
    request_type: str | None = None
    stream: bool = False
    message: str = "Llama Pack client diagnostic: reply with ok."
    target: str = "auto"


class ProjectContextProject(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1)
    root: str | None = None


class ProjectContextPath(BaseModel):
    model_config = ConfigDict(extra="forbid")

    path: str = Field(min_length=1)
    content: str | None = None
    artifact_metadata: dict[str, str | int | float | bool | None] | None = None


class ProjectContextArtifact(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(min_length=1)
    kind: str = Field(min_length=1)
    path: str | None = None
    title: str | None = None
    metadata: dict[str, str | int | float | bool | None] = Field(default_factory=dict)


class ProjectContextRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    project_id: str | None = None
    project: ProjectContextProject | None = None
    selected_paths: list[ProjectContextPath] = Field(default_factory=list)
    artifacts: list[ProjectContextArtifact] = Field(default_factory=list)
    focused_path: str | None = None

    @model_validator(mode="after")
    def require_supplied_context(self) -> "ProjectContextRequest":
        for index, selected_path in enumerate(self.selected_paths):
            if selected_path.content is None and selected_path.artifact_metadata is None:
                raise ValueError(f"selected_paths[{index}] must include explicit content or saved artifact metadata")
        return self


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
            "projectContext": True,
        },
        "projectContext": _project_context_metadata(),
        "models": await _client_safe_models(request, registry),
    }


@router.post("/client/project-context/{action}")
async def openai_client_project_context(
    action: Literal["summarize_project", "summarize_path", "refresh_context_item"],
    body: ProjectContextRequest,
    config: AppConfig = Depends(get_config),
    project_store: ProjectStoreOrm = Depends(get_project_store),
    project_graph_store: ProjectGraphStoreOrm = Depends(get_project_graph_store),
):
    if action == "summarize_path":
        return _project_context_response(action, _summarize_path(body))
    if action == "refresh_context_item":
        return _project_context_response(action, _refresh_context_item(body, config, project_store, project_graph_store))
    return _project_context_response(action, _summarize_project(body))


@router.get("/client/projects")
async def openai_client_list_projects(
    config: AppConfig = Depends(get_config),
    store: ProjectStoreOrm = Depends(get_project_store),
):
    _require_controller_projects(config)
    return {"projects": store.list_projects(include_archived=False)}


@router.post("/client/projects", status_code=201)
async def openai_client_create_project(
    body: CreateProjectRequest,
    config: AppConfig = Depends(get_config),
    store: ProjectStoreOrm = Depends(get_project_store),
):
    _require_controller_projects(config)
    return store.create_project(name=body.name.strip(), root_hint=_clean_optional_string(body.root_hint))


@router.patch("/client/projects/{project_id}")
async def openai_client_update_project(
    project_id: str,
    body: UpdateProjectRequest,
    config: AppConfig = Depends(get_config),
    store: ProjectStoreOrm = Depends(get_project_store),
):
    _require_controller_projects(config)
    project = store.update_project(
        project_id=project_id,
        name=body.name.strip(),
        root_hint=_clean_optional_string(body.root_hint),
        archived=body.archived,
    )
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.get("/client/projects/{project_id}/node-roots")
async def openai_client_list_project_node_roots(
    project_id: str,
    config: AppConfig = Depends(get_config),
    store: ProjectStoreOrm = Depends(get_project_store),
):
    _require_controller_projects(config)
    roots = store.list_node_roots(project_id)
    if roots is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return {"node_roots": roots}


@router.put("/client/projects/{project_id}/node-roots")
async def openai_client_upsert_project_node_root(
    project_id: str,
    body: UpsertProjectNodeRootRequest,
    config: AppConfig = Depends(get_config),
    store: ProjectStoreOrm = Depends(get_project_store),
):
    _require_controller_projects(config)
    status = _validated_safe_root_status(body.safe_root_status)
    root = store.upsert_node_root(
        project_id=project_id,
        node_name=body.node_name.strip(),
        root_path=body.root_path.strip(),
        safe_root_status=status,
    )
    if root is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return root


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
                include_thread_event=False,
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
    project_store: ProjectStoreOrm = Depends(get_project_store),
    project_graph_store: ProjectGraphStoreOrm = Depends(get_project_graph_store),
):
    try:
        model_name = body.model
        payload: dict[str, Any] = ChatRequestBody.model_validate(
            body.model_dump(exclude={"model", "stream", "thread_id", "request_type", "metadata", "agent_tool_max_iterations"})
        ).model_dump()
        if body.tool_runtime is not None:
            payload["tool_runtime"] = body.tool_runtime
        if body.tool_choice is not None:
            payload["tool_choice"] = body.tool_choice
        if body.agent_tool_max_iterations is not None:
            payload["agent_tool_max_iterations"] = body.agent_tool_max_iterations
        if body.project_id is not None:
            payload["project_id"] = body.project_id
        profile_headers: dict[str, str] = {}
        if config.mode != "controller":
            model_name, profile_headers = resolve_profile_model(model_name, payload, profile_activation)
        if body.tool_runtime == "agent" and config.mode == "agent":
            if not config.agent_tools.enabled:
                raise HTTPException(status_code=400, detail="agent tool runtime is not enabled")
            project_graph_context = _project_graph_context(body.project_id, project_store, project_graph_store)
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
                    with track_model_if_local(manager, model_name):
                        return await AgentToolLoop(
                            config,
                            scheduler,
                            process_manager=manager,
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
            with track_model_if_local(manager, model_name):
                response, headers = await AgentToolLoop(
                    config,
                    scheduler,
                    process_manager=manager,
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
                include_thread_event=True,
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
        yield _agent_tool_sse({"type": "error", "error": str(exc)})
        yield b"data: [DONE]\n\n"
        return
    yield _agent_tool_sse({"type": "final", **response})
    yield b"data: [DONE]\n\n"


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


def _project_context_metadata() -> dict[str, object]:
    return {
        "actions": ["summarize_project", "summarize_path", "refresh_context_item"],
        "endpoint": "/v1/client/project-context/{action}",
        "inputPolicy": "explicit_user_selected_inputs_and_saved_artifact_metadata_only",
    }


def _project_context_response(action: str, summary: dict[str, object]) -> dict[str, object]:
    return {
        "action": action,
        "policy": "explicit_user_selected_inputs_and_saved_artifact_metadata_only",
        "summary": summary,
    }


def _summarize_project(body: ProjectContextRequest) -> dict[str, object]:
    return {
        "project": _project_payload(body.project),
        "selectedPathCount": len(body.selected_paths),
        "artifactCount": len(body.artifacts),
        "paths": [_path_summary(item) for item in body.selected_paths],
        "artifacts": [_artifact_payload(item) for item in body.artifacts],
    }


def _summarize_path(body: ProjectContextRequest) -> dict[str, object]:
    selected_path = _focused_or_first_path(body)
    return {
        "project": _project_payload(body.project),
        "path": _path_summary(selected_path),
        "artifacts": [_artifact_payload(item) for item in body.artifacts],
    }


def _refresh_context_item(
    body: ProjectContextRequest,
    config: AppConfig,
    project_store: ProjectStoreOrm,
    project_graph_store: ProjectGraphStoreOrm,
) -> dict[str, object]:
    selected_path = _focused_or_first_path(body)
    summary = {
        "project": _project_payload(body.project),
        "path": _path_summary(selected_path),
        "artifactCount": len(body.artifacts),
    }
    if body.project_id is None:
        return summary
    if selected_path.content is None:
        raise HTTPException(status_code=422, detail="refresh_context_item requires explicit content when project_id is provided")
    _require_controller_projects(config)
    if project_store.get_project(body.project_id) is None:
        raise HTTPException(status_code=404, detail="Project not found")
    artifact = project_graph_store.upsert_context_artifact(
        project_id=body.project_id,
        path=selected_path.path,
        kind="path_summary",
        title=_context_artifact_title(body.artifacts, selected_path.path),
        content=selected_path.content,
        metadata={"source_path": selected_path.path},
    )
    summary["artifactMetadata"] = _context_artifact_metadata_payload(artifact)
    return summary


def _project_payload(project: ProjectContextProject | None) -> dict[str, str | None] | None:
    if project is None:
        return None
    return {"name": project.name, "root": project.root}


def _clean_optional_string(value: str | None) -> str | None:
    if value is None:
        return None
    stripped = value.strip()
    return stripped if stripped else None


def _require_controller_projects(config: AppConfig) -> None:
    if config.mode != "controller":
        raise HTTPException(status_code=404, detail="Projects are only available from controller mode")


def _validated_safe_root_status(value: str) -> str:
    status = value.strip()
    if status not in SAFE_ROOT_STATUSES:
        expected = ", ".join(sorted(SAFE_ROOT_STATUSES))
        raise HTTPException(status_code=422, detail=f"safe_root_status must be one of: {expected}")
    return status


def _path_summary(selected_path: ProjectContextPath) -> dict[str, object]:
    payload: dict[str, object] = {"path": selected_path.path}
    if selected_path.content is not None:
        payload["characters"] = len(selected_path.content)
    if selected_path.artifact_metadata is not None:
        payload["artifactMetadata"] = dict(selected_path.artifact_metadata)
    return payload


def _artifact_payload(artifact: ProjectContextArtifact) -> dict[str, object]:
    return {
        "id": artifact.id,
        "kind": artifact.kind,
        "path": artifact.path,
        "title": artifact.title,
        "metadata": dict(artifact.metadata),
    }


def _context_artifact_title(artifacts: list[ProjectContextArtifact], path: str) -> str | None:
    for artifact in artifacts:
        if artifact.path == path or artifact.metadata.get("source_path") == path:
            return artifact.title
    return None


def _context_artifact_metadata_payload(artifact: dict[str, object]) -> dict[str, object]:
    return {
        "artifact_id": artifact["id"],
        "project_id": artifact["project_id"],
        "path": artifact["path"],
        "kind": artifact["kind"],
        "title": artifact["title"],
        "content_hash": artifact["content_hash"],
        "size_bytes": artifact["size_bytes"],
        "updated_at": artifact["updated_at"],
    }


def _focused_or_first_path(body: ProjectContextRequest) -> ProjectContextPath:
    if not body.selected_paths:
        raise HTTPException(status_code=422, detail="selected_paths must include at least one explicit context item")
    if body.focused_path is None:
        return body.selected_paths[0]
    for selected_path in body.selected_paths:
        if selected_path.path == body.focused_path:
            return selected_path
    raise HTTPException(status_code=422, detail=f"focused_path is not present in selected_paths: {body.focused_path}")


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
    route = get_route_header(headers)
    node = get_node_header(headers)
    model = get_model_header(headers)
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
