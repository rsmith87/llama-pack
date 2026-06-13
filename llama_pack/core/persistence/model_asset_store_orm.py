from __future__ import annotations

import uuid
from datetime import UTC, datetime
from pathlib import Path

from sqlalchemy import select, update

from llama_pack.core.persistence.alembic_config import Base
from llama_pack.core.persistence.db_infra import (
    create_persistence_engine,
    create_session_factory,
    require_sqlite_tables,
    session_scope,
    sqlite_path_from_url,
    sqlite_url_for_path,
)
from llama_pack.core.persistence.models.model_asset import ModelAssetOrm, ModelOrm


class ModelAssetStoreOrm:
    def __init__(self, db_path: Path | None = None, db_url: str | None = None):
        if db_url is None:
            if db_path is None:
                raise ValueError("db_path or db_url is required")
            db_path.parent.mkdir(parents=True, exist_ok=True)
            db_url = sqlite_url_for_path(db_path)
        sqlite_path = sqlite_path_from_url(db_url)
        self.engine = create_persistence_engine(db_url)
        Base.metadata.create_all(self.engine, tables=[ModelAssetOrm.__table__, ModelOrm.__table__])
        if sqlite_path is not None:
            require_sqlite_tables(
                db_path=sqlite_path,
                required_tables={"model_assets", "models", "alembic_version"},
                target_name="models",
            )
        self.session_factory = create_session_factory(self.engine)

    def upsert_asset(
        self,
        *,
        canonical_path: str,
        filename: str,
        display_name: str,
        size_bytes: int,
        asset_kind: str,
        source_type: str,
        content_sha256: str | None = None,
        source_repo_id: str | None = None,
        source_revision: str | None = None,
        source_filename: str | None = None,
        download_id: str | None = None,
        model_line: str | None = None,
    ) -> dict[str, object]:
        now = datetime.now(UTC).isoformat()
        with session_scope(self.session_factory) as session:
            row = session.execute(
                select(ModelAssetOrm).where(ModelAssetOrm.canonical_path == canonical_path)
            ).scalar_one_or_none()
            if row is None:
                row = ModelAssetOrm(
                    asset_id=str(uuid.uuid4()),
                    canonical_path=canonical_path,
                    filename=filename,
                    display_name=display_name,
                    size_bytes=size_bytes,
                    asset_kind=asset_kind,
                    source_type=source_type,
                    content_sha256=content_sha256,
                    source_repo_id=source_repo_id,
                    source_revision=source_revision,
                    source_filename=source_filename,
                    download_id=download_id,
                    model_line=model_line,
                    first_discovered_at=now,
                    last_seen_at=now,
                    last_scanned_at=now,
                    missing=0,
                )
                session.add(row)
            else:
                row.filename = filename
                row.display_name = display_name
                row.size_bytes = size_bytes
                row.asset_kind = asset_kind
                row.source_type = source_type
                row.content_sha256 = content_sha256
                row.source_repo_id = source_repo_id
                row.source_revision = source_revision
                row.source_filename = source_filename
                row.download_id = download_id
                row.model_line = model_line
                row.last_seen_at = now
                row.last_scanned_at = now
                row.missing = 0
            session.flush()
            asset_id = row.asset_id
        return self.get_asset(asset_id)

    def list_assets(self) -> list[dict[str, object]]:
        with session_scope(self.session_factory) as session:
            rows = session.execute(select(ModelAssetOrm).order_by(ModelAssetOrm.canonical_path.asc())).scalars().all()
        return [self._asset_to_dict(row) for row in rows]

    def get_asset(self, asset_id: str) -> dict[str, object]:
        with session_scope(self.session_factory) as session:
            row = session.execute(select(ModelAssetOrm).where(ModelAssetOrm.asset_id == asset_id)).scalar_one_or_none()
        if row is None:
            raise KeyError(f"Unknown asset id: {asset_id}")
        return self._asset_to_dict(row)

    def get_asset_by_path(self, canonical_path: str) -> dict[str, object] | None:
        with session_scope(self.session_factory) as session:
            row = session.execute(
                select(ModelAssetOrm).where(ModelAssetOrm.canonical_path == canonical_path)
            ).scalar_one_or_none()
        if row is None:
            return None
        return self._asset_to_dict(row)

    def mark_missing_assets(self, *, missing_asset_ids: set[str]) -> int:
        if not missing_asset_ids:
            return 0
        with session_scope(self.session_factory) as session:
            result = session.execute(
                update(ModelAssetOrm)
                .where(ModelAssetOrm.asset_id.in_(sorted(missing_asset_ids)))
                .values(missing=1)
            )
        return int(result.rowcount or 0)

    def upsert_model(
        self,
        *,
        model_name: str,
        asset_id: str | None,
        config_source: str,
        model_line: str | None = None,
    ) -> dict[str, object]:
        now = datetime.now(UTC).isoformat()
        with session_scope(self.session_factory) as session:
            row = session.execute(select(ModelOrm).where(ModelOrm.model_name == model_name)).scalar_one_or_none()
            if row is None:
                row = ModelOrm(
                    model_id=str(uuid.uuid4()),
                    model_name=model_name,
                    asset_id=asset_id,
                    config_source=config_source,
                    model_line=model_line,
                    created_at=now,
                    updated_at=now,
                )
                session.add(row)
            else:
                row.asset_id = asset_id
                row.config_source = config_source
                row.model_line = model_line
                row.updated_at = now
            session.flush()
            model_id = row.model_id
        return self.get_model(model_id)

    def list_models(self) -> list[dict[str, object]]:
        with session_scope(self.session_factory) as session:
            rows = session.execute(select(ModelOrm).order_by(ModelOrm.model_name.asc())).scalars().all()
        return [self._model_to_dict(row) for row in rows]

    def get_model(self, model_id: str) -> dict[str, object]:
        with session_scope(self.session_factory) as session:
            row = session.execute(select(ModelOrm).where(ModelOrm.model_id == model_id)).scalar_one_or_none()
        if row is None:
            raise KeyError(f"Unknown model id: {model_id}")
        return self._model_to_dict(row)

    def delete_model_by_name(self, model_name: str) -> None:
        with session_scope(self.session_factory) as session:
            row = session.execute(select(ModelOrm).where(ModelOrm.model_name == model_name)).scalar_one_or_none()
            if row is None:
                raise KeyError(f"Unknown model name: {model_name}")
            session.delete(row)

    def _asset_to_dict(self, row: ModelAssetOrm) -> dict[str, object]:
        return {
            "asset_id": row.asset_id,
            "asset_kind": row.asset_kind,
            "canonical_path": row.canonical_path,
            "filename": row.filename,
            "display_name": row.display_name,
            "size_bytes": row.size_bytes,
            "content_sha256": row.content_sha256,
            "source_type": row.source_type,
            "source_repo_id": row.source_repo_id,
            "source_revision": row.source_revision,
            "source_filename": row.source_filename,
            "download_id": row.download_id,
            "model_line": row.model_line,
            "first_discovered_at": row.first_discovered_at,
            "last_seen_at": row.last_seen_at,
            "last_scanned_at": row.last_scanned_at,
            "missing": bool(row.missing),
        }

    def _model_to_dict(self, row: ModelOrm) -> dict[str, object]:
        return {
            "model_id": row.model_id,
            "model_name": row.model_name,
            "asset_id": row.asset_id,
            "config_source": row.config_source,
            "model_line": row.model_line,
            "created_at": row.created_at,
            "updated_at": row.updated_at,
        }
