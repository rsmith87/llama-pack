"""add tool-loop eval case diagnostics

Revision ID: 20260612_0006
Revises: 20260612_0005
Create Date: 2026-06-12 00:00:00.000000
"""

from __future__ import annotations

from alembic import context, op
import sqlalchemy as sa


revision = "20260612_0006"
down_revision = "20260612_0005"
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
    for name, default in (
        ("missing_expected_tools_json", "[]"),
        ("unexpected_tools_json", "[]"),
        ("diagnostics_json", "{}"),
    ):
        if name not in columns:
            op.add_column(
                "tool_loop_eval_cases",
                sa.Column(name, sa.Text(), nullable=False, server_default=default),
            )


def downgrade() -> None:
    if _target() != "benchmarks":
        return

    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "tool_loop_eval_cases" not in inspector.get_table_names():
        return
    columns = {column["name"] for column in inspector.get_columns("tool_loop_eval_cases")}
    for name in ("diagnostics_json", "unexpected_tools_json", "missing_expected_tools_json"):
        if name in columns:
            op.drop_column("tool_loop_eval_cases", name)
