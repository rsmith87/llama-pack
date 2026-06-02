from __future__ import annotations

from pathlib import Path

MAX_RESULT_CHARS = 8000
TRACE_RESULT_CHARS = 2000

def truncate(value: str, limit: int) -> str:
    if len(value) <= limit:
        return value
    return value[:limit] + "...[truncated]"

def is_relative_to(path: Path, root: Path) -> bool:
    try:
        path.relative_to(root)
        return True
    except ValueError:
        return False
