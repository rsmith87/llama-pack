from __future__ import annotations

import asyncio
from pathlib import Path
import re

from llama_manager.core.agent_tools.common import MAX_RESULT_CHARS, is_relative_to, truncate
from llama_manager.core.config.models import AgentToolDefinitionConfig, AppConfig

_MAX_LINE_CHARS = 500


class FileReadToolAdapter:
    def __init__(self, config: AppConfig) -> None:
        self.config = config

    async def execute(self, tool: AgentToolDefinitionConfig, arguments: dict[str, object]) -> dict[str, object]:
        if tool.path is None:
            return {"ok": False, "error": "file_read tool has no path"}
        resolved = tool.path.resolve()
        roots = [root.resolve() for root in self.config.agent_tools.safe_roots]
        if not roots or not any(is_relative_to(resolved, root) for root in roots):
            return {"ok": False, "error": f"file path is outside configured safe roots: {resolved}"}
        content = await asyncio.to_thread(resolved.read_text, encoding="utf-8")
        return {"ok": True, "content": truncate(content, MAX_RESULT_CHARS)}


class DynamicFileReadToolAdapter:
    def __init__(self, config: AppConfig) -> None:
        self.config = config

    async def execute(self, tool: AgentToolDefinitionConfig, arguments: dict[str, object]) -> dict[str, object]:
        if tool.path is None:
            return {"ok": False, "error": "file_read_dynamic tool has no path"}
        requested = arguments.get("path")
        if not isinstance(requested, str) or not requested.strip():
            return {"ok": False, "error": "file_read_dynamic requires a non-empty 'path' argument"}
        root = tool.path.resolve()
        if not root.exists():
            return {"ok": False, "error": f"root directory does not exist: {root}"}
        if not root.is_dir():
            return {"ok": False, "error": f"root path is not a directory: {root}"}

        relative = requested.strip()
        if Path(relative).is_absolute():
            return {"ok": False, "error": "file_read_dynamic path must be relative"}
        candidate_path = root / relative
        resolved = candidate_path.resolve()
        if not is_relative_to(resolved, root):
            return {"ok": False, "error": f"file path is outside configured root: {resolved}"}

        roots = [safe_root.resolve() for safe_root in self.config.agent_tools.safe_roots]
        if not roots or not any(is_relative_to(resolved, safe_root) for safe_root in roots):
            return {"ok": False, "error": f"file path is outside configured safe roots: {resolved}"}
        if not resolved.exists():
            return {"ok": False, "error": f"file does not exist: {resolved}"}
        if not resolved.is_file():
            return {"ok": False, "error": f"path is not a file: {resolved}"}
        try:
            size = resolved.stat().st_size
        except OSError as exc:
            return {"ok": False, "error": str(exc)}
        if size > tool.max_file_bytes:
            return {"ok": False, "error": f"file exceeds max_file_bytes ({tool.max_file_bytes}): {resolved}"}

        content = await asyncio.to_thread(resolved.read_text, encoding="utf-8")
        return {"ok": True, "path": str(resolved), "content": truncate(content, MAX_RESULT_CHARS)}


class FileWriteToolAdapter:
    def __init__(self, config: AppConfig) -> None:
        self.config = config

    async def execute(self, tool: AgentToolDefinitionConfig, arguments: dict[str, object]) -> dict[str, object]:
        if tool.path is None:
            return {"ok": False, "error": "file_write tool has no path"}
        resolved = tool.path.resolve()
        roots = [root.resolve() for root in self.config.agent_tools.safe_roots]
        if not roots or not any(is_relative_to(resolved, root) for root in roots):
            return {"ok": False, "error": f"file path is outside configured safe roots: {resolved}"}

        content = str(arguments.get("content") or "")
        if not content:
            return {"ok": False, "error": "file_write requires a 'content' argument"}
        encoded = content.encode("utf-8")
        if len(encoded) > tool.max_write_bytes:
            return {"ok": False, "error": f"content exceeds max_write_bytes ({tool.max_write_bytes})"}

        mode = tool.write_mode
        if mode == "create_only" and resolved.exists():
            return {"ok": False, "error": f"file already exists and write_mode is create_only: {resolved}"}

        open_mode = "a" if mode == "append" else "w"
        await asyncio.to_thread(_write_file, resolved, content, open_mode)
        return {"ok": True, "path": str(resolved), "bytes_written": len(encoded), "mode": mode}


