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


def test_project_graph_store_keeps_active_snapshots_per_node(tmp_path):
    db_path = tmp_path / "projects.db"
    prepare_projects_db(db_path)
    project = _create_project(db_path)
    store = ProjectGraphStoreOrm(sqlite_url_for_path(db_path))

    mac = store.create_snapshot(project_id=str(project["id"]), node_name="mac-mini", root_path="/repo", git_commit="a1")
    store.replace_snapshot_graph(snapshot_id=str(mac["id"]), files=[], symbols=[], imports=[], relations=[])
    store.activate_snapshot(str(mac["id"]))

    linux = store.create_snapshot(project_id=str(project["id"]), node_name="linux-2080ti", root_path="/repo", git_commit="a1")
    store.replace_snapshot_graph(snapshot_id=str(linux["id"]), files=[], symbols=[], imports=[], relations=[])
    store.activate_snapshot(str(linux["id"]))

    mac_active = store.get_active_snapshot_for_node(str(project["id"]), "mac-mini")
    linux_active = store.get_active_snapshot_for_node(str(project["id"]), "linux-2080ti")
    project_active = store.get_active_snapshot(str(project["id"]))

    assert mac_active is not None
    assert linux_active is not None
    assert project_active is not None
    assert mac_active["id"] == mac["id"]
    assert linux_active["id"] == linux["id"]
    assert project_active["id"] in {mac["id"], linux["id"]}


def test_project_graph_store_allows_same_graph_ids_on_multiple_nodes(tmp_path):
    db_path = tmp_path / "projects.db"
    prepare_projects_db(db_path)
    project = _create_project(db_path)
    store = ProjectGraphStoreOrm(sqlite_url_for_path(db_path))
    graph = {
        "files": [
            {
                "id": "file-api",
                "path": "api.py",
                "language": "python",
                "content_hash": "hash-api",
                "size_bytes": 100,
                "mtime_ns": 1,
                "parse_status": "parsed",
                "parse_error": None,
            }
        ],
        "symbols": [
            {
                "id": "sym-run",
                "file_id": "file-api",
                "qualified_name": "api.run",
                "name": "run",
                "kind": "function",
                "language": "python",
                "start_line": 1,
                "end_line": 2,
                "signature": "def run()",
                "doc_summary": None,
                "exported": True,
                "confidence": 1.0,
            }
        ],
        "imports": [],
        "relations": [
            {
                "id": "rel-run",
                "source_symbol_id": "sym-run",
                "target_symbol_id": "sym-run",
                "source_file_id": "file-api",
                "target_file_id": "file-api",
                "relation_type": "self",
                "start_line": 1,
                "end_line": 1,
                "confidence": 1.0,
                "evidence": {"text": "run"},
            }
        ],
    }

    mac = store.create_snapshot(project_id=str(project["id"]), node_name="mac-mini", root_path="/repo", git_commit="a1")
    store.replace_snapshot_graph(snapshot_id=str(mac["id"]), **graph)
    store.activate_snapshot(str(mac["id"]))

    linux = store.create_snapshot(project_id=str(project["id"]), node_name="linux-2080ti", root_path="/repo", git_commit="a1")
    store.replace_snapshot_graph(snapshot_id=str(linux["id"]), **graph)
    store.activate_snapshot(str(linux["id"]))

    assert store.get_active_snapshot_for_node(str(project["id"]), "mac-mini")["id"] == mac["id"]
    assert store.get_active_snapshot_for_node(str(project["id"]), "linux-2080ti")["id"] == linux["id"]
    assert store.find_symbols(project_id=str(project["id"]), query="run", kind=None)[0]["name"] == "run"


def test_project_graph_store_preserves_active_snapshot_when_new_snapshot_fails(tmp_path):
    db_path = tmp_path / "projects.db"
    prepare_projects_db(db_path)
    project = _create_project(db_path)
    store = ProjectGraphStoreOrm(sqlite_url_for_path(db_path))

    first = store.create_snapshot(project_id=str(project["id"]), node_name="local", root_path="/repo", git_commit="a1")
    store.replace_snapshot_graph(snapshot_id=str(first["id"]), files=[], symbols=[], imports=[], relations=[])
    store.activate_snapshot(str(first["id"]))
    failed = store.create_snapshot(project_id=str(project["id"]), node_name="local", root_path="/repo", git_commit="a2")
    failed = store.fail_snapshot(str(failed["id"]), "parse crashed")

    active = store.get_active_snapshot(str(project["id"]))
    assert active is not None
    assert active["id"] == first["id"]
    assert store.status(str(project["id"]))["status"] == "ready"


