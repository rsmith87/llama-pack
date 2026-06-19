"""project context artifacts

Revision ID: 20260619_0003
Revises: 20260619_0002
Create Date: 2026-06-19 00:00:00.000000
"""

from __future__ import annotations

from alembic import context, op
import sqlalchemy as sa


revision = "20260619_0003"
down_revision = "20260619_0002"
branch_labels = None
depends_on = None


def _target() -> str:
    return context.get_x_argument(as_dictionary=True).get("db", "controller")


def upgrade() -> None:
    if _target() != "projects":
        return

    if not _table_exists("project_context_artifacts"):
        op.create_table(
            "project_context_artifacts",
            sa.Column("id", sa.Text(), nullable=False),
            sa.Column("project_id", sa.Text(), nullable=False),
            sa.Column("path", sa.Text(), nullable=False),
            sa.Column("kind", sa.Text(), nullable=False),
            sa.Column("title", sa.Text(), nullable=True),
            sa.Column("content_hash", sa.Text(), nullable=False),
            sa.Column("size_bytes", sa.Integer(), nullable=False),
            sa.Column("metadata", sa.Text(), nullable=False),
            sa.Column("created_at", sa.Text(), nullable=False),
            sa.Column("updated_at", sa.Text(), nullable=False),
            sa.ForeignKeyConstraint(["project_id"], ["projects.id"], name="fk_project_context_artifacts_project_id_projects"),
            sa.PrimaryKeyConstraint("id", name="pk_project_context_artifacts"),
            sa.UniqueConstraint("project_id", "path", "kind", name="uq_project_context_artifacts_project_path_kind"),
        )
    _create_index("project_context_artifacts", "idx_project_context_artifacts_project", ["project_id"])
    _create_index("project_context_artifacts", "idx_project_context_artifacts_updated", ["updated_at"])


def downgrade() -> None:
    if _target() != "projects":
        return

    _drop_index("project_context_artifacts", "idx_project_context_artifacts_updated")
    _drop_index("project_context_artifacts", "idx_project_context_artifacts_project")
    _drop_table("project_context_artifacts")


def _table_exists(table_name: str) -> bool:
    bind = op.get_bind()
    return sa.inspect(bind).has_table(table_name)


def _index_exists(table_name: str, index_name: str) -> bool:
    bind = op.get_bind()
    indexes = sa.inspect(bind).get_indexes(table_name) if _table_exists(table_name) else []
    return any(index["name"] == index_name for index in indexes)


def _create_index(table_name: str, index_name: str, columns: list[str]) -> None:
    if not _index_exists(table_name, index_name):
        op.create_index(index_name, table_name, columns, unique=False)


def _drop_index(table_name: str, index_name: str) -> None:
    if _index_exists(table_name, index_name):
        op.drop_index(index_name, table_name=table_name)


def _drop_table(table_name: str) -> None:
    if _table_exists(table_name):
        op.drop_table(table_name)