def _write_file(path, content: str, open_mode: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, open_mode, encoding="utf-8") as f:
        f.write(content)


class DirectoryListToolAdapter:
    def __init__(self, config: AppConfig) -> None:
        self.config = config

    async def execute(self, tool: AgentToolDefinitionConfig, arguments: dict[str, object]) -> dict[str, object]:
        if tool.path is None:
            return {"ok": False, "error": "directory_list tool has no path"}
        root = tool.path.resolve()
        roots = [safe_root.resolve() for safe_root in self.config.agent_tools.safe_roots]
        if not roots or not any(is_relative_to(root, safe_root) for safe_root in roots):
            return {"ok": False, "error": f"directory path is outside configured safe roots: {root}"}
        if not root.exists():
            return {"ok": False, "error": f"directory does not exist: {root}"}
        if not root.is_dir():
            return {"ok": False, "error": f"path is not a directory: {root}"}

        entries, truncated = await asyncio.to_thread(_list_directory_entries, root, tool)
        return {
            "ok": True,
            "root": str(root),
            "entries": entries,
            "truncated": truncated,
        }


class FileSearchToolAdapter:
    def __init__(self, config: AppConfig) -> None:
        self.config = config

    async def execute(self, tool: AgentToolDefinitionConfig, arguments: dict[str, object]) -> dict[str, object]:
        if tool.path is None:
            return {"ok": False, "error": "file_search tool has no path"}
        if not tool.glob:
            return {"ok": False, "error": "file_search tool has no glob"}
        root = tool.path.resolve()
        roots = [safe_root.resolve() for safe_root in self.config.agent_tools.safe_roots]
        if not roots or not any(is_relative_to(root, safe_root) for safe_root in roots):
            return {"ok": False, "error": f"directory path is outside configured safe roots: {root}"}
        if not root.exists():
            return {"ok": False, "error": f"directory does not exist: {root}"}
        if not root.is_dir():
            return {"ok": False, "error": f"path is not a directory: {root}"}

        matches, truncated = await asyncio.to_thread(_search_files, root, tool)
        return {
            "ok": True,
            "root": str(root),
            "matches": matches,
            "truncated": truncated,
        }


class TextSearchToolAdapter:
    def __init__(self, config: AppConfig) -> None:
        self.config = config

    async def execute(self, tool: AgentToolDefinitionConfig, arguments: dict[str, object]) -> dict[str, object]:
        query = arguments.get("query")
        if not isinstance(query, str) or not query:
            return {"ok": False, "error": "text_search requires a non-empty 'query' argument"}
        if tool.regex:
            try:
                pattern = re.compile(query, 0 if tool.case_sensitive else re.IGNORECASE)
            except re.error as exc:
                return {"ok": False, "error": f"invalid regex: {exc}"}
        else:
            pattern = None
        if tool.path is None:
            return {"ok": False, "error": "text_search tool has no path"}
        if not tool.glob:
            return {"ok": False, "error": "text_search tool has no glob"}
        root = tool.path.resolve()
        roots = [safe_root.resolve() for safe_root in self.config.agent_tools.safe_roots]
        if not roots or not any(is_relative_to(root, safe_root) for safe_root in roots):
            return {"ok": False, "error": f"directory path is outside configured safe roots: {root}"}
        if not root.exists():
            return {"ok": False, "error": f"directory does not exist: {root}"}
        if not root.is_dir():
            return {"ok": False, "error": f"path is not a directory: {root}"}

        matches, truncated = await asyncio.to_thread(_search_text, root, tool, query, pattern)
        return {
            "ok": True,
            "root": str(root),
            "query": query,
            "matches": matches,
            "truncated": truncated,
        }


