from __future__ import annotations

from sqlalchemy import Index, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column

from llama_pack.core.persistence.alembic_config import Base


class ModelAssetOrm(Base):
    __tablename__ = "model_assets"

    asset_id: Mapped[str] = mapped_column(Text, primary_key=True)
    asset_kind: Mapped[str] = mapped_column(Text, nullable=False)
    canonical_path: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    filename: Mapped[str] = mapped_column(Text, nullable=False)
    display_name: Mapped[str] = mapped_column(Text, nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    content_sha256: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_type: Mapped[str] = mapped_column(Text, nullable=False)
    source_repo_id: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_revision: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_filename: Mapped[str | None] = mapped_column(Text, nullable=True)
    download_id: Mapped[str | None] = mapped_column(Text, nullable=True)
    model_line: Mapped[str | None] = mapped_column(Text, nullable=True)
    first_discovered_at: Mapped[str] = mapped_column(Text, nullable=False)
    last_seen_at: Mapped[str] = mapped_column(Text, nullable=False)
    last_scanned_at: Mapped[str] = mapped_column(Text, nullable=False)
    missing: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")

    __table_args__ = (
        Index("idx_model_assets_canonical_path", "canonical_path"),
        Index("idx_model_assets_download_id", "download_id"),
        Index("idx_model_assets_model_line", "model_line"),
        Index("idx_model_assets_source_repo_id", "source_repo_id"),
    )


class ModelOrm(Base):
    __tablename__ = "models"

    model_id: Mapped[str] = mapped_column(Text, primary_key=True)
    model_name: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    asset_id: Mapped[str | None] = mapped_column(Text, nullable=True)
    config_source: Mapped[str] = mapped_column(Text, nullable=False)
    model_line: Mapped[str | None] = mapped_column(Text, nullable=True)
    ctx: Mapped[int | None] = mapped_column(Integer, nullable=True)
    gpu_layers: Mapped[int | None] = mapped_column(Integer, nullable=True)
    vision: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    mmproj: Mapped[str | None] = mapped_column(Text, nullable=True)
    supports_json_schema: Mapped[int | None] = mapped_column(Integer, nullable=True)
    supports_grammar: Mapped[int | None] = mapped_column(Integer, nullable=True)
    supports_mtp: Mapped[int | None] = mapped_column(Integer, nullable=True)
    reasoning: Mapped[str | None] = mapped_column(Text, nullable=True)
    reasoning_budget: Mapped[int | None] = mapped_column(Integer, nullable=True)
    prompt_template: Mapped[str | None] = mapped_column(Text, nullable=True)
    favorite: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    strengths_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]", server_default="[]")
    cost_tier: Mapped[str | None] = mapped_column(Text, nullable=True)
    extra_args_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]", server_default="[]")
    created_at: Mapped[str] = mapped_column(Text, nullable=False)
    updated_at: Mapped[str] = mapped_column(Text, nullable=False)

    __table_args__ = (
        Index("idx_models_asset_id", "asset_id"),
        Index("idx_models_model_line", "model_line"),
        Index("idx_models_name", "model_name"),
    )


class ModelProfileOrm(Base):
    __tablename__ = "model_profiles"

    profile_id: Mapped[str] = mapped_column(Text, primary_key=True)
    model_id: Mapped[str] = mapped_column(Text, nullable=False)
    profile_key: Mapped[str] = mapped_column(Text, nullable=False)
    label: Mapped[str | None] = mapped_column(Text, nullable=True)
    order: Mapped[int] = mapped_column(Integer, nullable=False, default=100, server_default="100")
    kind: Mapped[str | None] = mapped_column(Text, nullable=True)
    ctx: Mapped[int | None] = mapped_column(Integer, nullable=True)
    gpu_layers: Mapped[int | None] = mapped_column(Integer, nullable=True)
    host: Mapped[str | None] = mapped_column(Text, nullable=True)
    extra_args_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]", server_default="[]")
    intended_ctx: Mapped[int | None] = mapped_column(Integer, nullable=True)
    kv_cache_policy: Mapped[str | None] = mapped_column(Text, nullable=True)
    resource_tier: Mapped[str | None] = mapped_column(Text, nullable=True)
    strengths_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]", server_default="[]")
    cost_tier: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[str] = mapped_column(Text, nullable=False)
    updated_at: Mapped[str] = mapped_column(Text, nullable=False)

    __table_args__ = (
        Index("idx_model_profiles_model_id", "model_id"),
        Index("idx_model_profiles_model_profile_key", "model_id", "profile_key", unique=True),
        Index("idx_model_profiles_profile_key", "profile_key"),
    )


class ModelDeploymentOrm(Base):
    __tablename__ = "model_deployments"

    deployment_id: Mapped[str] = mapped_column(Text, primary_key=True)
    model_id: Mapped[str] = mapped_column(Text, nullable=False)
    deployment_name: Mapped[str] = mapped_column(Text, nullable=False)
    node_name: Mapped[str | None] = mapped_column(Text, nullable=True)
    host: Mapped[str] = mapped_column(Text, nullable=False)
    port: Mapped[int] = mapped_column(Integer, nullable=False)
    ctx_override: Mapped[int | None] = mapped_column(Integer, nullable=True)
    gpu_layers_override: Mapped[int | None] = mapped_column(Integer, nullable=True)
    mmproj_override: Mapped[str | None] = mapped_column(Text, nullable=True)
    extra_args_override_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]", server_default="[]")
    profile_key: Mapped[str | None] = mapped_column(Text, nullable=True)
    enabled: Mapped[int] = mapped_column(Integer, nullable=False, default=1, server_default="1")
    created_at: Mapped[str] = mapped_column(Text, nullable=False)
    updated_at: Mapped[str] = mapped_column(Text, nullable=False)

    __table_args__ = (
        Index("idx_model_deployments_model_id", "model_id"),
        Index("idx_model_deployments_model_deployment_name", "model_id", "deployment_name", unique=True),
        Index("idx_model_deployments_node_name", "node_name"),
        Index("idx_model_deployments_port", "port"),
    )
