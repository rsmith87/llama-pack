from __future__ import annotations

import importlib
import sys
from pathlib import Path
from typing import Any

from llama_manager.core.config import AppConfig
from llama_manager.core.plugins.context import PluginContext
from llama_manager.core.plugins.manifest import load_manifest
from llama_manager.core.plugins.registry import PluginRecord, PluginRegistry, _plugin_asset_url

CORE_PLUGIN_API_VERSION = "1.0"


def load_plugins(config: AppConfig) -> PluginRegistry:
    registry = PluginRegistry()
    for plugin_id, plugin_config in config.plugins.items():
        if plugin_id not in config.enabled_plugins or not plugin_config.enabled:
            registry.add_disabled(plugin_id)
    for plugin_id in config.enabled_plugins:
        plugin_config = config.plugins.get(plugin_id)
        if plugin_config is None or plugin_config.path is None:
            registry.add_disabled(plugin_id, reason="Plugin path is not configured")
            continue
        _load_one(registry, plugin_id, plugin_config.path, plugin_config.config, config.mode, config.log_dir)
    return registry


def load_configured_plugin(registry: PluginRegistry, config: AppConfig, plugin_id: str) -> PluginRecord:
    plugin_config = config.plugins.get(plugin_id)
    if plugin_config is None:
        raise KeyError(plugin_id)
    if plugin_config.path is None:
        raise ValueError("Plugin path is not configured")
    registry.remove_record(plugin_id)
    _load_one(registry, plugin_id, plugin_config.path, plugin_config.config, config.mode, config.log_dir)
    return registry.records[plugin_id]


def _load_one(registry: PluginRegistry, plugin_id: str, path: Path, plugin_config: dict[str, Any], mode: str, log_dir: Path) -> None:
    try:
        manifest = load_manifest(path)
        if manifest.id != plugin_id:
            raise ValueError(f"Manifest id {manifest.id!r} does not match configured plugin id {plugin_id!r}")
        record = PluginRecord(manifest.id, manifest.name, manifest.version, "loading", manifest=manifest)
        record.root = path
        if manifest.config_schema:
            record.config = manifest.config_schema.redact(plugin_config)
        record.navigation.extend(manifest.navigation)
        record.secondary_navigation.extend(manifest.secondary_navigation)
        record.ui_routes.extend(manifest.ui_routes)
        if manifest.frontend:
            page_prefix = f"/ui/plugins/{plugin_id}"
            _plugin_asset_url(plugin_id, manifest.frontend.entry)
            _plugin_asset_url(plugin_id, manifest.frontend.style)
            for style_entry in manifest.frontend.style_entries:
                _plugin_asset_url(plugin_id, style_entry)
            for page in manifest.frontend.pages:
                if page.route != page_prefix and not page.route.startswith(f"{page_prefix}/"):
                    raise ValueError(f"Plugin page route {page.route!r} must stay under {page_prefix}")
                _plugin_asset_url(plugin_id, page.template)
                _plugin_asset_url(plugin_id, page.controller)
                record.ui_routes.append({"path": page.route, "label": page.title})
        if manifest.frontend and manifest.frontend.static_dir:
            record.static_dir = (path / manifest.frontend.static_dir).resolve()
        registry.add_record(record)
        if (
            manifest.requires_core != CORE_PLUGIN_API_VERSION
            or manifest.backend_api_version != CORE_PLUGIN_API_VERSION
            or manifest.frontend_api_version != CORE_PLUGIN_API_VERSION
        ):
            record.status = "incompatible"
            record.warnings.append(f"Plugin requires core {manifest.requires_core}; supported core is {CORE_PLUGIN_API_VERSION}")
            return
        if mode not in manifest.modes:
            record.status = "incompatible"
            modes = ", ".join(manifest.modes)
            record.warnings.append(f"Plugin requires mode {modes}; current mode is {mode}")
            return
        if manifest.config_schema:
            config_errors = manifest.config_schema.validation_errors(plugin_config)
            if config_errors:
                registry.disable(plugin_id, f"Invalid plugin config: {', '.join(config_errors)}")
                return
        plugin = _import_entrypoint(path, manifest.entrypoint)
        plugin.register(PluginContext(registry, record, plugin_config, state_dir=log_dir / "plugins" / plugin_id / "state"))
        record.status = "enabled"
    except Exception as exc:
        registry.mark_failed(plugin_id, str(exc))


def _import_entrypoint(plugin_path: Path, entrypoint: str) -> Any:
    module_name, _, attr = entrypoint.partition(":")
    if not module_name or not attr:
        raise ValueError(f"Invalid plugin entrypoint {entrypoint!r}")
    root = str(plugin_path)
    added = False
    if root not in sys.path:
        sys.path.insert(0, root)
        added = True
    try:
        sys.modules.pop(module_name, None)
        sys.modules.pop(module_name.split(".", 1)[0], None)
        module = importlib.import_module(module_name)
        return getattr(module, attr)
    finally:
        if added:
            try:
                sys.path.remove(root)
            except ValueError:
                pass
