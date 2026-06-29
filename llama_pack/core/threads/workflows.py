from __future__ import annotations

from typing import Any
from uuid import uuid4

from llama_pack.core.chat.internal_payload import TRUSTED_CONTROLLER_TARGET_KEY
from llama_pack.core.model_lifecycle import ManagedModelLifecycle
from llama_pack.core.threads.events import ThreadEventPublisher
from llama_pack.core.threads.routing import RouteDecision
from llama_pack.core.threads.routing import RoutingPolicy
from llama_pack.core.threads.store import ThreadStore


class WorkflowRunError(RuntimeError):
    def __init__(self, error_code: str, step_index: int, step_label: str, cause: Exception) -> None:
        self.error_code = error_code
        self.step_index = step_index
        self.step_label = step_label
        self.error = str(cause)
        super().__init__(f"Workflow step {step_index + 1} '{step_label}' failed: {cause}")

    def detail(self) -> dict[str, str | int]:
        return {
            "code": self.error_code,
            "message": str(self),
            "step_index": self.step_index,
            "step_label": self.step_label,
            "error": self.error,
        }


class ThreadWorkflowRunner:
    def __init__(
        self,
        store: ThreadStore,
        routing_policy: RoutingPolicy,
        chat_proxy: Any,
        event_publisher: ThreadEventPublisher,
        model_lifecycle: ManagedModelLifecycle | None,
    ) -> None:
        self.store = store
        self.routing_policy = routing_policy
        self.chat_proxy = chat_proxy
        self.event_publisher = event_publisher
        self.model_lifecycle = model_lifecycle

    async def run_workflow(
        self,
        thread_id: str,
        content: str,
        steps: list[Any],
        model: str | None,
        target: str,
        metadata: dict[str, Any] | None,
    ) -> dict[str, Any]:
        thread = self.store.get_thread(thread_id)
        request_metadata = {**thread.get("metadata", {}), **(metadata or {})}
        turn_id = str(uuid4())

        await self.event_publisher.append_event(
            thread_id=thread_id,
            event_type="user_message",
            role="user",
            content={"text": content, "metadata": request_metadata},
            public=True,
            turn_id=turn_id,
            route=None,
            agent_node=None,
            model=None,
            error_code=None,
            error_detail=None,
        )

        current_input = content
        step_results: list[dict[str, Any]] = []
        managed_loads: list[tuple[str, str, list[str]]] = []

        try:
            for index, step in enumerate(steps):
                step_model = step.model or model or thread.get("default_model")
                step_target = step.target if step.target != "auto" else target

                try:
                    decision = await self.routing_policy.choose(
                        request_type=request_metadata.get("request_type") or "general",
                        requested_model=step_model,
                        explicit_target=step_target,
                        previous_route=None,
                    )
                except ValueError as exc:
                    await self.event_publisher.append_error_async(thread_id, "WORKFLOW_ROUTING_ERROR", exc, turn_id)
                    raise

                await self.event_publisher.append_event(
                    thread_id=thread_id,
                    event_type="workflow_step",
                    role=None,
                    content={
                        "label": step.label,
                        "step_index": index,
                        "status": "running",
                        "model": decision.model,
                        "node": decision.node,
                    },
                    public=False,
                    turn_id=turn_id,
                    route=None,
                    agent_node=decision.node,
                    model=decision.model,
                    error_code=None,
                    error_detail=None,
                )

                messages = [
                    {"role": "system", "content": step.instructions},
                    {"role": "user", "content": current_input},
                ]

                try:
                    managed_load = await self._ensure_model_loaded(decision)
                    if managed_load is not None:
                        managed_loads.append(managed_load)
                    raw_response, _response_meta = await self.chat_proxy.chat_with_meta(
                        decision.model,
                        {"messages": messages, "target": f"node:{decision.node}", TRUSTED_CONTROLLER_TARGET_KEY: True},
                    )
                    step_output = raw_response["choices"][0]["message"]["content"]
                except Exception as exc:
                    await self.event_publisher.append_event(
                        thread_id=thread_id,
                        event_type="workflow_step",
                        role=None,
                        content={"label": step.label, "step_index": index, "status": "failed", "error": str(exc)},
                        public=False,
                        turn_id=turn_id,
                        route=None,
                        agent_node=None,
                        model=None,
                        error_code=None,
                        error_detail=None,
                    )
                    await self.event_publisher.append_error_async(thread_id, "WORKFLOW_STEP_ERROR", exc, turn_id)
                    raise WorkflowRunError("WORKFLOW_STEP_ERROR", index, step.label, exc) from exc

                await self.event_publisher.append_event(
                    thread_id=thread_id,
                    event_type="workflow_step",
                    role=None,
                    content={
                        "label": step.label,
                        "step_index": index,
                        "status": "complete",
                        "output": step_output,
                        "model": decision.model,
                        "node": decision.node,
                    },
                    public=False,
                    turn_id=turn_id,
                    route=None,
                    agent_node=decision.node,
                    model=decision.model,
                    error_code=None,
                    error_detail=None,
                )

                step_results.append({"label": step.label, "model": decision.model, "node": decision.node, "output": step_output})
                current_input = step_output

            last = step_results[-1]
            route = {"node": last["node"], "model": last["model"], "strategy": "workflow", "reason": "workflow_final_step"}

            await self.event_publisher.append_event(
                thread_id=thread_id,
                event_type="assistant_message",
                role="assistant",
                content={"text": last["output"], "workflow_steps": step_results},
                public=True,
                turn_id=turn_id,
                route=route,
                agent_node=last["node"],
                model=last["model"],
                error_code=None,
                error_detail=None,
            )

            return {
                "thread_id": thread_id,
                "message": {"role": "assistant", "content": last["output"]},
                "route": route,
                "workflow_steps": step_results,
            }
        finally:
            await self._restore_managed_loads(managed_loads)

    async def _ensure_model_loaded(self, decision: RouteDecision) -> tuple[str, str, list[str]] | None:
        if not decision.startup_needed:
            return None
        if decision.startup_decision != "start_now":
            raise RuntimeError(f"model_start_deferred: node={decision.node} model={decision.model}")
        if self.model_lifecycle is None:
            raise RuntimeError(f"model_lifecycle_unavailable: node={decision.node} model={decision.model}")
        prior_models = await self.model_lifecycle.snapshot_running_models(decision.node)
        try:
            await self.model_lifecycle.load_exclusive(decision.node, decision.model, prior_models)
        except Exception:
            await self.model_lifecycle.restore_exclusive(decision.node, decision.model, prior_models)
            raise
        return decision.node, decision.model, prior_models

    async def _restore_managed_loads(self, managed_loads: list[tuple[str, str, list[str]]]) -> None:
        if self.model_lifecycle is None:
            return
        for node_name, model_name, prior_models in reversed(managed_loads):
            await self.model_lifecycle.restore_exclusive(node_name, model_name, prior_models)
