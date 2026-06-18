from __future__ import annotations

import asyncio
import inspect
from collections.abc import Callable
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from fastapi import APIRouter

from llama_pack.core.plugins.events import EventBus
from llama_pack.core.plugins.hooks import HookRegistry
from llama_pack.core.plugins.manifest import PluginManifest
from llama_pack.core.plugins.migrations import PluginMigrationTarget


@dataclass
class PluginRecord:
    id: str
    name: str
    version: str
    status: str
    manifest: PluginManifest | None = None
    warnings: list[str] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)
    health: list[dict[str, str]] = field(default_factory=list)
    health_checks: list[Callable[[], Any]] = field(default_factory=list)
    migration_targets: list[PluginMigrationTarget] = field(default_factory=list)
    config: dict[str, Any] = field(default_factory=dict)
    routers: list[tuple[str, APIRouter]] = field(default_factory=list)
    navigation: list[dict[str, Any]] = field(default_factory=list)
    secondary_navigation: list[dict[str, Any]] = field(default_factory=list)
    ui_routes: list[dict[str, Any]] = field(default_factory=list)
    static_dir: Path | None = None
    root: Path | None = None


def _plugin_asset_url(plugin_id: str, path: str | None) -> str | None:
    if path is None:
        return None
    if ".." in Path(path).parts:
        raise ValueError(f"Plugin asset path {path!r} must not contain traversal segments")
    plugin_asset_prefix = f"/plugin-assets/{plugin_id}/"
    if path.startswith("/plugin-assets/"):
        if not path.startswith(plugin_asset_prefix):
            raise ValueError(f"Plugin asset URL {path!r} must stay under {plugin_asset_prefix}")
        return path
    return f"/plugin-assets/{plugin_id}/{path.lstrip('/')}"


