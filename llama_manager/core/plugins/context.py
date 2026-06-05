from __future__ import annotations

from collections.abc import Callable
from pathlib import Path
from typing import Any

from fastapi import APIRouter

from llama_manager.core.plugins.databases import PluginDatabase, resolve_plugin_database
from llama_manager.core.plugins.events import EventEnvelope
from llama_manager.core.plugins.migrations import PluginMigrationTarget, normalize_migration_directory
from llama_manager.core.plugins.registry import PluginRecord, PluginRegistry


class PluginContext:
    def __init__(self, registry: PluginRegistry, record: PluginRecord, config: dict[str, Any], state_dir: Path) -> None:
        self.registry = registry
        self.record = record
        self.config = config
        self._state_dir = state_dir

    def get_state_dir(self) -> Path:
        """Return the plugin's private state directory (inside the plugin folder).

        The directory is not created automatically — the plugin is responsible
        for calling ``mkdir(parents=True, exist_ok=True)`` before writing to it.
        """
        return self._state_dir

    def get_database(self, name: str = "main") -> PluginDatabase:
        """Return a plugin-owned SQLite database handle inside the state directory."""
        return resolve_plugin_database(self.record.id, self._state_dir, name)

    def add_api_router(self, router: APIRouter, *, prefix: str | None = None) -> None:
        resolved = prefix or f"/{self.record.id}"
        self.registry.reserve_route_prefix(self.record.id, resolved)
        self.record.routers.append((resolved, router))

    def add_navigation_item(self, item: dict[str, Any]) -> None:
        self.record.navigation.append(item)

    def add_secondary_navigation_item(self, item: dict[str, Any]) -> None:
        self.record.secondary_navigation.append(item)

    def add_ui_route(self, item: dict[str, Any]) -> None:
        self.record.ui_routes.append(item)

    def subscribe(self, event_name: str, handler: Callable[[EventEnvelope], Any]) -> None:
        self.registry.events.subscribe(self.record.id, event_name, handler)

    def add_policy_hook(self, hook_name: str, handler: Callable[[dict[str, Any]], Any]) -> None:
        self.registry.hooks.add_policy_hook(self.record.id, hook_name, handler)

    def add_health_check(self, handler: Callable[[], Any]) -> None:
        self.record.health_checks.append(handler)

    def add_migration_target(
        self,
        target_id: str,
        *,
        directory: str | Path,
        database: PluginDatabase | None = None,
        database_url: str | None = None,
        current_revision: str | None = None,
        head_revision: str | None = None,
        runner: Callable[[], Any] | None = None,
    ) -> None:
        if any(target.id == target_id for target in self.record.migration_targets):
            raise ValueError(f"Plugin migration target collision: {target_id}")
        resolved_database_url = database.url if database else database_url
        database_name = database.name if database else None
        database_path = database.path if database else None
        self.record.migration_targets.append(
            PluginMigrationTarget(
                id=target_id,
                directory=normalize_migration_directory(directory),
                database_name=database_name,
                database_path=database_path,
                database_url=resolved_database_url,
                current_revision=current_revision,
                head_revision=head_revision,
                runner=runner,
            )
        )

    def get_plugin_config(self) -> dict[str, Any]:
        return dict(self.config)
