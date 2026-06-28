from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

from llama_pack.core.config.models import AGENT_TOOL_MAX_ITERATIONS_LIMIT


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
    "history_summary",
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


class ThreadTextContentBlock(BaseModel):
    type: Literal["text"]
    text: str


class ThreadImageUrl(BaseModel):
    url: str


class ThreadImageContentBlock(BaseModel):
    type: Literal["image_url"]
    image_url: ThreadImageUrl


ThreadMessageContent = str | list[ThreadTextContentBlock | ThreadImageContentBlock]


class ThreadMessageRequest(BaseModel):
    role: Literal["user"] = "user"
    content: ThreadMessageContent
    model: str | None = None
    model_family: str | None = None
    context_profile: str | None = None
    target: str = "auto"
    metadata: ThreadMetadata | None = None
    temperature: float | None = Field(default=None, ge=0.0, le=2.0)
    max_tokens: int | None = Field(default=None, ge=1, le=32768)
    top_p: float | None = Field(default=None, ge=0.0, le=1.0)
    top_k: int | None = Field(default=None, ge=0)
    min_p: float | None = Field(default=None, ge=0.0, le=1.0)
    repeat_penalty: float | None = Field(default=None, ge=0.0)
    seed: int | None = None
    stop: str | list[str] | None = None
    json_schema: dict[str, object] | None = None
    grammar: str | None = None
    reasoning: bool = False
    cache_prompt: bool | None = None
    slot_id: int | None = None
    tool_runtime: Literal["agent"] | None = None
    tool_choice: dict[str, Any] | str | None = None
    project_id: str | None = None
    document_collection_ids: list[str] | None = Field(default=None, min_length=1, max_length=20)
    agent_tool_max_iterations: int | None = Field(default=None, ge=1, le=AGENT_TOOL_MAX_ITERATIONS_LIMIT)

    def generation_payload(self) -> dict[str, object]:
        payload: dict[str, object] = {}
        for key in (
            "temperature",
            "max_tokens",
            "top_p",
            "top_k",
            "min_p",
            "repeat_penalty",
            "seed",
            "stop",
            "json_schema",
            "grammar",
            "reasoning",
            "cache_prompt",
            "slot_id",
            "tool_runtime",
            "tool_choice",
            "project_id",
            "agent_tool_max_iterations",
        ):
            value = getattr(self, key)
            if value is not None:
                payload[key] = value
        return payload


class CompactThreadRequest(BaseModel):
    model: str | None = None
    model_family: str | None = None
    context_profile: str | None = None
    target: str = "auto"
    recent_message_count: int | None = Field(default=None, ge=1, le=100)


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
