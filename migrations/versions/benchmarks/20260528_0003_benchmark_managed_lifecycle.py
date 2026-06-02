"""add benchmark managed lifecycle fields

Revision ID: 20260528_0003
Revises: 20260523_0002
Create Date: 2026-05-28 00:00:00.000000
"""

from __future__ import annotations

from alembic import context, op
import sqlalchemy as sa


revision = "20260528_0003"
down_revision = "20260523_0002"
branch_labels = None
depends_on = None


def _target() -> str:
    return context.get_x_argument(as_dictionary=True).get("db", "controller")


def upgrade() -> None:
    if _target() != "benchmarks":
        return

    op.add_column("benchmark_runs", sa.Column("target_node", sa.Text(), nullable=True))
    op.add_column("benchmark_runs", sa.Column("managed_load", sa.Integer(), server_default="0", nullable=False))
    op.add_column("benchmark_runs", sa.Column("restore_after", sa.Integer(), server_default="0", nullable=False))


def downgrade() -> None:
    if _target() != "benchmarks":
        return

    op.drop_column("benchmark_runs", "restore_after")
    op.drop_column("benchmark_runs", "managed_load")
    op.drop_column("benchmark_runs", "target_node")
