from __future__ import annotations

from datetime import UTC, datetime
import uuid

from sqlalchemy import select

from llama_pack.core.persistence.db_infra import create_persistence_engine, create_session_factory, require_sqlite_tables, session_scope, sqlite_path_from_url
from llama_pack.core.persistence.models.projects import ProjectNodeRootOrm, ProjectOrm


class ProjectStoreOrm:
    def __init__(self, db_url: str) -> None:
        sqlite_path = sqlite_path_from_url(db_url)
        if sqlite_path is not None:
            sqlite_path.parent.mkdir(parents=True, exist_ok=True)
            require_sqlite_tables(
                db_path=sqlite_path,
                required_tables={"projects", "project_node_roots", "alembic_version"},
                target_name="projects",
            )
        self.engine = create_persistence_engine(db_url)
        self.session_factory = create_session_factory(self.engine)

    def list_projects(self, include_archived: bool) -> list[dict[str, object]]:
        with session_scope(self.session_factory) as session:
            stmt = select(ProjectOrm)
            if not include_archived:
                stmt = stmt.where(ProjectOrm.archived == 0)
            rows = session.execute(stmt.order_by(ProjectOrm.updated_at.desc())).scalars().all()
            return [self._project_payload(row) for row in rows]

    def get_project(self, project_id: str) -> dict[str, object] | None:
        with session_scope(self.session_factory) as session:
            row = session.get(ProjectOrm, project_id)
            if row is None:
                return None
            roots = session.execute(
                select(ProjectNodeRootOrm).where(ProjectNodeRootOrm.project_id == project_id).order_by(ProjectNodeRootOrm.node_name.asc(), ProjectNodeRootOrm.root_path.asc())
            ).scalars().all()
            payload = self._project_payload(row)
            payload["node_roots"] = [self._node_root_payload(root) for root in roots]
            return payload

    def create_project(self, name: str, root_hint: str | None) -> dict[str, object]:
        now = self._now()
        project = ProjectOrm(
            id=str(uuid.uuid4()),
            name=name,
            root_hint=root_hint,
            created_at=now,
            updated_at=now,
            archived=0,
        )
        with session_scope(self.session_factory) as session:
            session.add(project)
        created = self.get_project(project.id)
        if created is None:
            raise RuntimeError(f"Created project {project.id} could not be loaded")
        return created

    def update_project(self, project_id: str, name: str, root_hint: str | None, archived: bool) -> dict[str, object] | None:
        with session_scope(self.session_factory) as session:
            row = session.get(ProjectOrm, project_id)
            if row is None:
                return None
            row.name = name
            row.root_hint = root_hint
            row.archived = 1 if archived else 0
            row.updated_at = self._now()
        return self.get_project(project_id)

    def upsert_node_root(self, project_id: str, node_name: str, root_path: str, safe_root_status: str) -> dict[str, object] | None:
        now = self._now()
        with session_scope(self.session_factory) as session:
            project = session.get(ProjectOrm, project_id)
            if project is None:
                return None
            existing = session.execute(
                select(ProjectNodeRootOrm).where(
                    ProjectNodeRootOrm.project_id == project_id,
                    ProjectNodeRootOrm.node_name == node_name,
                    ProjectNodeRootOrm.root_path == root_path,
                )
            ).scalar_one_or_none()
            if existing is None:
                existing = ProjectNodeRootOrm(
                    id=str(uuid.uuid4()),
                    project_id=project_id,
                    node_name=node_name,
                    root_path=root_path,
                    safe_root_status=safe_root_status,
                    created_at=now,
                    updated_at=now,
                )
                session.add(existing)
            else:
                existing.safe_root_status = safe_root_status
                existing.updated_at = now
            project.updated_at = now
            root_id = existing.id
        return self.get_node_root(root_id)

    def get_node_root(self, root_id: str) -> dict[str, object] | None:
        with session_scope(self.session_factory) as session:
            row = session.get(ProjectNodeRootOrm, root_id)
            if row is None:
                return None
            return self._node_root_payload(row)

    def list_node_roots(self, project_id: str) -> list[dict[str, object]] | None:
        with session_scope(self.session_factory) as session:
            if session.get(ProjectOrm, project_id) is None:
                return None
            rows = session.execute(
                select(ProjectNodeRootOrm).where(ProjectNodeRootOrm.project_id == project_id).order_by(ProjectNodeRootOrm.node_name.asc(), ProjectNodeRootOrm.root_path.asc())
            ).scalars().all()
            return [self._node_root_payload(row) for row in rows]

    def close(self) -> None:
        self.engine.dispose()

    def _project_payload(self, row: ProjectOrm) -> dict[str, object]:
        return {
            "id": row.id,
            "name": row.name,
            "root_hint": row.root_hint,
            "created_at": row.created_at,
            "updated_at": row.updated_at,
            "archived": bool(row.archived),
        }

    def _node_root_payload(self, row: ProjectNodeRootOrm) -> dict[str, object]:
        return {
            "id": row.id,
            "project_id": row.project_id,
            "node_name": row.node_name,
            "root_path": row.root_path,
            "safe_root_status": row.safe_root_status,
            "created_at": row.created_at,
            "updated_at": row.updated_at,
        }

    def _now(self) -> str:
        return datetime.now(UTC).isoformat()
