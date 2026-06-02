"""drop operational tables from chat_sessions

Removes model_downloads and benchmark tables that have been moved to their
own dedicated databases (downloads.db and benchmarks.db).

Revision ID: 20260523_0007
Revises: 20260522_0006
Create Date: 2026-05-23 00:00:00.000000
"""

from __future__ import annotations

from alembic import context, op
import sqlalchemy as sa


revision = "20260523_0007"
down_revision = "20260522_0006"
branch_labels = None
depends_on = None


def _target() -> str:
    return context.get_x_argument(as_dictionary=True).get("db", "controller")


def upgrade() -> None:
    if _target() != "chat_sessions":
        return

    bind = op.get_bind()
    inspector = sa.inspect(bind)

    # Drop benchmark_run_samples first (references benchmark_runs)
    if inspector.has_table("benchmark_run_samples"):
        existing_indexes = {idx.get("name") for idx in inspector.get_indexes("benchmark_run_samples")}
        for idx_name in existing_indexes:
            if idx_name:
                op.drop_index(idx_name, table_name="benchmark_run_samples")
        op.drop_table("benchmark_run_samples")

    if inspector.has_table("benchmark_runs"):
        existing_indexes = {idx.get("name") for idx in inspector.get_indexes("benchmark_runs")}
        for idx_name in existing_indexes:
            if idx_name:
                op.drop_index(idx_name, table_name="benchmark_runs")
        op.drop_table("benchmark_runs")

    if inspector.has_table("benchmark_definitions"):
        existing_indexes = {idx.get("name") for idx in inspector.get_indexes("benchmark_definitions")}
        for idx_name in existing_indexes:
            if idx_name:
                op.drop_index(idx_name, table_name="benchmark_definitions")
        op.drop_table("benchmark_definitions")

    if inspector.has_table("model_downloads"):
        existing_indexes = {idx.get("name") for idx in inspector.get_indexes("model_downloads")}
        for idx_name in existing_indexes:
            if idx_name:
                op.drop_index(idx_name, table_name="model_downloads")
        op.drop_table("model_downloads")


def downgrade() -> None:
    if _target() != "chat_sessions":
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
