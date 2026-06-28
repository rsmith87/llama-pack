from __future__ import annotations

from typing import Any

from llama_pack.core.plugins.events import EventBus
from llama_pack.core.threads.store import ThreadStore


class ThreadEventPublisher:
    def __init__(self, store: ThreadStore, event_bus: EventBus | None) -> None:
        self.store = store
        self.event_bus = event_bus

    async def append_event(
        self,
        *,
        thread_id: str,
        event_type: str,
        role: str | None,
        content: dict[str, Any],
        public: bool,
        turn_id: str | None,
        route: dict[str, Any] | None,
        agent_node: str | None,
        model: str | None,
        error_code: str | None,
        error_detail: str | None,
    ) -> dict[str, Any]:
        event = self.store.append_event(
            thread_id=thread_id,
            event_type=event_type,
            role=role,
            content=content,
            public=public,
            turn_id=turn_id,
            route=route,
            agent_node=agent_node,
            model=model,
            error_code=error_code,
            error_detail=error_detail,
        )
        await self.publish(event)
        return event

    async def publish(self, event: dict[str, Any]) -> None:
        if self.event_bus is None:
            return
        await self.event_bus.emit(
            plugin_thread_event_type(str(event["event_type"]), event.get("content")),
            payload=plugin_thread_event_payload(event),
            correlation_id=str(event.get("turn_id") or event["id"]),
        )

    def append_error(self, thread_id: str, error_code: str, exc: Exception, turn_id: str | None) -> None:
        self.store.append_event(
            thread_id=thread_id,
            event_type="error",
            role=None,
            content={"text": str(exc)},
            public=True,
            turn_id=turn_id,
            error_code=error_code,
            error_detail=str(exc),
        )

    async def append_error_async(
        self,
        thread_id: str,
        error_code: str,
        exc: Exception,
        turn_id: str | None,
    ) -> None:
        await self.append_event(
            thread_id=thread_id,
            event_type="error",
            role=None,
            content={"text": str(exc)},
            public=True,
            turn_id=turn_id,
            route=None,
            agent_node=None,
            model=None,
            error_code=error_code,
            error_detail=str(exc),
        )


def plugin_thread_event_type(event_type: str, content: dict[str, Any] | None) -> str:
    if event_type == "workflow_step":
        status = (content or {}).get("status")
        if status == "running":
            return "llama_pack.thread.workflow_step.started"
        if status == "complete":
            return "llama_pack.thread.workflow_step.completed"
        if status == "failed":
            return "llama_pack.thread.workflow_step.failed"
    return f"llama_pack.thread.{event_type}.created"


def plugin_thread_event_payload(event: dict[str, Any]) -> dict[str, Any]:
    return {
        "event_id": event["id"],
        "thread_id": event["thread_id"],
        "event_type": event["event_type"],
        "turn_id": event.get("turn_id"),
        "role": event.get("role"),
        "public": bool(event.get("public")),
        "route": event.get("route"),
        "agent_node": event.get("agent_node"),
        "model": event.get("model"),
        "error_code": event.get("error_code"),
        "error_detail": event.get("error_detail"),
        "content": bounded_plugin_content(event.get("content") or {}),
        "created_at": event["created_at"],
    }


def bounded_plugin_content(content: dict[str, Any]) -> dict[str, Any]:
    bounded: dict[str, Any] = {}
    for key, value in content.items():
        if key in {"raw_response", "messages"}:
            continue
        if isinstance(value, str):
            bounded[key] = value[:1000]
        elif isinstance(value, list):
            bounded[key] = value[:20]
        elif isinstance(value, dict):
            bounded[key] = {str(item_key): item_value for item_key, item_value in list(value.items())[:20]}
        else:
            bounded[key] = value
    return bounded
