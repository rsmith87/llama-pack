from __future__ import annotations

from collections.abc import Callable
from pathlib import Path
from time import monotonic

from llama_pack.core.code_graph.models import (
    GraphFileRecord,
    GraphIndexProgress,
    GraphIndexResult,
    GraphImportRecord,
    GraphRelationRecord,
    GraphSymbolRecord,
    ParsedGraphFile,
    ProjectGraphIndexPayload,
)
from llama_pack.core.code_graph.python_parser import parse_python_file
from llama_pack.core.code_graph.typescript_parser import ParsedTypeScriptFile, parse_typescript_files
from llama_pack.core.persistence.project_graph_store_orm import ProjectGraphStoreOrm


ProgressCallback = Callable[[GraphIndexProgress], None]
CancelCallback = Callable[[], bool]


class ProjectGraphIndexCanceled(RuntimeError):
    pass


class ProjectGraphIndexer:
    def __init__(self, graph_store: ProjectGraphStoreOrm) -> None:
        self.graph_store = graph_store

    def index(
        self,
        payload: ProjectGraphIndexPayload,
        progress: ProgressCallback,
        is_cancel_requested: CancelCallback,
    ) -> GraphIndexResult:
        started = monotonic()
        root = Path(payload.root_path).resolve()
        self._check_cancel(is_cancel_requested)
        if not root.exists() or not root.is_dir():
            raise FileNotFoundError(f"Project graph root does not exist or is not a directory: {root}")
        progress(
            _progress(
                "validating_root",
                "Validated project graph root",
                2,
                files_discovered=0,
                files_scanned=0,
                files_indexed=0,
                files_failed=0,
                symbols_indexed=0,
                relations_indexed=0,
                current_path=None,
            )
        )
        self._check_cancel(is_cancel_requested)
        files = self._discover_files(root, payload)
        progress(
            _progress(
                "discovering_files",
                "Discovered project graph files",
                10,
                files_discovered=len(files),
                files_scanned=0,
                files_indexed=0,
                files_failed=0,
                symbols_indexed=0,
                relations_indexed=0,
                current_path=None,
            )
        )
        self._check_cancel(is_cancel_requested)
        parsed_python: list[ParsedGraphFile] = []
        parsed_ts: list[ParsedTypeScriptFile] = []
        python_files = [file_path for file_path in files if file_path.suffix == ".py"]
        ts_files = [file_path for file_path in files if file_path.suffix in {".ts", ".tsx"}]
        for index, file_path in enumerate(python_files, start=1):
            self._check_cancel(is_cancel_requested)
            parsed_python.append(parse_python_file(file_path, root=root))
            progress(
                _progress(
                    "parsing_python",
                    "Parsing Python files",
                    _percent(index, len(python_files), 10, 35),
                    files_discovered=len(files),
                    files_scanned=index,
                    files_indexed=index,
                    files_failed=0,
                    symbols_indexed=sum(len(parsed.symbols) for parsed in parsed_python),
                    relations_indexed=sum(len(parsed.relations) for parsed in parsed_python),
                    current_path=file_path.relative_to(root).as_posix(),
                )
            )
        self._check_cancel(is_cancel_requested)
        if ts_files:
            ts_project = parse_typescript_files(root=root, files=ts_files)
            parsed_ts = ts_project.files
        progress(
            _progress(
                "parsing_typescript",
                "Parsed TypeScript/React files",
                60,
                files_discovered=len(files),
                files_scanned=len(python_files) + len(ts_files),
                files_indexed=len(parsed_python) + len(parsed_ts),
                files_failed=sum(1 for parsed in parsed_ts if parsed.file.parse_status == "failed"),
                symbols_indexed=sum(len(parsed.symbols) for parsed in [*parsed_python, *parsed_ts]),
                relations_indexed=sum(len(parsed.relations) for parsed in [*parsed_python, *parsed_ts]),
                current_path=None,
            )
        )
        self._check_cancel(is_cancel_requested)
        graph = self._flatten(parsed_python, parsed_ts)
        progress(
            _progress(
                "resolving_relations",
                "Resolved graph relations",
                75,
                files_discovered=len(files),
                files_scanned=len(files),
                files_indexed=len(graph.files),
                files_failed=sum(1 for record in graph.files if record.parse_status == "failed"),
                symbols_indexed=len(graph.symbols),
                relations_indexed=len(graph.relations),
                current_path=None,
            )
        )
        self._check_cancel(is_cancel_requested)
        snapshot = self.graph_store.create_snapshot(
            project_id=payload.project_id,
            node_name=payload.node_name,
            root_path=str(root),
            git_commit=None,
        )
        progress(
            _progress(
                "writing_snapshot",
                "Writing graph snapshot",
                85,
                files_discovered=len(files),
                files_scanned=len(files),
                files_indexed=len(graph.files),
                files_failed=sum(1 for record in graph.files if record.parse_status == "failed"),
                symbols_indexed=len(graph.symbols),
                relations_indexed=len(graph.relations),
                current_path=None,
            )
        )
        try:
            self.graph_store.replace_snapshot_graph(
                snapshot_id=str(snapshot["id"]),
                files=[record.model_dump() for record in graph.files],
                symbols=[record.model_dump() for record in graph.symbols],
                imports=[record.model_dump() for record in graph.imports],
                relations=[record.model_dump() for record in graph.relations],
            )
            self._check_cancel(is_cancel_requested)
            progress(
                _progress(
                    "activating_snapshot",
                    "Activating graph snapshot",
                    95,
                    files_discovered=len(files),
                    files_scanned=len(files),
                    files_indexed=len(graph.files),
                    files_failed=sum(1 for record in graph.files if record.parse_status == "failed"),
                    symbols_indexed=len(graph.symbols),
                    relations_indexed=len(graph.relations),
                    current_path=None,
                )
            )
            active = self.graph_store.activate_snapshot(str(snapshot["id"]))
        except Exception as exc:
            self.graph_store.fail_snapshot(str(snapshot["id"]), str(exc))
            raise
        duration_ms = int((monotonic() - started) * 1000)
        result = GraphIndexResult(
            project_id=payload.project_id,
            snapshot_id=str(active["id"]),
            status="ready",
            root_path=str(active["root_path"]),
            node_name=str(active["node_name"]),
            git_commit=active.get("git_commit") if isinstance(active.get("git_commit"), str) else None,
            file_count=int(active["file_count"]),
            symbol_count=int(active["symbol_count"]),
            relation_count=int(active["relation_count"]),
            failed_file_count=sum(1 for record in graph.files if record.parse_status == "failed"),
            duration_ms=duration_ms,
            warnings=[],
        )
        progress(
            _progress(
                "completed",
                "Project graph index completed",
                100,
                files_discovered=len(files),
                files_scanned=len(files),
                files_indexed=result.file_count,
                files_failed=result.failed_file_count,
                symbols_indexed=result.symbol_count,
                relations_indexed=result.relation_count,
                current_path=None,
            )
        )
        return result

    def _discover_files(self, root: Path, payload: ProjectGraphIndexPayload) -> list[Path]:
        discovered: dict[str, Path] = {}
        excluded = set(payload.exclude_dirs)
        for pattern in payload.include_globs:
            for file_path in root.glob(pattern):
                if not file_path.is_file():
                    continue
                relative = file_path.relative_to(root)
                if any(part in excluded for part in relative.parts):
                    continue
                if file_path.stat().st_size > payload.max_file_bytes:
                    continue
                discovered[relative.as_posix()] = file_path
        return [discovered[key] for key in sorted(discovered)]

    def _flatten(self, python_files: list[ParsedGraphFile], ts_files: list[ParsedTypeScriptFile]) -> "_GraphRecords":
        files: list[GraphFileRecord] = []
        symbols: list[GraphSymbolRecord] = []
        imports: list[GraphImportRecord] = []
        relations: list[GraphRelationRecord] = []
        for parsed in [*python_files, *ts_files]:
            files.append(parsed.file)
            symbols.extend(parsed.symbols)
            imports.extend(parsed.imports)
            relations.extend(parsed.relations)
        return _GraphRecords(files=files, symbols=symbols, imports=imports, relations=relations)

    def _check_cancel(self, is_cancel_requested: CancelCallback) -> None:
        if is_cancel_requested():
            raise ProjectGraphIndexCanceled("Project graph indexing was canceled")

    def export_snapshot_graph(self, snapshot_id: str) -> dict[str, object]:
        return self.graph_store.export_snapshot_graph(snapshot_id)


class _GraphRecords:
    def __init__(
        self,
        files: list[GraphFileRecord],
        symbols: list[GraphSymbolRecord],
        imports: list[GraphImportRecord],
        relations: list[GraphRelationRecord],
    ) -> None:
        self.files = files
        self.symbols = symbols
        self.imports = imports
        self.relations = relations


def _progress(
    phase: str,
    message: str,
    percent: int,
    files_discovered: int,
    files_scanned: int,
    files_indexed: int,
    files_failed: int,
    symbols_indexed: int,
    relations_indexed: int,
    current_path: str | None,
) -> GraphIndexProgress:
    return GraphIndexProgress(
        phase=phase,
        message=message,
        percent=percent,
        files_discovered=files_discovered,
        files_scanned=files_scanned,
        files_indexed=files_indexed,
        files_failed=files_failed,
        symbols_indexed=symbols_indexed,
        relations_indexed=relations_indexed,
        current_path=current_path,
        warnings=[],
    )


def _percent(index: int, total: int, start: int, end: int) -> int:
    if total <= 0:
        return end
    return start + int(((end - start) * index) / total)
