from __future__ import annotations

from typing import TYPE_CHECKING, Protocol

from llama_manager.core.config.models import AgentToolDefinitionConfig, AppConfig
from llama_manager.core.agent_tools.adapters.filesystem import (
    DirectoryListToolAdapter,
    DynamicFileReadToolAdapter,
    FileReadToolAdapter,
    FileSearchToolAdapter,
    FileWriteToolAdapter,
    LogTailToolAdapter,
    TextSearchToolAdapter,
)
from llama_manager.core.agent_tools.adapters.git import (
    GitDiffToolAdapter,
    GitLogToolAdapter,
    GitStatusToolAdapter,
)
from llama_manager.core.agent_tools.adapters.http import HttpJsonToolAdapter, HttpToolAdapter
from llama_manager.core.agent_tools.adapters.memory import MemorySearchToolAdapter, MemoryWriteToolAdapter
from llama_manager.core.agent_tools.adapters.process import ProcessStatusToolAdapter
from llama_manager.core.agent_tools.adapters.shell import ShellToolAdapter
from llama_manager.core.agent_tools.adapters.sqlite import SqliteQueryToolAdapter
from llama_manager.core.agent_tools.adapters.web_fetch import WebFetchToolAdapter

if TYPE_CHECKING:
    from llama_manager.core.memory.store import ChromaMemoryStore
    from llama_manager.core.runtime.process_manager import ProcessManager


class ToolAdapter(Protocol):
    async def execute(self, tool: AgentToolDefinitionConfig, arguments: dict[str, object]) -> dict[str, object]: ...


def default_adapters(
    config: AppConfig,
    process_manager: ProcessManager | None = None,
    memory_store: ChromaMemoryStore | None = None,
) -> dict[str, ToolAdapter]:
    adapters: dict[str, ToolAdapter] = {
        "shell": ShellToolAdapter(config),
        "file_read": FileReadToolAdapter(config),
        "file_read_dynamic": DynamicFileReadToolAdapter(config),
        "file_write": FileWriteToolAdapter(config),
        "http": HttpToolAdapter(config),
        "directory_list": DirectoryListToolAdapter(config),
        "file_search": FileSearchToolAdapter(config),
        "text_search": TextSearchToolAdapter(config),
        "git_status": GitStatusToolAdapter(config),
        "git_diff": GitDiffToolAdapter(config),
        "git_log": GitLogToolAdapter(config),
        "process_status": ProcessStatusToolAdapter(config, process_manager),
        "http_json": HttpJsonToolAdapter(config),
        "log_tail": LogTailToolAdapter(config),
        "sqlite_query": SqliteQueryToolAdapter(config),
        "web_fetch": WebFetchToolAdapter(config),
    }
    if memory_store is not None and not memory_store.disabled:
        adapters["memory_write"] = MemoryWriteToolAdapter(memory_store)
        adapters["memory_search"] = MemorySearchToolAdapter(memory_store)
    return adapters


__all__ = [
    "ToolAdapter",
    "default_adapters",
    "ShellToolAdapter",
    "FileReadToolAdapter",
    "DynamicFileReadToolAdapter",
    "FileWriteToolAdapter",
    "DirectoryListToolAdapter",
    "FileSearchToolAdapter",
    "TextSearchToolAdapter",
    "LogTailToolAdapter",
    "HttpToolAdapter",
    "HttpJsonToolAdapter",
    "GitStatusToolAdapter",
    "GitDiffToolAdapter",
    "GitLogToolAdapter",
    "ProcessStatusToolAdapter",
    "SqliteQueryToolAdapter",
    "WebFetchToolAdapter",
    "MemoryWriteToolAdapter",
    "MemorySearchToolAdapter",
]
