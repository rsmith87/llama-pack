"""add tool-loop eval run history

Revision ID: 20260611_0004
Revises: 20260528_0003
Create Date: 2026-06-11 00:00:00.000000
"""

from __future__ import annotations

from alembic import context, op
import sqlalchemy as sa


revision = "20260611_0004"
down_revision = "20260528_0003"
branch_labels = None
depends_on = None


def _target() -> str:
    return context.get_x_argument(as_dictionary=True).get("db", "controller")


def upgrade() -> None:
    if _target() != "benchmarks":
        return

    bind = op.get_bind()
    existing_tables = set(sa.inspect(bind).get_table_names())

    if "tool_loop_eval_runs" not in existing_tables:
        op.create_table(
            "tool_loop_eval_runs",
            sa.Column("id", sa.Text(), nullable=False),
            sa.Column("generated_at", sa.Text(), nullable=False),
            sa.Column("model", sa.Text(), nullable=False),
            sa.Column("target_selector", sa.Text(), server_default="auto", nullable=False),
            sa.Column("target_node", sa.Text(), nullable=True),
            sa.Column("status", sa.Text(), nullable=False),
            sa.Column("average_score", sa.Float(), server_default="0", nullable=False),
            sa.Column("case_count", sa.Integer(), server_default="0", nullable=False),
            sa.Column("passed_count", sa.Integer(), server_default="0", nullable=False),
            sa.Column("failed_count", sa.Integer(), server_default="0", nullable=False),
            sa.Column("error_detail", sa.Text(), nullable=True),
            sa.Column("created_at", sa.Text(), nullable=False),
            sa.PrimaryKeyConstraint("id", name=op.f("pk_tool_loop_eval_runs")),
        )
        op.create_index(
            op.f("idx_tool_loop_eval_runs_generated_at"),
            "tool_loop_eval_runs",
            ["generated_at"],
            unique=False,
        )
        op.create_index(op.f("idx_tool_loop_eval_runs_model"), "tool_loop_eval_runs", ["model"], unique=False)
        op.create_index(op.f("idx_tool_loop_eval_runs_status"), "tool_loop_eval_runs", ["status"], unique=False)

    if "tool_loop_eval_cases" not in existing_tables:
        op.create_table(
            "tool_loop_eval_cases",
            sa.Column("id", sa.Text(), nullable=False),
            sa.Column("run_id", sa.Text(), nullable=False),
            sa.Column("case_index", sa.Integer(), nullable=False),
            sa.Column("case_id", sa.Text(), nullable=False),
            sa.Column("status", sa.Text(), nullable=False),
            sa.Column("score", sa.Float(), server_default="0", nullable=False),
            sa.Column("checks_json", sa.Text(), server_default="{}", nullable=False),
            sa.Column("error_detail", sa.Text(), nullable=True),
            sa.Column("iteration_count", sa.Integer(), server_default="0", nullable=False),
            sa.Column("tool_call_count", sa.Integer(), server_default="0", nullable=False),
            sa.Column("observed_tool_sequence_json", sa.Text(), server_default="[]", nullable=False),
            sa.Column("expected_tool_sequence_json", sa.Text(), server_default="[]", nullable=False),
            sa.Column("scoring_mode", sa.Text(), nullable=True),
            sa.Column("tool_results_json", sa.Text(), server_default="[]", nullable=False),
            sa.Column("final_answer", sa.Text(), server_default="", nullable=False),
            sa.PrimaryKeyConstraint("id", name=op.f("pk_tool_loop_eval_cases")),
        )
        op.create_index(
            op.f("idx_tool_loop_eval_cases_run_id"),
            "tool_loop_eval_cases",
            ["run_id"],
            unique=False,
        )
        op.create_index(
            op.f("idx_tool_loop_eval_cases_case_id"),
            "tool_loop_eval_cases",
            ["case_id"],
            unique=False,
        )


def downgrade() -> None:
    if _target() != "benchmarks":
        return

    bind = op.get_bind()
    existing_tables = set(sa.inspect(bind).get_table_names())
    if "tool_loop_eval_cases" in existing_tables:
        existing_indexes = {idx.get("name") for idx in sa.inspect(bind).get_indexes("tool_loop_eval_cases")}
        for idx_name in (op.f("idx_tool_loop_eval_cases_case_id"), op.f("idx_tool_loop_eval_cases_run_id")):
            if idx_name in existing_indexes:
                op.drop_index(idx_name, table_name="tool_loop_eval_cases")
        op.drop_table("tool_loop_eval_cases")
    if "tool_loop_eval_runs" in existing_tables:
        existing_indexes = {idx.get("name") for idx in sa.inspect(bind).get_indexes("tool_loop_eval_runs")}
        for idx_name in (
            op.f("idx_tool_loop_eval_runs_status"),
            op.f("idx_tool_loop_eval_runs_model"),
            op.f("idx_tool_loop_eval_runs_generated_at"),
        ):
            if idx_name in existing_indexes:
                op.drop_index(idx_name, table_name="tool_loop_eval_runs")
        op.drop_table("tool_loop_eval_runs")
