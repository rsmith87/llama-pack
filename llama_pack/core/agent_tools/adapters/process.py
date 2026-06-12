from __future__ import annotations

from typing import TYPE_CHECKING

from llama_pack.core.config.models import AgentToolDefinitionConfig, AppConfig

if TYPE_CHECKING:
    from llama_pack.core.runtime.process_manager import ProcessManager

_PROCESS_STATUS_FIELDS = ("name", "running", "pid", "port", "family")


class ProcessStatusToolAdapter:
    def __init__(self, config: AppConfig, process_manager: ProcessManager | None) -> None:
        self.config = config
        self.process_manager = process_manager

    async def execute(self, tool: AgentToolDefinitionConfig, arguments: dict[str, object]) -> dict[str, object]:
        if self.process_manager is None:
            return {"ok": False, "error": "process_status is not available: no process manager"}
        statuses = self.process_manager.list_statuses()
        processes = [
            {key: s[key] for key in _PROCESS_STATUS_FIELDS if key in s}
            for s in statuses[: tool.max_entries]
        ]
        return {
            "ok": True,
            "processes": processes,
            "total": len(statuses),
            "truncated": len(statuses) > tool.max_entries,
        }
