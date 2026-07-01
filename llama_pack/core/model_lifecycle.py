from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass
from typing import Any
from urllib.parse import quote

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class ModelWaitResult:
    running: bool
    last_models: list[dict[str, Any]]
    last_error: str | None


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

        start_response = await self.request_node_model_action(node_name, model_name, "start")
        expected_names = _expected_running_names(model_name, start_response)
        wait_result = await self.wait_for_model_running(node_name, expected_names)
        if wait_result.running:
            return
        observed = ", ".join(_observed_model_summaries(wait_result.last_models)) or "none"
        error_detail = f" last_error={wait_result.last_error}" if wait_result.last_error is not None else ""
        raise RuntimeError(
            f"model_start_timeout: node={node_name} model={model_name} observed_models=[{observed}]{error_detail}"
        )

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

    async def request_node_model_action(self, node_name: str, model_name: str, action: str) -> object:
        encoded_model = quote(model_name, safe="")
        return await self.node_registry.request_node(
            node_name,
            "POST",
            f"/lm-api/v1/models/{encoded_model}/{action}",
        )

    async def wait_for_model_running(self, node_name: str, model_names: set[str]) -> ModelWaitResult:
        deadline = asyncio.get_running_loop().time() + self.model_start_timeout_seconds
        last_models: list[dict[str, Any]] = []
        last_error: str | None = None
        while True:
            try:
                last_models = await self.list_node_models(node_name)
                last_error = None
                if model_running(last_models, model_names):
                    return ModelWaitResult(running=True, last_models=last_models, last_error=None)
            except Exception as exc:
                last_error = f"{type(exc).__name__}: {exc}"
                logger.warning("Model lifecycle status poll failed for %s on %s: %s", sorted(model_names), node_name, exc)
            if asyncio.get_running_loop().time() >= deadline:
                return ModelWaitResult(running=False, last_models=last_models, last_error=last_error)
            await asyncio.sleep(1.0)


def running_model_names(models: list[dict[str, Any]]) -> list[str]:
    return [
        str(model["name"])
        for model in models
        if isinstance(model, dict) and model.get("name") and model.get("running")
    ]


def model_running(models: list[dict[str, Any]], model_names: set[str]) -> bool:
    return any(
        isinstance(model, dict)
        and model.get("name") in model_names
        and bool(model.get("running"))
        and _model_ready(model)
        for model in models
    )


def _expected_running_names(model_name: str, start_response: object) -> set[str]:
    names = {model_name}
    if isinstance(start_response, dict):
        response_name = str(start_response.get("name") or "").strip()
        if response_name:
            names.add(response_name)
    return names


def _model_ready(model: dict[str, Any]) -> bool:
    if "ready" not in model:
        return True
    return bool(model.get("ready"))


def _observed_model_summaries(models: list[dict[str, Any]]) -> list[str]:
    summaries: list[str] = []
    for model in models:
        if not isinstance(model, dict):
            continue
        name = str(model.get("name") or "").strip()
        if not name:
            continue
        if "ready" in model:
            summaries.append(f"{name}:running={bool(model.get('running'))}:ready={bool(model.get('ready'))}")
            continue
        summaries.append(f"{name}:running={bool(model.get('running'))}")
    return summaries
