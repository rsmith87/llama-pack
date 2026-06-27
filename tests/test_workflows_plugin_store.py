from __future__ import annotations

import sys
from pathlib import Path

PLUGIN_ROOT = Path(__file__).resolve().parents[1] / "plugins" / "llama_pack_workflows"
if str(PLUGIN_ROOT) not in sys.path:
    sys.path.insert(0, str(PLUGIN_ROOT))

from llama_pack_workflows.models import WorkflowDefinitionCreate, WorkflowTrigger
from llama_pack_workflows.store import WorkflowStore


def _definition_body(name: str) -> WorkflowDefinitionCreate:
    return WorkflowDefinitionCreate(
        name=name,
        description="Store test workflow",
        template_id="thread_prompt_chain",
        enabled=True,
        parameters={"content": "hello", "steps": [], "model": "qwen", "target": "auto"},
        triggers=[WorkflowTrigger(type="manual", schedule=None, event_type=None)],
    )


def test_store_creates_and_lists_workflow_definitions(tmp_path: Path):
    store = WorkflowStore(tmp_path / "workflows.db")
    store.migrate()

    created = store.create_definition(_definition_body("Morning warmup"))
    rows = store.list_definitions()

    assert len(rows) == 1
    assert rows[0].id == created.id
    assert rows[0].name == "Morning warmup"


def test_store_updates_workflow_definition(tmp_path: Path):
    store = WorkflowStore(tmp_path / "workflows.db")
    store.migrate()
    created = store.create_definition(_definition_body("Morning warmup"))

    updated_body = WorkflowDefinitionCreate(
        name="Evening summary",
        description="Updated workflow",
        template_id="scheduled_benchmark",
        enabled=False,
        parameters={"benchmark_id": "bench-1", "models": ["qwen"]},
        triggers=[
            WorkflowTrigger(
                type="schedule",
                schedule={"kind": "interval_minutes", "value": "30"},
                event_type=None,
            )
        ],
    )
    updated = store.update_definition(created.id, updated_body)

    assert updated.id == created.id
    assert updated.name == "Evening summary"
    assert updated.description == "Updated workflow"
    assert updated.template_id == "scheduled_benchmark"
    assert updated.enabled is False
    assert updated.parameters == {"benchmark_id": "bench-1", "models": ["qwen"]}
    assert updated.triggers[0].type == "schedule"
    assert updated.triggers[0].schedule is not None
    assert updated.triggers[0].schedule.kind == "interval_minutes"
    assert updated.triggers[0].schedule.value == "30"
    assert updated.updated_at >= created.updated_at


def test_store_records_run_and_step_failure(tmp_path: Path):
    store = WorkflowStore(tmp_path / "workflows.db")
    store.migrate()
    definition = store.create_definition(_definition_body("Failure case"))

    run = store.create_run(definition.id, "manual", "api", None)
    store.mark_run_running(run.id)
    store.add_step(
        run.id,
        "generate",
        "failed",
        "seed",
        None,
        None,
        None,
        "model qwen unavailable",
    )
    store.mark_run_failed(run.id, "model qwen unavailable")
    loaded = store.get_run(run.id)
    steps = store.list_run_steps(run.id)

    assert loaded.status == "failed"
    assert loaded.error_detail == "model qwen unavailable"
    assert len(steps) == 1
    assert steps[0]["label"] == "generate"
    assert steps[0]["error_detail"] == "model qwen unavailable"
