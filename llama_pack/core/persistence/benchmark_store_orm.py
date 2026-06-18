from __future__ import annotations

import json
import uuid
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from sqlalchemy import select

from llama_pack.core.persistence.db_infra import (
    create_persistence_engine,
    create_session_factory,
    require_sqlite_tables,
    session_scope,
    sqlite_path_from_url,
    sqlite_url_for_path,
)
from llama_pack.core.persistence.models.app_state import (
    BenchmarkDefinitionOrm,
    BenchmarkRunOrm,
    BenchmarkRunSampleOrm,
    ToolLoopEvalCaseOrm,
    ToolLoopEvalRunOrm,
)

_DEFAULT_DEFINITIONS = [
    {
        "slug": "factual-qa-mini",
        "name": "Factual QA Mini",
        "description": "Factual recall check inspired by open-domain QA evals. Measures whether a model answers concise knowledge questions without over-explaining.",
        "prompt_text": (
            "Answer each question with only the requested fact.\n"
            "1. What is the capital of Canada?\n"
            "2. Who wrote Pride and Prejudice?\n"
            "3. What gas do plants absorb during photosynthesis?"
        ),
        "system_prompt": None,
        "sample_count": 5,
        "max_tokens": 64,
        "tags": ["preset", "eval-pack", "factuality", "qa"],
        "request_defaults": {"temperature": 0.0},
    },
    {
        "slug": "instruction-following-mini",
        "name": "Instruction Following Mini",
        "description": "Format and constraint-following check inspired by instruction adherence evals. Measures whether outputs obey explicit structure and wording limits.",
        "prompt_text": (
            "Convert the notes into exactly three JSON objects with keys task, owner, and priority. "
            "Use lowercase priority values only.\n"
            "Notes: Maya owns the urgent database backup. Lee owns the normal docs refresh. "
            "Ari owns the low-priority dependency audit."
        ),
        "system_prompt": "Follow the user's formatting constraints exactly.",
        "sample_count": 5,
        "max_tokens": 160,
        "tags": ["preset", "eval-pack", "instruction-following", "format"],
        "request_defaults": {},
    },
    {
        "slug": "reasoning-math-mini",
        "name": "Reasoning & Math Mini",
        "description": "Short multi-step reasoning check inspired by grade-school math and symbolic reasoning evals. Measures accuracy under light chain-of-thought pressure.",
        "prompt_text": (
            "Solve the problem and give the final answer on its own last line.\n"
            "A workshop packs 6 boxes per hour for 3 hours, then 4 boxes per hour for 2 hours. "
            "Each box holds 12 adapters. How many adapters are packed?"
        ),
        "system_prompt": None,
        "sample_count": 3,
        "max_tokens": 192,
        "tags": ["preset", "eval-pack", "reasoning", "math"],
        "request_defaults": {"temperature": 0.0},
    },
    {
        "slug": "summarization-mini",
        "name": "Summarization Mini",
        "description": "Compression and salience check inspired by summarization evals. Measures whether the model preserves key facts in a tight brief.",
        "prompt_text": (
            "Summarize the passage in exactly four bullets, preserving dates, owners, and risks.\n\n"
            "Passage: On Monday, the platform team completed the API gateway migration. "
            "Nina owns the rollout notes due Friday. Two risks remain: stale client SDKs and "
            "incomplete dashboard alerts. The support team will run a customer-facing smoke test on Thursday."
        ),
        "system_prompt": None,
        "sample_count": 3,
        "max_tokens": 224,
        "tags": ["preset", "eval-pack", "summarization", "faithfulness"],
        "request_defaults": {},
    },
]

_LEGACY_DEFAULT_SLUGS = {"short-response-latency", "sustained-generation"}


def _compute_aggregate(samples: list[dict[str, Any]]) -> dict[str, Any]:
    success = [s for s in samples if s["status"] == "success"]
    total = len(samples)

    def _sorted_values(key: str) -> list[float]:
        return sorted(float(s[key]) for s in success if s.get(key) is not None)

    def _median(vals: list[float]) -> float | None:
        if not vals:
            return None
        mid = len(vals) // 2
        return (vals[mid - 1] + vals[mid]) / 2.0 if len(vals) % 2 == 0 else vals[mid]

    def _p95(vals: list[float]) -> float | None:
        if not vals:
            return None
        idx = max(0, int(len(vals) * 0.95) - 1)
        return vals[idx]

    ttft = _sorted_values("ttft_ms")
    tps = _sorted_values("tokens_per_second")
    dur = _sorted_values("total_duration_ms")

    return {
        "ttft_ms_median": _median(ttft),
        "ttft_ms_p95": _p95(ttft),
        "tokens_per_second_median": _median(tps),
        "tokens_per_second_p95": _p95(tps),
        "total_duration_ms_median": _median(dur),
        "success_rate": len(success) / total if total > 0 else 0.0,
        "sample_count": total,
    }


