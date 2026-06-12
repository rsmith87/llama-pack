"""add tool-loop eval case trace events

Revision ID: 20260612_0007
Revises: 20260612_0006
Create Date: 2026-06-12 00:00:00.000000
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import context, op


revision = "20260612_0007"
down_revision = "20260612_0006"
branch_labels = None
depends_on = None


def _target() -> str:
    return context.get_x_argument(as_dictionary=True).get("db", "controller")


def upgrade() -> None:
    if _target() != "benchmarks":
        return
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "tool_loop_eval_cases" not in inspector.get_table_names():
        return
    columns = {column["name"] for column in inspector.get_columns("tool_loop_eval_cases")}
    if "trace_events_json" not in columns:
        op.add_column(
            "tool_loop_eval_cases",
            sa.Column("trace_events_json", sa.Text(), nullable=False, server_default="[]"),
        )


def downgrade() -> None:
    if _target() != "benchmarks":
        return
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "tool_loop_eval_cases" not in inspector.get_table_names():
        return
    columns = {column["name"] for column in inspector.get_columns("tool_loop_eval_cases")}
    if "trace_events_json" in columns:
        op.drop_column("tool_loop_eval_cases", "trace_events_json")
