from __future__ import annotations

import asyncio
import secrets
from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import asynccontextmanager
from typing import Any

from datetime import UTC, datetime
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, Response

from llama_pack.api.routes import (
    audit,
    auth,
    benchmarks,
    chat,
    client_discovery,
    conversions,
    document_collections,
    downloads,
    external_keys,
    health,
    jobs,
    library,
    memory,
    models,
    node_work,
    nodes,
    offline,
    ollama_compat,
    openai_compat,
    ocr,
    plugins,
    projects,
    quantizations,
    runtime,
    settings,
    setup,
    threads,
    transfers,
    ui,
)
from llama_pack.api.http_headers import get_request_api_key, request_api_key_headers, response_route_headers
from llama_pack.core.config import AppConfig, load_config
from llama_pack.core.model_assets.conversions import ConversionManager
from llama_pack.core.model_assets.library import GgufLibrary
from llama_pack.core.runtime.process_manager import ProcessManager
from llama_pack.core.model_assets.quantizations import QuantizationManager
from llama_pack.core.app.auth_policy import (
    is_external_key_forbidden,
    is_test_chat_key_forbidden,
    is_viewer_forbidden,
    should_allow_first_run_setup,
    should_bypass_middleware,
    should_enforce_agent_key,
    should_validate_ui_session,
)
from llama_pack.core.app.state import AppStateRequestBindings, ModelManagerBindings, configure_app_state
from llama_pack.core.plugins.registry import PluginRecord
import logging

logger = logging.getLogger(__name__)

LM_API_PREFIX = "/lm-api/v1"


async def _controller_sweeper_loop(app: FastAPI, interval_seconds: int = 15) -> None:
    stop_event: asyncio.Event = app.state.controller_sweeper_stop_event
    while not stop_event.is_set():
        orchestrator = app.state.orchestrator
        if orchestrator is not None and orchestrator.try_acquire_leader_lease():
            orchestrator.sweep_expired_leases()
        try:
            await asyncio.wait_for(stop_event.wait(), timeout=interval_seconds)
        except TimeoutError:
            continue


async def _run_plugin_lifecycle_callback(callback: Callable[[Any], Any], app: FastAPI) -> None:
    result = callback(app)
    if asyncio.iscoroutine(result) or isinstance(result, Awaitable):
        await result


async def _start_plugin_background_tasks(app: FastAPI, record: PluginRecord) -> None:
    if record.status != "enabled":
        return
    for task in record.background_tasks:
        if task.running:
            continue
        await _run_plugin_lifecycle_callback(task.start, app)
        task.running = True


async def _stop_plugin_background_tasks(app: FastAPI, record: PluginRecord) -> None:
    stop_error: BaseException | None = None
    for task in reversed(record.background_tasks):
        if not task.running:
            continue
        try:
            await _run_plugin_lifecycle_callback(task.stop, app)
        except BaseException as exc:
            if stop_error is None:
                stop_error = exc
        finally:
            task.running = False
    if stop_error is not None:
        raise stop_error


async def _start_enabled_plugin_background_tasks(app: FastAPI) -> None:
    for record in app.state.plugin_registry.records.values():
        await _start_plugin_background_tasks(app, record)


async def _stop_all_plugin_background_tasks(app: FastAPI) -> None:
    stop_error: BaseException | None = None
    for record in reversed(list(app.state.plugin_registry.records.values())):
        try:
            await _stop_plugin_background_tasks(app, record)
        except BaseException as exc:
            if stop_error is None:
                stop_error = exc
    if stop_error is not None:
        raise stop_error


