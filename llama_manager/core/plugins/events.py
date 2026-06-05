from __future__ import annotations

import asyncio
import inspect
from collections import defaultdict
from collections.abc import Callable
from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from pydantic import BaseModel, Field


class EventSource(BaseModel):
    kind: str = "core"
    id: str = "neuraxis"


class EventActor(BaseModel):
    user: str | None = None
    role: str | None = None
    api_key_id: str | None = None
    session_id: str | None = None


class EventEnvelope(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    type: str
    version: str = "1.0"
    occurred_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    source: EventSource = Field(default_factory=EventSource)
    correlation_id: str | None = None
    actor: EventActor = Field(default_factory=EventActor)
    payload: dict[str, Any] = Field(default_factory=dict)


class EventBus:
    def __init__(self, *, timeout_seconds: float = 2.0) -> None:
        self.timeout_seconds = timeout_seconds
        self._subscribers: dict[str, list[tuple[str, Callable[[EventEnvelope], Any]]]] = defaultdict(list)
        self._health_recorder: Callable[[str, str, str], None] | None = None
        self._locks: dict[str, asyncio.Lock] = defaultdict(asyncio.Lock)

    def set_health_recorder(self, recorder: Callable[[str, str, str], None]) -> None:
        self._health_recorder = recorder

    def subscribe(self, plugin_id: str, event_type: str, handler: Callable[[EventEnvelope], Any]) -> None:
        self._subscribers[event_type].append((plugin_id, handler))

    def remove_plugin(self, plugin_id: str) -> None:
        for event_type, subscribers in list(self._subscribers.items()):
            remaining = [(owner, handler) for owner, handler in subscribers if owner != plugin_id]
            if remaining:
                self._subscribers[event_type] = remaining
            else:
                self._subscribers.pop(event_type, None)

    async def emit(
        self,
        event_type: str,
        *,
        payload: dict[str, Any] | None = None,
        correlation_id: str | None = None,
        actor: dict[str, Any] | None = None,
    ) -> EventEnvelope:
        event = EventEnvelope(
            type=event_type,
            payload=payload or {},
            correlation_id=correlation_id,
            actor=EventActor.model_validate(actor or {}),
        )
        key = correlation_id or event.id
        async with self._locks[key]:
            for plugin_id, handler in list(self._subscribers.get(event_type, [])):
                try:
                    result = handler(event)
                    if inspect.isawaitable(result):
                        await asyncio.wait_for(result, timeout=self.timeout_seconds)
                except Exception as exc:
                    if self._health_recorder is not None:
                        self._health_recorder(plugin_id, "error", str(exc))
        return event
