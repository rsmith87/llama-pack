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
    created_at: Mapped[str] = mapped_column(Text, nullable=False)
    updated_at: Mapped[str] = mapped_column(Text, nullable=False)

    __table_args__ = (
        Index("idx_models_asset_id", "asset_id"),
        Index("idx_models_model_line", "model_line"),
        Index("idx_models_name", "model_name"),
    )