def _configure_app_state(
    app: FastAPI,
    app_config: AppConfig,
    process_manager: ProcessManager | None,
    conversion_manager: ConversionManager | None,
    quantization_manager: QuantizationManager | None,
    gguf_library: GgufLibrary | None,
    controller_request: Callable[[str, str, str | None, bool, dict[str, Any] | None], Awaitable[dict[str, Any]]] | None,
    chat_request: Callable[[str, dict[str, Any]], Awaitable[dict[str, Any]]] | None,
    chat_stream_request: Callable[[str, dict[str, Any]], AsyncIterator[bytes]] | None,
    heartbeat_request: Callable[[str, str, dict[str, Any] | None], Awaitable[dict[str, Any]]] | None,
) -> None:
    configure_app_state(
        app,
        app_config,
        AppStateRequestBindings(
            controller_request=controller_request,
            chat_request=chat_request,
            chat_stream_request=chat_stream_request,
            heartbeat_request=heartbeat_request,
        ),
        ModelManagerBindings(
            process_manager=process_manager,
            conversion_manager=conversion_manager,
            quantization_manager=quantization_manager,
            gguf_library=gguf_library,
        ),
    )
    app.state.start_plugin_background_tasks = lambda record: _start_plugin_background_tasks(app, record)
    app.state.stop_plugin_background_tasks = lambda record: _stop_plugin_background_tasks(app, record)


def _register_routers(app: FastAPI, app_config: AppConfig) -> None:
    app.include_router(ui.router)
    app.include_router(plugins.assets_router)
    app.mount("/ui", ui.static_app, name="ui")
    app.include_router(health.router)  # /health stays at root for Docker/orchestration compat
    app.include_router(health.router, prefix=LM_API_PREFIX)  # /lm-api/v1/health alias
    app.include_router(client_discovery.router, prefix=LM_API_PREFIX)
    app.include_router(models.router, prefix=LM_API_PREFIX)
    app.include_router(chat.router, prefix=LM_API_PREFIX)
    app.include_router(openai_compat.router)
    app.include_router(ollama_compat.router)
    app.include_router(ocr.router, prefix=LM_API_PREFIX)
    app.include_router(conversions.router, prefix=LM_API_PREFIX)
    app.include_router(downloads.router, prefix=LM_API_PREFIX)
    app.include_router(offline.router, prefix=LM_API_PREFIX)
    app.include_router(quantizations.router, prefix=LM_API_PREFIX)
    app.include_router(runtime.router, prefix=LM_API_PREFIX)
    app.include_router(settings.router, prefix=LM_API_PREFIX)
    app.include_router(setup.router, prefix=LM_API_PREFIX)
    app.include_router(library.router, prefix=LM_API_PREFIX)
    app.include_router(transfers.router, prefix=LM_API_PREFIX)
    app.include_router(nodes.router, prefix=LM_API_PREFIX)
    app.include_router(audit.router, prefix=LM_API_PREFIX)
    app.include_router(auth.router, prefix=LM_API_PREFIX)
    app.include_router(external_keys.router, prefix=LM_API_PREFIX)
    app.include_router(ui.api_router, prefix=LM_API_PREFIX)
    app.include_router(plugins.router, prefix=LM_API_PREFIX)
    app.include_router(threads.router, prefix=LM_API_PREFIX)
    app.state.plugin_routers_included = set()
    for record in app.state.plugin_registry.records.values():
        if record.status != "enabled":
            continue
        for route_prefix, router in record.routers:
            app.include_router(router, prefix=f"{LM_API_PREFIX}/plugins{route_prefix}")
            app.state.plugin_routers_included.add((record.id, route_prefix))
    if app_config.mode == "controller":
        app.include_router(benchmarks.router, prefix=LM_API_PREFIX)
        app.include_router(projects.router, prefix=LM_API_PREFIX)
        app.include_router(document_collections.router, prefix=LM_API_PREFIX)
        app.include_router(jobs.router, prefix=LM_API_PREFIX)
        app.include_router(node_work.router, prefix=LM_API_PREFIX)
        app.include_router(memory.router, prefix=LM_API_PREFIX)


