from __future__ import annotations

import json
import uuid
from datetime import UTC, datetime
from pathlib import Path

from sqlalchemy import delete, select

from llama_manager.core.persistence.db_infra import (
    create_persistence_engine,
    create_session_factory,
    require_sqlite_tables,
    session_scope,
    sqlite_path_from_url,
    sqlite_url_for_path,
)
from llama_manager.core.persistence.models.app_state import ChatSessionOrm

VISITOR_SESSION_KEY = "_test_chat_visitor_id"


def _public_request_defaults(request_defaults: dict[str, object]) -> dict[str, object]:
    return {key: value for key, value in request_defaults.items() if key != VISITOR_SESSION_KEY}


class ChatSessionStoreOrm:
    def __init__(self, db_path: Path | None = None, db_url: str | None = None):
        if db_url is None:
            if db_path is None:
                raise ValueError("db_path or db_url is required")
            db_path.parent.mkdir(parents=True, exist_ok=True)
            db_url = sqlite_url_for_path(db_path)
        sqlite_path = sqlite_path_from_url(db_url)
        if sqlite_path is not None:
            require_sqlite_tables(
                db_path=sqlite_path,
                required_tables={"chat_sessions", "alembic_version"},
                target_name="chat_sessions",
            )
        self.engine = create_persistence_engine(db_url)
        self.session_factory = create_session_factory(self.engine)

    def list_sessions(self, *, visitor_id: str | None = None) -> list[dict[str, object]]:
        with session_scope(self.session_factory) as session:
            rows = session.execute(
                select(ChatSessionOrm).order_by(ChatSessionOrm.updated_at.desc())
            ).scalars().all()
        payloads = []
        for row in rows:
            request_defaults = json.loads(row.request_defaults_json)
            if visitor_id is not None and request_defaults.get(VISITOR_SESSION_KEY) != visitor_id:
                continue
            payloads.append({
                "id": row.id,
                "name": row.name,
                "model": row.model,
                "target_selector": row.target_selector,
                "created_at": row.created_at,
                "updated_at": row.updated_at,
            })
        return payloads

    def get_session(self, session_id: str, *, visitor_id: str | None = None) -> dict[str, object] | None:
        with session_scope(self.session_factory) as session:
            row = session.execute(select(ChatSessionOrm).where(ChatSessionOrm.id == session_id)).scalar_one_or_none()
        if row is None:
            return None
        request_defaults = json.loads(row.request_defaults_json)
        if visitor_id is not None and request_defaults.get(VISITOR_SESSION_KEY) != visitor_id:
            return None
        return {
            "id": row.id,
            "name": row.name,
            "model": row.model,
            "target_selector": row.target_selector,
            "messages": json.loads(row.messages_json),
            "request_defaults": _public_request_defaults(request_defaults),
            "created_at": row.created_at,
            "updated_at": row.updated_at,
        }

    def save_session(
        self,
        *,
        name: str,
        model: str,
        target_selector: str,
        messages: list[dict[str, object]],
        request_defaults: dict[str, object],
        session_id: str | None = None,
        visitor_id: str | None = None,
    ) -> dict[str, object]:
        now = datetime.now(UTC).isoformat()
        sid = session_id or str(uuid.uuid4())
        request_defaults_to_save = dict(request_defaults)
        if visitor_id is not None:
            request_defaults_to_save[VISITOR_SESSION_KEY] = visitor_id
        with session_scope(self.session_factory) as session:
            existing = session.execute(select(ChatSessionOrm).where(ChatSessionOrm.id == sid)).scalar_one_or_none()
            created_at = existing.created_at if existing is not None else now
            if existing is not None and visitor_id is not None:
                existing_defaults = json.loads(existing.request_defaults_json)
                if existing_defaults.get(VISITOR_SESSION_KEY) != visitor_id:
                    raise PermissionError("Session not found")
            if existing is None:
                row = ChatSessionOrm(
                    id=sid,
                    name=name,
                    model=model,
                    target_selector=target_selector,
                    messages_json=json.dumps(messages),
                    request_defaults_json=json.dumps(request_defaults_to_save),
                    created_at=created_at,
                    updated_at=now,
                )
                session.add(row)
            else:
                existing.name = name
                existing.model = model
                existing.target_selector = target_selector
                existing.messages_json = json.dumps(messages)
                existing.request_defaults_json = json.dumps(request_defaults_to_save)
                existing.updated_at = now

        payload = self.get_session(sid, visitor_id=visitor_id)
        if payload is None:
            raise RuntimeError("Failed to save chat session")
        return payload

    def delete_session(self, session_id: str, *, visitor_id: str | None = None) -> bool:
        with session_scope(self.session_factory) as session:
            row = session.execute(select(ChatSessionOrm).where(ChatSessionOrm.id == session_id)).scalar_one_or_none()
            if row is None:
                return False
            if visitor_id is not None:
                request_defaults = json.loads(row.request_defaults_json)
                if request_defaults.get(VISITOR_SESSION_KEY) != visitor_id:
                    return False
            result = session.execute(delete(ChatSessionOrm).where(ChatSessionOrm.id == session_id))
        return (result.rowcount or 0) > 0
