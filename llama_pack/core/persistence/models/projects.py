from __future__ import annotations

from sqlalchemy import Float, ForeignKey, Index, Integer, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from llama_pack.core.persistence.alembic_config import Base


class ProjectOrm(Base):
    __tablename__ = "projects"

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    root_hint: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[str] = mapped_column(Text, nullable=False)
    updated_at: Mapped[str] = mapped_column(Text, nullable=False)
    archived: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")

    __table_args__ = (
        Index("idx_projects_updated_at", "updated_at"),
        Index("idx_projects_archived", "archived"),
    )


class ProjectNodeRootOrm(Base):
    __tablename__ = "project_node_roots"

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), nullable=False)
    node_name: Mapped[str] = mapped_column(Text, nullable=False)
    root_path: Mapped[str] = mapped_column(Text, nullable=False)
    safe_root_status: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[str] = mapped_column(Text, nullable=False)
    updated_at: Mapped[str] = mapped_column(Text, nullable=False)

    __table_args__ = (
        UniqueConstraint("project_id", "node_name", "root_path", name="uq_project_node_roots_project_node_path"),
        Index("idx_project_node_roots_project_id", "project_id"),
        Index("idx_project_node_roots_node_name", "node_name"),
    )


class ProjectGraphSnapshotOrm(Base):
    __tablename__ = "project_graph_snapshots"

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), nullable=False)
    node_name: Mapped[str] = mapped_column(Text, nullable=False)
    root_path: Mapped[str] = mapped_column(Text, nullable=False)
    git_commit: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(Text, nullable=False)
    started_at: Mapped[str] = mapped_column(Text, nullable=False)
    finished_at: Mapped[str | None] = mapped_column(Text, nullable=True)
    error_detail: Mapped[str | None] = mapped_column(Text, nullable=True)
    file_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    symbol_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    relation_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    active: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    created_at: Mapped[str] = mapped_column(Text, nullable=False)

    __table_args__ = (
        Index("idx_project_graph_snapshots_project_active", "project_id", "active"),
        Index("idx_project_graph_snapshots_status", "status"),
    )


class ProjectGraphFileOrm(Base):
    __tablename__ = "project_graph_files"

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    snapshot_id: Mapped[str] = mapped_column(ForeignKey("project_graph_snapshots.id"), nullable=False)
    path: Mapped[str] = mapped_column(Text, nullable=False)
    language: Mapped[str] = mapped_column(Text, nullable=False)
    content_hash: Mapped[str] = mapped_column(Text, nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    mtime_ns: Mapped[int] = mapped_column(Integer, nullable=False)
    indexed_at: Mapped[str] = mapped_column(Text, nullable=False)
    parse_status: Mapped[str] = mapped_column(Text, nullable=False)
    parse_error: Mapped[str | None] = mapped_column(Text, nullable=True)

    __table_args__ = (
        UniqueConstraint("snapshot_id", "path", name="uq_project_graph_files_snapshot_path"),
        Index("idx_project_graph_files_snapshot", "snapshot_id"),
    )


class ProjectGraphSymbolOrm(Base):
    __tablename__ = "project_graph_symbols"

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    snapshot_id: Mapped[str] = mapped_column(ForeignKey("project_graph_snapshots.id"), nullable=False)
    file_id: Mapped[str] = mapped_column(ForeignKey("project_graph_files.id"), nullable=False)
    qualified_name: Mapped[str] = mapped_column(Text, nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    kind: Mapped[str] = mapped_column(Text, nullable=False)
    language: Mapped[str] = mapped_column(Text, nullable=False)
    start_line: Mapped[int] = mapped_column(Integer, nullable=False)
    end_line: Mapped[int] = mapped_column(Integer, nullable=False)
    signature: Mapped[str | None] = mapped_column(Text, nullable=True)
    doc_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    exported: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    confidence: Mapped[float] = mapped_column(Float, nullable=False, default=1.0, server_default="1")

    __table_args__ = (
        Index("idx_project_graph_symbols_snapshot_name", "snapshot_id", "name"),
        Index("idx_project_graph_symbols_snapshot_kind", "snapshot_id", "kind"),
    )


class ProjectGraphImportOrm(Base):
    __tablename__ = "project_graph_imports"

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    snapshot_id: Mapped[str] = mapped_column(ForeignKey("project_graph_snapshots.id"), nullable=False)
    file_id: Mapped[str] = mapped_column(ForeignKey("project_graph_files.id"), nullable=False)
    module: Mapped[str] = mapped_column(Text, nullable=False)
    imported_name: Mapped[str | None] = mapped_column(Text, nullable=True)
    alias: Mapped[str | None] = mapped_column(Text, nullable=True)
    resolved_file_id: Mapped[str | None] = mapped_column(ForeignKey("project_graph_files.id"), nullable=True)
    confidence: Mapped[float] = mapped_column(Float, nullable=False, default=1.0, server_default="1")

    __table_args__ = (
        Index("idx_project_graph_imports_snapshot_module", "snapshot_id", "module"),
    )


class ProjectGraphRelationOrm(Base):
    __tablename__ = "project_graph_relations"

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    snapshot_id: Mapped[str] = mapped_column(ForeignKey("project_graph_snapshots.id"), nullable=False)
    source_symbol_id: Mapped[str | None] = mapped_column(ForeignKey("project_graph_symbols.id"), nullable=True)
    target_symbol_id: Mapped[str | None] = mapped_column(ForeignKey("project_graph_symbols.id"), nullable=True)
    source_file_id: Mapped[str | None] = mapped_column(ForeignKey("project_graph_files.id"), nullable=True)
    target_file_id: Mapped[str | None] = mapped_column(ForeignKey("project_graph_files.id"), nullable=True)
    relation_type: Mapped[str] = mapped_column(Text, nullable=False)
    start_line: Mapped[int | None] = mapped_column(Integer, nullable=True)
    end_line: Mapped[int | None] = mapped_column(Integer, nullable=True)
    confidence: Mapped[float] = mapped_column(Float, nullable=False, default=1.0, server_default="1")
    evidence: Mapped[str | None] = mapped_column(Text, nullable=True)

    __table_args__ = (
        Index("idx_project_graph_relations_snapshot_type", "snapshot_id", "relation_type"),
        Index("idx_project_graph_relations_source", "source_symbol_id"),
        Index("idx_project_graph_relations_target", "target_symbol_id"),
    )
