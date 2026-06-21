from __future__ import annotations

import asyncio
import json
import time
from datetime import UTC, datetime
from typing import Any

from llama_pack.core.agent_tools.common import TRACE_RESULT_CHARS, truncate
from llama_pack.core.config.models import AppConfig


class RuntimeTraceRecorder:
    def __init__(self, *, trace_id: str, source: str, scope: str) -> None:
        self.trace_id = trace_id
        self.source = source
        self.scope = scope
        self.events: list[dict[str, Any]] = []
        self._sequence = 0
        self._queue: asyncio.Queue[dict[str, Any] | None] = asyncio.Queue()
        self._closed = False

    def emit(
        self,
        event_type: str,
        *,
        status: str = "running",
        scope: str | None = None,
        case_id: str | None = None,
        tool_call_id: str | None = None,
        model: str | None = None,
        title: str = "",
        summary: str = "",
        payload: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        self._sequence += 1
        event = {
            "id": f"{self.trace_id}-{self._sequence:06d}",
            "trace_id": self.trace_id,
            "sequence": self._sequence,
            "timestamp": datetime.now(UTC).isoformat(),
            "event_type": event_type,
            "source": self.source,
            "scope": scope or self.scope,
            "status": status,
            "payload": payload or {},
        }
        if case_id is not None:
            event["case_id"] = case_id
        if tool_call_id is not None:
            event["tool_call_id"] = tool_call_id
        if model is not None:
            event["model"] = model
        if title:
            event["title"] = title
        if summary:
            event["summary"] = summary
        self.events.append(event)
        if not self._closed:
            self._queue.put_nowait(event)
        return event

    def events_for_case(self, case_id: str) -> list[dict[str, Any]]:
        return [event for event in self.events if event.get("case_id") == case_id]

    async def stream(self):
        seen: set[str] = set()
        index = 0
        while index < len(self.events):
            event = self.events[index]
            seen.add(str(event["id"]))
            yield event
            index += 1
        while True:
            event = await self._queue.get()
            if event is None:
                break
            if str(event["id"]) in seen:
                continue
            seen.add(str(event["id"]))
            yield event

    def close(self) -> None:
        if self._closed:
            return
        self._closed = True
        self._queue.put_nowait(None)


class ToolTraceWriter:
    def __init__(self, config: AppConfig) -> None:
        self.config = config

    def write(
        self,
        request_id: str,
        model: str,
        name: str,
        adapter_type: str,
        started: float,
        result: dict[str, Any],
    ) -> None:
        self.config.log_dir.mkdir(parents=True, exist_ok=True)
        trace = {
            "request_id": request_id,
            "model": model,
            "tool_name": name,
            "adapter_type": adapter_type,
            "duration_ms": round((time.monotonic() - started) * 1000, 3),
            "status": "ok" if result.get("ok") else "error",
            "exit_code": result.get("exit_code"),
            "status_code": result.get("status_code"),
            "error": result.get("error") or "",
            "locations": result.get("locations") or [],
            "result_preview": truncate(str(result.get("content") or ""), TRACE_RESULT_CHARS),
        }
        with (self.config.log_dir / "agent_tool_calls.jsonl").open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(trace, sort_keys=True) + "\n")
