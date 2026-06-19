from __future__ import annotations

from datetime import UTC, datetime
import hashlib
import json
import uuid
from typing import Any

from sqlalchemy import delete, select, update
from sqlalchemy.orm import Session

from llama_pack.core.code_graph.models import GraphFileRecord, GraphImportRecord, GraphRelationRecord, GraphSymbolRecord
from llama_pack.core.persistence.db_infra import create_persistence_engine, create_session_factory, require_sqlite_tables, session_scope, sqlite_path_from_url
from llama_pack.core.persistence.models.projects import (
    ProjectContextArtifactOrm,
    ProjectGraphFileOrm,
    ProjectGraphImportOrm,
    ProjectGraphRelationOrm,
    ProjectGraphSnapshotOrm,
    ProjectGraphSymbolOrm,
    ProjectOrm,
)


GRAPH_TABLES = {
    "projects",
    "project_node_roots",
    "project_context_artifacts",
    "project_graph_snapshots",
    "project_graph_files",
    "project_graph_symbols",
    "project_graph_imports",
    "project_graph_relations",
    "alembic_version",
}


class ProjectGraphStoreOrm:
    def __init__(self, db_url: str) -> None:
        sqlite_path = sqlite_path_from_url(db_url)
        if sqlite_path is not None:
            sqlite_path.parent.mkdir(parents=True, exist_ok=True)
            require_sqlite_tables(db_path=sqlite_path, required_tables=GRAPH_TABLES, target_name="projects")
        self.engine = create_persistence_engine(db_url)
        self.session_factory = create_session_factory(self.engine)

    def create_snapshot(self, project_id: str, node_name: str, root_path: str, git_commit: str | None) -> dict[str, object]:
        now = self._now()
        snapshot = ProjectGraphSnapshotOrm(
            id=str(uuid.uuid4()),
            project_id=project_id,
            node_name=node_name,
            root_path=root_path,
            git_commit=git_commit,
            status="running",
            started_at=now,
            finished_at=None,
            error_detail=None,
            file_count=0,
            symbol_count=0,
            relation_count=0,
            active=0,
            created_at=now,
        )
        with session_scope(self.session_factory) as session:
            if self._ensure_local_project(session, project_id=project_id, root_path=root_path, now=now):
                session.flush()
            session.add(snapshot)
        loaded = self.get_snapshot(snapshot.id)
        if loaded is None:
            raise RuntimeError(f"Created graph snapshot {snapshot.id} could not be loaded")
        return loaded

    def _ensure_local_project(self, session: Session, project_id: str, root_path: str, now: str) -> bool:
        if session.get(ProjectOrm, project_id) is not None:
            return False
        session.add(
            ProjectOrm(
                id=project_id,
                name=project_id,
                root_hint=root_path,
                created_at=now,
                updated_at=now,
                archived=0,
            )
        )
        return True

    def get_snapshot(self, snapshot_id: str) -> dict[str, object] | None:
        with session_scope(self.session_factory) as session:
            row = session.get(ProjectGraphSnapshotOrm, snapshot_id)
            return self._snapshot_payload(row) if row is not None else None

    def replace_snapshot_graph(
        self,
        snapshot_id: str,
        files: list[dict[str, object]],
        symbols: list[dict[str, object]],
        imports: list[dict[str, object]],
        relations: list[dict[str, object]],
    ) -> None:
        indexed_at = self._now()
        file_records = [GraphFileRecord.model_validate(record) for record in files]
        symbol_records = [GraphSymbolRecord.model_validate(record) for record in symbols]
        import_records = [GraphImportRecord.model_validate(record) for record in imports]
        relation_records = [GraphRelationRecord.model_validate(record) for record in relations]
        with session_scope(self.session_factory) as session:
            snapshot = session.get(ProjectGraphSnapshotOrm, snapshot_id)
            if snapshot is None:
                raise KeyError(f"Project graph snapshot not found: {snapshot_id}")
            old_snapshot_ids = [
                row
                for row in session.execute(
                    select(ProjectGraphSnapshotOrm.id).where(
                        ProjectGraphSnapshotOrm.project_id == snapshot.project_id,
                        ProjectGraphSnapshotOrm.id != snapshot_id,
                    )
                ).scalars()
            ]
            self._delete_snapshot_graphs(session, [snapshot_id], delete_snapshots=False)
            self._delete_snapshot_graphs(session, old_snapshot_ids, delete_snapshots=True)
            self._insert_snapshot_graph(
                session,
                snapshot=snapshot,
                indexed_at=indexed_at,
                file_records=file_records,
                symbol_records=symbol_records,
                import_records=import_records,
                relation_records=relation_records,
            )

    def export_snapshot_graph(self, snapshot_id: str) -> dict[str, object]:
        snapshot = self.get_snapshot(snapshot_id)
        if snapshot is None:
            raise KeyError(f"Project graph snapshot not found: {snapshot_id}")
        with session_scope(self.session_factory) as session:
            files = session.execute(
                select(ProjectGraphFileOrm).where(ProjectGraphFileOrm.snapshot_id == snapshot_id).order_by(ProjectGraphFileOrm.path.asc())
            ).scalars().all()
            symbols = session.execute(
                select(ProjectGraphSymbolOrm).where(ProjectGraphSymbolOrm.snapshot_id == snapshot_id).order_by(ProjectGraphSymbolOrm.qualified_name.asc())
            ).scalars().all()
            imports = session.execute(
                select(ProjectGraphImportOrm).where(ProjectGraphImportOrm.snapshot_id == snapshot_id).order_by(ProjectGraphImportOrm.module.asc())
            ).scalars().all()
            relations = session.execute(
                select(ProjectGraphRelationOrm).where(ProjectGraphRelationOrm.snapshot_id == snapshot_id).order_by(ProjectGraphRelationOrm.id.asc())
            ).scalars().all()
            return {
                "snapshot": snapshot,
                "files": [self._file_record_payload(row) for row in files],
                "symbols": [self._symbol_record_payload(row) for row in symbols],
                "imports": [self._import_record_payload(row) for row in imports],
                "relations": [self._relation_payload(row) for row in relations],
            }

    def import_snapshot_graph(
        self,
        snapshot: dict[str, object],
        files: list[dict[str, object]],
        symbols: list[dict[str, object]],
        imports: list[dict[str, object]],
        relations: list[dict[str, object]],
    ) -> dict[str, object]:
        snapshot_id = str(snapshot["id"])
        project_id = str(snapshot["project_id"])
        node_name = str(snapshot["node_name"])
        root_path = str(snapshot["root_path"])
        git_commit = snapshot.get("git_commit") if isinstance(snapshot.get("git_commit"), str) else None
        now = self._now()
        indexed_at = now
        file_records = [GraphFileRecord.model_validate(record) for record in files]
        symbol_records = [GraphSymbolRecord.model_validate(record) for record in symbols]
        import_records = [GraphImportRecord.model_validate(record) for record in imports]
        relation_records = [GraphRelationRecord.model_validate(record) for record in relations]
        with session_scope(self.session_factory) as session:
            if self._ensure_local_project(session, project_id=project_id, root_path=root_path, now=now):
                session.flush()
            old_snapshot_ids = [
                row
                for row in session.execute(
                    select(ProjectGraphSnapshotOrm.id).where(ProjectGraphSnapshotOrm.project_id == project_id)
                ).scalars()
            ]
            self._delete_snapshot_graphs(session, old_snapshot_ids, delete_snapshots=True)
            imported = ProjectGraphSnapshotOrm(
                id=snapshot_id,
                project_id=project_id,
                node_name=node_name,
                root_path=root_path,
                git_commit=git_commit,
                status="ready",
                started_at=str(snapshot.get("started_at") or now),
                finished_at=str(snapshot.get("finished_at") or now),
                error_detail=None,
                file_count=0,
                symbol_count=0,
                relation_count=0,
                active=1,
                created_at=str(snapshot.get("created_at") or now),
            )
            session.add(imported)
            session.flush()
            self._insert_snapshot_graph(
                session,
                snapshot=imported,
                indexed_at=indexed_at,
                file_records=file_records,
                symbol_records=symbol_records,
                import_records=import_records,
                relation_records=relation_records,
            )
        loaded = self.get_snapshot(snapshot_id)
        if loaded is None:
            raise RuntimeError(f"Imported graph snapshot {snapshot_id} could not be loaded")
        return loaded

    def activate_snapshot(self, snapshot_id: str) -> dict[str, object]:
        now = self._now()
        with session_scope(self.session_factory) as session:
            snapshot = session.get(ProjectGraphSnapshotOrm, snapshot_id)
            if snapshot is None:
                raise KeyError(f"Project graph snapshot not found: {snapshot_id}")
            session.execute(
                update(ProjectGraphSnapshotOrm)
                .where(ProjectGraphSnapshotOrm.project_id == snapshot.project_id)
                .values(active=0)
            )
            snapshot.status = "ready"
            snapshot.finished_at = now
            snapshot.error_detail = None
            snapshot.active = 1
        loaded = self.get_snapshot(snapshot_id)
        if loaded is None:
            raise RuntimeError(f"Activated graph snapshot {snapshot_id} could not be loaded")
        return loaded

    def fail_snapshot(self, snapshot_id: str, error_detail: str) -> dict[str, object]:
        now = self._now()
        with session_scope(self.session_factory) as session:
            snapshot = session.get(ProjectGraphSnapshotOrm, snapshot_id)
            if snapshot is None:
                raise KeyError(f"Project graph snapshot not found: {snapshot_id}")
            snapshot.status = "failed"
            snapshot.finished_at = now
            snapshot.error_detail = error_detail
            snapshot.active = 0
        loaded = self.get_snapshot(snapshot_id)
        if loaded is None:
            raise RuntimeError(f"Failed graph snapshot {snapshot_id} could not be loaded")
        return loaded

    def get_active_snapshot(self, project_id: str) -> dict[str, object] | None:
        with session_scope(self.session_factory) as session:
            row = session.execute(
                select(ProjectGraphSnapshotOrm)
                .where(ProjectGraphSnapshotOrm.project_id == project_id, ProjectGraphSnapshotOrm.active == 1)
                .order_by(ProjectGraphSnapshotOrm.created_at.desc())
            ).scalar_one_or_none()
            return self._snapshot_payload(row) if row is not None else None

    def upsert_context_artifact(
        self,
        project_id: str,
        path: str,
        kind: str,
        title: str | None,
        content: str,
        metadata: dict[str, str | int | float | bool | None],
    ) -> dict[str, object]:
        now = self._now()
        content_bytes = content.encode("utf-8")
        content_hash = hashlib.sha256(content_bytes).hexdigest()
        metadata_json = json.dumps(metadata, sort_keys=True)
        with session_scope(self.session_factory) as session:
            existing = session.execute(
                select(ProjectContextArtifactOrm).where(
                    ProjectContextArtifactOrm.project_id == project_id,
                    ProjectContextArtifactOrm.path == path,
                    ProjectContextArtifactOrm.kind == kind,
                )
            ).scalar_one_or_none()
            if existing is None:
                existing = ProjectContextArtifactOrm(
                    id=str(uuid.uuid4()),
                    project_id=project_id,
                    path=path,
                    kind=kind,
                    title=title,
                    content_hash=content_hash,
                    size_bytes=len(content_bytes),
                    metadata_json=metadata_json,
                    created_at=now,
                    updated_at=now,
                )
                session.add(existing)
            else:
                existing.title = title
                existing.content_hash = content_hash
                existing.size_bytes = len(content_bytes)
                existing.metadata_json = metadata_json
                existing.updated_at = now
            artifact_id = existing.id
        loaded = self.get_context_artifact(artifact_id)
        if loaded is None:
            raise RuntimeError(f"Saved context artifact {artifact_id} could not be loaded")
        return loaded

    def get_context_artifact(self, artifact_id: str) -> dict[str, object] | None:
        with session_scope(self.session_factory) as session:
            row = session.get(ProjectContextArtifactOrm, artifact_id)
            return self._context_artifact_payload(row) if row is not None else None

    def list_context_artifacts(self, project_id: str) -> list[dict[str, object]]:
        with session_scope(self.session_factory) as session:
            rows = session.execute(
                select(ProjectContextArtifactOrm)
                .where(ProjectContextArtifactOrm.project_id == project_id)
                .order_by(ProjectContextArtifactOrm.updated_at.desc())
            ).scalars().all()
            return [self._context_artifact_payload(row) for row in rows]

    def status(self, project_id: str) -> dict[str, object]:
        active = self.get_active_snapshot(project_id)
        if active is None:
            return {"project_id": project_id, "status": "not_indexed", "snapshot_id": None}
        return {
            "project_id": project_id,
            "status": active["status"],
            "snapshot_id": active["id"],
            "file_count": active["file_count"],
            "symbol_count": active["symbol_count"],
            "relation_count": active["relation_count"],
            "root_path": active["root_path"],
            "node_name": active["node_name"],
            "git_commit": active["git_commit"],
            "error_detail": active["error_detail"],
        }

    def find_symbols(self, project_id: str, query: str, kind: str | None) -> list[dict[str, object]]:
        snapshot = self.get_active_snapshot(project_id)
        if snapshot is None:
            return []
        pattern = f"%{query}%"
        with session_scope(self.session_factory) as session:
            stmt = (
                select(ProjectGraphSymbolOrm, ProjectGraphFileOrm)
                .join(ProjectGraphFileOrm, ProjectGraphFileOrm.id == ProjectGraphSymbolOrm.file_id)
                .where(ProjectGraphSymbolOrm.snapshot_id == snapshot["id"])
                .where(ProjectGraphSymbolOrm.name.like(pattern) | ProjectGraphSymbolOrm.qualified_name.like(pattern))
                .order_by(ProjectGraphSymbolOrm.name.asc())
                .limit(50)
            )
            if kind is not None:
                stmt = stmt.where(ProjectGraphSymbolOrm.kind == kind)
            rows = session.execute(stmt).all()
            return [self._symbol_payload(symbol, file) for symbol, file in rows]

    def symbol_context(self, project_id: str, symbol_id: str) -> dict[str, object] | None:
        snapshot = self.get_active_snapshot(project_id)
        if snapshot is None:
            return None
        with session_scope(self.session_factory) as session:
            row = session.execute(
                select(ProjectGraphSymbolOrm, ProjectGraphFileOrm)
                .join(ProjectGraphFileOrm, ProjectGraphFileOrm.id == ProjectGraphSymbolOrm.file_id)
                .where(ProjectGraphSymbolOrm.snapshot_id == snapshot["id"], ProjectGraphSymbolOrm.id == symbol_id)
            ).one_or_none()
            if row is None:
                return None
            symbol, file = row
            return {"symbol": self._symbol_payload(symbol, file), "file": self._file_payload(file)}

    def relations(self, project_id: str, symbol_id: str, relation_type: str, direction: str, depth: int) -> list[dict[str, object]]:
        snapshot = self.get_active_snapshot(project_id)
        if snapshot is None:
            return []
        if depth != 1:
            raise ValueError("Project graph relation queries currently support depth=1")
        source_column = ProjectGraphRelationOrm.source_symbol_id if direction == "out" else ProjectGraphRelationOrm.target_symbol_id
        target_column = ProjectGraphRelationOrm.target_symbol_id if direction == "out" else ProjectGraphRelationOrm.source_symbol_id
        with session_scope(self.session_factory) as session:
            rows = session.execute(
                select(ProjectGraphRelationOrm, ProjectGraphSymbolOrm, ProjectGraphFileOrm)
                .join(ProjectGraphSymbolOrm, ProjectGraphSymbolOrm.id == target_column)
                .join(ProjectGraphFileOrm, ProjectGraphFileOrm.id == ProjectGraphSymbolOrm.file_id)
                .where(
                    ProjectGraphRelationOrm.snapshot_id == snapshot["id"],
                    source_column == symbol_id,
                    ProjectGraphRelationOrm.relation_type == relation_type,
                )
                .order_by(ProjectGraphSymbolOrm.qualified_name.asc())
            ).all()
            return [
                {
                    "relation": self._relation_payload(relation),
                    "target_symbol": self._symbol_payload(symbol, file),
                }
                for relation, symbol, file in rows
            ]

    def _delete_snapshot_graphs(self, session: Session, snapshot_ids: list[str], delete_snapshots: bool) -> None:
        if not snapshot_ids:
            return
        session.execute(delete(ProjectGraphRelationOrm).where(ProjectGraphRelationOrm.snapshot_id.in_(snapshot_ids)))
        session.execute(delete(ProjectGraphImportOrm).where(ProjectGraphImportOrm.snapshot_id.in_(snapshot_ids)))
        session.execute(delete(ProjectGraphSymbolOrm).where(ProjectGraphSymbolOrm.snapshot_id.in_(snapshot_ids)))
        session.execute(delete(ProjectGraphFileOrm).where(ProjectGraphFileOrm.snapshot_id.in_(snapshot_ids)))
        if delete_snapshots:
            session.execute(delete(ProjectGraphSnapshotOrm).where(ProjectGraphSnapshotOrm.id.in_(snapshot_ids)))

    def _insert_snapshot_graph(
        self,
        session: Session,
        snapshot: ProjectGraphSnapshotOrm,
        indexed_at: str,
        file_records: list[GraphFileRecord],
        symbol_records: list[GraphSymbolRecord],
        import_records: list[GraphImportRecord],
        relation_records: list[GraphRelationRecord],
    ) -> None:
        for record in file_records:
            session.add(
                ProjectGraphFileOrm(
                    id=record.id or str(uuid.uuid4()),
                    snapshot_id=snapshot.id,
                    path=record.path,
                    language=record.language,
                    content_hash=record.content_hash,
                    size_bytes=record.size_bytes,
                    mtime_ns=record.mtime_ns,
                    indexed_at=indexed_at,
                    parse_status=record.parse_status,
                    parse_error=record.parse_error,
                )
            )
        session.flush()
        for record in symbol_records:
            session.add(
                ProjectGraphSymbolOrm(
                    id=record.id or str(uuid.uuid4()),
                    snapshot_id=snapshot.id,
                    file_id=record.file_id,
                    qualified_name=record.qualified_name,
                    name=record.name,
                    kind=record.kind,
                    language=record.language,
                    start_line=record.start_line,
                    end_line=record.end_line,
                    signature=record.signature,
                    doc_summary=record.doc_summary,
                    exported=1 if record.exported else 0,
                    confidence=record.confidence,
                )
            )
        session.flush()
        for record in import_records:
            session.add(
                ProjectGraphImportOrm(
                    id=record.id or str(uuid.uuid4()),
                    snapshot_id=snapshot.id,
                    file_id=record.file_id,
                    module=record.module,
                    imported_name=record.imported_name,
                    alias=record.alias,
                    resolved_file_id=record.resolved_file_id,
                    confidence=record.confidence,
                )
            )
        session.flush()
        for record in relation_records:
            session.add(
                ProjectGraphRelationOrm(
                    id=record.id or str(uuid.uuid4()),
                    snapshot_id=snapshot.id,
                    source_symbol_id=record.source_symbol_id,
                    target_symbol_id=record.target_symbol_id,
                    source_file_id=record.source_file_id,
                    target_file_id=record.target_file_id,
                    relation_type=record.relation_type,
                    start_line=record.start_line,
                    end_line=record.end_line,
                    confidence=record.confidence,
                    evidence=json.dumps(record.evidence) if record.evidence is not None else None,
                )
            )
        snapshot.file_count = len(file_records)
        snapshot.symbol_count = len(symbol_records)
        snapshot.relation_count = len(relation_records)

    def close(self) -> None:
        self.engine.dispose()

    def _snapshot_payload(self, row: ProjectGraphSnapshotOrm) -> dict[str, object]:
        return {
            "id": row.id,
            "project_id": row.project_id,
            "node_name": row.node_name,
            "root_path": row.root_path,
            "git_commit": row.git_commit,
            "status": row.status,
            "started_at": row.started_at,
            "finished_at": row.finished_at,
            "error_detail": row.error_detail,
            "file_count": row.file_count,
            "symbol_count": row.symbol_count,
            "relation_count": row.relation_count,
            "active": bool(row.active),
            "created_at": row.created_at,
        }

    def _context_artifact_payload(self, row: ProjectContextArtifactOrm) -> dict[str, object]:
        return {
            "id": row.id,
            "project_id": row.project_id,
            "path": row.path,
            "kind": row.kind,
            "title": row.title,
            "content_hash": row.content_hash,
            "size_bytes": row.size_bytes,
            "metadata": json.loads(row.metadata_json),
            "created_at": row.created_at,
            "updated_at": row.updated_at,
        }

    def _file_payload(self, row: ProjectGraphFileOrm) -> dict[str, object]:
        return {
            "id": row.id,
            "path": row.path,
            "language": row.language,
            "content_hash": row.content_hash,
            "size_bytes": row.size_bytes,
            "mtime_ns": row.mtime_ns,
            "indexed_at": row.indexed_at,
            "parse_status": row.parse_status,
            "parse_error": row.parse_error,
        }

    def _file_record_payload(self, row: ProjectGraphFileOrm) -> dict[str, object]:
        payload = self._file_payload(row)
        del payload["indexed_at"]
        return payload

    def _symbol_record_payload(self, row: ProjectGraphSymbolOrm) -> dict[str, object]:
        return {
            "id": row.id,
            "file_id": row.file_id,
            "qualified_name": row.qualified_name,
            "name": row.name,
            "kind": row.kind,
            "language": row.language,
            "start_line": row.start_line,
            "end_line": row.end_line,
            "signature": row.signature,
            "doc_summary": row.doc_summary,
            "exported": bool(row.exported),
            "confidence": row.confidence,
        }

    def _import_record_payload(self, row: ProjectGraphImportOrm) -> dict[str, object]:
        return {
            "id": row.id,
            "file_id": row.file_id,
            "module": row.module,
            "imported_name": row.imported_name,
            "alias": row.alias,
            "resolved_file_id": row.resolved_file_id,
            "confidence": row.confidence,
        }

    def _symbol_payload(self, row: ProjectGraphSymbolOrm, file: ProjectGraphFileOrm) -> dict[str, object]:
        return {
            "id": row.id,
            "qualified_name": row.qualified_name,
            "name": row.name,
            "kind": row.kind,
            "language": row.language,
            "start_line": row.start_line,
            "end_line": row.end_line,
            "signature": row.signature,
            "doc_summary": row.doc_summary,
            "exported": bool(row.exported),
            "confidence": row.confidence,
            "file": self._file_payload(file),
        }

    def _relation_payload(self, row: ProjectGraphRelationOrm) -> dict[str, object]:
        return {
            "id": row.id,
            "source_symbol_id": row.source_symbol_id,
            "target_symbol_id": row.target_symbol_id,
            "source_file_id": row.source_file_id,
            "target_file_id": row.target_file_id,
            "relation_type": row.relation_type,
            "start_line": row.start_line,
            "end_line": row.end_line,
            "confidence": row.confidence,
            "evidence": json.loads(row.evidence) if row.evidence else None,
        }

    def _now(self) -> str:
        return datetime.now(UTC).isoformat()
