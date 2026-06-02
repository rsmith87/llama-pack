"""benchmarks baseline schema

Revision ID: 20260523_0002
Revises:
Create Date: 2026-05-23 00:00:00.000000
"""

from __future__ import annotations

from alembic import context, op
import sqlalchemy as sa


revision = "20260523_0002"
down_revision = None
branch_labels = ("benchmarks",)
depends_on = None


def _target() -> str:
    return context.get_x_argument(as_dictionary=True).get("db", "controller")


def upgrade() -> None:
    if _target() != "benchmarks":
        return

    bind = op.get_bind()
    if "benchmark_definitions" in sa.inspect(bind).get_table_names():
        return

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
    op.create_index(op.f("ix_benchmark_definitions_slug"), "benchmark_definitions", ["slug"], unique=False)

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
    op.create_index(op.f("idx_benchmark_runs_definition_id"), "benchmark_runs", ["benchmark_definition_id"], unique=False)
    op.create_index(op.f("idx_benchmark_runs_status"), "benchmark_runs", ["status"], unique=False)

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
    op.create_index(op.f("idx_benchmark_run_samples_run_id"), "benchmark_run_samples", ["run_id"], unique=False)


def downgrade() -> None:
    if _target() != "benchmarks":
        return

    op.drop_index(op.f("idx_benchmark_run_samples_run_id"), table_name="benchmark_run_samples")
    op.drop_table("benchmark_run_samples")
    op.drop_index(op.f("idx_benchmark_runs_status"), table_name="benchmark_runs")
    op.drop_index(op.f("idx_benchmark_runs_definition_id"), table_name="benchmark_runs")
    op.drop_table("benchmark_runs")
    op.drop_index(op.f("ix_benchmark_definitions_slug"), table_name="benchmark_definitions")
    op.drop_table("benchmark_definitions")