def _register_middleware(app: FastAPI) -> None:
    cors_methods = ["GET", "POST", "OPTIONS"]
    cors_headers = ["Content-Type", "X-UI-Session", *request_api_key_headers()]
    cors_exposed_headers = response_route_headers()

    @app.middleware("http")
    async def enforce_plugin_activation(request: Request, call_next):
        path = request.url.path
        prefix = f"{LM_API_PREFIX}/plugins/"
        if path.startswith(prefix):
            remainder = path[len(prefix) :]
            plugin_id, _, plugin_path = remainder.partition("/")
            management_paths = {"activate", "deactivate", "migrations/status"}
            if plugin_id not in {"enabled", "status"} and plugin_path not in management_paths:
                record = app.state.plugin_registry.records.get(plugin_id)
                if record is None or record.status != "enabled":
                    return JSONResponse({"detail": "Not Found"}, status_code=404)
        return await call_next(request)

    @app.middleware("http")
    async def enforce_agent_api_key(request: Request, call_next):
        path = request.url.path
        method = request.method
        if should_bypass_middleware(path, method):
            return await call_next(request)

        configured = app.state.config.agent_api_key
        auth_store = app.state.auth_store
        provided_key = get_request_api_key(request.headers)
        if not provided_key:
            test_chat_token = request.cookies.get(ui.TEST_CHAT_SESSION_COOKIE) or ""
            test_chat_session = app.state.test_chat_sessions.get(test_chat_token)
            if test_chat_session:
                expires_at = test_chat_session.get("expires_at")
                if expires_at and datetime.now(UTC) <= datetime.fromisoformat(expires_at):
                    provided_key = test_chat_session.get("api_key", "")
                    request.state.test_chat_visitor_id = test_chat_token
                else:
                    app.state.test_chat_sessions.pop(test_chat_token, None)
        resolved_key = auth_store.resolve_key(provided_key) if provided_key else None
        configured_key_ok = bool(configured and provided_key and secrets.compare_digest(provided_key, configured))

        if resolved_key is not None:
            request.state.ui_key_id = resolved_key.get("id")
            request.state.ui_account_id = resolved_key.get("id")
            request.state.ui_user = resolved_key.get("username", "api-key")
            request.state.ui_role = resolved_key.get("role", "operator")
            if is_viewer_forbidden(path, request.state.ui_role):
                return JSONResponse(status_code=403, content={"detail": "Forbidden"})
            if is_external_key_forbidden(path, method, request.state.ui_role):
                return JSONResponse(status_code=403, content={"detail": "Forbidden"})
            if request.state.ui_role == "test_chat" and is_test_chat_key_forbidden(path, method):
                return JSONResponse(status_code=403, content={"detail": "Forbidden"})
            return await call_next(request)

        if configured_key_ok:
            request.state.ui_account_id = None
            request.state.ui_user = "agent-api-key"
            request.state.ui_role = "admin"
            return await call_next(request)

        auth_enabled = bool(configured or auth_store.has_active_keys())
        if should_validate_ui_session(auth_enabled, method):
            token = request.headers.get("X-UI-Session")
            session = app.state.ui_sessions.get(token or "")
            if not session:
                return JSONResponse(status_code=401, content={"detail": "Unauthorized"})
            expires_at = session.get("expires_at")
            if expires_at and datetime.now(UTC) > datetime.fromisoformat(expires_at):
                app.state.ui_sessions.pop(token, None)
                return JSONResponse(status_code=401, content={"detail": "Session expired"})
            request.state.ui_account_id = session.get("key_id")
            request.state.ui_key_id = session.get("key_id")
            request.state.ui_user = session["username"]
            request.state.ui_role = session.get("role", "operator")
            if is_viewer_forbidden(path, request.state.ui_role):
                return JSONResponse(status_code=403, content={"detail": "Forbidden"})
            return await call_next(request)

        if not auth_enabled and should_allow_first_run_setup(path, method):
            return await call_next(request)
        if not auth_enabled:
            return JSONResponse(status_code=401, content={"detail": "Auth bootstrap required"})
        if not should_enforce_agent_key(app.state.config.mode, configured, path):
            return await call_next(request)
        return JSONResponse(status_code=401, content={"detail": "Unauthorized"})

    @app.middleware("http")
    async def apply_dynamic_cors(request: Request, call_next):
        origin = request.headers.get("origin")
        allowed_origins = set(app.state.config.client_cors_origins)
        if origin and origin in allowed_origins and request.method == "OPTIONS":
            response = Response(status_code=200)
            _apply_cors_headers(response, origin, cors_methods, cors_headers, cors_exposed_headers)
            return response

        response = await call_next(request)
        if origin and origin in allowed_origins:
            _apply_cors_headers(response, origin, cors_methods, cors_headers, cors_exposed_headers)
        return response


