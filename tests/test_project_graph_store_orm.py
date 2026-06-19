from __future__ import annotations

from llama_pack.core.persistence.db_infra import sqlite_url_for_path
from llama_pack.core.persistence.project_graph_store_orm import ProjectGraphStoreOrm
from llama_pack.core.persistence.project_store_orm import ProjectStoreOrm
from tests.persistence_db_setup import prepare_projects_db


def _create_project(db_path):
    project_store = ProjectStoreOrm(sqlite_url_for_path(db_path))
    try:
        return project_store.create_project(name="Llama Pack", root_hint="/repo")
    finally:
        project_store.close()


def test_project_graph_store_activates_latest_ready_snapshot(tmp_path):
    db_path = tmp_path / "projects.db"
    prepare_projects_db(db_path)
    project = _create_project(db_path)
    store = ProjectGraphStoreOrm(sqlite_url_for_path(db_path))

    first = store.create_snapshot(project_id=str(project["id"]), node_name="local", root_path="/repo", git_commit="a1")
    store.replace_snapshot_graph(snapshot_id=str(first["id"]), files=[], symbols=[], imports=[], relations=[])
    store.activate_snapshot(str(first["id"]))

    second = store.create_snapshot(project_id=str(project["id"]), node_name="local", root_path="/repo", git_commit="a2")
    store.replace_snapshot_graph(snapshot_id=str(second["id"]), files=[], symbols=[], imports=[], relations=[])
    store.activate_snapshot(str(second["id"]))

    active = store.get_active_snapshot(str(project["id"]))
    assert active is not None
    assert active["id"] == second["id"]
    assert store.status(str(project["id"]))["snapshot_id"] == second["id"]


def test_project_graph_store_preserves_active_snapshot_when_new_snapshot_fails(tmp_path):
    db_path = tmp_path / "projects.db"
    prepare_projects_db(db_path)
    project = _create_project(db_path)
    store = ProjectGraphStoreOrm(sqlite_url_for_path(db_path))

    first = store.create_snapshot(project_id=str(project["id"]), node_name="local", root_path="/repo", git_commit="a1")
    store.replace_snapshot_graph(snapshot_id=str(first["id"]), files=[], symbols=[], imports=[], relations=[])
    store.activate_snapshot(str(first["id"]))
    failed = store.create_snapshot(project_id=str(project["id"]), node_name="local", root_path="/repo", git_commit="a2")
    store.fail_snapshot(str(failed["id"]), "parse crashed")

    active = store.get_active_snapshot(str(project["id"]))
    assert active is not None
    assert active["id"] == first["id"]
    assert store.status(str(project["id"]))["status"] == "ready"


def test_project_graph_store_queries_symbols_and_relations(tmp_path):
    db_path = tmp_path / "projects.db"
    prepare_projects_db(db_path)
    project = _create_project(db_path)
    store = ProjectGraphStoreOrm(sqlite_url_for_path(db_path))
    snapshot = store.create_snapshot(project_id=str(project["id"]), node_name="local", root_path="/repo", git_commit="a1")

    store.replace_snapshot_graph(
        snapshot_id=str(snapshot["id"]),
        files=[
            {
                "id": "file-api",
                "path": "llama_pack/api/routes/projects.py",
                "language": "python",
                "content_hash": "hash-api",
                "size_bytes": 100,
                "mtime_ns": 1,
                "parse_status": "parsed",
                "parse_error": None,
            }
        ],
        symbols=[
            {
                "id": "sym-route",
                "file_id": "file-api",
                "qualified_name": "llama_pack.api.routes.projects.get_project",
                "name": "get_project",
                "kind": "function",
                "language": "python",
                "start_line": 10,
                "end_line": 20,
                "signature": "def get_project(project_id: str)",
                "doc_summary": None,
                "exported": True,
                "confidence": 1.0,
            },
            {
                "id": "sym-helper",
                "file_id": "file-api",
                "qualified_name": "llama_pack.api.routes.projects._clean_optional_string",
                "name": "_clean_optional_string",
                "kind": "function",
                "language": "python",
                "start_line": 30,
                "end_line": 35,
                "signature": "def _clean_optional_string(value: str | None)",
                "doc_summary": None,
                "exported": False,
                "confidence": 1.0,
            },
        ],
        imports=[],
        relations=[
            {
                "id": "rel-call",
                "source_symbol_id": "sym-route",
                "target_symbol_id": "sym-helper",
                "source_file_id": "file-api",
                "target_file_id": "file-api",
                "relation_type": "calls_best_effort",
                "start_line": 18,
                "end_line": 18,
                "confidence": 0.7,
                "evidence": {"text": "_clean_optional_string(project_id)"},
            }
        ],
    )
    store.activate_snapshot(str(snapshot["id"]))

    symbols = store.find_symbols(project_id=str(project["id"]), query="clean", kind=None)
    assert [symbol["id"] for symbol in symbols] == ["sym-helper"]
    context = store.symbol_context(project_id=str(project["id"]), symbol_id="sym-route")
    assert context is not None
    assert context["file"]["path"] == "llama_pack/api/routes/projects.py"
    relations = store.relations(project_id=str(project["id"]), symbol_id="sym-route", relation_type="calls_best_effort", direction="out", depth=1)
    assert relations[0]["target_symbol"]["id"] == "sym-helper"
