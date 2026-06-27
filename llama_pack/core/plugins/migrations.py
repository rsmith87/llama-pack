from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from alembic.config import Config
from alembic.runtime.environment import EnvironmentContext
from alembic.migration import MigrationContext
from alembic.script import ScriptDirectory
from sqlalchemy import create_engine


@dataclass
class PluginMigrationTarget:
    id: str
    directory: str
    database_name: str | None = None
    database_path: Path | None = None
    database_url: str | None = None
    current_revision: str | None = None
    head_revision: str | None = None
    runner: Callable[[], Any] | None = None
    last_error: str | None = None
    last_error_source: str | None = None

    def refresh_status(self, *, plugin_root: Path | None = None) -> None:
        if self.database_url is None or self.directory is None:
            return
        migration_dir = Path(self.directory)
        if not migration_dir.is_absolute() and plugin_root is not None:
            migration_dir = plugin_root / migration_dir
        try:
            script = ScriptDirectory.from_config(_alembic_config_for(migration_dir, self.database_url))
            heads = script.get_heads()
            if len(heads) == 1:
                self.head_revision = heads[0]
            if self.database_path is not None and not self.database_path.exists():
                self._clear_refresh_error()
                return
            engine = create_engine(self.database_url, future=True, pool_pre_ping=True)
            try:
                with engine.connect() as connection:
                    context = MigrationContext.configure(connection)
                    self.current_revision = context.get_current_revision()
            finally:
                engine.dispose()
            self._clear_refresh_error()
        except Exception as exc:
            self.last_error = str(exc)
            self.last_error_source = "refresh"

    def upgrade(self, *, plugin_root: Path | None = None) -> None:
        if self.runner is None and self.database_url is None:
            raise ValueError(f"Plugin migration target {self.id} has no database URL")
        try:
            if self.runner is not None:
                self.runner()
                self.current_revision = self.head_revision
            else:
                if self.database_url is None:
                    raise ValueError(f"Plugin migration target {self.id} has no database URL")
                migration_dir = self.migration_dir(plugin_root=plugin_root)
                config = _alembic_config_for(migration_dir, self.database_url)
                script = ScriptDirectory.from_config(config)
                if self.database_path is not None:
                    self.database_path.parent.mkdir(parents=True, exist_ok=True)
                engine = create_engine(self.database_url, future=True, pool_pre_ping=True)
                try:
                    with engine.begin() as connection:
                        def upgrade_revisions(revision: str, context: MigrationContext):
                            return script._upgrade_revs("head", revision)

                        with EnvironmentContext(config, script, fn=upgrade_revisions, destination_rev="head") as environment:
                            environment.configure(connection=connection)
                            with environment.begin_transaction():
                                environment.run_migrations()
                finally:
                    engine.dispose()
            self.last_error = None
            self.last_error_source = None
        except Exception as exc:
            self.last_error = str(exc)
            self.last_error_source = "upgrade"
            raise
        finally:
            if self.runner is None:
                self.refresh_status(plugin_root=plugin_root)

    def migration_dir(self, *, plugin_root: Path | None = None) -> Path:
        migration_dir = Path(self.directory)
        if not migration_dir.is_absolute() and plugin_root is not None:
            return plugin_root / migration_dir
        return migration_dir

    @property
    def status(self) -> str:
        if self.head_revision is None:
            return "unknown"
        if self.current_revision is None:
            return "missing"
        if self.current_revision != self.head_revision:
            return "pending"
        return "current"

    @property
    def pending(self) -> bool:
        return self.status in {"missing", "pending"}

    def health_warning(self) -> str | None:
        if self.status == "missing":
            return f"Plugin migration target {self.id} is missing: head {self.head_revision}"
        if self.status == "pending":
            return (
                f"Plugin migration target {self.id} is pending: "
                f"current {self.current_revision}, head {self.head_revision}"
            )
        return None

    def payload(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "directory": self.directory,
            "database_name": self.database_name,
            "database_path": str(self.database_path) if self.database_path else None,
            "database_url": self.database_url,
            "current_revision": self.current_revision,
            "head_revision": self.head_revision,
            "status": self.status,
            "pending": self.pending,
            "last_error": self.last_error,
        }

    def _clear_refresh_error(self) -> None:
        if self.last_error_source in {None, "refresh"}:
            self.last_error = None
            self.last_error_source = None


def normalize_migration_directory(directory: str | Path) -> str:
    return str(directory)


def _alembic_config_for(migration_dir: Path, database_url: str) -> Config:
    config = Config()
    config.set_main_option("script_location", str(migration_dir))
    config.set_main_option("path_separator", "os")
    config.set_main_option("version_locations", str(migration_dir))
    config.set_main_option("sqlalchemy.url", database_url)
    return config
