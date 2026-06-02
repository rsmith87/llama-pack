from __future__ import annotations

import json

import httpx

from llama_manager.core.agent_tools.common import MAX_RESULT_CHARS, truncate
from llama_manager.core.config.models import AgentToolDefinitionConfig, AppConfig


class HttpToolAdapter:
    def __init__(self, config: AppConfig) -> None:
        self.config = config

    async def execute(self, tool: AgentToolDefinitionConfig, arguments: dict[str, object]) -> dict[str, object]:
        async with httpx.AsyncClient(timeout=tool.timeout_seconds or self.config.agent_tools.tool_timeout_seconds) as client:
            response = await client.request((tool.method or "GET").upper(), tool.url or "")
        return {
            "ok": response.status_code < 400,
            "status_code": response.status_code,
            "content": truncate(response.text, MAX_RESULT_CHARS),
        }


class HttpJsonToolAdapter:
    def __init__(self, config: AppConfig) -> None:
        self.config = config

    async def execute(self, tool: AgentToolDefinitionConfig, arguments: dict[str, object]) -> dict[str, object]:
        timeout = tool.timeout_seconds or self.config.agent_tools.tool_timeout_seconds
        url = tool.url or ""
        method = (tool.method or "GET").upper()
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.request(method, url)
        raw = response.content[: tool.max_response_bytes]
        try:
            parsed = response.json() if len(response.content) == len(raw) else _json_loads_bytes(raw)
        except Exception as exc:
            return {
                "ok": False,
                "status_code": response.status_code,
                "error": f"invalid JSON: {exc}",
            }
        return {
            "ok": response.status_code < 400,
            "status_code": response.status_code,
            "data": parsed,
            "truncated": len(response.content) > tool.max_response_bytes,
        }


def _json_loads_bytes(data: bytes) -> object:
    return json.loads(data.decode("utf-8", errors="replace"))
