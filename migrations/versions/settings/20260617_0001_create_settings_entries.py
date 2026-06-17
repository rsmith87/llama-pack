"""create settings entries

Revision ID: 20260617_0001
Revises:
Create Date: 2026-06-17 00:00:00.000000
"""

from __future__ import annotations

from alembic import context, op
import sqlalchemy as sa


revision = "20260617_0001"
down_revision = None
branch_labels = ("settings",)
depends_on = None


def _target() -> str:
    return context.get_x_argument(as_dictionary=True).get("db", "controller")


def upgrade() -> None:
    if _target() != "settings":
        return

    op.create_table(
        "settings_entries",
        sa.Column("key", sa.Text(), nullable=False),
        sa.Column("value_json", sa.Text(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_by", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("key", name="pk_settings_entries"),
    )


def downgrade() -> None:
    if _target() != "settings":
        return

    op.drop_table("settings_entries")
