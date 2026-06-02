"""Add external key usage summary fields

Revision ID: 20260527_0001
Revises: 20260523_0008
Create Date: 2026-05-27 00:00:00.000000
"""

from __future__ import annotations

from alembic import context, op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260527_0001"
down_revision = "20260523_0008"
branch_labels = None
depends_on = None


def _target() -> str:
    return context.get_x_argument(as_dictionary=True).get("db", "controller")


def upgrade() -> None:
    if _target() != "auth":
        return

    with op.batch_alter_table("api_keys") as batch_op:
        batch_op.add_column(sa.Column("last_used_at", sa.Text(), nullable=True))
        batch_op.add_column(sa.Column("last_used_endpoint", sa.Text(), nullable=True))
        batch_op.add_column(sa.Column("last_used_route", sa.Text(), nullable=True))
        batch_op.add_column(sa.Column("last_used_node", sa.Text(), nullable=True))
        batch_op.add_column(sa.Column("last_used_model", sa.Text(), nullable=True))
        batch_op.add_column(sa.Column("last_used_request_type", sa.Text(), nullable=True))


def downgrade() -> None:
    if _target() != "auth":
        return

    with op.batch_alter_table("api_keys") as batch_op:
        batch_op.drop_column("last_used_request_type")
        batch_op.drop_column("last_used_model")
        batch_op.drop_column("last_used_node")
        batch_op.drop_column("last_used_route")
        batch_op.drop_column("last_used_endpoint")
        batch_op.drop_column("last_used_at")
