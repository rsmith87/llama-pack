from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import select

from llama_pack.core.persistence.alembic_config import Base
from llama_pack.core.persistence.db_infra import create_persistence_engine, create_session_factory, session_scope, sqlite_path_from_url
from llama_pack.core.persistence.models.settings import SettingsEntryOrm


class SettingsStoreOrm:
    def __init__(self, db_url: str) -> None:
        sqlite_path = sqlite_path_from_url(db_url)
        if sqlite_path is not None:
            sqlite_path.parent.mkdir(parents=True, exist_ok=True)
        self.engine = create_persistence_engine(db_url)
        Base.metadata.create_all(self.engine, tables=[SettingsEntryOrm.__table__])
        self.session_factory = create_session_factory(self.engine)

    def get_entries(self) -> dict[str, str]:
        with session_scope(self.session_factory) as session:
            rows = session.execute(select(SettingsEntryOrm)).scalars().all()
            return {row.key: row.value_json for row in rows}

    def upsert_entries(self, values: dict[str, str], updated_by: str | None) -> None:
        now = datetime.now(UTC)
        with session_scope(self.session_factory) as session:
            for key, value_json in values.items():
                row = session.get(SettingsEntryOrm, key)
                if row is None:
                    session.add(
                        SettingsEntryOrm(
                            key=key,
                            value_json=value_json,
                            updated_at=now,
                            updated_by=updated_by,
                        )
                    )
                else:
                    row.value_json = value_json
                    row.updated_at = now
                    row.updated_by = updated_by

    def close(self) -> None:
        self.engine.dispose()
