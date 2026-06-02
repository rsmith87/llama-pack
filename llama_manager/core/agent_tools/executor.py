from __future__ import annotations

import time
from typing import TYPE_CHECKING, Any

from llama_manager.core.agent_tools.adapters import ToolAdapter, default_adapters
from llama_manager.core.agent_tools.tracing import ToolTraceWriter
from llama_manager.core.config.models import AppConfig

if TYPE_CHECKING:
    from llama_manager.core.memory.store import ChromaMemoryStore
    from llama_manager.core.runtime.process_manager import ProcessManager


class ToolExecutor:
    def __init__(
        self,
        config: AppConfig,
        adapters: dict[str, ToolAdapter] | None = None,
        trace_writer: ToolTraceWriter | None = None,
        process_manager: ProcessManager | None = None,
        memory_store: ChromaMemoryStore | None = None,
    ) -> None:
        self.config = config
        self.adapters = adapters or default_adapters(config, process_manager=process_manager, memory_store=memory_store)
        self.trace_writer = trace_writer or ToolTraceWriter(config)

    async def execute(self, name: str, arguments: dict[str, Any], request_id: str, model: str) -> dict[str, Any]:
        started = time.monotonic()
        tool = self.config.agent_tools.tools.get(name)
        if tool is None:
            result = {"ok": False, "error": f"Unknown tool {name!r}"}
            self.trace_writer.write(request_id, model, name, "unknown", started, result)
            return result

        adapter = self.adapters.get(tool.type)
        if adapter is None:
            result = {"ok": False, "error": f"Unsupported tool adapter {tool.type!r}"}
            self.trace_writer.write(request_id, model, name, tool.type, started, result)
            return result

        try:
            result = await adapter.execute(tool, arguments)
        except Exception as exc:
            result = {"ok": False, "error": str(exc)}

        self.trace_writer.write(request_id, model, name, tool.type, started, result)
        return result
