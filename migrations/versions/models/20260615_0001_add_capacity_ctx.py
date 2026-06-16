"""add capacity_ctx to models

Revision ID: 20260615_0001
Revises: 20260614_0002
Create Date: 2026-06-15 00:00:00.000000
"""

from __future__ import annotations

from alembic import context, op
import sqlalchemy as sa


revision = "20260615_0001"
down_revision = "20260614_0002"
branch_labels = None
depends_on = None


def _target() -> str:
    return context.get_x_argument(as_dictionary=True).get("db", "controller")


def upgrade() -> None:
    if _target() != "models":
        return

    with op.batch_alter_table("models") as batch_op:
        batch_op.add_column(sa.Column("capacity_ctx", sa.Integer(), nullable=True))


def downgrade() -> None:
    if _target() != "models":
        return

    with op.batch_alter_table("models") as batch_op:
        batch_op.drop_column("capacity_ctx")