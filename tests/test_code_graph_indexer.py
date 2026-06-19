from __future__ import annotations

from pathlib import Path

import pytest

from llama_pack.core.code_graph.indexer import ProjectGraphIndexer, ProjectGraphIndexCanceled
from llama_pack.core.code_graph.models import ProjectGraphIndexPayload
from llama_pack.core.persistence.db_infra import sqlite_url_for_path
from llama_pack.core.persistence.project_graph_store_orm import ProjectGraphStoreOrm
from llama_pack.core.persistence.project_store_orm import ProjectStoreOrm
from tests.persistence_db_setup import prepare_projects_db


def _project(db_path: Path) -> dict[str, object]:
    store = ProjectStoreOrm(sqlite_url_for_path(db_path))
    try:
        return store.create_project(name="Llama Pack", root_hint="/repo")
    finally:
        store.close()


def test_code_graph_indexer_indexes_python_and_typescript_and_reports_progress(tmp_path):
    db_path = tmp_path / "projects.db"
    prepare_projects_db(db_path)
    project = _project(db_path)
    root = tmp_path / "repo"
    root.mkdir()
    (root / "api.py").write_text(
        "def helper():\n"
        "    return 'ok'\n"
        "def run():\n"
        "    return helper()\n",
        encoding="utf-8",
    )
    (root / "App.tsx").write_text(
        "export function Child(): JSX.Element { return <span />; }\n"
        "export function App(): JSX.Element { return <Child />; }\n",
        encoding="utf-8",
    )
    (root / "node_modules").mkdir()
    (root / "node_modules" / "ignored.ts").write_text("export function Ignored() {}\n", encoding="utf-8")
    graph_store = ProjectGraphStoreOrm(sqlite_url_for_path(db_path))
    progress_events: list[dict[str, object]] = []
    payload = ProjectGraphIndexPayload(
        project_id=str(project["id"]),
        node_name="local",
        root_path=str(root),
        include_globs=["**/*.py", "**/*.ts", "**/*.tsx"],
        overview_files=[],
        exclude_dirs=["node_modules"],
        max_file_bytes=524288,
        force=False,
    )

    result = ProjectGraphIndexer(graph_store).index(
        payload=payload,
        progress=lambda event: progress_events.append(event.model_dump()),
        is_cancel_requested=lambda: False,
    )

    assert result.status == "ready"
    assert result.file_count == 2
    assert result.symbol_count >= 4
    assert graph_store.status(str(project["id"]))["status"] == "ready"
    assert [event["phase"] for event in progress_events][:2] == ["validating_root", "discovering_files"]
    assert progress_events[-1]["phase"] == "completed"


def test_code_graph_indexer_cancellation_does_not_activate_snapshot(tmp_path):
    db_path = tmp_path / "projects.db"
    prepare_projects_db(db_path)
    project = _project(db_path)
    root = tmp_path / "repo"
    root.mkdir()
    (root / "api.py").write_text("def run():\n    return 'ok'\n", encoding="utf-8")
    graph_store = ProjectGraphStoreOrm(sqlite_url_for_path(db_path))
    payload = ProjectGraphIndexPayload(
        project_id=str(project["id"]),
        node_name="local",
        root_path=str(root),
        include_globs=["**/*.py"],
        overview_files=[],
        exclude_dirs=[],
        max_file_bytes=524288,
        force=False,
    )

    with pytest.raises(ProjectGraphIndexCanceled):
        ProjectGraphIndexer(graph_store).index(
            payload=payload,
            progress=lambda event: None,
            is_cancel_requested=lambda: True,
        )

    assert graph_store.get_active_snapshot(str(project["id"])) is None
