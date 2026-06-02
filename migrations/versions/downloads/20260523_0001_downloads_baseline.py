"""downloads baseline schema

Revision ID: 20260523_0001
Revises:
Create Date: 2026-05-23 00:00:00.000000
"""

from __future__ import annotations

from alembic import context, op
import sqlalchemy as sa


revision = "20260523_0001"
down_revision = None
branch_labels = ("downloads",)
depends_on = None


def _target() -> str:
    return context.get_x_argument(as_dictionary=True).get("db", "controller")


def upgrade() -> None:
    if _target() != "downloads":
        return

    bind = op.get_bind()
    if "model_downloads" in sa.inspect(bind).get_table_names():
        return

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
    op.create_index(op.f("idx_model_downloads_created_at"), "model_downloads", ["created_at"], unique=False)
    op.create_index(op.f("idx_model_downloads_status"), "model_downloads", ["status"], unique=False)


def downgrade() -> None:
    if _target() != "downloads":
        return

    op.drop_index(op.f("idx_model_downloads_status"), table_name="model_downloads")
    op.drop_index(op.f("idx_model_downloads_created_at"), table_name="model_downloads")
    op.drop_table("model_downloads")
