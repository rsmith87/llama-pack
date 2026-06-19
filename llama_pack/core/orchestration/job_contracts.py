from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import re
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from llama_pack.core.code_graph.models import (
    DEFAULT_PROJECT_GRAPH_MAX_FILE_BYTES,
    default_project_graph_exclude_dirs,
    default_project_graph_include_globs,
    default_project_graph_overview_files,
)


REPO_ID_PATTERN = re.compile(r"^[A-Za-z0-9._-]+/[A-Za-z0-9._-]+$")


class ChatMessage(BaseModel):
    role: str
    content: str | list[dict[str, object]]


class JobRequirements(BaseModel):
    labels: dict[str, Any] = Field(default_factory=dict)
    capacity: dict[str, Any] = Field(default_factory=dict)


class LlmGenerateJobPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    model: str = Field(min_length=1)
    messages: list[ChatMessage] = Field(min_length=1)
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    max_tokens: int = Field(default=512, ge=1, le=32768)
    n_predict: int | None = Field(default=None, ge=1, le=32768)
    top_p: float | None = Field(default=None, ge=0.0, le=1.0)
    top_k: int | None = Field(default=None, ge=0)
    min_p: float | None = Field(default=None, ge=0.0, le=1.0)
    repeat_penalty: float | None = Field(default=None, ge=0.0)
    seed: int | None = None
    stop: str | list[str] | None = None
    json_schema: dict[str, object] | None = None
    grammar: str | None = None
    reasoning: bool = False
    target: str = "auto"
    cache_prompt: bool | None = None
    slot_id: int | None = None
    project_id: str | None = None
    requirements: JobRequirements | None = None

    @model_validator(mode="after")
    def normalize_fields(self) -> "LlmGenerateJobPayload":
        if self.n_predict is not None:
            self.max_tokens = self.n_predict
        if isinstance(self.stop, str):
            tokens = [item.strip() for item in self.stop.split(",") if item.strip()]
            if not tokens:
                self.stop = None
            elif len(tokens) == 1:
                self.stop = tokens[0]
            else:
                self.stop = tokens
        elif isinstance(self.stop, list):
            tokens = [item.strip() for item in self.stop if isinstance(item, str) and item.strip()]
            self.stop = tokens or None
        if isinstance(self.grammar, str):
            normalized_grammar = self.grammar.strip()
            self.grammar = normalized_grammar or None
        if self.json_schema is not None and self.grammar is not None:
            raise ValueError("json_schema and grammar are mutually exclusive")
        return self


class ModelTransferJobPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    source_node: str = Field(min_length=1)
    destination_node: str = Field(min_length=1)
    source_file_id: str = Field(min_length=1)
    include: Literal["selected_with_sidecars"] = "selected_with_sidecars"
    source_url: str | None = None
    transfer_token: str | None = None

    @model_validator(mode="after")
    def validate_nodes(self) -> "ModelTransferJobPayload":
        if self.source_node == self.destination_node:
            raise ValueError("source_node and destination_node must differ")
        return self


class ModelDownloadJobPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    repo_id: str = Field(min_length=1)
    revision: str | None = None
    include_file: str | None = None
    mmproj_file: str | None = None
    requirements: JobRequirements | None = None

    @field_validator("repo_id")
    @classmethod
    def validate_repo_id(cls, value: str) -> str:
        normalized = value.strip()
        if not REPO_ID_PATTERN.match(normalized):
            raise ValueError("repo_id must be in owner/name format")
        return normalized

    @field_validator("revision")
    @classmethod
    def normalize_revision(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None

    @field_validator("include_file", "mmproj_file")
    @classmethod
    def validate_include_file(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        if (
            not normalized
            or normalized.startswith("/")
            or "\\" in normalized
            or ".." in Path(normalized).parts
            or not normalized.lower().endswith(".gguf")
        ):
            raise ValueError("include_file must be a relative .gguf path")
        return normalized


class ModelInstallJobPayload(ModelDownloadJobPayload):
    model_name: str = Field(min_length=1)
    port: int = Field(ge=1024, le=65535)
    ctx: int = Field(default=4096, ge=512)
    gpu_layers: int = Field(default=0, ge=0)
    host: str = "127.0.0.1"
    reasoning: Literal["on", "off", "auto"] | None = None
    reasoning_budget: int | None = None
    prompt_template: str | None = None
    vision: bool = False
    supports_mtp: bool = False
    draft_model_path: str | None = None
    start: bool = True

    @field_validator("model_name", "host", "prompt_template", "draft_model_path")
    @classmethod
    def normalize_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None


class LlmEmbedJobPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    model: str = Field(min_length=1)
    input: str | list[str]
    target: str = "auto"
    requirements: JobRequirements | None = None


class LlmBatchCase(BaseModel):
    model_config = ConfigDict(extra="forbid")

    messages: list[ChatMessage] = Field(min_length=1)
    id: str | None = None
    model: str | None = None
    target: str | None = None
    temperature: float | None = Field(default=None, ge=0.0, le=2.0)
    max_tokens: int | None = Field(default=None, ge=1, le=32768)


class LlmBatchJobPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    model: str = Field(min_length=1)
    cases: list[LlmBatchCase] = Field(min_length=1, max_length=200)
    target: str = "auto"
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    max_tokens: int = Field(default=512, ge=1, le=32768)
    requirements: JobRequirements | None = None


class ProjectGraphIndexJobPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    project_id: str = Field(min_length=1)
    node_name: str = Field(min_length=1)
    root_path: str = Field(min_length=1)
    include_globs: list[str] = Field(default_factory=default_project_graph_include_globs)
    overview_files: list[str] = Field(default_factory=default_project_graph_overview_files)
    exclude_dirs: list[str] = Field(default_factory=default_project_graph_exclude_dirs)
    max_file_bytes: int = Field(default=DEFAULT_PROJECT_GRAPH_MAX_FILE_BYTES, ge=1)
    force: bool = False
    requirements: JobRequirements = Field(default_factory=lambda: JobRequirements(capacity={"project_graph_index": True}))

    @field_validator("include_globs", "overview_files", "exclude_dirs")
    @classmethod
    def validate_relative_items(cls, value: list[str]) -> list[str]:
        for item in value:
            normalized = item.strip()
            if not normalized or normalized.startswith("/") or "\\" in normalized:
                raise ValueError("graph index path patterns must be non-empty relative POSIX strings")
        return value


@dataclass
class ResolvedBatchCase:
    case_id: str
    model: str
    target: str
    chat_payload: dict[str, Any]


def validate_job_payload(job_type: str, payload: dict[str, Any]) -> dict[str, Any]:
    if job_type == "llm.generate":
        return LlmGenerateJobPayload.model_validate(payload).model_dump(mode="json", exclude_none=True)
    if job_type == "model.transfer":
        return ModelTransferJobPayload.model_validate(payload).model_dump(mode="json", exclude_none=True)
    if job_type == "model.download":
        return ModelDownloadJobPayload.model_validate(payload).model_dump(mode="json", exclude_none=True)
    if job_type == "model.install":
        return ModelInstallJobPayload.model_validate(payload).model_dump(mode="json", exclude_none=True)
    if job_type == "llm.embed":
        return LlmEmbedJobPayload.model_validate(payload).model_dump(mode="json", exclude_none=True)
    if job_type == "llm.batch":
        return LlmBatchJobPayload.model_validate(payload).model_dump(mode="json", exclude_none=True)
    if job_type == "project.graph.index":
        return ProjectGraphIndexJobPayload.model_validate(payload).model_dump(mode="json", exclude_none=True)
    return payload


def chat_payload_from_llm_generate(payload: dict[str, Any]) -> tuple[str, dict[str, Any]]:
    parsed = LlmGenerateJobPayload.model_validate(payload)
    data = parsed.model_dump(mode="json", exclude_none=True)
    model = data.pop("model")
    data.pop("requirements", None)
    return model, data


def embed_payload_from_llm_embed(payload: dict[str, Any]) -> tuple[str, list[str], str]:
    parsed = LlmEmbedJobPayload.model_validate(payload)
    model = parsed.model
    target = parsed.target
    inputs = parsed.input if isinstance(parsed.input, list) else [parsed.input]
    normalized = [item for item in inputs if isinstance(item, str) and item.strip()]
    if not normalized:
        raise ValueError("input must include at least one non-empty string")
    return model, normalized, target


def download_payload_from_model_download(payload: dict[str, Any]) -> dict[str, Any]:
    parsed = ModelDownloadJobPayload.model_validate(payload)
    data = parsed.model_dump(mode="json", exclude_none=True)
    data.pop("requirements", None)
    return data


def install_payload_from_model_install(payload: dict[str, Any]) -> dict[str, Any]:
    parsed = ModelInstallJobPayload.model_validate(payload)
    data = parsed.model_dump(mode="json", exclude_none=True)
    data.pop("requirements", None)
    return data


def batch_cases_from_llm_batch(payload: dict[str, Any]) -> list[ResolvedBatchCase]:
    parsed = LlmBatchJobPayload.model_validate(payload)
    resolved: list[ResolvedBatchCase] = []
    for i, case in enumerate(parsed.cases):
        case_id = case.id or f"case-{i + 1}"
        model = case.model or parsed.model
        target = case.target or parsed.target
        temperature = case.temperature if case.temperature is not None else parsed.temperature
        max_tokens = case.max_tokens if case.max_tokens is not None else parsed.max_tokens
        msgs = [m.model_dump(mode="json") for m in case.messages]
        resolved.append(
            ResolvedBatchCase(
                case_id=case_id,
                model=model,
                target=target,
                chat_payload={"messages": msgs, "temperature": temperature, "max_tokens": max_tokens},
            )
        )
    return resolved