class PluginRegistry:
    def __init__(self) -> None:
        self.records: dict[str, PluginRecord] = {}
        self.route_prefixes: set[str] = set()
        self.events = EventBus()
        self.hooks = HookRegistry()
        self.events.set_health_recorder(self.record_health)
        self.hooks.set_health_recorder(self.record_health)

    def add_record(self, record: PluginRecord) -> None:
        self.records[record.id] = record

    def add_disabled(self, plugin_id: str, *, reason: str = "Disabled") -> None:
        self.records[plugin_id] = PluginRecord(plugin_id, plugin_id, "", "disabled", warnings=[reason])

    def disable(self, plugin_id: str, message: str) -> None:
        record = self.records.get(plugin_id)
        if record is None:
            record = PluginRecord(plugin_id, plugin_id, "", "disabled")
            self.records[plugin_id] = record
        record.status = "disabled"
        record.warnings.append(message)
        self._remove_runtime_bindings(plugin_id, record)
        record.routers.clear()

    def deactivate(self, plugin_id: str, message: str = "Deactivated at runtime") -> PluginRecord | None:
        record = self.records.get(plugin_id)
        if record is None:
            return None
        record.status = "disabled"
        if message not in record.warnings:
            record.warnings.append(message)
        self._remove_runtime_bindings(plugin_id, record)
        return record

    def mark_failed(self, plugin_id: str, message: str) -> None:
        record = self.records.get(plugin_id)
        if record is None:
            record = PluginRecord(plugin_id, plugin_id, "", "failed")
            self.records[plugin_id] = record
        record.status = "failed"
        record.errors.append(message)
        self._remove_runtime_bindings(plugin_id, record)
        record.routers.clear()

    def record_health(self, plugin_id: str, level: str, message: str) -> None:
        record = self.records.get(plugin_id)
        if record is None:
            return
        record.health.append({"level": level, "message": message})
        if level == "error":
            record.errors.append(message)
        elif level == "warning":
            record.warnings.append(message)

    def reserve_route_prefix(self, plugin_id: str, prefix: str) -> None:
        expected = f"/{plugin_id}"
        if prefix != expected:
            raise ValueError(f"Plugin route prefix {prefix!r} is outside namespace {expected!r}")
        if prefix in self.route_prefixes:
            raise ValueError(f"Plugin route prefix collision: {prefix}")
        self.route_prefixes.add(prefix)

    def remove_record(self, plugin_id: str) -> PluginRecord | None:
        record = self.records.pop(plugin_id, None)
        self._remove_runtime_bindings(plugin_id, record)
        return record

    def _remove_runtime_bindings(self, plugin_id: str, record: PluginRecord | None) -> None:
        self.events.remove_plugin(plugin_id)
        self.hooks.remove_plugin(plugin_id)
        if record is None:
            self.route_prefixes.discard(f"/{plugin_id}")
            return
        for route_prefix, _router in record.routers:
            self.route_prefixes.discard(route_prefix)

    def enabled_metadata(self) -> list[dict[str, Any]]:
        return [self._frontend_payload(record) for record in self.records.values() if record.status == "enabled"]

    def status_payload(self) -> dict[str, Any]:
        return {
            "plugins": [
                {
                    "id": record.id,
                    "status": record.status,
                    "version": record.version,
                    "health": record.health,
                    "warnings": record.warnings,
                    "errors": record.errors,
                    "config": record.config,
                }
                for record in self.records.values()
            ]
        }

    async def status_payload_async(self) -> dict[str, Any]:
        plugins = []
        for record in self.records.values():
            health = [*record.health]
            warnings = [*record.warnings]
            errors = [*record.errors]
            for item in await self._run_health_checks(record):
                health.append(item)
                if item["level"] == "warning":
                    warnings.append(item["message"])
                elif item["level"] == "error":
                    errors.append(item["message"])
            for item in self._migration_health(record):
                health.append(item)
                if item["level"] == "warning":
                    warnings.append(item["message"])
                elif item["level"] == "error":
                    errors.append(item["message"])
            plugins.append(
                {
                    "id": record.id,
                    "status": record.status,
                    "version": record.version,
                    "health": health,
                    "warnings": warnings,
                    "errors": errors,
                    "config": record.config,
                }
            )
        return {"plugins": plugins}

    def migration_status_payload(self, plugin_id: str) -> dict[str, Any] | None:
        record = self.records.get(plugin_id)
        if record is None or record.status != "enabled":
            return None
        for target in record.migration_targets:
            target.refresh_status(plugin_root=record.root)
        return {
            "plugin_id": plugin_id,
            "targets": [target.payload() for target in record.migration_targets],
        }

    def upgrade_migration_target(self, plugin_id: str, target_id: str) -> dict[str, Any] | None:
        record = self.records.get(plugin_id)
        if record is None or record.status != "enabled":
            return None
        for target in record.migration_targets:
            if target.id == target_id:
                target.upgrade(plugin_root=record.root)
                return {"plugin_id": plugin_id, "target": target.payload()}
        return None

    def _migration_health(self, record: PluginRecord) -> list[dict[str, str]]:
        if record.status != "enabled":
            return []
        health: list[dict[str, str]] = []
        for target in record.migration_targets:
            target.refresh_status(plugin_root=record.root)
            if target.last_error:
                operation = target.last_error_source or "refresh"
                health.append(
                    {
                        "level": "error",
                        "message": f"Plugin migration target {target.id} {operation} failed: {target.last_error}",
                    }
                )
            warning = target.health_warning()
            if warning:
                health.append({"level": "warning", "message": warning})
        return health

    async def _run_health_checks(self, record: PluginRecord) -> list[dict[str, str]]:
        results: list[dict[str, str]] = []
        if record.status != "enabled":
            return results
        for check in record.health_checks:
            try:
                value = check()
                if inspect.isawaitable(value):
                    value = await asyncio.wait_for(value, timeout=2.0)
                results.extend(_normalize_health_result(value))
            except Exception as exc:
                results.append({"level": "error", "message": str(exc)})
        return results

    def _frontend_payload(self, record: PluginRecord) -> dict[str, Any]:
        manifest = record.manifest
        frontend = manifest.frontend.model_dump(mode="json") if manifest and manifest.frontend else {}
        if manifest and manifest.frontend:
            frontend["style_entries"] = [_plugin_asset_url(record.id, item) for item in manifest.frontend.style_entries]
            frontend["pages"] = [
                {
                    "route": page.route,
                    "template": _plugin_asset_url(record.id, page.template),
                    "controller": _plugin_asset_url(record.id, page.controller),
                    "title": page.title,
                }
                for page in manifest.frontend.pages
            ]
        frontend.pop("static_dir", None)
        return {
            "id": record.id,
            "name": record.name,
            "version": record.version,
            "status": record.status,
            "frontend": frontend,
            "navigation": record.navigation,
            "secondary_navigation": record.secondary_navigation,
            "ui_routes": record.ui_routes,
        }


def _normalize_health_result(value: Any) -> list[dict[str, str]]:
    if value is None:
        return []
    if isinstance(value, dict):
        values = [value]
    elif isinstance(value, list):
        values = value
    else:
        return [{"level": "warning", "message": str(value)}]
    results: list[dict[str, str]] = []
    for item in values:
        if not isinstance(item, dict):
            results.append({"level": "warning", "message": str(item)})
            continue
        level = str(item.get("level") or "ok")
        message = str(item.get("message") or "")
        results.append({"level": level, "message": message})
    return results
