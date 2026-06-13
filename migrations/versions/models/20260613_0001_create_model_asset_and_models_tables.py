"""models baseline schema

Revision ID: 20260613_0001
Revises:
Create Date: 2026-06-13 00:00:00.000000
"""

from __future__ import annotations

from alembic import context, op
import sqlalchemy as sa


revision = "20260613_0001"
down_revision = None
branch_labels = ("models",)
depends_on = None


def _target() -> str:
    return context.get_x_argument(as_dictionary=True).get("db", "controller")


def upgrade() -> None:
    if _target() != "models":
        return

    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = set(inspector.get_table_names())

    if "model_assets" not in existing_tables:
        op.create_table(
            "model_assets",
            sa.Column("asset_id", sa.Text(), nullable=False),
            sa.Column("asset_kind", sa.Text(), nullable=False),
            sa.Column("canonical_path", sa.Text(), nullable=False),
            sa.Column("filename", sa.Text(), nullable=False),
            sa.Column("display_name", sa.Text(), nullable=False),
            sa.Column("size_bytes", sa.Integer(), nullable=False),
            sa.Column("content_sha256", sa.Text(), nullable=True),
            sa.Column("source_type", sa.Text(), nullable=False),
            sa.Column("source_repo_id", sa.Text(), nullable=True),
            sa.Column("source_revision", sa.Text(), nullable=True),
            sa.Column("source_filename", sa.Text(), nullable=True),
            sa.Column("download_id", sa.Text(), nullable=True),
            sa.Column("model_line", sa.Text(), nullable=True),
            sa.Column("first_discovered_at", sa.Text(), nullable=False),
            sa.Column("last_seen_at", sa.Text(), nullable=False),
            sa.Column("last_scanned_at", sa.Text(), nullable=False),
            sa.Column("missing", sa.Integer(), server_default="0", nullable=False),
            sa.PrimaryKeyConstraint("asset_id", name=op.f("pk_model_assets")),
            sa.UniqueConstraint("canonical_path", name=op.f("uq_model_assets_canonical_path")),
        )
        op.create_index(op.f("idx_model_assets_canonical_path"), "model_assets", ["canonical_path"], unique=False)
        op.create_index(op.f("idx_model_assets_download_id"), "model_assets", ["download_id"], unique=False)
        op.create_index(op.f("idx_model_assets_model_line"), "model_assets", ["model_line"], unique=False)
        op.create_index(op.f("idx_model_assets_source_repo_id"), "model_assets", ["source_repo_id"], unique=False)

    if "models" not in existing_tables:
        op.create_table(
            "models",
            sa.Column("model_id", sa.Text(), nullable=False),
            sa.Column("model_name", sa.Text(), nullable=False),
            sa.Column("asset_id", sa.Text(), nullable=True),
            sa.Column("config_source", sa.Text(), nullable=False),
            sa.Column("model_line", sa.Text(), nullable=True),
            sa.Column("created_at", sa.Text(), nullable=False),
            sa.Column("updated_at", sa.Text(), nullable=False),
            sa.PrimaryKeyConstraint("model_id", name=op.f("pk_models")),
            sa.UniqueConstraint("model_name", name=op.f("uq_models_model_name")),
        )
        op.create_index(op.f("idx_models_asset_id"), "models", ["asset_id"], unique=False)
        op.create_index(op.f("idx_models_model_line"), "models", ["model_line"], unique=False)
        op.create_index(op.f("idx_models_name"), "models", ["model_name"], unique=False)


def downgrade() -> None:
    if _target() != "models":
        return

    op.drop_index(op.f("idx_models_name"), table_name="models")
    op.drop_index(op.f("idx_models_model_line"), table_name="models")
    op.drop_index(op.f("idx_models_asset_id"), table_name="models")
    op.drop_table("models")
    op.drop_index(op.f("idx_model_assets_source_repo_id"), table_name="model_assets")
    op.drop_index(op.f("idx_model_assets_model_line"), table_name="model_assets")
    op.drop_index(op.f("idx_model_assets_download_id"), table_name="model_assets")
    op.drop_index(op.f("idx_model_assets_canonical_path"), table_name="model_assets")
    op.drop_table("model_assets")
