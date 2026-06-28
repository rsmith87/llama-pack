from __future__ import annotations

from dataclasses import dataclass
from typing import Any
from uuid import uuid4

from llama_pack.core.threads.context import ThreadContextError, ThreadContextManager
from llama_pack.core.threads.events import ThreadEventPublisher
from llama_pack.core.threads.routing import RouteDecision, RoutingPolicy
from llama_pack.core.threads.store import ThreadStore


@dataclass(frozen=True)
class PreparedThreadTurn:
    thread: dict[str, Any]
    request_metadata: dict[str, Any]
    messages: list[dict[str, Any]]
    turn_id: str
    route: dict[str, Any]
    decision: RouteDecision
    model_family: str | None
    context_profile: str | None
    context_management: dict[str, Any] | None

    def profile_payload(self) -> dict[str, str]:
        payload: dict[str, str] = {}
        if self.model_family:
            payload["model_family"] = self.model_family
        if self.context_profile:
            payload["context_profile"] = self.context_profile
        return payload

    def as_legacy_dict(self) -> dict[str, Any]:
        return {
            "thread": self.thread,
            "request_metadata": self.request_metadata,
            "messages": self.messages,
            "turn_id": self.turn_id,
            "route": self.route,
            "decision": self.decision,
            "model_family": self.model_family,
            "context_profile": self.context_profile,
            "context_management": self.context_management,
        }


class ThreadTurnPreparer:
    def __init__(
        self,
        store: ThreadStore,
        routing_policy: RoutingPolicy,
        context_manager: ThreadContextManager,
        event_publisher: ThreadEventPublisher,
    ) -> None:
        self.store = store
        self.routing_policy = routing_policy
        self.context_manager = context_manager
        self.event_publisher = event_publisher

    async def prepare_message_route(
        self,
        thread_id: str,
        role: str,
        content: Any,
        model: str | None,
        model_family: str | None,
        context_profile: str | None,
        target: str,
        metadata: dict[str, Any] | None,
    ) -> PreparedThreadTurn:
        if role != "user":
            raise ValueError("ThreadService only accepts user messages")

        thread = self.store.get_thread(thread_id)
        request_metadata = {**thread.get("metadata", {}), **(metadata or {})}
        request_type = request_metadata.get("request_type") or "general"
        previous_route = self.previous_route(thread_id, model_family=model_family, context_profile=context_profile)
        requested_model = requested_model_name(model, model_family, context_profile)
        display_text = message_display_text(content)
        messages = [
            *self.context_manager.public_messages(thread_id),
            {"role": "user", "content": content},
        ]
        turn_id = str(uuid4())

        await self.event_publisher.append_event(
            thread_id=thread_id,
            event_type="user_message",
            role="user",
            content={"text": display_text, "request_content": json_content(content), "metadata": request_metadata},
            public=True,
            turn_id=turn_id,
            route=None,
            agent_node=None,
            model=None,
            error_code=None,
            error_detail=None,
        )
        try:
            self.require_thread_node_target(thread_id, target)
        except ValueError as exc:
            await self.event_publisher.append_error_async(thread_id, "ROUTING_ERROR", exc, turn_id)
            raise

        try:
            decision = await self.routing_policy.choose(
                request_type=request_type,
                requested_model=requested_model or thread.get("default_model"),
                explicit_target=target,
                previous_route=previous_route,
            )
        except ValueError as exc:
            await self.event_publisher.append_error_async(thread_id, "ROUTING_ERROR", exc, turn_id)
            raise

        route = route_from_decision(decision, model_family, context_profile)

        await self.event_publisher.append_event(
            thread_id=thread_id,
            event_type="routing_decision",
            role=None,
            content={**route, "candidates": list(decision.candidates)},
            public=False,
            turn_id=turn_id,
            route=route,
            agent_node=decision.node,
            model=decision.model,
            error_code=None,
            error_detail=None,
        )
        try:
            managed_messages = await self.context_manager.managed_thread_messages(
                thread_id=thread_id,
                turn_id=turn_id,
                messages=messages,
                model=decision.model,
                route=route,
            )
        except ThreadContextError:
            raise

        return PreparedThreadTurn(
            thread=thread,
            request_metadata=request_metadata,
            messages=managed_messages["messages"],
            turn_id=turn_id,
            route=route,
            decision=decision,
            model_family=model_family,
            context_profile=context_profile,
            context_management=managed_messages["metadata"],
        )

    def previous_route(
        self,
        thread_id: str,
        model_family: str | None,
        context_profile: str | None,
    ) -> dict[str, Any] | None:
        for event in reversed(self.store.list_events(thread_id, include_internal=True)):
            if event["event_type"] != "assistant_message":
                continue
            if event.get("agent_node") and event.get("model"):
                route = event.get("route") or {}
                if model_family or context_profile:
                    if route.get("family") != model_family or route.get("profile") != context_profile:
                        continue
                return {"node": event["agent_node"], "model": event["model"]}
        return None

    def assigned_node(self, thread_id: str) -> str | None:
        for event in reversed(self.store.list_events(thread_id, include_internal=True)):
            if event["event_type"] == "assistant_message" and event.get("agent_node"):
                return str(event["agent_node"])
        return None

    def require_thread_node_target(self, thread_id: str, target: str) -> None:
        target_value = target.strip()
        if not target_value.startswith("node:"):
            return
        requested_node = target_value.removeprefix("node:").strip()
        if not requested_node:
            return
        assigned_node = self.assigned_node(thread_id)
        if assigned_node is None or assigned_node == requested_node:
            return
        raise ValueError(
            f"This thread is already routed to node '{assigned_node}'. "
            f"Start a new thread to use node '{requested_node}'."
        )


def requested_model_name(model: str | None, model_family: str | None, context_profile: str | None) -> str | None:
    if model_family and context_profile:
        return f"{model_family}:{context_profile}"
    return model


def route_from_decision(
    decision: RouteDecision,
    model_family: str | None,
    context_profile: str | None,
) -> dict[str, Any]:
    return {
        "node": decision.node,
        "model": decision.model,
        "family": model_family,
        "profile": context_profile,
        "strategy": decision.strategy,
        "reason": decision.reason,
    }


def message_display_text(content: Any) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        text_parts: list[str] = []
        for block in content:
            block_payload = json_content(block)
            if isinstance(block_payload, dict) and block_payload.get("type") == "text":
                text = block_payload.get("text")
                if isinstance(text, str):
                    text_parts.append(text)
        return "\n".join(text_parts)
    return str(content)


def json_content(content: Any) -> Any:
    if hasattr(content, "model_dump"):
        return content.model_dump()
    if isinstance(content, list):
        return [json_content(item) for item in content]
    return content
