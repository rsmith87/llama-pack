from __future__ import annotations

from pathlib import Path

from llama_pack_workflows.store import WorkflowStore


def upgrade(database_path: str) -> None:
    WorkflowStore(Path(database_path)).migrate()
