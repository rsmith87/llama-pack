from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


Priority = Literal["high", "medium", "low"]
RequestType = Literal["coding", "general", "research"]
ThreadEventType = Literal[
    "user_message",
    "assistant_message",
    "routing_decision",
    "agent_request",
    "agent_response",
    "aggregation",
    "workflow_step",
    "error",
]


class ThreadMetadata(BaseModel):
    app: str | None = None
    purpose: str | None = None
    priority: Priority = "medium"
    request_type: RequestType = "general"


class CreateThreadRequest(BaseModel):
    title: str | None = None
    default_model: str | None = None
    metadata: ThreadMetadata = Field(default_factory=ThreadMetadata)


class ThreadMessageRequest(BaseModel):
    role: Literal["user"] = "user"
    content: str
    model: str | None = None
    model_family: str | None = None
    context_profile: str | None = None
    target: str = "auto"
    metadata: ThreadMetadata | None = None


class WorkflowStep(BaseModel):
    label: str
    instructions: str
    model: str | None = None
    target: str = "auto"


class WorkflowRunRequest(BaseModel):
    content: str
    steps: list[WorkflowStep] = Field(min_length=1)
    model: str | None = None
    target: str = "auto"
    metadata: ThreadMetadata | None = None


class ThreadRecord(BaseModel):
    id: str
    title: str | None
    default_model: str | None
    metadata: dict[str, Any]
    created_by: str | None
    created_at: datetime
    updated_at: datetime


class ThreadEventRecord(BaseModel):
    id: str
    thread_id: str
    event_type: ThreadEventType
    role: str | None
    content: dict[str, Any]
    public: bool
    turn_id: str | None = None
    route: dict[str, Any] | None = None
    agent_node: str | None = None
    model: str | None = None
    error_code: str | None = None
    error_detail: str | None = None
    created_at: datetime
