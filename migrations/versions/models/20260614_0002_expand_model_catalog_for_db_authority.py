"""expand model catalog for db authority

Revision ID: 20260614_0002
Revises: 20260613_0002
Create Date: 2026-06-14 00:00:00.000000
"""

from __future__ import annotations

from alembic import context, op
import sqlalchemy as sa


revision = "20260614_0002"
down_revision = "20260613_0002"
branch_labels = None
depends_on = None


def _target() -> str:
    return context.get_x_argument(as_dictionary=True).get("db", "controller")


def upgrade() -> None:
    if _target() != "models":
        return

    with op.batch_alter_table("models") as batch_op:
        batch_op.add_column(sa.Column("mmproj_asset_id", sa.Text(), nullable=True))
        batch_op.add_column(sa.Column("mtp_draft_asset_id", sa.Text(), nullable=True))
        batch_op.add_column(sa.Column("mtp_draft_model_id", sa.Text(), nullable=True))

    op.create_index("idx_models_mmproj_asset_id", "models", ["mmproj_asset_id"], unique=False)
    op.create_index("idx_models_mtp_draft_asset_id", "models", ["mtp_draft_asset_id"], unique=False)
    op.create_index("idx_models_mtp_draft_model_id", "models", ["mtp_draft_model_id"], unique=False)

    op.create_table(
        "model_asset_provenance",
        sa.Column("provenance_id", sa.Text(), nullable=False),
        sa.Column("output_asset_id", sa.Text(), nullable=False),
        sa.Column("source_asset_id", sa.Text(), nullable=True),
        sa.Column("source_model_id", sa.Text(), nullable=True),
        sa.Column("job_kind", sa.Text(), nullable=False),
        sa.Column("job_ref", sa.Text(), nullable=False),
        sa.Column("detail_json", sa.Text(), nullable=False, server_default=sa.text("'{}'")),
        sa.Column("created_at", sa.Text(), nullable=False),
        sa.PrimaryKeyConstraint("provenance_id", name="pk_model_asset_provenance"),
    )
    op.create_index(
        "idx_model_asset_provenance_output_asset_id",
        "model_asset_provenance",
        ["output_asset_id"],
        unique=False,
    )
    op.create_index(
        "idx_model_asset_provenance_source_asset_id",
        "model_asset_provenance",
        ["source_asset_id"],
        unique=False,
    )
    op.create_index(
        "idx_model_asset_provenance_source_model_id",
        "model_asset_provenance",
        ["source_model_id"],
        unique=False,
    )
    op.create_index(
        "idx_model_asset_provenance_job_kind_job_ref",
        "model_asset_provenance",
        ["job_kind", "job_ref"],
        unique=False,
    )


def downgrade() -> None:
    if _target() != "models":
        return

    op.drop_index("idx_model_asset_provenance_job_kind_job_ref", table_name="model_asset_provenance")
    op.drop_index("idx_model_asset_provenance_source_model_id", table_name="model_asset_provenance")
    op.drop_index("idx_model_asset_provenance_source_asset_id", table_name="model_asset_provenance")
    op.drop_index("idx_model_asset_provenance_output_asset_id", table_name="model_asset_provenance")
    op.drop_table("model_asset_provenance")

    op.drop_index("idx_models_mtp_draft_model_id", table_name="models")
    op.drop_index("idx_models_mtp_draft_asset_id", table_name="models")
    op.drop_index("idx_models_mmproj_asset_id", table_name="models")

    with op.batch_alter_table("models") as batch_op:
        batch_op.drop_column("mtp_draft_model_id")
        batch_op.drop_column("mtp_draft_asset_id")
        batch_op.drop_column("mmproj_asset_id")
