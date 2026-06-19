from __future__ import annotations

import hashlib
import json
from pathlib import Path
import subprocess

from pydantic import BaseModel, ConfigDict, Field, ValidationError

from llama_pack.core.code_graph.models import GraphFileRecord, GraphImportRecord, GraphRelationRecord, GraphSymbolRecord


class ParsedTypeScriptFile(BaseModel):
    model_config = ConfigDict(extra="forbid")

    file: GraphFileRecord
    symbols: list[GraphSymbolRecord] = Field(default_factory=list)
    imports: list[GraphImportRecord] = Field(default_factory=list)
    relations: list[GraphRelationRecord] = Field(default_factory=list)


class ParsedTypeScriptProject(BaseModel):
    model_config = ConfigDict(extra="forbid")

    files: list[ParsedTypeScriptFile] = Field(default_factory=list)


class _RawTypeScriptFile(BaseModel):
    model_config = ConfigDict(extra="forbid")

    path: str
    file_id: str
    symbols: list[GraphSymbolRecord] = Field(default_factory=list)
    imports: list[GraphImportRecord] = Field(default_factory=list)
    relations: list[GraphRelationRecord] = Field(default_factory=list)
    parse_error: str | None = None


class _RawTypeScriptProject(BaseModel):
    model_config = ConfigDict(extra="forbid")

    files: list[_RawTypeScriptFile]


class TypeScriptParserError(RuntimeError):
    pass


def parse_typescript_files(root: Path, files: list[Path]) -> ParsedTypeScriptProject:
    script_path = Path(__file__).resolve().parents[3] / "scripts" / "code_graph_ts_parser.mjs"
    command = ["node", str(script_path), "--root", str(root)]
    for file_path in files:
        command.extend(["--file", str(file_path)])
    completed = subprocess.run(command, capture_output=True, text=True, check=False)
    if completed.returncode != 0:
        raise TypeScriptParserError(f"TypeScript parser failed with exit code {completed.returncode}: {completed.stderr.strip()}")
    try:
        raw_payload = json.loads(completed.stdout)
        raw = _RawTypeScriptProject.model_validate(raw_payload)
    except (json.JSONDecodeError, ValidationError) as exc:
        raise TypeScriptParserError(f"TypeScript parser returned invalid JSON: {exc}") from exc
    parsed_files: list[ParsedTypeScriptFile] = []
    root_resolved = root.resolve()
    by_relative = {file_path.resolve().relative_to(root_resolved).as_posix(): file_path for file_path in files}
    for raw_file in raw.files:
        source_path = by_relative.get(raw_file.path)
        if source_path is None:
            raise TypeScriptParserError(f"TypeScript parser returned unexpected file path: {raw_file.path}")
        content = source_path.read_text(encoding="utf-8")
        stat = source_path.stat()
        file_record = GraphFileRecord(
            id=raw_file.file_id,
            path=raw_file.path,
            language="typescript",
            content_hash=hashlib.sha256(content.encode("utf-8")).hexdigest(),
            size_bytes=stat.st_size,
            mtime_ns=stat.st_mtime_ns,
            parse_status="failed" if raw_file.parse_error else "parsed",
            parse_error=raw_file.parse_error,
        )
        parsed_files.append(
            ParsedTypeScriptFile(
                file=file_record,
                symbols=raw_file.symbols,
                imports=raw_file.imports,
                relations=raw_file.relations,
            )
        )
    return ParsedTypeScriptProject(files=parsed_files)
