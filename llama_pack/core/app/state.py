from __future__ import annotations

import asyncio
import logging
from collections.abc import AsyncIterator, Awaitable, Callable
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from fastapi import FastAPI

from llama_pack.core.benchmarks.runner import BenchmarkRunner
from llama_pack.core.chat.proxy import ChatProxy
from llama_pack.core.chat.scheduler import ChatScheduler
from llama_pack.core.chat.slot_allocator import ChatSlotAllocator
from llama_pack.core.code_graph.indexer import ProjectGraphIndexer
from llama_pack.core.config import AppConfig
from llama_pack.core.document_collections.service import DocumentCollectionService
from llama_pack.core.document_collections.vector_store import DocumentCollectionVectorStore
from llama_pack.core.memory.store import ChromaMemoryStore
from llama_pack.core.model_assets.catalog_service import ModelCatalogService
from llama_pack.core.model_assets.conversions import ConversionManager
from llama_pack.core.model_assets.downloads import DownloadManager
from llama_pack.core.model_assets.library import GgufLibrary
from llama_pack.core.model_assets.models_db import ModelAssetInventoryService
from llama_pack.core.model_assets.quantizations import QuantizationManager
from llama_pack.core.model_assets.transfers import TransferManager
from llama_pack.core.nodes.heartbeat import AgentHeartbeatClient
from llama_pack.core.nodes.registry import NodeRegistry
from llama_pack.core.nodes.worker import AgentWorker
from llama_pack.core.ocr import create_ocr_service
from llama_pack.core.offline.setup import OfflineSetupService
from llama_pack.core.orchestration.orchestrator import Orchestrator
from llama_pack.core.orchestration.repo import OrchestrationRepo
from llama_pack.core.orchestration.store_orm import OrchestrationStoreOrm
from llama_pack.core.persistence.audit_store_orm import AuditStoreOrm
from llama_pack.core.persistence.auth_store_orm import AuthStoreOrm
from llama_pack.core.persistence.benchmark_store_orm import BenchmarkStoreOrm
from llama_pack.core.persistence.chat_session_store_orm import ChatSessionStoreOrm
from llama_pack.core.persistence.db_infra import default_state_dir, resolve_persistence_urls, sqlite_path_from_url
from llama_pack.core.persistence.document_collection_store_orm import DocumentCollectionStoreOrm
from llama_pack.core.persistence.model_asset_store_orm import ModelAssetStoreOrm
from llama_pack.core.persistence.model_download_store_orm import ModelDownloadStoreOrm
from llama_pack.core.persistence.project_graph_store_orm import ProjectGraphStoreOrm
from llama_pack.core.persistence.project_store_orm import ProjectStoreOrm
from llama_pack.core.persistence.settings_store_orm import SettingsStoreOrm
from llama_pack.core.plugins import load_plugins
from llama_pack.core.runtime.network_security import NetworkPolicy
from llama_pack.core.runtime.process_manager import ProcessManager
from llama_pack.core.settings.runtime import RuntimeSettingsService
from llama_pack.core.threads.service import ThreadService
from llama_pack.core.threads.store import ThreadStore
from llama_pack.storage.db import InMemoryStore, JsonFileStore

logger = logging.getLogger(__name__)

LM_API_PREFIX = "/lm-api/v1"
ControllerRequest = Callable[[str, str, str | None, bool, dict[str, Any] | None], Awaitable[dict[str, Any]]]
ChatRequest = Callable[[str, dict[str, Any]], Awaitable[dict[str, Any]]]
ChatStreamRequest = Callable[[str, dict[str, Any]], AsyncIterator[bytes]]
HeartbeatRequest = Callable[[str, str, dict[str, Any] | None], Awaitable[dict[str, Any]]]


@dataclass(frozen=True)
class AppStateRequestBindings:
    controller_request: ControllerRequest | None
    chat_request: ChatRequest | None
    chat_stream_request: ChatStreamRequest | None
    heartbeat_request: HeartbeatRequest | None


@dataclass(frozen=True)
class ModelManagerBindings:
    process_manager: ProcessManager | None
    conversion_manager: ConversionManager | None
    quantization_manager: QuantizationManager | None
    gguf_library: GgufLibrary | None


