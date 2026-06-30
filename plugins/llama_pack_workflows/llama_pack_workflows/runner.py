from __future__ import annotations

from collections.abc import Callable
from pathlib import Path
from typing import Protocol

from fastapi import FastAPI

from llama_pack.core.threads.models import WorkflowStep
from llama_pack_workflows.models import TriggerType, WorkflowDefinition, WorkflowRun
from llama_pack_workflows.store import WorkflowStore


class ModelRouteRegistry(Protocol):
    def list_nodes(self) -> list[dict[str, object]]: ...

    async def request_node(self, node_name: str, method: str, path: str) -> object: ...


class WorkflowRunner:
    def __init__(self, store: WorkflowStore, app_provider: Callable[[], FastAPI | None]) -> None:
        self.store = store
        self.app_provider = app_provider

    async def run_manual(self, workflow_id: str) -> WorkflowRun:
        definition = self.store.get_definition(workflow_id)
        run = self.store.create_run(definition.id, "manual", "api", None)
        return await self._execute_run(run.id, definition)

    async def run_from_trigger(
        self,
        definition: WorkflowDefinition,
        trigger_type: TriggerType,
        trigger_detail: str,
        correlation_id: str | None,
    ) -> WorkflowRun:
        run = self.store.create_run(definition.id, trigger_type, trigger_detail, correlation_id)
        return await self._execute_run(run.id, definition)

    async def _execute_run(self, run_id: str, definition: WorkflowDefinition) -> WorkflowRun:
        self.store.mark_run_running(run_id)
        try:
            if definition.template_id == "thread_prompt_chain":
                await self._run_thread_prompt_chain(run_id, definition)
            else:
                raise ValueError(f"Workflow template {definition.template_id} does not support execution yet")
            return self.store.mark_run_completed(run_id)
        except Exception as exc:
            return self.store.mark_run_failed(run_id, str(exc))

    async def route_options(self) -> dict[str, list[dict[str, str]]]:
        app = self.app_provider()
        if app is None:
            raise RuntimeError("Workflow runner cannot list route options because the FastAPI app is not available")
        registry: ModelRouteRegistry | None = getattr(app.state, "node_registry", None)
        if registry is None:
            return {"models": [{"value": "auto", "label": "Auto"}], "targets": [{"value": "auto", "label": "Auto"}]}

        models: dict[str, str] = {"auto": "Auto"}
        targets: dict[str, str] = {"auto": "Auto"}
        for node in registry.list_nodes():
            node_name = str(node.get("name") or "").strip()
            if not node_name:
                continue
            if bool(node.get("heartbeat_fresh")):
                targets[f"node:{node_name}"] = node_name
                for model in await self._node_models(registry, node_name):
                    model_name = str(model.get("name") or "").strip()
                    if model_name:
                        models[model_name] = model_name
                for model_name in await self._node_gguf_names(registry, node_name):
                    models[model_name] = model_name
        return {
            "models": [{"value": value, "label": label} for value, label in models.items()],
            "targets": [{"value": value, "label": label} for value, label in targets.items()],
        }

    async def _run_thread_prompt_chain(self, run_id: str, definition: WorkflowDefinition) -> None:
        parameters = definition.parameters
        content = _required_string(parameters, "content")
        steps = _required_steps(parameters)
        model = _required_string(parameters, "model")
        target = _required_string(parameters, "target")
        app = self.app_provider()
        if app is None:
            raise RuntimeError("Workflow runner cannot execute because the FastAPI app is not available")
        thread = app.state.thread_service.create_thread(
            title=definition.name,
            default_model=model,
            metadata={"workflow_id": definition.id},
            created_by="llama_pack_workflows",
        )
        thread_id = str(thread["id"])
        result = await app.state.thread_service.run_workflow_async(
            thread_id=thread_id,
            content=content,
            steps=steps,
            model=model,
            target=target,
            metadata={"workflow_id": definition.id, "workflow_run_id": run_id},
        )
        message = result.get("message")
        if not isinstance(message, dict):
            raise TypeError(f"Thread workflow response message must be an object for workflow {definition.id}")
        output = message.get("content")
        self.store.add_step(
            run_id,
            "thread_prompt_chain",
            "completed",
            content[:500],
            str(output)[:500],
            None,
            thread_id,
            None,
        )

    async def _node_models(self, registry: ModelRouteRegistry, node_name: str) -> list[dict[str, object]]:
        payload = await registry.request_node(node_name, "GET", "/lm-api/v1/models")
        if not isinstance(payload, list):
            raise TypeError(f"Node {node_name} model options response must be a list")
        models: list[dict[str, object]] = []
        for item in payload:
            if isinstance(item, dict):
                models.append(item)
        return models

    async def _node_gguf_names(self, registry: ModelRouteRegistry, node_name: str) -> list[str]:
        payload = await registry.request_node(node_name, "GET", "/lm-api/v1/library/ggufs")
        if not isinstance(payload, list):
            raise TypeError(f"Node {node_name} GGUF options response must be a list")
        names: dict[str, str] = {}
        for item in payload:
            if not isinstance(item, dict):
                continue
            for value in (
                str(item.get("name") or "").strip(),
                str(item.get("registered_as") or "").strip(),
                Path(str(item.get("filename") or "")).stem.strip(),
            ):
                if value:
                    names[value] = value
        return list(names)


def _required_string(parameters: dict[str, object], key: str) -> str:
    value = parameters.get(key)
    if not isinstance(value, str) or not value:
        raise ValueError(f"Workflow parameter {key!r} must be a non-empty string")
    return value


def _required_steps(parameters: dict[str, object]) -> list[WorkflowStep]:
    raw_steps = parameters.get("steps")
    if not isinstance(raw_steps, list) or not raw_steps:
        raise ValueError("Workflow parameter 'steps' must be a non-empty list")
    return [WorkflowStep.model_validate(step) for step in raw_steps]
