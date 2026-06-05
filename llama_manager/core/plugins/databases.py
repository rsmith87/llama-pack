from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path

from llama_manager.core.persistence.db_infra import sqlite_url_for_path


_DATABASE_NAME_RE = re.compile(r"^[a-z][a-z0-9_]*$")


@dataclass(frozen=True)
class PluginDatabase:
    name: str
    path: Path
    url: str


def resolve_plugin_database(plugin_id: str, state_dir: Path, name: str = "main") -> PluginDatabase:
    if not _DATABASE_NAME_RE.fullmatch(name):
        raise ValueError(f"Invalid plugin database name: {name!r}")

    state_root = state_dir.resolve()
    filename = f"{plugin_id}.db" if name == "main" else f"{name}.db"
    database_path = (state_root / filename).resolve()
    try:
        database_path.relative_to(state_root)
    except ValueError as exc:
        raise ValueError(f"Invalid plugin database path for {name!r}") from exc

    return PluginDatabase(name=name, path=database_path, url=sqlite_url_for_path(database_path))
