from __future__ import annotations

from collections.abc import Callable
from typing import Any

from fastapi import APIRouter

from llama_manager.core.plugins.events import EventEnvelope
from llama_manager.core.plugins.registry import PluginRecord, PluginRegistry


class PluginContext:
    def __init__(self, registry: PluginRegistry, record: PluginRecord, config: dict[str, Any]) -> None:
        self.registry = registry
        self.record = record
        self.config = config

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

    def get_plugin_config(self) -> dict[str, Any]:
        return dict(self.config)
