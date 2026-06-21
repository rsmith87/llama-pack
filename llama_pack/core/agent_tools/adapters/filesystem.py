from __future__ import annotations

import asyncio
from dataclasses import dataclass
from pathlib import Path
import re

from llama_pack.core.agent_tools.common import MAX_RESULT_CHARS, is_relative_to, truncate
from llama_pack.core.config.models import AgentToolDefinitionConfig, AppConfig

_MAX_LINE_CHARS = 500


@dataclass(frozen=True)
class FileRangeContent:
    content: str
    start_line: int
    end_line: int


@dataclass(frozen=True)
class FileRangeError:
    error: str


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
        line_count = _count_text_lines(content)
        return {
            "ok": True,
            "content": truncate(content, MAX_RESULT_CHARS),
            "locations": _locations_for_range(str(resolved), 1, line_count),
        }


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

        line_range = _read_line_range(arguments)
        if isinstance(line_range, str):
            return {"ok": False, "error": line_range}

        read_result = await asyncio.to_thread(_read_file_range, resolved, line_range)
        if isinstance(read_result, FileRangeError):
            return {"ok": False, "error": read_result.error}
        return {
            "ok": True,
            "path": str(resolved),
            "content": truncate(read_result.content, MAX_RESULT_CHARS),
            "locations": _locations_for_range(str(resolved), read_result.start_line, read_result.end_line),
        }


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
            "locations": [_location(str(match["file"]), int(match["line"]), int(match["line"])) for match in matches],
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


def _location(path: str, start_line: int, end_line: int) -> dict[str, str | int]:
    return {"path": path, "start_line": start_line, "end_line": end_line}


def _locations_for_range(path: str, start_line: int, end_line: int) -> list[dict[str, str | int]]:
    if end_line < start_line:
        return []
    return [_location(path, start_line, end_line)]


def _count_text_lines(content: str) -> int:
    return len(content.splitlines())


def _read_line_range(arguments: dict[str, object]) -> tuple[int | None, int | None] | str:
    start_line = _optional_positive_int(arguments.get("start_line"), "start_line")
    if isinstance(start_line, str):
        return start_line
    end_line = _optional_positive_int(arguments.get("end_line"), "end_line")
    if isinstance(end_line, str):
        return end_line
    if start_line is not None and end_line is not None and end_line < start_line:
        return "end_line must be greater than or equal to start_line"
    return start_line, end_line


def _optional_positive_int(value: object, name: str) -> int | None | str:
    if value is None:
        return None
    if isinstance(value, bool) or not isinstance(value, int):
        return f"{name} must be an integer"
    if value < 1:
        return f"{name} must be greater than or equal to 1"
    return value


def _read_file_range(path: Path, line_range: tuple[int | None, int | None]) -> FileRangeContent | FileRangeError:
    content = path.read_text(encoding="utf-8")
    start_line, end_line = line_range
    if start_line is None and end_line is None:
        return FileRangeContent(content=content, start_line=1, end_line=_count_text_lines(content))

    lines = content.splitlines()
    first_line = start_line or 1
    last_line = end_line or len(lines)
    line_count = len(lines)
    if first_line > line_count:
        return FileRangeError(error=f"start_line {first_line} exceeds file line count {line_count}")
    if last_line > line_count:
        return FileRangeError(error=f"end_line {last_line} exceeds file line count {line_count}")
    selected = lines[first_line - 1 : last_line]
    return FileRangeContent(content="\n".join(selected), start_line=first_line, end_line=last_line)


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