class BenchmarkStoreOrm:
    _REQUIRED_TABLES = {
        "benchmark_definitions",
        "benchmark_runs",
        "benchmark_run_samples",
        "tool_loop_eval_runs",
        "tool_loop_eval_cases",
        "alembic_version",
    }

    def __init__(self, db_path: Path | None = None, db_url: str | None = None):
        if db_url is None:
            if db_path is None:
                raise ValueError("db_path or db_url is required")
            db_path.parent.mkdir(parents=True, exist_ok=True)
            db_url = sqlite_url_for_path(db_path)
        sqlite_path = sqlite_path_from_url(db_url)
        if sqlite_path is not None:
            require_sqlite_tables(
                db_path=sqlite_path,
                required_tables=self._REQUIRED_TABLES,
                target_name="benchmarks",
            )
        self.engine = create_persistence_engine(db_url)
        self.session_factory = create_session_factory(self.engine)
        self._seed_defaults()

    # ------------------------------------------------------------------
    # Bootstrap
    # ------------------------------------------------------------------

    def _seed_defaults(self) -> None:
        """Idempotently ensure the built-in benchmark presets exist."""
        now = datetime.now(UTC).isoformat()
        with session_scope(self.session_factory) as session:
            legacy_rows = session.execute(
                select(BenchmarkDefinitionOrm).where(BenchmarkDefinitionOrm.slug.in_(_LEGACY_DEFAULT_SLUGS))
            ).scalars()
            for row in legacy_rows:
                if row.archived == 0:
                    row.archived = 1
                    row.updated_at = now

            for preset in _DEFAULT_DEFINITIONS:
                existing = session.execute(
                    select(BenchmarkDefinitionOrm).where(BenchmarkDefinitionOrm.slug == preset["slug"])
                ).scalar_one_or_none()
                if existing is None:
                    row = BenchmarkDefinitionOrm(
                        id=str(uuid.uuid4()),
                        name=preset["name"],
                        slug=preset["slug"],
                        description=preset["description"],
                        prompt_text=preset["prompt_text"],
                        system_prompt=preset["system_prompt"],
                        request_defaults_json=json.dumps(preset["request_defaults"]),
                        sample_count=preset["sample_count"],
                        max_tokens=preset["max_tokens"],
                        tags_json=json.dumps(preset["tags"]),
                        created_at=now,
                        updated_at=now,
                        archived=0,
                    )
                    session.add(row)

    # ------------------------------------------------------------------
    # Definitions
    # ------------------------------------------------------------------

    def list_definitions(self, *, include_archived: bool = False) -> list[dict[str, Any]]:
        with session_scope(self.session_factory) as session:
            q = select(BenchmarkDefinitionOrm).order_by(BenchmarkDefinitionOrm.created_at.desc())
            if not include_archived:
                q = q.where(BenchmarkDefinitionOrm.archived == 0)
            rows = session.execute(q).scalars().all()
        return [_definition_to_dict(r) for r in rows]

    def get_definition(self, definition_id: str) -> dict[str, Any] | None:
        with session_scope(self.session_factory) as session:
            row = session.execute(
                select(BenchmarkDefinitionOrm).where(BenchmarkDefinitionOrm.id == definition_id)
            ).scalar_one_or_none()
        return _definition_to_dict(row) if row is not None else None

    def create_definition(
        self,
        *,
        name: str,
        slug: str,
        prompt_text: str,
        sample_count: int,
        max_tokens: int,
        description: str | None = None,
        system_prompt: str | None = None,
        request_defaults: dict[str, Any] | None = None,
        tags: list[str] | None = None,
    ) -> dict[str, Any]:
        now = datetime.now(UTC).isoformat()
        row = BenchmarkDefinitionOrm(
            id=str(uuid.uuid4()),
            name=name,
            slug=slug,
            description=description,
            prompt_text=prompt_text,
            system_prompt=system_prompt,
            request_defaults_json=json.dumps(request_defaults or {}),
            sample_count=sample_count,
            max_tokens=max_tokens,
            tags_json=json.dumps(tags or []),
            created_at=now,
            updated_at=now,
            archived=0,
        )
        with session_scope(self.session_factory) as session:
            session.add(row)
        return _definition_to_dict(row)

    # ------------------------------------------------------------------
    # Runs
    # ------------------------------------------------------------------

    def list_runs(self, *, definition_id: str | None = None, limit: int = 50) -> list[dict[str, Any]]:
        with session_scope(self.session_factory) as session:
            q = select(BenchmarkRunOrm).order_by(BenchmarkRunOrm.started_at.desc())
            if definition_id is not None:
                q = q.where(BenchmarkRunOrm.benchmark_definition_id == definition_id)
            q = q.limit(limit)
            rows = session.execute(q).scalars().all()
        return [_run_to_dict(r) for r in rows]

    def get_run(self, run_id: str) -> dict[str, Any] | None:
        with session_scope(self.session_factory) as session:
            row = session.execute(
                select(BenchmarkRunOrm).where(BenchmarkRunOrm.id == run_id)
            ).scalar_one_or_none()
            if row is None:
                return None
            result = _run_to_dict(row)
            samples = session.execute(
                select(BenchmarkRunSampleOrm)
                .where(BenchmarkRunSampleOrm.run_id == run_id)
                .order_by(BenchmarkRunSampleOrm.sample_index)
            ).scalars().all()
        result["samples"] = [_sample_to_dict(s) for s in samples]
        return result

    def create_run(
        self,
        *,
        benchmark_definition_id: str,
        model: str,
        target_selector: str = "auto",
        target_node: str | None = None,
        managed_load: bool = False,
        restore_after: bool = False,
        status: str = "pending",
    ) -> dict[str, Any]:
        row = BenchmarkRunOrm(
            id=str(uuid.uuid4()),
            benchmark_definition_id=benchmark_definition_id,
            model=model,
            target_selector=target_selector,
            target_node=target_node,
            managed_load=1 if managed_load else 0,
            restore_after=1 if restore_after else 0,
            status=status,
            started_at=None,
            finished_at=None,
            error_detail=None,
            aggregate_json=None,
        )
        with session_scope(self.session_factory) as session:
            session.add(row)
        return _run_to_dict(row)

    def update_run(
        self,
        run_id: str,
        *,
        status: str | None = None,
        started_at: str | None = None,
        finished_at: str | None = None,
        error_detail: str | None = None,
        aggregate_json: str | None = None,
    ) -> dict[str, Any] | None:
        with session_scope(self.session_factory) as session:
            row = session.execute(
                select(BenchmarkRunOrm).where(BenchmarkRunOrm.id == run_id)
            ).scalar_one_or_none()
            if row is None:
                return None
            if status is not None:
                row.status = status
            if started_at is not None:
                row.started_at = started_at
            if finished_at is not None:
                row.finished_at = finished_at
            if error_detail is not None:
                row.error_detail = error_detail
            if aggregate_json is not None:
                row.aggregate_json = aggregate_json
            result = _run_to_dict(row)
        return result

    # ------------------------------------------------------------------
    # Samples
    # ------------------------------------------------------------------

    def create_sample(
        self,
        *,
        run_id: str,
        sample_index: int,
        status: str,
        ttft_ms: float | None,
        tokens_per_second: float | None,
        total_duration_ms: float | None,
        prompt_tokens: int | None,
        completion_tokens: int | None,
        completion_chars: int | None,
        response_excerpt: str | None,
        error_detail: str | None,
        raw_telemetry: dict[str, Any] | None,
    ) -> dict[str, Any]:
        now = datetime.now(UTC).isoformat()
        row = BenchmarkRunSampleOrm(
            id=str(uuid.uuid4()),
            run_id=run_id,
            sample_index=sample_index,
            status=status,
            ttft_ms=ttft_ms,
            tokens_per_second=tokens_per_second,
            total_duration_ms=total_duration_ms,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            completion_chars=completion_chars,
            response_excerpt=response_excerpt,
            error_detail=error_detail,
            raw_telemetry_json=json.dumps(raw_telemetry) if raw_telemetry is not None else None,
            created_at=now,
        )
        with session_scope(self.session_factory) as session:
            session.add(row)
        return _sample_to_dict(row)

    def get_run_samples(self, run_id: str) -> list[dict[str, Any]]:
        with session_scope(self.session_factory) as session:
            rows = session.execute(
                select(BenchmarkRunSampleOrm)
                .where(BenchmarkRunSampleOrm.run_id == run_id)
                .order_by(BenchmarkRunSampleOrm.sample_index)
            ).scalars().all()
        return [_sample_to_dict(r) for r in rows]

    # ------------------------------------------------------------------
    # Tool-loop eval runs
    # ------------------------------------------------------------------

    def create_tool_loop_eval_run(
        self,
        *,
        generated_at: str,
        target_selector: str,
        target_node: str | None,
        target_instance: str | None = None,
        suite: dict[str, Any],
    ) -> dict[str, Any]:
        now = datetime.now(UTC).isoformat()
        run_id = str(uuid.uuid4())
        row = ToolLoopEvalRunOrm(
            id=run_id,
            generated_at=generated_at,
            model=str(suite.get("model") or ""),
            target_selector=target_selector,
            target_node=target_node,
            target_instance=target_instance,
            status=str(suite.get("status") or "failed"),
            average_score=float(suite.get("average_score") or 0.0),
            case_count=int(suite.get("case_count") or len(suite.get("cases") or [])),
            passed_count=int(suite.get("passed_count") or 0),
            failed_count=int(suite.get("failed_count") or 0),
            error_detail=str(suite.get("error") or "") or None,
            created_at=now,
        )
        case_rows = [
            _tool_loop_case_row(run_id, index, case)
            for index, case in enumerate(suite.get("cases") or [])
            if isinstance(case, dict)
        ]
        with session_scope(self.session_factory) as session:
            session.add(row)
            for case_row in case_rows:
                session.add(case_row)
        return _tool_loop_run_to_dict(row)

    def list_tool_loop_eval_runs(
        self,
        *,
        model: str | None = None,
        status: str | None = None,
        limit: int = 50,
    ) -> list[dict[str, Any]]:
        with session_scope(self.session_factory) as session:
            q = select(ToolLoopEvalRunOrm).order_by(ToolLoopEvalRunOrm.generated_at.desc())
            if model is not None:
                q = q.where(ToolLoopEvalRunOrm.model == model)
            if status is not None:
                q = q.where(ToolLoopEvalRunOrm.status == status)
            q = q.limit(limit)
            rows = session.execute(q).scalars().all()
            case_ids_by_run_id = _tool_loop_case_ids_by_run_id(session, [row.id for row in rows])
        return [
            _tool_loop_run_to_dict(row, case_ids=case_ids_by_run_id.get(row.id, []))
            for row in rows
        ]

    def get_tool_loop_eval_run(self, run_id: str) -> dict[str, Any] | None:
        with session_scope(self.session_factory) as session:
            row = session.execute(
                select(ToolLoopEvalRunOrm).where(ToolLoopEvalRunOrm.id == run_id)
            ).scalar_one_or_none()
            if row is None:
                return None
            result = _tool_loop_run_to_dict(row)
            cases = session.execute(
                select(ToolLoopEvalCaseOrm)
                .where(ToolLoopEvalCaseOrm.run_id == run_id)
                .order_by(ToolLoopEvalCaseOrm.case_index)
            ).scalars().all()
        result["cases"] = [_tool_loop_case_to_dict(case) for case in cases]
        result["case_ids"] = [case["case_id"] for case in result["cases"]]
        return result


