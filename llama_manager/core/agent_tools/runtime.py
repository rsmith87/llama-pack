from __future__ import annotations

import json
from typing import TYPE_CHECKING, Any
from uuid import uuid4

from llama_manager.core.agent_tools.executor import ToolExecutor
from llama_manager.core.agent_tools.registry import ToolRegistry
from llama_manager.core.config.models import AppConfig

if TYPE_CHECKING:
    from llama_manager.core.memory.store import ChromaMemoryStore
    from llama_manager.core.runtime.process_manager import ProcessManager


class AgentToolLoop:
    def __init__(
        self,
        config: AppConfig,
        proxy: Any,
        process_manager: ProcessManager | None = None,
        memory_store: ChromaMemoryStore | None = None,
    ) -> None:
        self.config = config
        self.proxy = proxy
        self.registry = ToolRegistry(config.agent_tools)
        self.executor = ToolExecutor(config, process_manager=process_manager, memory_store=memory_store)

    async def run(
        self,
        model_name: str,
        payload: dict[str, Any],
        request_id: str | None = None,
    ) -> tuple[dict[str, Any], dict[str, Any]]:
        request_id = request_id or str(uuid4())
        messages = [dict(message) for message in payload.get("messages", [])]
        base_payload = {key: value for key, value in payload.items() if key not in {"messages", "tool_runtime"}}
        tool_defs = self.registry.openai_tools()
        last_meta: dict[str, Any] = {}

        for _ in range(self.config.agent_tools.max_iterations):
            request_payload = {**base_payload, "messages": messages, "tools": tool_defs}
            response, last_meta = await self.proxy.chat_with_meta(model_name, request_payload)
            message = _assistant_message(response)
            tool_calls = _tool_calls(message)
            if not tool_calls:
                return response, last_meta

            messages.append(message)
            for tool_call in tool_calls:
                function = tool_call.get("function") or {}
                name = str(function.get("name") or "")
                arguments = _parse_arguments(function.get("arguments"))
                result = await self.executor.execute(name, arguments, request_id=request_id, model=model_name)
                messages.append(
                    {
                        "role": "tool",
                        "tool_call_id": tool_call.get("id") or name,
                        "name": name,
                        "content": json.dumps(result),
                    }
                )

        raise RuntimeError("agent tool loop reached max_iterations before final assistant response")


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
