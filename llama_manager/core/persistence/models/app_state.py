from __future__ import annotations

from sqlalchemy import Float, Index, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column

from llama_manager.core.persistence.alembic_config import Base


class ApiKeyOrm(Base):
    __tablename__ = "api_keys"

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    username: Mapped[str] = mapped_column(Text, nullable=False)
    role: Mapped[str] = mapped_column(Text, nullable=False)
    key_hash: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    key_hint: Mapped[str] = mapped_column(Text, nullable=False)
    revoked: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    created_at: Mapped[str] = mapped_column(Text, nullable=False)
    site_name: Mapped[str | None] = mapped_column(Text, nullable=True)
    site_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_used_at: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_used_endpoint: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_used_route: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_used_node: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_used_model: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_used_request_type: Mapped[str | None] = mapped_column(Text, nullable=True)


class AuditEventOrm(Base):
    __tablename__ = "audit_events"

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    actor: Mapped[str] = mapped_column(Text, nullable=False)
    event_type: Mapped[str] = mapped_column(Text, nullable=False)
    dry_run: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    target: Mapped[str | None] = mapped_column(Text, nullable=True)
    route: Mapped[str | None] = mapped_column(Text, nullable=True)
    payload_json: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[str] = mapped_column(Text, nullable=False)

    __table_args__ = (
        Index("idx_audit_events_created_at", "created_at"),
    )


class ChatSessionOrm(Base):
    __tablename__ = "chat_sessions"

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    model: Mapped[str] = mapped_column(Text, nullable=False)
    target_selector: Mapped[str] = mapped_column(Text, nullable=False, default="auto", server_default="auto")
    messages_json: Mapped[str] = mapped_column(Text, nullable=False)
    request_defaults_json: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[str] = mapped_column(Text, nullable=False)
    updated_at: Mapped[str] = mapped_column(Text, nullable=False)

    __table_args__ = (
        Index("idx_chat_sessions_updated_at", "updated_at"),
    )


class ModelDownloadOrm(Base):
    __tablename__ = "model_downloads"

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    repo_id: Mapped[str] = mapped_column(Text, nullable=False)
    revision: Mapped[str | None] = mapped_column(Text, nullable=True)
    local_path: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(Text, nullable=False)
    started_at: Mapped[str | None] = mapped_column(Text, nullable=True)
    finished_at: Mapped[str | None] = mapped_column(Text, nullable=True)
    bytes_downloaded: Mapped[int | None] = mapped_column(Integer, nullable=True)
    bytes_total: Mapped[int | None] = mapped_column(Integer, nullable=True)
    pid: Mapped[int | None] = mapped_column(Integer, nullable=True)
    returncode: Mapped[int | None] = mapped_column(Integer, nullable=True)
    command: Mapped[str] = mapped_column(Text, nullable=False)
    log_path: Mapped[str] = mapped_column(Text, nullable=False)
    error_detail: Mapped[str | None] = mapped_column(Text, nullable=True)
    triggered_by: Mapped[str] = mapped_column(Text, nullable=False, default="unknown", server_default="unknown")
    created_at: Mapped[str] = mapped_column(Text, nullable=False)
    updated_at: Mapped[str] = mapped_column(Text, nullable=False)

    __table_args__ = (
        Index("idx_model_downloads_created_at", "created_at"),
        Index("idx_model_downloads_status", "status"),
    )


class BenchmarkDefinitionOrm(Base):
    __tablename__ = "benchmark_definitions"

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    slug: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    prompt_text: Mapped[str] = mapped_column(Text, nullable=False)
    system_prompt: Mapped[str | None] = mapped_column(Text, nullable=True)
    request_defaults_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}", server_default="{}")
    sample_count: Mapped[int] = mapped_column(Integer, nullable=False, default=3, server_default="3")
    max_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=256, server_default="256")
    tags_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]", server_default="[]")
    created_at: Mapped[str] = mapped_column(Text, nullable=False)
    updated_at: Mapped[str] = mapped_column(Text, nullable=False)
    archived: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")

    __table_args__ = (
        Index("idx_benchmark_definitions_slug", "slug"),
    )


