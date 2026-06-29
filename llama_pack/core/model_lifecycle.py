from __future__ import annotations

import asyncio
import logging
from typing import Any
from urllib.parse import quote

logger = logging.getLogger(__name__)


class ManagedModelLifecycle:
    def __init__(self, node_registry: Any, model_start_timeout_seconds: float) -> None:
        self.node_registry = node_registry
        self.model_start_timeout_seconds = model_start_timeout_seconds

    async def snapshot_running_models(self, node_name: str) -> list[str]:
        if not node_name:
            raise ValueError("node_name is required to snapshot running models")
        return running_model_names(await self.list_node_models(node_name))

    async def load_exclusive(self, node_name: str, model_name: str, running_before: list[str]) -> None:
        for running_model in running_before:
            await self.request_node_model_action(node_name, running_model, "stop")

        await self.request_node_model_action(node_name, model_name, "start")
        if await self.wait_for_model_running(node_name, model_name):
            return
        raise RuntimeError("model_start_timeout")

    async def restore_exclusive(self, node_name: str, loaded_model: str, prior_models: list[str]) -> None:
        if not node_name:
            return
        try:
            await self.request_node_model_action(node_name, loaded_model, "stop")
        except Exception as exc:
            logger.warning("Failed to stop managed model %s on %s: %s", loaded_model, node_name, exc)
        for model_name in prior_models:
            try:
                await self.request_node_model_action(node_name, model_name, "start")
            except Exception as exc:
                logger.warning("Failed to restore model %s on %s: %s", model_name, node_name, exc)

    async def list_node_models(self, node_name: str) -> list[dict[str, Any]]:
        payload = await self.node_registry.request_node(node_name, "GET", "/lm-api/v1/models")
        return payload if isinstance(payload, list) else []

    async def request_node_model_action(self, node_name: str, model_name: str, action: str) -> None:
        encoded_model = quote(model_name, safe="")
        await self.node_registry.request_node(
            node_name,
            "POST",
            f"/lm-api/v1/models/{encoded_model}/{action}",
        )

    async def wait_for_model_running(self, node_name: str, model_name: str) -> bool:
        deadline = asyncio.get_running_loop().time() + self.model_start_timeout_seconds
        while True:
            if model_running(await self.list_node_models(node_name), model_name):
                return True
            if asyncio.get_running_loop().time() >= deadline:
                return False
            await asyncio.sleep(1.0)


def running_model_names(models: list[dict[str, Any]]) -> list[str]:
    return [
        str(model["name"])
        for model in models
        if isinstance(model, dict) and model.get("name") and model.get("running")
    ]


def model_running(models: list[dict[str, Any]], model_name: str) -> bool:
    return any(
        isinstance(model, dict) and model.get("name") == model_name and bool(model.get("running"))
        for model in models
    )