# ------------------------------------------------------------------
# Serializers
# ------------------------------------------------------------------

def _definition_to_dict(row: BenchmarkDefinitionOrm) -> dict[str, Any]:
    return {
        "id": row.id,
        "name": row.name,
        "slug": row.slug,
        "description": row.description,
        "prompt_text": row.prompt_text,
        "system_prompt": row.system_prompt,
        "request_defaults": json.loads(row.request_defaults_json),
        "sample_count": row.sample_count,
        "max_tokens": row.max_tokens,
        "tags": json.loads(row.tags_json),
        "created_at": row.created_at,
        "updated_at": row.updated_at,
        "archived": bool(row.archived),
    }


def _run_to_dict(row: BenchmarkRunOrm) -> dict[str, Any]:
    return {
        "id": row.id,
        "benchmark_definition_id": row.benchmark_definition_id,
        "model": row.model,
        "target_selector": row.target_selector,
        "target_node": row.target_node,
        "managed_load": bool(row.managed_load),
        "restore_after": bool(row.restore_after),
        "status": row.status,
        "started_at": row.started_at,
        "finished_at": row.finished_at,
        "error_detail": row.error_detail,
        "aggregate": json.loads(row.aggregate_json) if row.aggregate_json else None,
    }


def _sample_to_dict(row: BenchmarkRunSampleOrm) -> dict[str, Any]:
    return {
        "id": row.id,
        "run_id": row.run_id,
        "sample_index": row.sample_index,
        "status": row.status,
        "ttft_ms": row.ttft_ms,
        "tokens_per_second": row.tokens_per_second,
        "total_duration_ms": row.total_duration_ms,
        "prompt_tokens": row.prompt_tokens,
        "completion_tokens": row.completion_tokens,
        "completion_chars": row.completion_chars,
        "response_excerpt": row.response_excerpt,
        "error_detail": row.error_detail,
        "created_at": row.created_at,
    }


