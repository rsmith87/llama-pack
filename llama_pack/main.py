from __future__ import annotations

import asyncio
import secrets
from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import asynccontextmanager
from pathlib import Path
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
    downloads,
    external_keys,
    health,
    jobs,
    library,
    memory,
    models,
    node_work,
    nodes,
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
from llama_pack.core.chat.proxy import ChatProxy
from llama_pack.core.chat.scheduler import ChatScheduler
from llama_pack.core.chat.slot_allocator import ChatSlotAllocator
from llama_pack.core.memory.store import ChromaMemoryStore
from llama_pack.core.nodes.heartbeat import AgentHeartbeatClient
from llama_pack.core.model_assets.conversions import ConversionManager
from llama_pack.core.model_assets.catalog_service import ModelCatalogService
from llama_pack.core.model_assets.library import GgufLibrary
from llama_pack.core.model_assets.models_db import ModelAssetInventoryService
from llama_pack.core.model_assets.downloads import DownloadManager
from llama_pack.core.model_assets.transfers import TransferManager
from llama_pack.core.nodes.registry import NodeRegistry
from llama_pack.core.runtime.process_manager import ProcessManager
from llama_pack.core.model_assets.quantizations import QuantizationManager
from llama_pack.core.orchestration.store_orm import OrchestrationStoreOrm
from llama_pack.core.orchestration.repo import OrchestrationRepo
from llama_pack.core.orchestration.orchestrator import Orchestrator
from llama_pack.core.threads.service import ThreadService
from llama_pack.core.threads.store import ThreadStore
from llama_pack.core.nodes.worker import AgentWorker
from llama_pack.storage.db import InMemoryStore, JsonFileStore
from llama_pack.core.persistence.chat_session_store_orm import ChatSessionStoreOrm
from llama_pack.core.persistence.audit_store_orm import AuditStoreOrm
from llama_pack.core.persistence.auth_store_orm import AuthStoreOrm
from llama_pack.core.persistence.benchmark_store_orm import BenchmarkStoreOrm
from llama_pack.core.persistence.db_infra import default_state_dir, resolve_persistence_urls, sqlite_path_from_url
from llama_pack.core.persistence.model_download_store_orm import ModelDownloadStoreOrm
from llama_pack.core.persistence.model_asset_store_orm import ModelAssetStoreOrm
from llama_pack.core.persistence.settings_store_orm import SettingsStoreOrm
from llama_pack.core.persistence.project_store_orm import ProjectStoreOrm
from llama_pack.core.persistence.project_graph_store_orm import ProjectGraphStoreOrm
from llama_pack.core.code_graph.indexer import ProjectGraphIndexer
from llama_pack.core.settings.runtime import RuntimeSettingsService
from llama_pack.core.benchmarks.runner import BenchmarkRunner
from llama_pack.core.app.auth_policy import (
    is_external_key_forbidden,
    is_test_chat_key_forbidden,
    is_viewer_forbidden,
    should_allow_first_run_setup,
    should_bypass_middleware,
    should_enforce_agent_key,
    should_validate_ui_session,
)
from llama_pack.core.plugins import load_plugins
from llama_pack.core.ocr import create_ocr_service

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


def _build_orchestrator(config: AppConfig) -> Orchestrator | None:
    if config.mode != "controller":
        return None
    controller_url = resolve_persistence_urls(config).controller
    db_path = sqlite_path_from_url(controller_url) or (default_state_dir(config) / "controller_state.db")
    orchestration_store = OrchestrationStoreOrm(db_path=db_path, db_url=controller_url)
    orchestration_repo = OrchestrationRepo(orchestration_store)
    return Orchestrator(
        orchestration_repo,
        retention_days=config.controller_retention_days,
        archive_retention_days=config.controller_archive_retention_days,
        controller_instance_id=config.controller_instance_id,
        leader_lease_seconds=config.controller_leader_lease_seconds,
    )


async def _thread_model_running(registry: NodeRegistry, node: str, model: str) -> bool:
    try:
        models = await registry.request_node(node, "GET", f"{LM_API_PREFIX}/models")
    except Exception as exc:
        raise RuntimeError(f"Node {node} model status request failed for model {model}: {exc}") from exc
    if not isinstance(models, list):
        raise TypeError(f"Node {node} model status response for model {model} must be a list")
    return any(item.get("name") == model and item.get("running") is True for item in models if isinstance(item, dict))


async def _thread_model_available(registry: NodeRegistry, node: str, model: str) -> bool:
    try:
        models = await registry.request_node(node, "GET", f"{LM_API_PREFIX}/models")
    except Exception as exc:
        raise RuntimeError(f"Node {node} model availability request failed for model {model}: {exc}") from exc
    if not isinstance(models, list):
        raise TypeError(f"Node {node} model availability response for model {model} must be a list")
    for item in models:
        if isinstance(item, dict) and item.get("name") == model:
            return True

    try:
        files = await registry.request_node(node, "GET", f"{LM_API_PREFIX}/library/ggufs")
    except Exception as exc:
        raise RuntimeError(f"Node {node} GGUF library request failed for model {model}: {exc}") from exc
    if not isinstance(files, list):
        raise TypeError(f"Node {node} GGUF library response for model {model} must be a list")
    for item in files:
        if not isinstance(item, dict):
            continue
        names = {
            str(item.get("name") or ""),
            str(item.get("registered_as") or ""),
            Path(str(item.get("filename") or "")).stem,
        }
        if model in names:
            return True
    return False