def configure_app_state(
    app: FastAPI,
    app_config: AppConfig,
    request_bindings: AppStateRequestBindings,
    manager_bindings: ModelManagerBindings,
) -> None:
    app_config = configure_foundation_state(app, app_config)
    auth_urls = resolve_persistence_urls(app_config)
    configure_session_and_persistence_state(app, app_config, auth_urls)
    configure_chat_state(app, app_config, request_bindings, manager_bindings)
    configure_model_asset_state(app, app_config, auth_urls, manager_bindings)
    configure_runtime_domain_state(app, app_config, auth_urls)
    configure_controller_agent_state(app, app_config, request_bindings)


def configure_foundation_state(app: FastAPI, app_config: AppConfig) -> AppConfig:
    auth_urls = resolve_persistence_urls(app_config)
    app.state.settings_store = SettingsStoreOrm(db_url=auth_urls.settings)
    app.state.runtime_settings_service = RuntimeSettingsService(config=app_config, store=app.state.settings_store)
    effective_config = app.state.runtime_settings_service.effective_config()
    app.state.config = effective_config
    app.state.network_policy = NetworkPolicy(effective_config)
    app.state.plugin_registry = load_plugins(effective_config)
    app.state.ocr_service = create_ocr_service(effective_config.log_dir / "ocr")
    return effective_config


def configure_session_and_persistence_state(app: FastAPI, app_config: AppConfig, auth_urls: Any) -> None:
    app.state.chat_session_store = ChatSessionStoreOrm(db_url=auth_urls.chat_sessions)
    app.state.model_download_store = ModelDownloadStoreOrm(db_url=auth_urls.downloads)
    app.state.audit_store = AuditStoreOrm(db_url=auth_urls.audit)
    app.state.auth_store = AuthStoreOrm(db_url=auth_urls.auth)
    app.state.benchmark_store = BenchmarkStoreOrm(db_url=auth_urls.benchmarks)
    app.state.project_store = ProjectStoreOrm(db_url=auth_urls.projects)
    app.state.project_graph_store = ProjectGraphStoreOrm(db_url=auth_urls.projects)


def configure_chat_state(
    app: FastAPI,
    app_config: AppConfig,
    request_bindings: AppStateRequestBindings,
    manager_bindings: ModelManagerBindings,
) -> None:
    app.state.chat_request = request_bindings.chat_request
    app.state.chat_stream_request = request_bindings.chat_stream_request
    persistent_config = app_config.config_source not in {"(defaults)", "(in-memory)"}
    store = (
        JsonFileStore(app_config.log_dir / "controller_nodes_state.json")
        if app_config.mode == "controller" and persistent_config
        else InMemoryStore()
        if app_config.mode == "controller"
        else None
    )
    app.state.node_registry = NodeRegistry(
        app_config,
        request=request_bindings.controller_request,
        store=store,
        network_policy=app.state.network_policy,
    )
    app.state.orchestrator = build_orchestrator(app_config)
    app.state.offline_setup_service = OfflineSetupService(app.state.node_registry, app.state.orchestrator)
    app.state.process_manager = manager_bindings.process_manager


def configure_model_asset_state(
    app: FastAPI,
    app_config: AppConfig,
    auth_urls: Any,
    manager_bindings: ModelManagerBindings,
) -> None:
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

    app.state.process_manager = app.state.process_manager or ProcessManager(
        app_config,
        catalog_service=app.state.model_catalog_service,
    )
    if getattr(app.state.process_manager, "catalog_service", None) is None:
        setattr(app.state.process_manager, "catalog_service", app.state.model_catalog_service)

    app.state.model_asset_inventory_service = ModelAssetInventoryService(
        app_config,
        app.state.model_asset_store,
        download_store=app.state.model_download_store,
    )
    app.state.conversion_manager = manager_bindings.conversion_manager or ConversionManager(
        app_config,
        inventory_service=app.state.model_asset_inventory_service,
    )
    app.state.quantization_manager = manager_bindings.quantization_manager or QuantizationManager(
        app_config,
        inventory_service=app.state.model_asset_inventory_service,
    )
    app.state.gguf_library = manager_bindings.gguf_library or GgufLibrary(
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
        network_policy=app.state.network_policy,
    )


