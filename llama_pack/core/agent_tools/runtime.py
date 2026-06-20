from __future__ import annotations

import json
from typing import TYPE_CHECKING, Any
from uuid import uuid4

from llama_pack.core.agent_tools.executor import ToolExecutor
from llama_pack.core.agent_tools.registry import ToolRegistry
from llama_pack.core.agent_tools.tracing import RuntimeTraceRecorder
from llama_pack.core.code_graph.tools import ProjectGraphToolContext, project_graph_tool_definitions
from llama_pack.core.config.models import AppConfig

if TYPE_CHECKING:
    from llama_pack.core.memory.store import ChromaMemoryStore
    from llama_pack.core.runtime.process_manager import ProcessManager


class AgentToolLoop:
    def __init__(
        self,
        config: AppConfig,
        proxy: Any,
        process_manager: ProcessManager | None = None,
        memory_store: ChromaMemoryStore | None = None,
        trace_recorder: RuntimeTraceRecorder | None = None,
        project_graph_context: ProjectGraphToolContext | None = None,
    ) -> None:
        self.config = config
        self.proxy = proxy
        runtime_tools = project_graph_tool_definitions() if project_graph_context is not None else []
        self.registry = ToolRegistry(config.agent_tools, runtime_tools=runtime_tools)
        self.trace_recorder = trace_recorder
        self.executor = ToolExecutor(
            config,
            process_manager=process_manager,
            memory_store=memory_store,
            trace_recorder=trace_recorder,
            project_graph_context=project_graph_context,
        )

    async def run(
        self,
        model_name: str,
        payload: dict[str, Any],
        request_id: str | None = None,
    ) -> tuple[dict[str, Any], dict[str, Any]]:
        request_id = request_id or str(uuid4())
        messages = [dict(message) for message in payload.get("messages", [])]
        max_iterations = _request_max_iterations(payload, self.config.agent_tools.max_iterations)
        if self.executor.project_graph_context is not None:
            messages.insert(
                0,
                {
                    "role": "system",
                    "content": "Project code graph tools are available for this chat. Use them to inspect indexed symbols, relationships, routes, and React components before making codebase claims.",
                },
            )
        base_payload = {key: value for key, value in payload.items() if key not in {"messages", "tool_runtime", "agent_tool_max_iterations"}}
        tool_defs = self.registry.openai_tools()
        last_meta: dict[str, Any] = {}

        for iteration in range(max_iterations):
            self._emit(
                "assistant_turn_started",
                model=model_name,
                title=f"Assistant turn {iteration + 1}",
                payload={"iteration": iteration + 1},
            )
            request_payload = {**base_payload, "messages": messages, "tools": tool_defs}
            response, last_meta = await self.proxy.chat_with_meta(model_name, request_payload)
            message = _assistant_message(response)
            tool_calls = _tool_calls(message)
            if not tool_calls:
                self._emit(
                    "assistant_message_completed",
                    status="passed",
                    model=model_name,
                    title="Assistant answered",
                    payload={"content": message.get("content") or ""},
                )
                return response, last_meta

            messages.append(message)
            for tool_call in tool_calls:
                function = tool_call.get("function") or {}
                name = str(function.get("name") or "")
                arguments = _parse_arguments(function.get("arguments"))
                tool_call_id = str(tool_call.get("id") or name)
                result = await self.executor.execute(
                    name,
                    arguments,
                    request_id=request_id,
                    model=model_name,
                    tool_call_id=tool_call_id,
                )
                messages.append(
                    {
                        "role": "tool",
                        "tool_call_id": tool_call_id,
                        "name": name,
                        "content": json.dumps(result),
                    }
                )

        raise RuntimeError("agent tool loop reached max_iterations before final assistant response")

    def _emit(self, event_type: str, **kwargs: Any) -> dict[str, Any] | None:
        if self.trace_recorder is None:
            return None
        return self.trace_recorder.emit(event_type, **kwargs)


def _assistant_message(response: dict[str, Any]) -> dict[str, Any]:
    choices = response.get("choices") or []
    if not choices or not isinstance(choices[0], dict):
        return {"role": "assistant", "content": ""}
    message = choices[0].get("message") or {}
    return dict(message) if isinstance(message, dict) else {"role": "assistant", "content": str(message)}


def _tool_calls(message: dict[str, Any]) -> list[dict[str, Any]]:
    calls = message.get("tool_calls") or []
    return [call for call in calls if isinstance(call, dict)]


def _parse_arguments(raw: Any) -> dict[str, Any]:
    if isinstance(raw, dict):
        return raw
    if not isinstance(raw, str) or not raw.strip():
        return {}
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return {}
    return parsed if isinstance(parsed, dict) else {}


def _request_max_iterations(payload: dict[str, Any], configured_max_iterations: int) -> int:
    raw = payload.get("agent_tool_max_iterations")
    if raw is None:
        return configured_max_iterations
    if not isinstance(raw, int):
        raise ValueError("agent_tool_max_iterations must be an integer between 1 and 16")
    if raw < 1 or raw > 16:
        raise ValueError("agent_tool_max_iterations must be between 1 and 16")
    return raw
