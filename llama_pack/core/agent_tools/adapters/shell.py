from __future__ import annotations

import asyncio

from llama_pack.core.agent_tools.common import MAX_RESULT_CHARS, truncate
from llama_pack.core.config.models import AgentToolDefinitionConfig, AppConfig


class ShellToolAdapter:
    def __init__(self, config: AppConfig) -> None:
        self.config = config

    async def execute(self, tool: AgentToolDefinitionConfig, arguments: dict[str, object]) -> dict[str, object]:
        process = await asyncio.create_subprocess_exec(
            *(tool.command or []),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        try:
            stdout, stderr = await asyncio.wait_for(
                process.communicate(),
                timeout=tool.timeout_seconds or self.config.agent_tools.tool_timeout_seconds,
            )
        except TimeoutError:
            process.kill()
            await process.communicate()
            return {"ok": False, "exit_code": None, "error": "tool timed out"}

        out = stdout.decode("utf-8", errors="replace")
        err = stderr.decode("utf-8", errors="replace")
        return {
            "ok": process.returncode == 0,
            "exit_code": process.returncode,
            "content": truncate(out, MAX_RESULT_CHARS),
            "stderr": truncate(err, MAX_RESULT_CHARS) if err else "",
        }