class LogTailToolAdapter:
    def __init__(self, config: AppConfig) -> None:
        self.config = config

    async def execute(self, tool: AgentToolDefinitionConfig, arguments: dict[str, object]) -> dict[str, object]:
        if tool.path is None:
            return {"ok": False, "error": "log_tail tool has no path"}
        log_path = tool.path.resolve()
        roots = [safe_root.resolve() for safe_root in self.config.agent_tools.safe_roots]
        if not roots or not any(is_relative_to(log_path, safe_root) for safe_root in roots):
            return {"ok": False, "error": f"log path is outside configured safe roots: {log_path}"}
        if not log_path.exists():
            return {"ok": False, "error": f"log file does not exist: {log_path}"}
        if not log_path.is_file():
            return {"ok": False, "error": f"path is not a file: {log_path}"}

        lines, total = await asyncio.to_thread(_read_tail, log_path, tool.max_lines)
        return {
            "ok": True,
            "path": str(log_path),
            "lines": lines,
            "total_lines": total,
            "truncated": total > tool.max_lines,
        }


def _read_tail(path, max_lines: int) -> tuple[list[str], int]:
    """Return (last max_lines lines, total line count) without loading the full file."""
    with open(path, "rb") as f:
        buf: list[str] = []
        total = 0
        for raw in f:
            line = raw.decode("utf-8", errors="replace").rstrip("\n")
            buf.append(line[:_MAX_LINE_CHARS])
            total += 1
            if len(buf) > max_lines:
                buf.pop(0)
    return buf, total


def _search_text(root, tool: AgentToolDefinitionConfig, query: str, pattern: re.Pattern | None) -> tuple[list[dict[str, object]], bool]:
    matches: list[dict[str, object]] = []
    truncated = False
    needle = query if tool.case_sensitive else query.lower()
    try:
        candidates = sorted(root.glob(tool.glob or ""), key=lambda p: p.as_posix())
    except (ValueError, NotImplementedError):
        return [], False
    for path in candidates:
        if not path.is_file():
            continue
        if not tool.include_hidden and any(part.startswith(".") for part in path.relative_to(root).parts):
            continue
        try:
            if path.stat().st_size > tool.max_file_bytes:
                continue
            header = path.read_bytes()[:512]
        except OSError:
            continue
        if b"\x00" in header:
            continue
        try:
            text = path.read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue
        relative = path.relative_to(root).as_posix()
        for line_no, line in enumerate(text.splitlines(), start=1):
            hit = pattern.search(line) if pattern is not None else needle in (line if tool.case_sensitive else line.lower())
            if hit:
                if len(matches) >= tool.max_matches:
                    truncated = True
                    return matches, truncated
                matches.append({"file": relative, "line": line_no, "text": truncate(line.rstrip(), _MAX_LINE_CHARS)})
    return matches, truncated


def _search_files(root, tool: AgentToolDefinitionConfig) -> tuple[list[str], bool]:
    matches: list[str] = []
    truncated = False
    try:
        candidates = sorted(root.glob(tool.glob or ""), key=lambda p: p.as_posix())
    except (ValueError, NotImplementedError):
        return [], False
    for match in candidates:
        if not match.is_file():
            continue
        relative = match.relative_to(root)
        if not tool.include_hidden and any(part.startswith(".") for part in relative.parts):
            continue
        if len(matches) >= tool.max_entries:
            truncated = True
            return matches, truncated
        matches.append(relative.as_posix())
    return matches, truncated


def _list_directory_entries(root, tool: AgentToolDefinitionConfig) -> tuple[list[dict[str, str]], bool]:
    entries: list[dict[str, str]] = []
    truncated = False
    pending = [(root, 0)]

    while pending:
        current, depth = pending.pop(0)
        children = sorted(current.iterdir(), key=lambda item: item.name.lower())
        for child in children:
            if not tool.include_hidden and child.name.startswith("."):
                continue
            if len(entries) >= tool.max_entries:
                truncated = True
                return entries, truncated
            relative = child.relative_to(root).as_posix()
            entry_type = "directory" if child.is_dir() else "file"
            entries.append({"path": relative, "type": entry_type})
            if tool.recursive and child.is_dir() and depth < tool.max_depth:
                pending.append((child, depth + 1))

    return entries, truncated
