from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from fastapi import APIRouter

from llama_manager.core.plugins.events import EventBus
from llama_manager.core.plugins.hooks import HookRegistry
from llama_manager.core.plugins.manifest import PluginManifest


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
    routers: list[tuple[str, APIRouter]] = field(default_factory=list)
    navigation: list[dict[str, Any]] = field(default_factory=list)
    secondary_navigation: list[dict[str, Any]] = field(default_factory=list)
    ui_routes: list[dict[str, Any]] = field(default_factory=list)
    static_dir: Path | None = None


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

    def mark_failed(self, plugin_id: str, message: str) -> None:
        record = self.records.get(plugin_id)
        if record is None:
            record = PluginRecord(plugin_id, plugin_id, "", "failed")
            self.records[plugin_id] = record
        record.status = "failed"
        record.errors.append(message)
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
                }
                for record in self.records.values()
            ]
        }

    def _frontend_payload(self, record: PluginRecord) -> dict[str, Any]:
        manifest = record.manifest
        frontend = manifest.frontend.model_dump(mode="json") if manifest and manifest.frontend else {"entry": None, "style": None}
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