def test_project_graph_store_status_reports_latest_failed_snapshot_with_active_counts(tmp_path):
    db_path = tmp_path / "projects.db"
    prepare_projects_db(db_path)
    project = _create_project(db_path)
    store = ProjectGraphStoreOrm(sqlite_url_for_path(db_path))

    first = store.create_snapshot(project_id=str(project["id"]), node_name="local", root_path="/repo", git_commit="a1")
    store.replace_snapshot_graph(
        snapshot_id=str(first["id"]),
        files=[
            {
                "id": "file-api",
                "path": "api.py",
                "language": "python",
                "content_hash": "hash-api",
                "size_bytes": 100,
                "mtime_ns": 1,
                "parse_status": "parsed",
                "parse_error": None,
            }
        ],
        symbols=[],
        imports=[],
        relations=[],
    )
    store.activate_snapshot(str(first["id"]))
    failed = store.create_snapshot(project_id=str(project["id"]), node_name="local", root_path="/repo", git_commit="a2")
    failed = store.fail_snapshot(str(failed["id"]), "parse crashed")

    status = store.status(str(project["id"]))

    assert status["status"] == "ready"
    assert status["snapshot_id"] == first["id"]
    assert status["active_snapshot_id"] == first["id"]
    assert status["latest_snapshot_id"] == failed["id"]
    assert status["latest_status"] == "failed"
    assert status["file_count"] == 1
    assert status["symbol_count"] == 0
    assert status["relation_count"] == 0
    assert status["updated_at"] == failed["finished_at"]
    assert status["error_detail"] == "parse crashed"


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


def test_project_graph_store_replaces_prior_project_snapshot_graph_with_stable_ids(tmp_path):
    db_path = tmp_path / "projects.db"
    prepare_projects_db(db_path)
    project = _create_project(db_path)
    store = ProjectGraphStoreOrm(sqlite_url_for_path(db_path))
    graph = {
        "files": [
            {
                "id": "file-api",
                "path": "api.py",
                "language": "python",
                "content_hash": "hash-api",
                "size_bytes": 100,
                "mtime_ns": 1,
                "parse_status": "parsed",
                "parse_error": None,
            }
        ],
        "symbols": [
            {
                "id": "sym-run",
                "file_id": "file-api",
                "qualified_name": "api.run",
                "name": "run",
                "kind": "function",
                "language": "python",
                "start_line": 1,
                "end_line": 2,
                "signature": "def run()",
                "doc_summary": None,
                "exported": True,
                "confidence": 1.0,
            }
        ],
        "imports": [],
        "relations": [],
    }

    first = store.create_snapshot(project_id=str(project["id"]), node_name="local", root_path="/repo", git_commit="a1")
    store.replace_snapshot_graph(snapshot_id=str(first["id"]), **graph)
    store.activate_snapshot(str(first["id"]))
    second = store.create_snapshot(project_id=str(project["id"]), node_name="local", root_path="/repo", git_commit="a2")
    store.replace_snapshot_graph(snapshot_id=str(second["id"]), **graph)
    store.activate_snapshot(str(second["id"]))

    active = store.get_active_snapshot(str(project["id"]))
    assert active is not None
    assert active["id"] == second["id"]
    assert active["file_count"] == 1
    assert store.find_symbols(project_id=str(project["id"]), query="run", kind=None)[0]["id"] == "sym-run"


def test_project_graph_store_upserts_context_artifact_metadata(tmp_path):
    db_path = tmp_path / "projects.db"
    prepare_projects_db(db_path)
    project = _create_project(db_path)
    store = ProjectGraphStoreOrm(sqlite_url_for_path(db_path))

    first = store.upsert_context_artifact(
        project_id=str(project["id"]),
        path="packages/spitball/src/styles/app.css",
        kind="path_summary",
        title="Style context",
        content=".board { display: grid; }",
        metadata={"source": "client"},
    )
    second = store.upsert_context_artifact(
        project_id=str(project["id"]),
        path="packages/spitball/src/styles/app.css",
        kind="path_summary",
        title="Updated style context",
        content=".board { display: flex; }",
        metadata={"source": "client", "revision": "2"},
    )

    assert second["id"] == first["id"]
    assert second["title"] == "Updated style context"
    assert second["content_hash"] != first["content_hash"]
    assert second["size_bytes"] == 25
    assert second["metadata"] == {"source": "client", "revision": "2"}
    assert "content" not in second
    assert store.list_context_artifacts(str(project["id"])) == [second]


def test_project_graph_store_creates_local_project_mirror_for_remote_snapshot(tmp_path):
    db_path = tmp_path / "projects.db"
    prepare_projects_db(db_path)
    store = ProjectGraphStoreOrm(sqlite_url_for_path(db_path))

    snapshot = store.create_snapshot(project_id="controller-project-1", node_name="mac-mini", root_path="/repo", git_commit=None)

    assert snapshot["project_id"] == "controller-project-1"
    project_store = ProjectStoreOrm(sqlite_url_for_path(db_path))
    try:
        project = project_store.get_project("controller-project-1")
    finally:
        project_store.close()
    assert project is not None
    assert project["name"] == "controller-project-1"
    assert project["root_hint"] == "/repo"
