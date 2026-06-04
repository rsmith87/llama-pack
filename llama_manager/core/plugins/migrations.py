from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path
from typing import Any


@dataclass
class PluginMigrationTarget:
    id: str
    directory: str
    database_url: str | None = None
    current_revision: str | None = None
    head_revision: str | None = None
    runner: Callable[[], Any] | None = None

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
            "database_url": self.database_url,
            "current_revision": self.current_revision,
            "head_revision": self.head_revision,
            "status": self.status,
            "pending": self.pending,
        }


def normalize_migration_directory(directory: str | Path) -> str:
    return str(directory)
