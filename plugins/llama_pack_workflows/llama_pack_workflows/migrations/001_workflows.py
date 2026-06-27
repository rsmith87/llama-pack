from __future__ import annotations

from pathlib import Path

from llama_pack_workflows.store import WorkflowStore

revision = "001_workflows"
down_revision = None
branch_labels = None
depends_on = None


def upgrade(database_path: str | None = None) -> None:
    if database_path is not None:
        WorkflowStore(Path(database_path)).migrate()


def downgrade() -> None:
    pass