async def _thread_model_artifact_presence(
    registry: NodeRegistry,
    catalog_service: ModelCatalogService | None,
    node: str,
    model: str,
) -> str | None:
    """9.2 — returns "registered", "gguf_present", or None for the routing policy."""
    try:
        models = await registry.request_node(node, "GET", f"{LM_API_PREFIX}/models")
    except Exception as exc:
        raise RuntimeError(f"Node {node} model artifact request failed for model {model}: {exc}") from exc
    if not isinstance(models, list):
        raise TypeError(f"Node {node} model artifact response for model {model} must be a list")
    for item in models:
        if isinstance(item, dict) and item.get("name") == model:
            return "registered"

    try:
        files = await registry.request_node(node, "GET", f"{LM_API_PREFIX}/library/ggufs")
    except Exception as exc:
        raise RuntimeError(f"Node {node} GGUF artifact request failed for model {model}: {exc}") from exc
    if not isinstance(files, list):
        raise TypeError(f"Node {node} GGUF artifact response for model {model} must be a list")
    for item in files:
        if not isinstance(item, dict):
            continue
        names = {
            str(item.get("name") or ""),
            str(item.get("registered_as") or ""),
            Path(str(item.get("filename") or "")).stem,
        }
        if model in names:
            return "gguf_present"
    return _persisted_thread_model_artifact_presence(catalog_service, node, model)


def _persisted_thread_model_artifact_presence(
    catalog_service: ModelCatalogService | None,
    node: str,
    model: str,
) -> str | None:
    if catalog_service is None:
        return None
    base_name, _, profile_key = model.partition(":")
    try:
        row = catalog_service.get_model(base_name)
    except Exception:
        return None
    deployments = catalog_service.store.list_model_deployments(str(row["model_id"]))
    for deployment in deployments:
        if deployment.get("node_name") != node or not bool(deployment.get("enabled", True)):
            continue
        if profile_key:
            if deployment.get("profile_key") == profile_key:
                return "registered"
            continue
        if deployment.get("profile_key") in {None, "", "default"}:
            return "registered"
    return None


