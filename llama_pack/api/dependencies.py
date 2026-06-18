from __future__ import annotations

from typing import TYPE_CHECKING
from typing import Any

from fastapi import Request

from llama_pack.core.config import AppConfig

if TYPE_CHECKING:
    from llama_pack.core.benchmarks.runner import BenchmarkRunner
    from llama_pack.core.chat.profile_activation import ProfileActivationService
    from llama_pack.core.chat.proxy import ChatProxy
    from llama_pack.core.chat.scheduler import ChatScheduler
    from llama_pack.core.memory.store import ChromaMemoryStore
    from llama_pack.core.model_assets.catalog_service import ModelCatalogService
    from llama_pack.core.model_assets.conversions import ConversionManager
    from llama_pack.core.model_assets.library import GgufLibrary
    from llama_pack.core.model_assets.models_db import ModelAssetInventoryService
    from llama_pack.core.model_assets.downloads import DownloadManager
    from llama_pack.core.model_assets.quantizations import QuantizationManager
    from llama_pack.core.model_assets.transfers import TransferManager
    from llama_pack.core.nodes.registry import NodeRegistry
    from llama_pack.core.orchestration.orchestrator import Orchestrator
    from llama_pack.core.persistence.benchmark_store_orm import BenchmarkStoreOrm
    from llama_pack.core.persistence.project_store_orm import ProjectStoreOrm
    from llama_pack.core.runtime.process_manager import ProcessManager
    from llama_pack.core.settings.runtime import RuntimeSettingsService
    from llama_pack.core.threads.service import ThreadService


def get_config(request: Request) -> AppConfig:
    return request.app.state.config


def get_process_manager(request: Request) -> ProcessManager:
    return request.app.state.process_manager


def get_model_catalog_service(request: Request) -> ModelCatalogService:
    return request.app.state.model_catalog_service


def get_conversion_manager(request: Request) -> ConversionManager:
    return request.app.state.conversion_manager


def get_quantization_manager(request: Request) -> QuantizationManager:
    return request.app.state.quantization_manager


def get_node_registry(request: Request) -> NodeRegistry:
    return request.app.state.node_registry


def get_chat_proxy(request: Request) -> ChatProxy:
    return request.app.state.chat_proxy


def get_chat_scheduler(request: Request) -> ChatScheduler:
    return request.app.state.chat_scheduler


def get_memory_store(request: Request) -> ChromaMemoryStore:
    return request.app.state.memory_store


def get_profile_activation_service(request: Request) -> ProfileActivationService:
    from llama_pack.core.chat.profile_activation import ProfileActivationService

    return ProfileActivationService(request.app.state.config, request.app.state.process_manager)


def get_gguf_library(request: Request) -> GgufLibrary:
    return request.app.state.gguf_library


def get_download_manager(request: Request) -> DownloadManager:
    return request.app.state.download_manager


def get_model_asset_inventory_service(request: Request) -> ModelAssetInventoryService:
    service = getattr(request.app.state, "model_asset_inventory_service", None)
    if service is None:
        raise RuntimeError("Model asset inventory service is unavailable")
    return service


def get_transfer_manager(request: Request) -> TransferManager:
    return request.app.state.transfer_manager


def get_chat_session_store(request: Request) -> Any:
    return request.app.state.chat_session_store


def get_benchmark_store(request: Request) -> BenchmarkStoreOrm:
    return request.app.state.benchmark_store


def get_benchmark_runner(request: Request) -> BenchmarkRunner:
    return request.app.state.benchmark_runner


def get_project_store(request: Request) -> ProjectStoreOrm:
    return request.app.state.project_store


def get_thread_service(request: Request) -> ThreadService:
    return request.app.state.thread_service


def get_audit_store(request: Request) -> Any:
    return request.app.state.audit_store


def get_orchestrator(request: Request) -> Orchestrator:
    orchestrator = getattr(request.app.state, "orchestrator", None)
    if orchestrator is None:
        raise RuntimeError("Orchestrator is only available in controller mode")
    return orchestrator


def get_runtime_settings_service(request: Request) -> RuntimeSettingsService:
    return request.app.state.runtime_settings_service
