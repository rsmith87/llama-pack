"""add model_downloads table

Revision ID: 20260515_0005
Revises: 20260513_0004
Create Date: 2026-05-15 00:00:00.000000
"""

from __future__ import annotations

from alembic import context, op
import sqlalchemy as sa


revision = "20260515_0005"
down_revision = "20260513_0004"
branch_labels = None
depends_on = None


def _target() -> str:
    return context.get_x_argument(as_dictionary=True).get("db", "controller")


def upgrade() -> None:
    if _target() != "chat_sessions":
        return

    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not inspector.has_table("model_downloads"):
        op.create_table(
            "model_downloads",
            sa.Column("id", sa.Text(), nullable=False),
            sa.Column("repo_id", sa.Text(), nullable=False),
            sa.Column("revision", sa.Text(), nullable=True),
            sa.Column("local_path", sa.Text(), nullable=False),
            sa.Column("status", sa.Text(), nullable=False),
            sa.Column("started_at", sa.Text(), nullable=True),
            sa.Column("finished_at", sa.Text(), nullable=True),
            sa.Column("bytes_downloaded", sa.Integer(), nullable=True),
            sa.Column("bytes_total", sa.Integer(), nullable=True),
            sa.Column("pid", sa.Integer(), nullable=True),
            sa.Column("returncode", sa.Integer(), nullable=True),
            sa.Column("command", sa.Text(), nullable=False),
            sa.Column("log_path", sa.Text(), nullable=False),
            sa.Column("error_detail", sa.Text(), nullable=True),
            sa.Column("triggered_by", sa.Text(), server_default="unknown", nullable=False),
            sa.Column("created_at", sa.Text(), nullable=False),
            sa.Column("updated_at", sa.Text(), nullable=False),
            sa.PrimaryKeyConstraint("id", name=op.f("pk_model_downloads")),
        )

    inspector = sa.inspect(bind)
    existing_indexes = {idx.get("name") for idx in inspector.get_indexes("model_downloads")}
    created_at_idx = op.f("idx_model_downloads_created_at")
    status_idx = op.f("idx_model_downloads_status")
    if created_at_idx not in existing_indexes:
        op.create_index(created_at_idx, "model_downloads", ["created_at"], unique=False)
    if status_idx not in existing_indexes:
        op.create_index(status_idx, "model_downloads", ["status"], unique=False)


def downgrade() -> None:
    if _target() != "chat_sessions":
        return

    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if not inspector.has_table("model_downloads"):
        return

    existing_indexes = {idx.get("name") for idx in inspector.get_indexes("model_downloads")}
    status_idx = op.f("idx_model_downloads_status")
    created_at_idx = op.f("idx_model_downloads_created_at")
    if status_idx in existing_indexes:
        op.drop_index(status_idx, table_name="model_downloads")
    if created_at_idx in existing_indexes:
        op.drop_index(created_at_idx, table_name="model_downloads")
    op.drop_table("model_downloads")