def _tool_loop_case_row(run_id: str, case_index: int, case: dict[str, Any]) -> ToolLoopEvalCaseOrm:
    return ToolLoopEvalCaseOrm(
        id=str(uuid.uuid4()),
        run_id=run_id,
        case_index=case_index,
        case_id=str(case.get("case_id") or ""),
        status=str(case.get("status") or "failed"),
        score=float(case.get("score") or 0.0),
        checks_json=json.dumps(case.get("checks") or {}),
        error_detail=str(case.get("error") or "") or None,
        iteration_count=int(case.get("iteration_count") or 0),
        tool_call_count=int(case.get("tool_call_count") or 0),
        observed_tool_sequence_json=json.dumps(case.get("observed_tool_sequence") or []),
        expected_tool_sequence_json=json.dumps(case.get("expected_tool_sequence") or []),
        missing_expected_tools_json=json.dumps(case.get("missing_expected_tools") or []),
        unexpected_tools_json=json.dumps(case.get("unexpected_tools") or []),
        scoring_mode=case.get("scoring_mode"),
        tool_results_json=json.dumps(case.get("tool_results") or []),
        trace_events_json=json.dumps(case.get("trace_events") or []),
        diagnostics_json=json.dumps(_tool_loop_case_diagnostics(case)),
        final_answer=str(case.get("final_answer") or ""),
    )


