"""project code graph

Revision ID: 20260619_0002
Revises: 20260618_0001
Create Date: 2026-06-19 00:00:00.000000
"""

from __future__ import annotations

from alembic import context, op
import sqlalchemy as sa


revision = "20260619_0002"
down_revision = "20260618_0001"
branch_labels = None
depends_on = None


def _target() -> str:
    return context.get_x_argument(as_dictionary=True).get("db", "controller")


def upgrade() -> None:
    if _target() != "projects":
        return

    if not _table_exists("project_graph_snapshots"):
        op.create_table(
            "project_graph_snapshots",
            sa.Column("id", sa.Text(), nullable=False),
            sa.Column("project_id", sa.Text(), nullable=False),
            sa.Column("node_name", sa.Text(), nullable=False),
            sa.Column("root_path", sa.Text(), nullable=False),
            sa.Column("git_commit", sa.Text(), nullable=True),
            sa.Column("status", sa.Text(), nullable=False),
            sa.Column("started_at", sa.Text(), nullable=False),
            sa.Column("finished_at", sa.Text(), nullable=True),
            sa.Column("error_detail", sa.Text(), nullable=True),
            sa.Column("file_count", sa.Integer(), server_default="0", nullable=False),
            sa.Column("symbol_count", sa.Integer(), server_default="0", nullable=False),
            sa.Column("relation_count", sa.Integer(), server_default="0", nullable=False),
            sa.Column("active", sa.Integer(), server_default="0", nullable=False),
            sa.Column("created_at", sa.Text(), nullable=False),
            sa.ForeignKeyConstraint(["project_id"], ["projects.id"], name="fk_project_graph_snapshots_project_id_projects"),
            sa.PrimaryKeyConstraint("id", name="pk_project_graph_snapshots"),
        )
    _create_index("project_graph_snapshots", "idx_project_graph_snapshots_project_active", ["project_id", "active"])
    _create_index("project_graph_snapshots", "idx_project_graph_snapshots_status", ["status"])

    if not _table_exists("project_graph_files"):
        op.create_table(
            "project_graph_files",
            sa.Column("id", sa.Text(), nullable=False),
            sa.Column("snapshot_id", sa.Text(), nullable=False),
            sa.Column("path", sa.Text(), nullable=False),
            sa.Column("language", sa.Text(), nullable=False),
            sa.Column("content_hash", sa.Text(), nullable=False),
            sa.Column("size_bytes", sa.Integer(), nullable=False),
            sa.Column("mtime_ns", sa.Integer(), nullable=False),
            sa.Column("indexed_at", sa.Text(), nullable=False),
            sa.Column("parse_status", sa.Text(), nullable=False),
            sa.Column("parse_error", sa.Text(), nullable=True),
            sa.ForeignKeyConstraint(["snapshot_id"], ["project_graph_snapshots.id"], name="fk_project_graph_files_snapshot_id_project_graph_snapshots"),
            sa.PrimaryKeyConstraint("id", name="pk_project_graph_files"),
            sa.UniqueConstraint("snapshot_id", "path", name="uq_project_graph_files_snapshot_path"),
        )
    _create_index("project_graph_files", "idx_project_graph_files_snapshot", ["snapshot_id"])

    if not _table_exists("project_graph_symbols"):
        op.create_table(
            "project_graph_symbols",
            sa.Column("id", sa.Text(), nullable=False),
            sa.Column("snapshot_id", sa.Text(), nullable=False),
            sa.Column("file_id", sa.Text(), nullable=False),
            sa.Column("qualified_name", sa.Text(), nullable=False),
            sa.Column("name", sa.Text(), nullable=False),
            sa.Column("kind", sa.Text(), nullable=False),
            sa.Column("language", sa.Text(), nullable=False),
            sa.Column("start_line", sa.Integer(), nullable=False),
            sa.Column("end_line", sa.Integer(), nullable=False),
            sa.Column("signature", sa.Text(), nullable=True),
            sa.Column("doc_summary", sa.Text(), nullable=True),
            sa.Column("exported", sa.Integer(), server_default="0", nullable=False),
            sa.Column("confidence", sa.Float(), server_default="1", nullable=False),
            sa.ForeignKeyConstraint(["file_id"], ["project_graph_files.id"], name="fk_project_graph_symbols_file_id_project_graph_files"),
            sa.ForeignKeyConstraint(["snapshot_id"], ["project_graph_snapshots.id"], name="fk_project_graph_symbols_snapshot_id_project_graph_snapshots"),
            sa.PrimaryKeyConstraint("id", name="pk_project_graph_symbols"),
        )
    _create_index("project_graph_symbols", "idx_project_graph_symbols_snapshot_name", ["snapshot_id", "name"])
    _create_index("project_graph_symbols", "idx_project_graph_symbols_snapshot_kind", ["snapshot_id", "kind"])

    if not _table_exists("project_graph_imports"):
        op.create_table(
            "project_graph_imports",
            sa.Column("id", sa.Text(), nullable=False),
            sa.Column("snapshot_id", sa.Text(), nullable=False),
            sa.Column("file_id", sa.Text(), nullable=False),
            sa.Column("module", sa.Text(), nullable=False),
            sa.Column("imported_name", sa.Text(), nullable=True),
            sa.Column("alias", sa.Text(), nullable=True),
            sa.Column("resolved_file_id", sa.Text(), nullable=True),
            sa.Column("confidence", sa.Float(), server_default="1", nullable=False),
            sa.ForeignKeyConstraint(["file_id"], ["project_graph_files.id"], name="fk_project_graph_imports_file_id_project_graph_files"),
            sa.ForeignKeyConstraint(["resolved_file_id"], ["project_graph_files.id"], name="fk_project_graph_imports_resolved_file_id_project_graph_files"),
            sa.ForeignKeyConstraint(["snapshot_id"], ["project_graph_snapshots.id"], name="fk_project_graph_imports_snapshot_id_project_graph_snapshots"),
            sa.PrimaryKeyConstraint("id", name="pk_project_graph_imports"),
        )
    _create_index("project_graph_imports", "idx_project_graph_imports_snapshot_module", ["snapshot_id", "module"])

    if not _table_exists("project_graph_relations"):
        op.create_table(
            "project_graph_relations",
            sa.Column("id", sa.Text(), nullable=False),
            sa.Column("snapshot_id", sa.Text(), nullable=False),
            sa.Column("source_symbol_id", sa.Text(), nullable=True),
            sa.Column("target_symbol_id", sa.Text(), nullable=True),
            sa.Column("source_file_id", sa.Text(), nullable=True),
            sa.Column("target_file_id", sa.Text(), nullable=True),
            sa.Column("relation_type", sa.Text(), nullable=False),
            sa.Column("start_line", sa.Integer(), nullable=True),
            sa.Column("end_line", sa.Integer(), nullable=True),
            sa.Column("confidence", sa.Float(), server_default="1", nullable=False),
            sa.Column("evidence", sa.Text(), nullable=True),
            sa.ForeignKeyConstraint(["snapshot_id"], ["project_graph_snapshots.id"], name="fk_project_graph_relations_snapshot_id_project_graph_snapshots"),
            sa.ForeignKeyConstraint(["source_file_id"], ["project_graph_files.id"], name="fk_project_graph_relations_source_file_id_project_graph_files"),
            sa.ForeignKeyConstraint(["source_symbol_id"], ["project_graph_symbols.id"], name="fk_project_graph_relations_source_symbol_id_project_graph_symbols"),
            sa.ForeignKeyConstraint(["target_file_id"], ["project_graph_files.id"], name="fk_project_graph_relations_target_file_id_project_graph_files"),
            sa.ForeignKeyConstraint(["target_symbol_id"], ["project_graph_symbols.id"], name="fk_project_graph_relations_target_symbol_id_project_graph_symbols"),
            sa.PrimaryKeyConstraint("id", name="pk_project_graph_relations"),
        )
    _create_index("project_graph_relations", "idx_project_graph_relations_snapshot_type", ["snapshot_id", "relation_type"])
    _create_index("project_graph_relations", "idx_project_graph_relations_source", ["source_symbol_id"])
    _create_index("project_graph_relations", "idx_project_graph_relations_target", ["target_symbol_id"])


def downgrade() -> None:
    if _target() != "projects":
        return

    _drop_index("project_graph_relations", "idx_project_graph_relations_target")
    _drop_index("project_graph_relations", "idx_project_graph_relations_source")
    _drop_index("project_graph_relations", "idx_project_graph_relations_snapshot_type")
    _drop_table("project_graph_relations")
    _drop_index("project_graph_imports", "idx_project_graph_imports_snapshot_module")
    _drop_table("project_graph_imports")
    _drop_index("project_graph_symbols", "idx_project_graph_symbols_snapshot_kind")
    _drop_index("project_graph_symbols", "idx_project_graph_symbols_snapshot_name")
    _drop_table("project_graph_symbols")
    _drop_index("project_graph_files", "idx_project_graph_files_snapshot")
    _drop_table("project_graph_files")
    _drop_index("project_graph_snapshots", "idx_project_graph_snapshots_status")
    _drop_index("project_graph_snapshots", "idx_project_graph_snapshots_project_active")
    _drop_table("project_graph_snapshots")


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