def _apply_cors_headers(
    response: Response,
    origin: str,
    methods: list[str],
    headers: list[str],
    exposed_headers: list[str],
) -> None:
    response.headers["Access-Control-Allow-Origin"] = origin
    response.headers["Access-Control-Allow-Credentials"] = "true"
    response.headers["Access-Control-Allow-Methods"] = ", ".join(methods)
    response.headers["Access-Control-Allow-Headers"] = ", ".join(headers)
    response.headers["Access-Control-Expose-Headers"] = ", ".join(exposed_headers)
    response.headers["Vary"] = _append_vary_origin(response.headers.get("Vary", ""))


def _append_vary_origin(value: str) -> str:
    parts = [part.strip() for part in value.split(",") if part.strip()]
    if "Origin" not in parts:
        parts.append("Origin")
    return ", ".join(parts)


def _register_lifespan(app: FastAPI) -> None:
    @asynccontextmanager
    async def lifespan(_app: FastAPI):
        try:
            await app.state.heartbeat_client.start()
            await app.state.agent_worker.start()
            await _start_enabled_plugin_background_tasks(app)
            if app.state.config.mode == "controller" and app.state.orchestrator is not None:
                app.state.controller_sweeper_stop_event.clear()
                app.state.controller_sweeper_task = asyncio.create_task(
                    _controller_sweeper_loop(
                        app, interval_seconds=app.state.controller_sweeper_interval_seconds
                    )
                )
            yield
        finally:
            plugin_stop_error: BaseException | None = None
            try:
                await _stop_all_plugin_background_tasks(app)
            except BaseException as exc:
                plugin_stop_error = exc
            finally:
                sweeper_task = app.state.controller_sweeper_task
                if sweeper_task is not None:
                    app.state.controller_sweeper_stop_event.set()
                    await sweeper_task
                    app.state.controller_sweeper_task = None
                await app.state.agent_worker.stop()
                await app.state.heartbeat_client.stop()
            if plugin_stop_error is not None:
                raise plugin_stop_error

    app.router.lifespan_context = lifespan


def create_app(
    config: AppConfig | None = None,
    process_manager: ProcessManager | None = None,
    conversion_manager: ConversionManager | None = None,
    quantization_manager: QuantizationManager | None = None,
    gguf_library: GgufLibrary | None = None,
    controller_request: Callable[[str, str, str | None, bool, dict[str, Any] | None], Awaitable[dict[str, Any]]] | None = None,
    chat_request: Callable[[str, dict[str, Any]], Awaitable[dict[str, Any]]] | None = None,
    chat_stream_request: Callable[[str, dict[str, Any]], AsyncIterator[bytes]] | None = None,
    heartbeat_request: Callable[[str, str, dict[str, Any] | None], Awaitable[dict[str, Any]]] | None = None,
) -> FastAPI:
    app_config = config or load_config()
    app = FastAPI(title="Llama Pack", version="0.1.0")
    _configure_app_state(
        app,
        app_config,
        process_manager,
        conversion_manager,
        quantization_manager,
        gguf_library,
        controller_request,
        chat_request,
        chat_stream_request,
        heartbeat_request,
    )
    _register_routers(app, app_config)
    _register_middleware(app)
    _register_lifespan(app)
    return app


def _create_module_app() -> FastAPI:
    try:
        return create_app()
    except RuntimeError as exc:
        app = FastAPI(title="Llama Pack", version="0.1.0")
        message = str(exc)

        def _startup_error_response() -> JSONResponse:
            return JSONResponse(
                status_code=503,
                content={"status": "error", "detail": message},
            )

        @app.get("/", include_in_schema=False)
        async def _root_unavailable():
            return _startup_error_response()

        @app.get("/health")
        async def _health_unavailable():
            return _startup_error_response()

        @app.get(f"{LM_API_PREFIX}/health")
        async def _health_prefixed_unavailable():
            return _startup_error_response()

        return app


app = _create_module_app()
