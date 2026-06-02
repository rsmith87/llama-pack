from __future__ import annotations

import json
import time
from typing import Any

from llama_manager.core.agent_tools.common import TRACE_RESULT_CHARS, truncate
from llama_manager.core.config.models import AppConfig


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
            "result_preview": truncate(str(result.get("content") or ""), TRACE_RESULT_CHARS),
        }
        with (self.config.log_dir / "agent_tool_calls.jsonl").open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(trace, sort_keys=True) + "\n")