def _tool_loop_case_ids_by_run_id(session: Any, run_ids: list[str]) -> dict[str, list[str]]:
    if not run_ids:
        return {}
    rows = session.execute(
        select(ToolLoopEvalCaseOrm.run_id, ToolLoopEvalCaseOrm.case_id)
        .where(ToolLoopEvalCaseOrm.run_id.in_(run_ids))
        .order_by(ToolLoopEvalCaseOrm.run_id, ToolLoopEvalCaseOrm.case_index)
    ).all()
    case_ids_by_run_id: dict[str, list[str]] = {run_id: [] for run_id in run_ids}
    for run_id, case_id in rows:
        case_ids_by_run_id[str(run_id)].append(str(case_id))
    return case_ids_by_run_id


def _tool_loop_run_to_dict(row: ToolLoopEvalRunOrm, case_ids: list[str] | None = None) -> dict[str, Any]:
    return {
        "id": row.id,
        "generated_at": row.generated_at,
        "model": row.model,
        "target_selector": row.target_selector,
        "target_node": row.target_node,
        "target_instance": row.target_instance,
        "status": row.status,
        "average_score": row.average_score,
        "case_count": row.case_count,
        "passed_count": row.passed_count,
        "failed_count": row.failed_count,
        "case_ids": list(case_ids or []),
        "error": row.error_detail,
        "created_at": row.created_at,
    }


def _tool_loop_case_to_dict(row: ToolLoopEvalCaseOrm) -> dict[str, Any]:
    return {
        "id": row.id,
        "run_id": row.run_id,
        "case_index": row.case_index,
        "case_id": row.case_id,
        "status": row.status,
        "score": row.score,
        "checks": json.loads(row.checks_json),
        "error": row.error_detail or "",
        "iteration_count": row.iteration_count,
        "tool_call_count": row.tool_call_count,
        "observed_tool_sequence": json.loads(row.observed_tool_sequence_json),
        "expected_tool_sequence": json.loads(row.expected_tool_sequence_json),
        "missing_expected_tools": json.loads(row.missing_expected_tools_json),
        "unexpected_tools": json.loads(row.unexpected_tools_json),
        "scoring_mode": row.scoring_mode,
        "tool_results": json.loads(row.tool_results_json),
        "trace_events": json.loads(row.trace_events_json),
        "diagnostics": json.loads(row.diagnostics_json),
        "final_answer": row.final_answer,
    }


def _tool_loop_case_diagnostics(case: dict[str, Any]) -> dict[str, Any]:
    diagnostics = dict(case.get("diagnostics") or {})
    for key in ("missing_artifact_substrings", "forbidden_artifact_substrings_found"):
        if key in case:
            diagnostics[key] = case.get(key) or {}
    return diagnostics
