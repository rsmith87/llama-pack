from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

WorkflowStatus = Literal["enabled", "disabled"]
WorkflowRunStatus = Literal["queued", "running", "completed", "failed", "cancelled"]
TriggerType = Literal["manual", "schedule", "event"]
ScheduleKind = Literal["daily", "interval_minutes"]


class TemplateParameter(BaseModel):
    model_config = ConfigDict(extra="ignore")

    name: str = Field(min_length=1)
    label: str = Field(min_length=1)
    type: Literal["string", "integer", "boolean", "string_list", "step_list"]
    required: bool
    description: str


class WorkflowTemplate(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    description: str
    category: Literal["operator", "ai"]
    parameters: list[TemplateParameter]


class WorkflowSchedule(BaseModel):
    model_config = ConfigDict(extra="ignore")

    kind: ScheduleKind
    value: str = Field(min_length=1)


class WorkflowTrigger(BaseModel):
    model_config = ConfigDict(extra="ignore")

    type: TriggerType
    schedule: WorkflowSchedule | None
    event_type: str | None


class WorkflowDefinitionCreate(BaseModel):
    model_config = ConfigDict(extra="ignore")

    name: str = Field(min_length=1, max_length=120)
    description: str = Field(max_length=500)
    template_id: str = Field(min_length=1)
    enabled: bool
    parameters: dict[str, object]
    triggers: list[WorkflowTrigger]


class WorkflowDefinition(WorkflowDefinitionCreate):
    id: str
    created_at: datetime
    updated_at: datetime


class WorkflowRun(BaseModel):
    id: str
    workflow_id: str
    status: WorkflowRunStatus
    trigger_type: TriggerType
    trigger_detail: str
    error_detail: str | None
    correlation_id: str | None
    started_at: datetime | None
    finished_at: datetime | None
    created_at: datetime
