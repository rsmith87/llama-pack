from __future__ import annotations

import json
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
from llama_pack.core.persistence.models.model_asset import (
    ModelAssetOrm,
    ModelDeploymentOrm,
    ModelOrm,
    ModelProfileOrm,
)


class ModelAssetStoreOrm:
    def __init__(self, db_path: Path | None = None, db_url: str | None = None):
        if db_url is None:
            if db_path is None:
                raise ValueError("db_path or db_url is required")
            db_path.parent.mkdir(parents=True, exist_ok=True)
            db_url = sqlite_url_for_path(db_path)
        sqlite_path = sqlite_path_from_url(db_url)
        self.engine = create_persistence_engine(db_url)
        Base.metadata.create_all(
            self.engine,
            tables=[
                ModelAssetOrm.__table__,
                ModelOrm.__table__,
                ModelProfileOrm.__table__,
                ModelDeploymentOrm.__table__,
            ],
        )
        if sqlite_path is not None:
            require_sqlite_tables(
                db_path=sqlite_path,
                required_tables={"model_assets", "models", "model_profiles", "model_deployments", "alembic_version"},
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
                if model_line is not None:
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

    def update_asset_metadata(
        self,
        asset_id: str,
        *,
        model_line: str | None = None,
    ) -> dict[str, object]:
        with session_scope(self.session_factory) as session:
            row = session.execute(
                select(ModelAssetOrm).where(ModelAssetOrm.asset_id == asset_id)
            ).scalar_one_or_none()
            if row is None:
                raise KeyError(f"Unknown asset id: {asset_id}")
            row.model_line = model_line
            session.flush()
        return self.get_asset(asset_id)

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
        ctx: int | None = None,
        gpu_layers: int | None = None,
        vision: bool = False,
        mmproj: str | None = None,
        supports_json_schema: bool | None = None,
        supports_grammar: bool | None = None,
        supports_mtp: bool | None = None,
        reasoning: str | None = None,
        reasoning_budget: int | None = None,
        prompt_template: str | None = None,
        favorite: bool = False,
        strengths: list[str] | None = None,
        cost_tier: str | None = None,
        extra_args: list[str] | None = None,
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
                    ctx=ctx,
                    gpu_layers=gpu_layers,
                    vision=1 if vision else 0,
                    mmproj=mmproj,
                    supports_json_schema=self._bool_to_db(supports_json_schema),
                    supports_grammar=self._bool_to_db(supports_grammar),
                    supports_mtp=self._bool_to_db(supports_mtp),
                    reasoning=reasoning,
                    reasoning_budget=reasoning_budget,
                    prompt_template=prompt_template,
                    favorite=1 if favorite else 0,
                    strengths_json=self._json_list(strengths),
                    cost_tier=cost_tier,
                    extra_args_json=self._json_list(extra_args),
                    created_at=now,
                    updated_at=now,
                )
                session.add(row)
            else:
                row.asset_id = asset_id
                row.config_source = config_source
                row.model_line = model_line
                row.ctx = ctx
                row.gpu_layers = gpu_layers
                row.vision = 1 if vision else 0
                row.mmproj = mmproj
                row.supports_json_schema = self._bool_to_db(supports_json_schema)
                row.supports_grammar = self._bool_to_db(supports_grammar)
                row.supports_mtp = self._bool_to_db(supports_mtp)
                row.reasoning = reasoning
                row.reasoning_budget = reasoning_budget
                row.prompt_template = prompt_template
                row.favorite = 1 if favorite else 0
                row.strengths_json = self._json_list(strengths)
                row.cost_tier = cost_tier
                row.extra_args_json = self._json_list(extra_args)
                row.updated_at = now
            session.flush()
            model_id = row.model_id
        return self.get_model(model_id)

    def upsert_model_profile(
        self,
        *,
        model_id: str,
        profile_key: str,
        label: str | None,
        order: int,
        kind: str | None,
        ctx: int | None = None,
        gpu_layers: int | None = None,
        host: str | None = None,
        extra_args: list[str] | None = None,
        intended_ctx: int | None = None,
        kv_cache_policy: str | None = None,
        resource_tier: str | None = None,
        strengths: list[str] | None = None,
        cost_tier: str | None = None,
    ) -> dict[str, object]:
        now = datetime.now(UTC).isoformat()
        with session_scope(self.session_factory) as session:
            row = session.execute(
                select(ModelProfileOrm).where(
                    ModelProfileOrm.model_id == model_id,
                    ModelProfileOrm.profile_key == profile_key,
                )
            ).scalar_one_or_none()
            if row is None:
                row = ModelProfileOrm(
                    profile_id=str(uuid.uuid4()),
                    model_id=model_id,
                    profile_key=profile_key,
                    label=label,
                    order=order,
                    kind=kind,
                    ctx=ctx,
                    gpu_layers=gpu_layers,
                    host=host,
                    extra_args_json=self._json_list(extra_args),
                    intended_ctx=intended_ctx,
                    kv_cache_policy=kv_cache_policy,
                    resource_tier=resource_tier,
                    strengths_json=self._json_list(strengths),
                    cost_tier=cost_tier,
                    created_at=now,
                    updated_at=now,
                )
                session.add(row)
            else:
                row.label = label
                row.order = order
                row.kind = kind
                row.ctx = ctx
                row.gpu_layers = gpu_layers
                row.host = host
                row.extra_args_json = self._json_list(extra_args)
                row.intended_ctx = intended_ctx
                row.kv_cache_policy = kv_cache_policy
                row.resource_tier = resource_tier
                row.strengths_json = self._json_list(strengths)
                row.cost_tier = cost_tier
                row.updated_at = now
            session.flush()
            profile_id = row.profile_id
        return self.get_model_profile(profile_id)

    def list_model_profiles(self, model_id: str) -> list[dict[str, object]]:
        with session_scope(self.session_factory) as session:
            rows = session.execute(
                select(ModelProfileOrm)
                .where(ModelProfileOrm.model_id == model_id)
                .order_by(ModelProfileOrm.order.asc(), ModelProfileOrm.profile_key.asc())
            ).scalars().all()
        return [self._profile_to_dict(row) for row in rows]

    def get_model_profile(self, profile_id: str) -> dict[str, object]:
        with session_scope(self.session_factory) as session:
            row = session.execute(
                select(ModelProfileOrm).where(ModelProfileOrm.profile_id == profile_id)
            ).scalar_one_or_none()
        if row is None:
            raise KeyError(f"Unknown model profile id: {profile_id}")
        return self._profile_to_dict(row)

    def upsert_model_deployment(
        self,
        *,
        model_id: str,
        deployment_name: str,
        node_name: str | None,
        host: str,
        port: int,
        ctx_override: int | None = None,
        gpu_layers_override: int | None = None,
        mmproj_override: str | None = None,
        extra_args_override: list[str] | None = None,
        profile_key: str | None = None,
        enabled: bool = True,
    ) -> dict[str, object]:
        now = datetime.now(UTC).isoformat()
        with session_scope(self.session_factory) as session:
            row = session.execute(
                select(ModelDeploymentOrm).where(
                    ModelDeploymentOrm.model_id == model_id,
                    ModelDeploymentOrm.deployment_name == deployment_name,
                )
            ).scalar_one_or_none()
            if row is None:
                row = ModelDeploymentOrm(
                    deployment_id=str(uuid.uuid4()),
                    model_id=model_id,
                    deployment_name=deployment_name,
                    node_name=node_name,
                    host=host,
                    port=port,
                    ctx_override=ctx_override,
                    gpu_layers_override=gpu_layers_override,
                    mmproj_override=mmproj_override,
                    extra_args_override_json=self._json_list(extra_args_override),
                    profile_key=profile_key,
                    enabled=1 if enabled else 0,
                    created_at=now,
                    updated_at=now,
                )
                session.add(row)
            else:
                row.node_name = node_name
                row.host = host
                row.port = port
                row.ctx_override = ctx_override
                row.gpu_layers_override = gpu_layers_override
                row.mmproj_override = mmproj_override
                row.extra_args_override_json = self._json_list(extra_args_override)
                row.profile_key = profile_key
                row.enabled = 1 if enabled else 0
                row.updated_at = now
            session.flush()
            deployment_id = row.deployment_id
        return self.get_model_deployment(deployment_id)

    def list_model_deployments(self, model_id: str) -> list[dict[str, object]]:
        with session_scope(self.session_factory) as session:
            rows = session.execute(
                select(ModelDeploymentOrm)
                .where(ModelDeploymentOrm.model_id == model_id)
                .order_by(ModelDeploymentOrm.deployment_name.asc())
            ).scalars().all()
        return [self._deployment_to_dict(row) for row in rows]

    def get_model_deployment(self, deployment_id: str) -> dict[str, object]:
        with session_scope(self.session_factory) as session:
            row = session.execute(
                select(ModelDeploymentOrm).where(ModelDeploymentOrm.deployment_id == deployment_id)
            ).scalar_one_or_none()
        if row is None:
            raise KeyError(f"Unknown model deployment id: {deployment_id}")
        return self._deployment_to_dict(row)

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

    def get_model_by_name(self, model_name: str) -> dict[str, object] | None:
        with session_scope(self.session_factory) as session:
            row = session.execute(select(ModelOrm).where(ModelOrm.model_name == model_name)).scalar_one_or_none()
        if row is None:
            return None
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
            "ctx": row.ctx,
            "gpu_layers": row.gpu_layers,
            "vision": bool(row.vision),
            "mmproj": row.mmproj,
            "supports_json_schema": self._db_to_bool(row.supports_json_schema),
            "supports_grammar": self._db_to_bool(row.supports_grammar),
            "supports_mtp": self._db_to_bool(row.supports_mtp),
            "reasoning": row.reasoning,
            "reasoning_budget": row.reasoning_budget,
            "prompt_template": row.prompt_template,
            "favorite": bool(row.favorite),
            "strengths": self._parse_json_list(row.strengths_json),
            "cost_tier": row.cost_tier,
            "extra_args": self._parse_json_list(row.extra_args_json),
            "created_at": row.created_at,
            "updated_at": row.updated_at,
        }

    def _profile_to_dict(self, row: ModelProfileOrm) -> dict[str, object]:
        return {
            "profile_id": row.profile_id,
            "model_id": row.model_id,
            "profile_key": row.profile_key,
            "label": row.label,
            "order": row.order,
            "kind": row.kind,
            "ctx": row.ctx,
            "gpu_layers": row.gpu_layers,
            "host": row.host,
            "extra_args": self._parse_json_list(row.extra_args_json),
            "intended_ctx": row.intended_ctx,
            "kv_cache_policy": row.kv_cache_policy,
            "resource_tier": row.resource_tier,
            "strengths": self._parse_json_list(row.strengths_json),
            "cost_tier": row.cost_tier,
            "created_at": row.created_at,
            "updated_at": row.updated_at,
        }

    def _deployment_to_dict(self, row: ModelDeploymentOrm) -> dict[str, object]:
        return {
            "deployment_id": row.deployment_id,
            "model_id": row.model_id,
            "deployment_name": row.deployment_name,
            "node_name": row.node_name,
            "host": row.host,
            "port": row.port,
            "ctx_override": row.ctx_override,
            "gpu_layers_override": row.gpu_layers_override,
            "mmproj_override": row.mmproj_override,
            "extra_args_override": self._parse_json_list(row.extra_args_override_json),
            "profile_key": row.profile_key,
            "enabled": bool(row.enabled),
            "created_at": row.created_at,
            "updated_at": row.updated_at,
        }

    @staticmethod
    def _json_list(value: list[str] | None) -> str:
        return json.dumps(value or [])

    @staticmethod
    def _parse_json_list(value: str | None) -> list[str]:
        if not value:
            return []
        parsed = json.loads(value)
        return parsed if isinstance(parsed, list) else []

    @staticmethod
    def _bool_to_db(value: bool | None) -> int | None:
        if value is None:
            return None
        return 1 if value else 0

    @staticmethod
    def _db_to_bool(value: int | None) -> bool | None:
        if value is None:
            return None
        return bool(value)
