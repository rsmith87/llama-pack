from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class GraphFileRecord(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str | None = None
    path: str = Field(min_length=1)
    language: str = Field(min_length=1)
    content_hash: str = Field(min_length=1)
    size_bytes: int = Field(ge=0)
    mtime_ns: int = Field(ge=0)
    parse_status: str = Field(min_length=1)
    parse_error: str | None = None


class GraphSymbolRecord(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str | None = None
    file_id: str = Field(min_length=1)
    qualified_name: str = Field(min_length=1)
    name: str = Field(min_length=1)
    kind: str = Field(min_length=1)
    language: str = Field(min_length=1)
    start_line: int = Field(ge=1)
    end_line: int = Field(ge=1)
    signature: str | None = None
    doc_summary: str | None = None
    exported: bool = False
    confidence: float = Field(ge=0.0, le=1.0)


class GraphImportRecord(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str | None = None
    file_id: str = Field(min_length=1)
    module: str = Field(min_length=1)
    imported_name: str | None = None
    alias: str | None = None
    resolved_file_id: str | None = None
    confidence: float = Field(ge=0.0, le=1.0)


class GraphRelationRecord(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str | None = None
    source_symbol_id: str | None = None
    target_symbol_id: str | None = None
    source_file_id: str | None = None
    target_file_id: str | None = None
    relation_type: str = Field(min_length=1)
    start_line: int | None = Field(default=None, ge=1)
    end_line: int | None = Field(default=None, ge=1)
    confidence: float = Field(ge=0.0, le=1.0)
    evidence: dict[str, object] | None = None


class GraphIndexProgress(BaseModel):
    model_config = ConfigDict(extra="forbid")

    phase: str = Field(min_length=1)
    message: str = Field(min_length=1)
    percent: int = Field(ge=0, le=100)
    files_discovered: int = Field(default=0, ge=0)
    files_scanned: int = Field(default=0, ge=0)
    files_indexed: int = Field(default=0, ge=0)
    files_failed: int = Field(default=0, ge=0)
    symbols_indexed: int = Field(default=0, ge=0)
    relations_indexed: int = Field(default=0, ge=0)
    current_path: str | None = None
    warnings: list[str] = Field(default_factory=list)


class GraphIndexResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    project_id: str = Field(min_length=1)
    snapshot_id: str = Field(min_length=1)
    status: Literal["ready"]
    root_path: str = Field(min_length=1)
    node_name: str = Field(min_length=1)
    git_commit: str | None = None
    file_count: int = Field(ge=0)
    symbol_count: int = Field(ge=0)
    relation_count: int = Field(ge=0)
    failed_file_count: int = Field(ge=0)
    duration_ms: int = Field(ge=0)
    warnings: list[str] = Field(default_factory=list)


class ProjectGraphIndexPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    project_id: str = Field(min_length=1)
    node_name: str = Field(min_length=1)
    root_path: str = Field(min_length=1)
    include_globs: list[str] = Field(min_length=1)
    overview_files: list[str]
    exclude_dirs: list[str]
    max_file_bytes: int = Field(ge=1)
    force: bool


class ParsedGraphFile(BaseModel):
    model_config = ConfigDict(extra="forbid")

    file: GraphFileRecord
    symbols: list[GraphSymbolRecord] = Field(default_factory=list)
    imports: list[GraphImportRecord] = Field(default_factory=list)
    relations: list[GraphRelationRecord] = Field(default_factory=list)
