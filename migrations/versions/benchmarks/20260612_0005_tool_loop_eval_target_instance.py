"""add tool-loop eval target instance metadata

Revision ID: 20260612_0005
Revises: 20260611_0004
Create Date: 2026-06-12 00:00:00.000000
"""

from __future__ import annotations

from alembic import context, op
import sqlalchemy as sa


revision = "20260612_0005"
down_revision = "20260611_0004"
branch_labels = None
depends_on = None


def _target() -> str:
    return context.get_x_argument(as_dictionary=True).get("db", "controller")


def upgrade() -> None:
    if _target() != "benchmarks":
        return

    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "tool_loop_eval_runs" not in inspector.get_table_names():
        return
    columns = {column["name"] for column in inspector.get_columns("tool_loop_eval_runs")}
    if "target_instance" not in columns:
        op.add_column("tool_loop_eval_runs", sa.Column("target_instance", sa.Text(), nullable=True))

    indexes = {idx.get("name") for idx in inspector.get_indexes("tool_loop_eval_runs")}
    idx_name = op.f("idx_tool_loop_eval_runs_target_instance")
    if idx_name not in indexes:
        op.create_index(idx_name, "tool_loop_eval_runs", ["target_instance"], unique=False)


def downgrade() -> None:
    if _target() != "benchmarks":
        return

    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "tool_loop_eval_runs" not in inspector.get_table_names():
        return
    indexes = {idx.get("name") for idx in inspector.get_indexes("tool_loop_eval_runs")}
    idx_name = op.f("idx_tool_loop_eval_runs_target_instance")
    if idx_name in indexes:
        op.drop_index(idx_name, table_name="tool_loop_eval_runs")
    columns = {column["name"] for column in inspector.get_columns("tool_loop_eval_runs")}
    if "target_instance" in columns:
        op.drop_column("tool_loop_eval_runs", "target_instance")