def configure_runtime_domain_state(app: FastAPI, app_config: AppConfig, auth_urls: Any) -> None:
    app.state.chat_proxy = ChatProxy(
        app.state.process_manager,
        app_config,
        app.state.node_registry,
        request=getattr(app.state, "chat_request", None),
        stream_request=getattr(app.state, "chat_stream_request", None),
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
        model_running=(
            (lambda node, model: local_thread_model_running(app.state.process_manager, model))
            if app_config.mode != "controller"
            else (lambda node, model: thread_model_running(app.state.node_registry, node, model))
        ),
        model_available=lambda node, model: thread_model_available(app.state.node_registry, node, model),
        model_artifact_presence=lambda node, model: thread_model_artifact_presence(
            app.state.node_registry, app.state.model_catalog_service, node, model
        ),
        node_startup_allowed=lambda node, model: thread_node_startup_allowed(app.state.node_registry, node, model),
        node_configs=app.state.node_registry.all_node_configs if app_config.mode == "controller" else None,
        event_bus=app.state.plugin_registry.events,
    )
    app.state.document_collection_service = build_document_collection_service(app_config, auth_urls.projects)
    app.state.chat_proxy.project_store = app.state.project_store
    app.state.chat_proxy.project_graph_store = app.state.project_graph_store
    if app_config.mode == "controller":
        app.state.benchmark_runner = BenchmarkRunner(app.state.benchmark_store, app.state.chat_proxy)
        app.state.memory_store = ChromaMemoryStore(app_config.memory)
    else:
        app.state.benchmark_runner = None
        app.state.memory_store = ChromaMemoryStore(app_config.memory)


def configure_controller_agent_state(
    app: FastAPI,
    app_config: AppConfig,
    request_bindings: AppStateRequestBindings,
) -> None:
    app.state.heartbeat_client = AgentHeartbeatClient(app_config, request=request_bindings.heartbeat_request)
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


def build_orchestrator(config: AppConfig) -> Orchestrator | None:
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


async def thread_model_running(registry: NodeRegistry, node: str, model: str) -> bool:
    try:
        models = await registry.request_node(node, "GET", f"{LM_API_PREFIX}/models")
    except Exception as exc:
        raise RuntimeError(f"Node {node} model status request failed for model {model}: {exc}") from exc
    if not isinstance(models, list):
        raise TypeError(f"Node {node} model status response for model {model} must be a list")
    return any(item.get("name") == model and item.get("running") is True for item in models if isinstance(item, dict))


def local_thread_model_running(process_manager: ProcessManager, model: str) -> bool:
    try:
        status = process_manager.status(model)
    except KeyError:
        return False
    status_data: Any = status.to_dict() if hasattr(status, "to_dict") else status
    if not isinstance(status_data, dict):
        raise TypeError(f"Local model status response for model {model} must be a dict")
    return bool(status_data.get("running"))


async def thread_model_available(registry: NodeRegistry, node: str, model: str) -> bool:
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


async def thread_model_artifact_presence(
    registry: NodeRegistry,
    catalog_service: ModelCatalogService | None,
    node: str,
    model: str,
) -> str | None:
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
    return persisted_thread_model_artifact_presence(catalog_service, node, model)


def persisted_thread_model_artifact_presence(
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


async def thread_node_startup_allowed(registry: NodeRegistry, node: str, model: str) -> bool:
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


def build_document_collection_service(app_config: AppConfig, projects_db_url: str) -> DocumentCollectionService | None:
    if app_config.mode != "controller":
        return None
    try:
        return DocumentCollectionService(
            metadata_store=DocumentCollectionStoreOrm(db_url=projects_db_url),
            vector_store=DocumentCollectionVectorStore(app_config.memory),
            max_chunk_chars=1600,
            chunk_overlap_chars=200,
        )
    except Exception as exc:
        logger.warning("Document Collections disabled: %s", exc)
        return None
