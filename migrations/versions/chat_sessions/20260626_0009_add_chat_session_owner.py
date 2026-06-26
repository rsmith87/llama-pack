"""add chat session ownership fields

Revision ID: 20260626_0009
Revises: 20260523_0007
Create Date: 2026-06-26 00:00:00.000000
"""

from __future__ import annotations

from alembic import context, op
import sqlalchemy as sa


revision = "20260626_0009"
down_revision = "20260523_0007"
branch_labels = None
depends_on = None


def _target() -> str:
    return context.get_x_argument(as_dictionary=True).get("db", "controller")


def upgrade() -> None:
    if _target() != "chat_sessions":
        return

    op.add_column("chat_sessions", sa.Column("owner_id", sa.Text(), nullable=True))
    op.add_column("chat_sessions", sa.Column("owner_username", sa.Text(), nullable=True))
    op.create_index("idx_chat_sessions_owner_id", "chat_sessions", ["owner_id"], unique=False)


def downgrade() -> None:
    if _target() != "chat_sessions":
        return

    op.drop_index("idx_chat_sessions_owner_id", table_name="chat_sessions")
    op.drop_column("chat_sessions", "owner_username")
    op.drop_column("chat_sessions", "owner_id")
