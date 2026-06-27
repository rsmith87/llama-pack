from __future__ import annotations

import sys
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest

from llama_pack.core.plugins.events import EventEnvelope

PLUGIN_ROOT = Path(__file__).resolve().parents[1] / "plugins" / "llama_pack_workflows"
if str(PLUGIN_ROOT) not in sys.path:
    sys.path.insert(0, str(PLUGIN_ROOT))

from llama_pack_workflows.models import WorkflowDefinition, WorkflowDefinitionCreate, WorkflowSchedule, WorkflowTrigger
from llama_pack_workflows.schedules import schedule_is_due
from llama_pack_workflows.scheduler import WorkflowEventDispatcher, WorkflowScheduler
from llama_pack_workflows.store import WorkflowStore


class FakeRunner:
    def __init__(self) -> None:
        self.calls: list[tuple[str, str, str | None]] = []

    async def run_from_trigger(
        self,
        definition: WorkflowDefinition,
        trigger_type: str,
        trigger_detail: str,
        correlation_id: str | None,
    ):
        self.calls.append((definition.id, trigger_type, correlation_id))
        return None


def _scheduled_body() -> WorkflowDefinitionCreate:
    return WorkflowDefinitionCreate(
        name="Scheduled summary",
        description="Runs on an interval",
        template_id="thread_prompt_chain",
        enabled=True,
        parameters={
            "content": "hello",
            "steps": [{"label": "summarize", "instructions": "Summarize."}],
            "model": "qwen",
            "target": "auto",
        },
        triggers=[WorkflowTrigger(type="schedule", schedule=WorkflowSchedule(kind="interval_minutes", value="15"), event_type=None)],
    )


def test_daily_schedule_is_due_after_configured_time():
    schedule = WorkflowSchedule(kind="daily", value="09:30")
    now = datetime(2026, 6, 27, 9, 31, tzinfo=UTC)
    previous = datetime(2026, 6, 26, 9, 31, tzinfo=UTC)

    assert schedule_is_due(schedule, now, previous) is True


def test_interval_schedule_waits_until_interval_elapsed():
    schedule = WorkflowSchedule(kind="interval_minutes", value="15")
    now = datetime(2026, 6, 27, 10, 0, tzinfo=UTC)
    previous = now - timedelta(minutes=14)

    assert schedule_is_due(schedule, now, previous) is False


@pytest.mark.asyncio
async def test_scheduler_run_once_starts_due_workflow(tmp_path: Path):
    store = WorkflowStore(tmp_path / "workflows.db")
    store.migrate()
    definition = store.create_definition(_scheduled_body())
    runner = FakeRunner()
    scheduler = WorkflowScheduler(store, runner, 60)

    started = await scheduler.run_once(datetime(2026, 6, 27, 10, 0, tzinfo=UTC))

    assert started == [definition.id]
    assert runner.calls == [(definition.id, "schedule", None)]


@pytest.mark.asyncio
async def test_event_trigger_runs_matching_workflow(tmp_path: Path):
    store = WorkflowStore(tmp_path / "workflows.db")
    store.migrate()
    definition = store.create_definition(
        WorkflowDefinitionCreate(
            name="Chat completion follow-up",
            description="Runs after chat completes",
            template_id="thread_prompt_chain",
            enabled=True,
            parameters={
                "content": "hello",
                "steps": [{"label": "summarize", "instructions": "Summarize."}],
                "model": "qwen",
                "target": "auto",
            },
            triggers=[WorkflowTrigger(type="event", schedule=None, event_type="llama_pack.chat.completed")],
        )
    )
    runner = FakeRunner()
    dispatcher = WorkflowEventDispatcher(store, runner)
    event = EventEnvelope(type="llama_pack.chat.completed", correlation_id="corr-1", payload={"model": "qwen"})

    await dispatcher.handle(event)

    assert runner.calls == [(definition.id, "event", "corr-1")]