async def _thread_node_startup_allowed(registry: NodeRegistry, node: str, model: str) -> bool:
    """9.1 — returns True if the node has capacity to start a new model instance."""
    node_config = None
    try:
        node_config = registry.get_node_config(node)
    except KeyError:
        pass

    max_running = node_config.max_running_models if node_config is not None else None
    if max_running is None:
        return True

    try:
        models = await registry.request_node(node, "GET", f"{LM_API_PREFIX}/models")
    except Exception as exc:
        raise RuntimeError(f"Node {node} startup capacity request failed for model {model}: {exc}") from exc
    if not isinstance(models, list):
        raise TypeError(f"Node {node} startup capacity response for model {model} must be a list")
    running_count = sum(1 for item in models if isinstance(item, dict) and item.get("running") is True)
    return running_count < max_running


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
    auth_urls = resolve_persistence_urls(app_config)
    app.state.settings_store = SettingsStoreOrm(db_url=auth_urls.settings)
    app.state.runtime_settings_service = RuntimeSettingsService(config=app_config, store=app.state.settings_store)
    app_config = app.state.runtime_settings_service.effective_config()
    app.state.config = app_config
    app.state.plugin_registry = load_plugins(app_config)
    app.state.ocr_service = create_ocr_service(app_config.log_dir / "ocr")
    persistent_config = app_config.config_source not in {"(defaults)", "(in-memory)"}
    store = (
        JsonFileStore(app_config.log_dir / "controller_nodes_state.json")
        if app_config.mode == "controller" and persistent_config
        else InMemoryStore()
        if app_config.mode == "controller"
        else None
    )
    app.state.node_registry = NodeRegistry(app_config, request=controller_request, store=store)
    app.state.orchestrator = _build_orchestrator(app_config)
    app.state.chat_session_store = ChatSessionStoreOrm(db_url=auth_urls.chat_sessions)
    app.state.model_download_store = ModelDownloadStoreOrm(db_url=auth_urls.downloads)
    try:
        app.state.model_asset_store = ModelAssetStoreOrm(db_url=auth_urls.models)
        app.state.model_catalog_service = ModelCatalogService(app.state.model_asset_store)
        app.state.model_catalog_service.validate_ready()
    except Exception as exc:
        raise RuntimeError(
            "DB-authoritative model persistence requires a working database and migrated schema. "
            "Run migrations first: uv run python scripts/migrate_all.py --config <config.yaml>. "
            "For target-specific repair, run: alembic -x db=models upgrade models@head"
        ) from exc
    app.state.process_manager = process_manager or ProcessManager(
        app_config,
        catalog_service=app.state.model_catalog_service,
    )
    if getattr(app.state.process_manager, "catalog_service", None) is None:
        setattr(app.state.process_manager, "catalog_service", app.state.model_catalog_service)
    app.state.chat_proxy = ChatProxy(
        app.state.process_manager,
        app_config,
        app.state.node_registry,
        request=chat_request,
        stream_request=chat_stream_request,
    )
    app.state.chat_scheduler = ChatScheduler(
        app.state.chat_proxy,
        max_active_per_target=app_config.chat_max_active_per_target,
        max_queue_per_target=app_config.chat_max_queue_per_target,
        max_active_per_session=app_config.chat_max_active_per_session,
        max_queue_per_session=app_config.chat_max_queue_per_session,
        admission_timeout_seconds=app_config.chat_admission_timeout_seconds,
        hooks=app.state.plugin_registry.hooks,
        event_bus=app.state.plugin_registry.events,
    )
    app.state.chat_slot_allocator = ChatSlotAllocator()
    app.state.thread_service = ThreadService(
        config=app_config,
        store=ThreadStore(default_state_dir(app_config) / "threads.db"),
        chat_proxy=app.state.chat_scheduler,
        model_running=lambda node, model: _thread_model_running(app.state.node_registry, node, model),
        model_available=lambda node, model: _thread_model_available(app.state.node_registry, node, model),
        model_artifact_presence=lambda node, model: _thread_model_artifact_presence(
            app.state.node_registry, app.state.model_catalog_service, node, model
        ),
        node_startup_allowed=lambda node, model: _thread_node_startup_allowed(app.state.node_registry, node, model),
    )
    app.state.model_asset_inventory_service = ModelAssetInventoryService(
        app_config,
        app.state.model_asset_store,
        download_store=app.state.model_download_store,
    )
    app.state.conversion_manager = conversion_manager or ConversionManager(
        app_config,
        inventory_service=app.state.model_asset_inventory_service,
    )
    app.state.quantization_manager = quantization_manager or QuantizationManager(
        app_config,
        inventory_service=app.state.model_asset_inventory_service,
    )
    app.state.gguf_library = gguf_library or GgufLibrary(
        app_config,
        inventory_service=app.state.model_asset_inventory_service,
    )
    app.state.transfer_manager = TransferManager(
        app_config,
        inventory_service=app.state.model_asset_inventory_service,
    )
    app.state.download_manager = DownloadManager(
        app_config,
        app.state.model_download_store,
        inventory_service=app.state.model_asset_inventory_service,
    )
    app.state.benchmark_store = BenchmarkStoreOrm(db_url=auth_urls.benchmarks)
    app.state.project_store = ProjectStoreOrm(db_url=auth_urls.projects)
    app.state.project_graph_store = ProjectGraphStoreOrm(db_url=auth_urls.projects)
    app.state.chat_proxy.project_store = app.state.project_store
    app.state.chat_proxy.project_graph_store = app.state.project_graph_store
    if app_config.mode == "controller":
        app.state.benchmark_runner = BenchmarkRunner(app.state.benchmark_store, app.state.chat_proxy)
        app.state.memory_store = ChromaMemoryStore(app_config.memory)
    else:
        app.state.benchmark_runner = None
        app.state.memory_store = ChromaMemoryStore(app_config.memory)  # self-disables when enabled=False
    app.state.audit_store = AuditStoreOrm(db_url=auth_urls.audit)
    app.state.auth_store = AuthStoreOrm(db_url=auth_urls.auth)
    app.state.heartbeat_client = AgentHeartbeatClient(app_config, request=heartbeat_request)
    app.state.agent_worker = AgentWorker(
        app_config,
        chat=app.state.chat_proxy.chat_with_meta,
        download_manager=app.state.download_manager,
        gguf_library=app.state.gguf_library,
        process_manager=app.state.process_manager,
        transfer_manager=app.state.transfer_manager,
        project_graph_indexer=ProjectGraphIndexer(app.state.project_graph_store),
    )
    app.state.controller_sweeper_task = None
    app.state.controller_sweeper_stop_event = asyncio.Event()
    app.state.controller_sweeper_interval_seconds = 15
    app.state.ui_sessions = {}
    app.state.test_chat_sessions = {}


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
            if is_external_key_forbidden(path, request.state.ui_role):
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
        await app.state.heartbeat_client.start()
        await app.state.agent_worker.start()
        if app.state.config.mode == "controller" and app.state.orchestrator is not None:
            app.state.controller_sweeper_stop_event.clear()
            app.state.controller_sweeper_task = asyncio.create_task(
                _controller_sweeper_loop(
                    app, interval_seconds=app.state.controller_sweeper_interval_seconds
                )
            )
        try:
            yield
        finally:
            sweeper_task = app.state.controller_sweeper_task
            if sweeper_task is not None:
                app.state.controller_sweeper_stop_event.set()
                await sweeper_task
                app.state.controller_sweeper_task = None
            await app.state.agent_worker.stop()
            await app.state.heartbeat_client.stop()

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
