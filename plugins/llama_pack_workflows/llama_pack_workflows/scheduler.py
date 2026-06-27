from __future__ import annotations

import asyncio
from datetime import UTC, datetime
from typing import Protocol

from llama_pack_workflows.models import TriggerType, WorkflowDefinition, WorkflowRun
from llama_pack_workflows.schedules import schedule_is_due
from llama_pack_workflows.store import WorkflowStore


class WorkflowTriggerRunner(Protocol):
    async def run_from_trigger(
        self,
        definition: WorkflowDefinition,
        trigger_type: TriggerType,
        trigger_detail: str,
        correlation_id: str | None,
    ) -> WorkflowRun | None:
        raise NotImplementedError


class WorkflowScheduler:
    def __init__(self, store: WorkflowStore, runner: WorkflowTriggerRunner, interval_seconds: int) -> None:
        self.store = store
        self.runner = runner
        self.interval_seconds = interval_seconds
        self._stop_event = asyncio.Event()
        self._task: asyncio.Task[None] | None = None

    def start(self) -> None:
        if self._task is not None and not self._task.done():
            return
        self._stop_event = asyncio.Event()
        self._task = asyncio.create_task(self._loop())

    async def stop(self) -> None:
        self._stop_event.set()
        if self._task is not None:
            await self._task
            self._task = None

    async def run_once(self, now: datetime) -> list[str]:
        started: list[str] = []
        for definition in self.store.list_enabled_definitions():
            if await self._run_definition_if_due(definition, now):
                started.append(definition.id)
        return started

    async def _run_definition_if_due(self, definition: WorkflowDefinition, now: datetime) -> bool:
        for trigger in definition.triggers:
            if trigger.type != "schedule" or trigger.schedule is None:
                continue
            latest = self.store.latest_run_for_workflow(definition.id, "schedule")
            previous = latest.created_at if latest is not None else None
            if schedule_is_due(trigger.schedule, now, previous):
                await self.runner.run_from_trigger(definition, "schedule", trigger.schedule.model_dump_json(), None)
                return True
        return False

    async def _loop(self) -> None:
        while not self._stop_event.is_set():
            await self.run_once(datetime.now(UTC))
            try:
                await asyncio.wait_for(self._stop_event.wait(), timeout=self.interval_seconds)
            except TimeoutError:
                continue


class WorkflowEventDispatcher:
    def __init__(self, store: WorkflowStore, runner: WorkflowTriggerRunner) -> None:
        self.store = store
        self.runner = runner

    async def handle(self, event) -> None:
        for definition in self.store.list_enabled_definitions():
            for trigger in definition.triggers:
                if trigger.type == "event" and trigger.event_type == event.type:
                    await self.runner.run_from_trigger(definition, "event", event.type, event.correlation_id or event.id)
