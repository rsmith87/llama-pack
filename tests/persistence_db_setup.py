from __future__ import annotations

from pathlib import Path

from sqlalchemy import Column, MetaData, String, Table, delete

from llama_pack.core.persistence.alembic_config import Base
from llama_pack.core.config import load_config
from llama_pack.core.persistence.db_infra import (
    create_persistence_engine,
    create_session_factory,
    default_state_dir,
    session_scope,
    sqlite_url_for_path,
)
from llama_pack.core.persistence.models.app_state import ApiKeyOrm, AuditEventOrm, BenchmarkDefinitionOrm, BenchmarkRunOrm, BenchmarkRunSampleOrm, ChatSessionOrm, ModelDownloadOrm, ToolLoopEvalCaseOrm, ToolLoopEvalRunOrm
from llama_pack.core.persistence.models.model_asset import (
    ModelAssetOrm,
    ModelAssetProvenanceOrm,
    ModelDeploymentOrm,
    ModelOrm,
    ModelProfileOrm,
)
from llama_pack.core.persistence.models.orchestration import (
    ArtifactOrm,
    ControllerLeaseOrm,
    JobAttemptOrm,
    JobEventOrm,
    JobOrm,
    NodeLeaseOrm,
    SchemaMetaOrm,
)
from llama_pack.core.persistence.models.settings import SettingsEntryOrm
from llama_pack.core.persistence.models.projects import (
    ProjectContextArtifactOrm,
    ProjectGraphFileOrm,
    ProjectGraphImportOrm,
    ProjectGraphRelationOrm,
    ProjectGraphSnapshotOrm,
    ProjectGraphSymbolOrm,
    ProjectNodeRootOrm,
    ProjectOrm,
)


TARGET_REVISIONS = {
    "controller": "20260513_0001",
    "auth": "20260527_0001",
    "audit": "20260513_0003",
    "chat_sessions": "20260523_0007",
    "downloads": "20260523_0001",
    "benchmarks": "20260612_0006",
    "models": "20260614_0002",
    "settings": "20260617_0001",
    "projects": "20260619_0003",
}
LATEST_REVISION = TARGET_REVISIONS["chat_sessions"]

ALEMBIC_VERSION = Table(
    "alembic_version",
    MetaData(),
    Column("version_num", String(32), primary_key=True),
)


def _write_schema(db_path: Path, tables: list, revision: str = LATEST_REVISION) -> None:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    engine = create_persistence_engine(sqlite_url_for_path(db_path))
    Base.metadata.create_all(engine, tables=tables)
    ALEMBIC_VERSION.metadata.create_all(engine)
    session_factory = create_session_factory(engine)
    with session_scope(session_factory) as session:
        session.execute(delete(ALEMBIC_VERSION))
        session.execute(ALEMBIC_VERSION.insert().values(version_num=revision))
    engine.dispose()


def prepare_auth_db(db_path: Path, revision: str = TARGET_REVISIONS["auth"]) -> None:
    _write_schema(db_path, [ApiKeyOrm.__table__], revision)


def prepare_audit_db(db_path: Path, revision: str = TARGET_REVISIONS["audit"]) -> None:
    _write_schema(db_path, [AuditEventOrm.__table__], revision)


def prepare_chat_sessions_db(db_path: Path, revision: str = TARGET_REVISIONS["chat_sessions"]) -> None:
    _write_schema(
        db_path,
        [
            ChatSessionOrm.__table__,
        ],
        revision,
    )


def prepare_downloads_db(db_path: Path, revision: str = TARGET_REVISIONS["downloads"]) -> None:
    _write_schema(
        db_path,
        [
            ModelDownloadOrm.__table__,
        ],
        revision,
    )


def prepare_benchmarks_db(db_path: Path, revision: str = TARGET_REVISIONS["benchmarks"]) -> None:
    _write_schema(
        db_path,
        [
            BenchmarkDefinitionOrm.__table__,
            BenchmarkRunOrm.__table__,
            BenchmarkRunSampleOrm.__table__,
            ToolLoopEvalRunOrm.__table__,
            ToolLoopEvalCaseOrm.__table__,
        ],
        revision,
    )


def prepare_models_db(db_path: Path, revision: str = TARGET_REVISIONS["models"]) -> None:
    _write_schema(
        db_path,
        [
            ModelAssetOrm.__table__,
            ModelOrm.__table__,
            ModelAssetProvenanceOrm.__table__,
            ModelProfileOrm.__table__,
            ModelDeploymentOrm.__table__,
        ],
        revision,
    )


def prepare_controller_db(db_path: Path, revision: str = TARGET_REVISIONS["controller"]) -> None:
    _write_schema(
        db_path,
        [
            JobOrm.__table__,
            JobAttemptOrm.__table__,
            NodeLeaseOrm.__table__,
            JobEventOrm.__table__,
            ArtifactOrm.__table__,
            SchemaMetaOrm.__table__,
            ControllerLeaseOrm.__table__,
        ],
        revision,
    )


def prepare_settings_db(db_path: Path, revision: str = TARGET_REVISIONS["settings"]) -> None:
    _write_schema(
        db_path,
        [
            SettingsEntryOrm.__table__,
        ],
        revision,
    )


def prepare_projects_db(db_path: Path, revision: str = TARGET_REVISIONS["projects"]) -> None:
    _write_schema(
        db_path,
        [
            ProjectOrm.__table__,
            ProjectNodeRootOrm.__table__,
            ProjectContextArtifactOrm.__table__,
            ProjectGraphSnapshotOrm.__table__,
            ProjectGraphFileOrm.__table__,
            ProjectGraphSymbolOrm.__table__,
            ProjectGraphImportOrm.__table__,
            ProjectGraphRelationOrm.__table__,
        ],
        revision,
    )


def prepare_all_persistence_dbs(log_dir: Path, revision: str | None = None) -> None:
    state_dir = default_state_dir(load_config({"log_dir": str(log_dir)}))
    prepare_controller_db(state_dir / "controller_state.db", revision=revision or TARGET_REVISIONS["controller"])
    prepare_auth_db(state_dir / "auth_store.db", revision=revision or TARGET_REVISIONS["auth"])
    prepare_audit_db(state_dir / "audit_events.db", revision=revision or TARGET_REVISIONS["audit"])
    prepare_chat_sessions_db(state_dir / "chat_sessions.db", revision=revision or TARGET_REVISIONS["chat_sessions"])
    prepare_downloads_db(state_dir / "downloads.db", revision=revision or TARGET_REVISIONS["downloads"])
    prepare_benchmarks_db(state_dir / "benchmarks.db", revision=revision or TARGET_REVISIONS["benchmarks"])
    prepare_models_db(state_dir / "models.db", revision=revision or TARGET_REVISIONS["models"])
    prepare_settings_db(state_dir / "settings.db", revision=revision or TARGET_REVISIONS["settings"])
    prepare_projects_db(state_dir / "projects.db", revision=revision or TARGET_REVISIONS["projects"])
