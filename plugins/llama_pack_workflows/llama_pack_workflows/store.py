from __future__ import annotations

import json
import sqlite3
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

from llama_pack_workflows.models import (
    TriggerType,
    WorkflowDefinition,
    WorkflowDefinitionCreate,
    WorkflowRun,
    WorkflowRunDetail,
    WorkflowRunStep,
)


class WorkflowStore:
    def __init__(self, db_path: Path) -> None:
        self.db_path = db_path

    def migrate(self) -> None:
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        with self._connect() as connection:
            connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS workflow_definitions (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    description TEXT NOT NULL,
                    template_id TEXT NOT NULL,
                    enabled INTEGER NOT NULL,
                    parameters_json TEXT NOT NULL,
                    triggers_json TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS workflow_runs (
                    id TEXT PRIMARY KEY,
                    workflow_id TEXT NOT NULL,
                    status TEXT NOT NULL,
                    trigger_type TEXT NOT NULL,
                    trigger_detail TEXT NOT NULL,
                    error_detail TEXT,
                    correlation_id TEXT,
                    started_at TEXT,
                    finished_at TEXT,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY(workflow_id) REFERENCES workflow_definitions(id)
                );

                CREATE TABLE IF NOT EXISTS workflow_run_steps (
                    id TEXT PRIMARY KEY,
                    run_id TEXT NOT NULL,
                    label TEXT NOT NULL,
                    status TEXT NOT NULL,
                    input_summary TEXT,
                    output_summary TEXT,
                    linked_job_id TEXT,
                    linked_thread_id TEXT,
                    error_detail TEXT,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY(run_id) REFERENCES workflow_runs(id)
                );
                """
            )

    def create_definition(self, body: WorkflowDefinitionCreate) -> WorkflowDefinition:
        now = _utc_now()
        workflow_id = str(uuid4())
        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO workflow_definitions (
                    id, name, description, template_id, enabled,
                    parameters_json, triggers_json, created_at, updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    workflow_id,
                    body.name,
                    body.description,
                    body.template_id,
                    1 if body.enabled else 0,
                    _json_dumps(body.parameters),
                    _json_dumps([trigger.model_dump(mode="json") for trigger in body.triggers]),
                    _datetime_to_text(now),
                    _datetime_to_text(now),
                ),
            )
        return self.get_definition(workflow_id)

    def list_definitions(self) -> list[WorkflowDefinition]:
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT id, name, description, template_id, enabled, parameters_json,
                       triggers_json, created_at, updated_at
                FROM workflow_definitions
                ORDER BY created_at DESC, id DESC
                """
            ).fetchall()
        return [_definition_from_row(row) for row in rows]

    def get_definition(self, workflow_id: str) -> WorkflowDefinition:
        with self._connect() as connection:
            row = connection.execute(
                """
                SELECT id, name, description, template_id, enabled, parameters_json,
                       triggers_json, created_at, updated_at
                FROM workflow_definitions
                WHERE id = ?
                """,
                (workflow_id,),
            ).fetchone()
        if row is None:
            raise KeyError(f"Workflow definition not found: {workflow_id}")
        return _definition_from_row(row)

    def update_definition(self, workflow_id: str, body: WorkflowDefinitionCreate) -> WorkflowDefinition:
        now = _utc_now()
        with self._connect() as connection:
            cursor = connection.execute(
                """
                UPDATE workflow_definitions
                SET name = ?,
                    description = ?,
                    template_id = ?,
                    enabled = ?,
                    parameters_json = ?,
                    triggers_json = ?,
                    updated_at = ?
                WHERE id = ?
                """,
                (
                    body.name,
                    body.description,
                    body.template_id,
                    1 if body.enabled else 0,
                    _json_dumps(body.parameters),
                    _json_dumps([trigger.model_dump(mode="json") for trigger in body.triggers]),
                    _datetime_to_text(now),
                    workflow_id,
                ),
            )
        if cursor.rowcount == 0:
            raise KeyError(f"Workflow definition not found: {workflow_id}")
        return self.get_definition(workflow_id)

    def set_definition_enabled(self, workflow_id: str, enabled: bool) -> WorkflowDefinition:
        now = _utc_now()
        with self._connect() as connection:
            cursor = connection.execute(
                """
                UPDATE workflow_definitions
                SET enabled = ?, updated_at = ?
                WHERE id = ?
                """,
                (1 if enabled else 0, _datetime_to_text(now), workflow_id),
            )
        if cursor.rowcount == 0:
            raise KeyError(f"Workflow definition not found: {workflow_id}")
        return self.get_definition(workflow_id)

    def list_enabled_definitions(self) -> list[WorkflowDefinition]:
        return [definition for definition in self.list_definitions() if definition.enabled]

    def create_run(
        self,
        workflow_id: str,
        trigger_type: TriggerType,
        trigger_detail: str,
        correlation_id: str | None,
    ) -> WorkflowRun:
        self.get_definition(workflow_id)
        now = _utc_now()
        run_id = str(uuid4())
        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO workflow_runs (
                    id, workflow_id, status, trigger_type, trigger_detail,
                    error_detail, correlation_id, started_at, finished_at, created_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    run_id,
                    workflow_id,
                    "queued",
                    trigger_type,
                    trigger_detail,
                    None,
                    correlation_id,
                    None,
                    None,
                    _datetime_to_text(now),
                ),
            )
        return self.get_run(run_id)

    def mark_run_running(self, run_id: str) -> WorkflowRun:
        now = _utc_now()
        self._update_run(run_id, "running", None, _datetime_to_text(now), None)
        return self.get_run(run_id)

    def mark_run_completed(self, run_id: str) -> WorkflowRun:
        now = _utc_now()
        self._update_run(run_id, "completed", None, None, _datetime_to_text(now))
        return self.get_run(run_id)

    def mark_run_failed(self, run_id: str, error_detail: str) -> WorkflowRun:
        now = _utc_now()
        self._update_run(run_id, "failed", error_detail, None, _datetime_to_text(now))
        return self.get_run(run_id)

    def list_runs(self, workflow_id: str | None) -> list[WorkflowRun]:
        if workflow_id is None:
            query = """
                SELECT id, workflow_id, status, trigger_type, trigger_detail, error_detail,
                       correlation_id, started_at, finished_at, created_at
                FROM workflow_runs
                ORDER BY created_at DESC, id DESC
            """
            params: tuple[str, ...] = ()
        else:
            query = """
                SELECT id, workflow_id, status, trigger_type, trigger_detail, error_detail,
                       correlation_id, started_at, finished_at, created_at
                FROM workflow_runs
                WHERE workflow_id = ?
                ORDER BY created_at DESC, id DESC
            """
            params = (workflow_id,)
        with self._connect() as connection:
            rows = connection.execute(query, params).fetchall()
        return [_run_from_row(row) for row in rows]

    def latest_run_for_workflow(self, workflow_id: str, trigger_type: TriggerType) -> WorkflowRun | None:
        with self._connect() as connection:
            row = connection.execute(
                """
                SELECT id, workflow_id, status, trigger_type, trigger_detail, error_detail,
                       correlation_id, started_at, finished_at, created_at
                FROM workflow_runs
                WHERE workflow_id = ? AND trigger_type = ?
                ORDER BY created_at DESC, id DESC
                LIMIT 1
                """,
                (workflow_id, trigger_type),
            ).fetchone()
        if row is None:
            return None
        return _run_from_row(row)

    def get_run(self, run_id: str) -> WorkflowRun:
        with self._connect() as connection:
            row = connection.execute(
                """
                SELECT id, workflow_id, status, trigger_type, trigger_detail, error_detail,
                       correlation_id, started_at, finished_at, created_at
                FROM workflow_runs
                WHERE id = ?
                """,
                (run_id,),
            ).fetchone()
        if row is None:
            raise KeyError(f"Workflow run not found: {run_id}")
        return _run_from_row(row)

    def add_step(
        self,
        run_id: str,
        label: str,
        status: str,
        input_summary: str | None,
        output_summary: str | None,
        linked_job_id: str | None,
        linked_thread_id: str | None,
        error_detail: str | None,
    ) -> None:
        self.get_run(run_id)
        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO workflow_run_steps (
                    id, run_id, label, status, input_summary, output_summary,
                    linked_job_id, linked_thread_id, error_detail, created_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    str(uuid4()),
                    run_id,
                    label,
                    status,
                    input_summary,
                    output_summary,
                    linked_job_id,
                    linked_thread_id,
                    error_detail,
                    _datetime_to_text(_utc_now()),
                ),
            )

    def list_run_steps(self, run_id: str) -> list[dict[str, str | None]]:
        return [step.model_dump(mode="json") for step in self.get_run_detail(run_id).steps]

    def get_run_detail(self, run_id: str) -> WorkflowRunDetail:
        run = self.get_run(run_id)
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT id, run_id, label, status, input_summary, output_summary,
                       linked_job_id, linked_thread_id, error_detail, created_at
                FROM workflow_run_steps
                WHERE run_id = ?
                ORDER BY created_at ASC, id ASC
                """,
                (run_id,),
            ).fetchall()
        steps = [_run_step_from_row(row) for row in rows]
        return WorkflowRunDetail(run=run, steps=steps)

    def _update_run(
        self,
        run_id: str,
        status: str,
        error_detail: str | None,
        started_at: str | None,
        finished_at: str | None,
    ) -> None:
        assignments = ["status = ?"]
        values: list[str | None] = [status]
        if error_detail is not None:
            assignments.append("error_detail = ?")
            values.append(error_detail)
        if started_at is not None:
            assignments.append("started_at = ?")
            values.append(started_at)
        if finished_at is not None:
            assignments.append("finished_at = ?")
            values.append(finished_at)
        values.append(run_id)
        with self._connect() as connection:
            cursor = connection.execute(
                f"UPDATE workflow_runs SET {', '.join(assignments)} WHERE id = ?",
                tuple(values),
            )
        if cursor.rowcount == 0:
            raise KeyError(f"Workflow run not found: {run_id}")

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.db_path)
        connection.row_factory = sqlite3.Row
        return connection


def _definition_from_row(row: sqlite3.Row) -> WorkflowDefinition:
    return WorkflowDefinition.model_validate(
        {
            "id": row["id"],
            "name": row["name"],
            "description": row["description"],
            "template_id": row["template_id"],
            "enabled": bool(row["enabled"]),
            "parameters": json.loads(row["parameters_json"]),
            "triggers": json.loads(row["triggers_json"]),
            "created_at": row["created_at"],
            "updated_at": row["updated_at"],
        }
    )


def _run_from_row(row: sqlite3.Row) -> WorkflowRun:
    return WorkflowRun.model_validate(
        {
            "id": row["id"],
            "workflow_id": row["workflow_id"],
            "status": row["status"],
            "trigger_type": row["trigger_type"],
            "trigger_detail": row["trigger_detail"],
            "error_detail": row["error_detail"],
            "correlation_id": row["correlation_id"],
            "started_at": row["started_at"],
            "finished_at": row["finished_at"],
            "created_at": row["created_at"],
        }
    )


def _run_step_from_row(row: sqlite3.Row) -> WorkflowRunStep:
    return WorkflowRunStep.model_validate(
        {
            "id": row["id"],
            "run_id": row["run_id"],
            "label": row["label"],
            "status": row["status"],
            "input_summary": row["input_summary"],
            "output_summary": row["output_summary"],
            "linked_job_id": row["linked_job_id"],
            "linked_thread_id": row["linked_thread_id"],
            "error_detail": row["error_detail"],
            "created_at": row["created_at"],
        }
    )


def _utc_now() -> datetime:
    return datetime.now(UTC)


def _datetime_to_text(value: datetime) -> str:
    return value.astimezone(UTC).isoformat()


def _json_dumps(value: object) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"))
