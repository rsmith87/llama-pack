from __future__ import annotations

from llama_pack.core.persistence.project_store_orm import ProjectStoreOrm
from tests.persistence_db_setup import prepare_projects_db


def _store(tmp_path) -> ProjectStoreOrm:
    db_path = tmp_path / "projects.db"
    prepare_projects_db(db_path)
    return ProjectStoreOrm(db_url=f"sqlite+pysqlite:///{db_path}")


def test_project_store_creates_lists_and_loads_project_with_node_roots(tmp_path):
    store = _store(tmp_path)

    project = store.create_project(name="Spitball", root_hint="/Users/robertsmith/Apps/llama-pack")
    root = store.upsert_node_root(
        project_id=str(project["id"]),
        node_name="mac-mini",
        root_path="/Users/robertsmith/Apps/llama-pack",
        safe_root_status="allowed",
    )

    assert project["name"] == "Spitball"
    assert project["archived"] is False
    assert root is not None
    assert root["node_name"] == "mac-mini"

    loaded = store.get_project(str(project["id"]))
    assert loaded is not None
    assert loaded["node_roots"] == [root]
    assert store.list_projects(include_archived=False)[0]["id"] == project["id"]


def test_project_store_upserts_existing_node_root(tmp_path):
    store = _store(tmp_path)
    project = store.create_project(name="Spitball", root_hint=None)

    first = store.upsert_node_root(
        project_id=str(project["id"]),
        node_name="mac-mini",
        root_path="/repo",
        safe_root_status="unknown",
    )
    second = store.upsert_node_root(
        project_id=str(project["id"]),
        node_name="mac-mini",
        root_path="/repo",
        safe_root_status="allowed",
    )

    assert first is not None
    assert second is not None
    assert second["id"] == first["id"]
    assert second["safe_root_status"] == "allowed"
    assert len(store.list_node_roots(str(project["id"])) or []) == 1


def test_project_store_hides_archived_projects_by_default(tmp_path):
    store = _store(tmp_path)
    project = store.create_project(name="Spitball", root_hint=None)

    updated = store.update_project(project_id=str(project["id"]), name="Spitball", root_hint=None, archived=True)

    assert updated is not None
    assert updated["archived"] is True
    assert store.list_projects(include_archived=False) == []
    assert store.list_projects(include_archived=True)[0]["id"] == project["id"]
