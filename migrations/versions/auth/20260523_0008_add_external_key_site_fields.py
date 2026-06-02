"""Add site_name and site_url to api_keys for external app keys

Revision ID: 20260523_0001
Revises: 20260513_0002
Create Date: 2026-05-23 00:00:00.000000
"""

from __future__ import annotations

from alembic import context, op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260523_0008"
down_revision = "20260513_0002"
branch_labels = None
depends_on = None


def _target() -> str:
    return context.get_x_argument(as_dictionary=True).get("db", "controller")


def upgrade() -> None:
    if _target() != "auth":
        return

    with op.batch_alter_table("api_keys") as batch_op:
        batch_op.add_column(sa.Column("site_name", sa.Text(), nullable=True))
        batch_op.add_column(sa.Column("site_url", sa.Text(), nullable=True))


def downgrade() -> None:
    if _target() != "auth":
        return

    with op.batch_alter_table("api_keys") as batch_op:
        batch_op.drop_column("site_url")
        batch_op.drop_column("site_name")
