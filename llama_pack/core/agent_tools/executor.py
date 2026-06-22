from __future__ import annotations

import time
from typing import TYPE_CHECKING, Any

from llama_pack.core.agent_tools.adapters import ToolAdapter, default_adapters
from llama_pack.core.agent_tools.tracing import RuntimeTraceRecorder, ToolTraceWriter
from llama_pack.core.code_graph.tools import GRAPH_TOOL_NAMES, ProjectGraphToolContext, execute_project_graph_tool
from llama_pack.core.config.models import AppConfig

if TYPE_CHECKING:
    from llama_pack.core.memory.store import ChromaMemoryStore
    from llama_pack.core.runtime.process_manager import ProcessManager


class ToolExecutor:
    def __init__(
        self,
        config: AppConfig,
        adapters: dict[str, ToolAdapter] | None = None,
        trace_writer: ToolTraceWriter | None = None,
        trace_recorder: RuntimeTraceRecorder | None = None,
        process_manager: ProcessManager | None = None,
        memory_store: ChromaMemoryStore | None = None,
        project_graph_context: ProjectGraphToolContext | None = None,
    ) -> None:
        self.config = config
        self.adapters = adapters or default_adapters(config, process_manager=process_manager, memory_store=memory_store)
        self.trace_writer = trace_writer or ToolTraceWriter(config)
        self.trace_recorder = trace_recorder
        self.project_graph_context = project_graph_context

    async def execute(
        self,
        name: str,
        arguments: dict[str, Any],
        request_id: str,
        model: str,
        *,
        case_id: str | None = None,
        tool_call_id: str | None = None,
    ) -> dict[str, Any]:
        started = time.monotonic()
        if self.trace_recorder is not None:
            self.trace_recorder.emit(
                "tool_call_started",
                case_id=case_id,
                tool_call_id=tool_call_id,
                model=model,
                title=f"{name} started",
                payload={"tool_name": name, "arguments": arguments},
            )
        if name in GRAPH_TOOL_NAMES:
            result = await self._execute_project_graph_tool(name, arguments)
            self.trace_writer.write(request_id, model, name, "project_graph", started, result)
            self._emit_completed(name, arguments, result, model, case_id, tool_call_id, started)
            return result

        tool = self.config.agent_tools.tools.get(name)
        if tool is None:
            result = {"ok": False, "error": f"Unknown tool {name!r}"}
            self.trace_writer.write(request_id, model, name, "unknown", started, result)
            self._emit_completed(name, arguments, result, model, case_id, tool_call_id, started)
            return result

        adapter = self.adapters.get(tool.type)
        if adapter is None:
            result = {"ok": False, "error": f"Unsupported tool adapter {tool.type!r}"}
            self.trace_writer.write(request_id, model, name, tool.type, started, result)
            self._emit_completed(name, arguments, result, model, case_id, tool_call_id, started)
            return result

        try:
            result = await adapter.execute(tool, arguments)
        except Exception as exc:
            result = {"ok": False, "error": str(exc)}

        self.trace_writer.write(request_id, model, name, tool.type, started, result)
        self._emit_completed(name, arguments, result, model, case_id, tool_call_id, started)
        return result

    async def _execute_project_graph_tool(self, name: str, arguments: dict[str, Any]) -> dict[str, Any]:
        if self.project_graph_context is None:
            return {"ok": False, "error": "Project graph tools require an active project_id"}
        try:
            return await execute_project_graph_tool(self.project_graph_context, name, arguments)
        except Exception as exc:
            return {"ok": False, "error": str(exc)}

    def _emit_completed(
        self,
        name: str,
        arguments: dict[str, Any],
        result: dict[str, Any],
        model: str,
        case_id: str | None,
        tool_call_id: str | None,
        started: float,
    ) -> None:
        if self.trace_recorder is None:
            return
        ok = bool(result.get("ok"))
        event = self.trace_recorder.emit(
            "tool_call_completed" if ok else "tool_call_failed",
            status="passed" if ok else "failed",
            case_id=case_id,
            tool_call_id=tool_call_id,
            model=model,
            title=f"{name} {'completed' if ok else 'failed'}",
            payload={
                "tool_name": name,
                "arguments": arguments,
                "duration_ms": round((time.monotonic() - started) * 1000, 3),
                "result": result,
            },
        )
        locations = result.get("locations")
        if isinstance(locations, list):
            event["locations"] = locations
