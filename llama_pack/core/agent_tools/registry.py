from __future__ import annotations

from typing import Any

from llama_pack.core.config.models import AgentToolsConfig


class ToolRegistry:
    def __init__(self, config: AgentToolsConfig, runtime_tools: list[dict[str, Any]] | None = None) -> None:
        self.config = config
        self.runtime_tools = runtime_tools or []

    def openai_tools(self) -> list[dict[str, Any]]:
        tools = list(self.runtime_tools)
        for name, tool in self.config.tools.items():
            parameters = tool.parameters or _default_parameters(tool.type)
            tools.append(
                {
                    "type": "function",
                    "function": {
                        "name": name,
                        "description": tool.description,
                        "parameters": parameters,
                    },
                }
            )
        return tools


def _default_parameters(tool_type: str) -> dict[str, Any]:
    if tool_type == "file_read_dynamic":
        return {
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": "Relative file path under the configured root.",
                }
            },
            "required": ["path"],
            "additionalProperties": False,
        }
    return {"type": "object", "properties": {}, "additionalProperties": False}
