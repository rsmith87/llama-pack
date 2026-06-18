from __future__ import annotations

from llama_pack.core.config import AppConfig
from llama_pack.core.model_assets.catalog_service import ModelCatalogService
from llama_pack.core.runtime.network_security import network_security_diagnostics
from llama_pack.providers.system_metrics import get_system_metrics


def health_payload(config: AppConfig, catalog_service: ModelCatalogService | None = None) -> dict[str, object]:
    system = get_system_metrics()
    cpu_percent = None
    memory_percent = None
    vram_percent = None

    cpu = system.get("cpu") if isinstance(system, dict) else None
    if isinstance(cpu, dict):
        cpu_percent = cpu.get("percent")

    ram = system.get("ram") if isinstance(system, dict) else None
    if isinstance(ram, dict):
        memory_percent = ram.get("percent")

    vram = system.get("vram") if isinstance(system, dict) else None
    if isinstance(vram, list) and vram:
        total_mb = sum(int(gpu.get("memory_total_mb", 0)) for gpu in vram if isinstance(gpu, dict))
        used_mb = sum(int(gpu.get("memory_used_mb", 0)) for gpu in vram if isinstance(gpu, dict))
        if total_mb > 0:
            vram_percent = (used_mb / total_mb) * 100

    models_count = len(catalog_service.list_registered_models()) if catalog_service is not None else len(config.models)

    return {
        "ok": True,
        "mode": config.mode,
        "controller_url": config.controller_url if config.mode == "agent" else None,
        "config_source": config.config_source,
        "diagnostics": [diagnostic.to_payload() for diagnostic in network_security_diagnostics(config)],
        "configured_models": models_count,
        "models_configured": models_count,
        "nodes_configured": len(config.nodes),
        "system": {
            **system,
            "cpu_percent": cpu_percent,
            "memory_percent": memory_percent,
            "vram_percent": vram_percent,
        },
    }