class BenchmarkRunOrm(Base):
    __tablename__ = "benchmark_runs"

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    benchmark_definition_id: Mapped[str] = mapped_column(Text, nullable=False)
    model: Mapped[str] = mapped_column(Text, nullable=False)
    target_selector: Mapped[str] = mapped_column(Text, nullable=False, default="auto", server_default="auto")
    target_node: Mapped[str | None] = mapped_column(Text, nullable=True)
    managed_load: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    restore_after: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    status: Mapped[str] = mapped_column(Text, nullable=False)
    started_at: Mapped[str | None] = mapped_column(Text, nullable=True)
    finished_at: Mapped[str | None] = mapped_column(Text, nullable=True)
    error_detail: Mapped[str | None] = mapped_column(Text, nullable=True)
    aggregate_json: Mapped[str | None] = mapped_column(Text, nullable=True)

    __table_args__ = (
        Index("idx_benchmark_runs_definition_id", "benchmark_definition_id"),
        Index("idx_benchmark_runs_status", "status"),
    )


class BenchmarkRunSampleOrm(Base):
    __tablename__ = "benchmark_run_samples"

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    run_id: Mapped[str] = mapped_column(Text, nullable=False)
    sample_index: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(Text, nullable=False)
    ttft_ms: Mapped[float | None] = mapped_column(Float, nullable=True)
    tokens_per_second: Mapped[float | None] = mapped_column(Float, nullable=True)
    total_duration_ms: Mapped[float | None] = mapped_column(Float, nullable=True)
    prompt_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)
    completion_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)
    completion_chars: Mapped[int | None] = mapped_column(Integer, nullable=True)
    response_excerpt: Mapped[str | None] = mapped_column(Text, nullable=True)
    error_detail: Mapped[str | None] = mapped_column(Text, nullable=True)
    raw_telemetry_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[str] = mapped_column(Text, nullable=False)

    __table_args__ = (
        Index("idx_benchmark_run_samples_run_id", "run_id"),
    )


class ToolLoopEvalRunOrm(Base):
    __tablename__ = "tool_loop_eval_runs"

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    generated_at: Mapped[str] = mapped_column(Text, nullable=False)
    model: Mapped[str] = mapped_column(Text, nullable=False)
    target_selector: Mapped[str] = mapped_column(Text, nullable=False, default="auto", server_default="auto")
    target_node: Mapped[str | None] = mapped_column(Text, nullable=True)
    target_instance: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(Text, nullable=False)
    average_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0, server_default="0")
    case_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    passed_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    failed_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    error_detail: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[str] = mapped_column(Text, nullable=False)

    __table_args__ = (
        Index("idx_tool_loop_eval_runs_generated_at", "generated_at"),
        Index("idx_tool_loop_eval_runs_model", "model"),
        Index("idx_tool_loop_eval_runs_status", "status"),
        Index("idx_tool_loop_eval_runs_target_instance", "target_instance"),
    )


class ToolLoopEvalCaseOrm(Base):
    __tablename__ = "tool_loop_eval_cases"

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    run_id: Mapped[str] = mapped_column(Text, nullable=False)
    case_index: Mapped[int] = mapped_column(Integer, nullable=False)
    case_id: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(Text, nullable=False)
    score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0, server_default="0")
    checks_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}", server_default="{}")
    error_detail: Mapped[str | None] = mapped_column(Text, nullable=True)
    iteration_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    tool_call_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    observed_tool_sequence_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]", server_default="[]")
    expected_tool_sequence_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]", server_default="[]")
    missing_expected_tools_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]", server_default="[]")
    unexpected_tools_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]", server_default="[]")
    scoring_mode: Mapped[str | None] = mapped_column(Text, nullable=True)
    tool_results_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]", server_default="[]")
    diagnostics_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}", server_default="{}")
    final_answer: Mapped[str] = mapped_column(Text, nullable=False, default="", server_default="")

    __table_args__ = (
        Index("idx_tool_loop_eval_cases_run_id", "run_id"),
        Index("idx_tool_loop_eval_cases_case_id", "case_id"),
    )
