"""add benchmark tables

Revision ID: 20260522_0006
Revises: 20260515_0005
Create Date: 2026-05-22 00:00:00.000000
"""

from __future__ import annotations

from alembic import context, op
import sqlalchemy as sa


revision = "20260522_0006"
down_revision = "20260515_0005"
branch_labels = None
depends_on = None


def _target() -> str:
    return context.get_x_argument(as_dictionary=True).get("db", "controller")


def upgrade() -> None:
    if _target() != "chat_sessions":
        return

    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not inspector.has_table("benchmark_definitions"):
        op.create_table(
            "benchmark_definitions",
            sa.Column("id", sa.Text(), nullable=False),
            sa.Column("name", sa.Text(), nullable=False),
            sa.Column("slug", sa.Text(), nullable=False),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("prompt_text", sa.Text(), nullable=False),
            sa.Column("system_prompt", sa.Text(), nullable=True),
            sa.Column("request_defaults_json", sa.Text(), server_default="{}", nullable=False),
            sa.Column("sample_count", sa.Integer(), server_default="3", nullable=False),
            sa.Column("max_tokens", sa.Integer(), server_default="256", nullable=False),
            sa.Column("tags_json", sa.Text(), server_default="[]", nullable=False),
            sa.Column("created_at", sa.Text(), nullable=False),
            sa.Column("updated_at", sa.Text(), nullable=False),
            sa.Column("archived", sa.Integer(), server_default="0", nullable=False),
            sa.PrimaryKeyConstraint("id", name=op.f("pk_benchmark_definitions")),
            sa.UniqueConstraint("slug", name=op.f("uq_benchmark_definitions_slug")),
        )

    inspector = sa.inspect(bind)
    existing_indexes = {idx.get("name") for idx in inspector.get_indexes("benchmark_definitions")}
    slug_idx = op.f("ix_benchmark_definitions_slug")
    if slug_idx not in existing_indexes:
        op.create_index(slug_idx, "benchmark_definitions", ["slug"], unique=False)

    if not inspector.has_table("benchmark_runs"):
        op.create_table(
            "benchmark_runs",
            sa.Column("id", sa.Text(), nullable=False),
            sa.Column("benchmark_definition_id", sa.Text(), nullable=False),
            sa.Column("model", sa.Text(), nullable=False),
            sa.Column("target_selector", sa.Text(), server_default="auto", nullable=False),
            sa.Column("status", sa.Text(), nullable=False),
            sa.Column("started_at", sa.Text(), nullable=True),
            sa.Column("finished_at", sa.Text(), nullable=True),
            sa.Column("error_detail", sa.Text(), nullable=True),
            sa.Column("aggregate_json", sa.Text(), nullable=True),
            sa.PrimaryKeyConstraint("id", name=op.f("pk_benchmark_runs")),
        )

    inspector = sa.inspect(bind)
    existing_indexes = {idx.get("name") for idx in inspector.get_indexes("benchmark_runs")}
    def_id_idx = op.f("idx_benchmark_runs_definition_id")
    status_idx = op.f("idx_benchmark_runs_status")
    if def_id_idx not in existing_indexes:
        op.create_index(def_id_idx, "benchmark_runs", ["benchmark_definition_id"], unique=False)
    if status_idx not in existing_indexes:
        op.create_index(status_idx, "benchmark_runs", ["status"], unique=False)

    if not inspector.has_table("benchmark_run_samples"):
        op.create_table(
            "benchmark_run_samples",
            sa.Column("id", sa.Text(), nullable=False),
            sa.Column("run_id", sa.Text(), nullable=False),
            sa.Column("sample_index", sa.Integer(), nullable=False),
            sa.Column("status", sa.Text(), nullable=False),
            sa.Column("ttft_ms", sa.Float(), nullable=True),
            sa.Column("tokens_per_second", sa.Float(), nullable=True),
            sa.Column("total_duration_ms", sa.Float(), nullable=True),
            sa.Column("prompt_tokens", sa.Integer(), nullable=True),
            sa.Column("completion_tokens", sa.Integer(), nullable=True),
            sa.Column("completion_chars", sa.Integer(), nullable=True),
            sa.Column("response_excerpt", sa.Text(), nullable=True),
            sa.Column("error_detail", sa.Text(), nullable=True),
            sa.Column("raw_telemetry_json", sa.Text(), nullable=True),
            sa.Column("created_at", sa.Text(), nullable=False),
            sa.PrimaryKeyConstraint("id", name=op.f("pk_benchmark_run_samples")),
        )

    inspector = sa.inspect(bind)
    existing_indexes = {idx.get("name") for idx in inspector.get_indexes("benchmark_run_samples")}
    run_id_idx = op.f("idx_benchmark_run_samples_run_id")
    if run_id_idx not in existing_indexes:
        op.create_index(run_id_idx, "benchmark_run_samples", ["run_id"], unique=False)


def downgrade() -> None:
    if _target() != "chat_sessions":
        return

    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if inspector.has_table("benchmark_run_samples"):
        existing_indexes = {idx.get("name") for idx in inspector.get_indexes("benchmark_run_samples")}
        run_id_idx = op.f("idx_benchmark_run_samples_run_id")
        if run_id_idx in existing_indexes:
            op.drop_index(run_id_idx, table_name="benchmark_run_samples")
        op.drop_table("benchmark_run_samples")

    if inspector.has_table("benchmark_runs"):
        existing_indexes = {idx.get("name") for idx in inspector.get_indexes("benchmark_runs")}
        def_id_idx = op.f("idx_benchmark_runs_definition_id")
        status_idx = op.f("idx_benchmark_runs_status")
        if def_id_idx in existing_indexes:
            op.drop_index(def_id_idx, table_name="benchmark_runs")
        if status_idx in existing_indexes:
            op.drop_index(status_idx, table_name="benchmark_runs")
        op.drop_table("benchmark_runs")

    if inspector.has_table("benchmark_definitions"):
        existing_indexes = {idx.get("name") for idx in inspector.get_indexes("benchmark_definitions")}
        slug_idx = op.f("ix_benchmark_definitions_slug")
        if slug_idx in existing_indexes:
            op.drop_index(slug_idx, table_name="benchmark_definitions")
        op.drop_table("benchmark_definitions")
