from __future__ import annotations

import asyncio
import re
import sqlite3

from llama_manager.core.agent_tools.common import is_relative_to
from llama_manager.core.config.models import AgentToolDefinitionConfig, AppConfig

_SQL_ALLOWED_STARTS = re.compile(r"^\s*(SELECT|WITH)\b", re.IGNORECASE)
_SQL_STRIP_COMMENTS = re.compile(r"(--[^\n]*|/\*.*?\*/)", re.DOTALL)


class SqliteQueryToolAdapter:
    def __init__(self, config: AppConfig) -> None:
        self.config = config

    async def execute(self, tool: AgentToolDefinitionConfig, arguments: dict[str, object]) -> dict[str, object]:
        # Resolve which db path to use
        if tool.paths:
            db_name = str(arguments.get("db") or "").strip()
            by_stem = {p.stem: p for p in tool.paths}
            if not db_name:
                available = ", ".join(sorted(by_stem))
                return {"ok": False, "error": f"sqlite_query requires a 'db' argument when multiple paths are configured. Available: {available}"}
            if db_name not in by_stem:
                available = ", ".join(sorted(by_stem))
                return {"ok": False, "error": f"unknown db {db_name!r}. Available: {available}"}
            db_path = by_stem[db_name].resolve()
        elif tool.path is not None:
            db_path = tool.path.resolve()
        else:
            return {"ok": False, "error": "sqlite_query tool has no path or paths configured"}

        roots = [safe_root.resolve() for safe_root in self.config.agent_tools.safe_roots]
        if not roots or not any(is_relative_to(db_path, safe_root) for safe_root in roots):
            return {"ok": False, "error": f"db path is outside configured safe roots: {db_path}"}
        if not db_path.exists():
            return {"ok": False, "error": f"database file does not exist: {db_path}"}

        query = str(arguments.get("query") or "").strip()
        if not query:
            return {"ok": False, "error": "sqlite_query requires a 'query' argument"}

        # Strip comments and check the query only starts with SELECT or WITH (CTEs)
        stripped = _SQL_STRIP_COMMENTS.sub("", query).strip()
        if not _SQL_ALLOWED_STARTS.match(stripped):
            return {"ok": False, "error": "only SELECT queries are allowed"}

        try:
            result = await asyncio.to_thread(_sqlite_execute, str(db_path), query, tool.max_entries)
            if tool.paths:
                result["db"] = db_name
            return result
        except sqlite3.OperationalError as exc:
            return {"ok": False, "error": f"query error: {exc}"}
        except sqlite3.DatabaseError as exc:
            return {"ok": False, "error": f"database error: {exc}"}


def _sqlite_execute(db_path: str, query: str, max_rows: int) -> dict:
    uri = f"file:{db_path}?mode=ro"
    con = sqlite3.connect(uri, uri=True)
    try:
        con.row_factory = sqlite3.Row
        cur = con.execute(query)
        cols = [desc[0] for desc in (cur.description or [])]
        rows = cur.fetchmany(max_rows + 1)
        truncated = len(rows) > max_rows
        return {
            "ok": True,
            "columns": cols,
            "rows": [list(row) for row in rows[:max_rows]],
            "row_count": len(rows[:max_rows]),
            "truncated": truncated,
        }
    finally:
        con.close()
