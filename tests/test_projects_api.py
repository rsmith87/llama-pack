from __future__ import annotations

import pytest

from llama_pack.core.config import load_config
from llama_pack.main import create_app
from tests.helpers import authenticated_client as TestClient
from tests.persistence_db_setup import prepare_all_persistence_dbs


@pytest.fixture(autouse=True)
def _prepare_migrated_persistence(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    prepare_all_persistence_dbs(tmp_path)
    prepare_all_persistence_dbs(tmp_path / "logs")


def _controller_app(tmp_path):
    return create_app(config=load_config({"mode": "controller", "log_dir": str(tmp_path)}))


def test_controller_can_create_list_and_load_project(tmp_path):
    app = _controller_app(tmp_path)
    with TestClient(app) as client:
        create_response = client.post(
            "/lm-api/v1/projects",
            json={"name": "Spitball", "root_hint": "/Users/robertsmith/Apps/llama-pack"},
        )
        list_response = client.get("/lm-api/v1/projects")

    assert create_response.status_code == 201
    created = create_response.json()
    assert created["name"] == "Spitball"
    assert created["root_hint"] == "/Users/robertsmith/Apps/llama-pack"
    assert created["node_roots"] == []
    assert list_response.status_code == 200
    assert list_response.json()["projects"][0]["id"] == created["id"]


def test_controller_can_upsert_project_node_root(tmp_path):
    app = _controller_app(tmp_path)
    with TestClient(app) as client:
        project = client.post("/lm-api/v1/projects", json={"name": "Spitball", "root_hint": None}).json()
        root_response = client.put(
            f"/lm-api/v1/projects/{project['id']}/node-roots",
            json={
                "node_name": "mac-mini",
                "root_path": "/Users/robertsmith/Apps/llama-pack",
                "safe_root_status": "allowed",
            },
        )
        loaded_response = client.get(f"/lm-api/v1/projects/{project['id']}")

    assert root_response.status_code == 200
    root = root_response.json()
    assert root["node_name"] == "mac-mini"
    assert root["safe_root_status"] == "allowed"
    assert loaded_response.json()["node_roots"] == [root]


def test_external_app_key_can_create_and_list_client_projects(tmp_path):
    app = _controller_app(tmp_path)
    created_key = app.state.auth_store.create_external_key("Spitball", "https://spitball.local")
    with TestClient(app) as client:
        client.headers.update({"X-Llama-Pack-Key": created_key["key"]})
        create_response = client.post("/v1/client/projects", json={"name": "Spitball", "root_hint": "/repo"})
        list_response = client.get("/v1/client/projects")

    assert create_response.status_code == 201
    assert create_response.json()["name"] == "Spitball"
    assert list_response.status_code == 200
    assert list_response.json()["projects"][0]["id"] == create_response.json()["id"]


def test_project_routes_are_controller_only(tmp_path):
    app = create_app(config=load_config({"mode": "agent", "log_dir": str(tmp_path)}))
    with TestClient(app) as client:
        response = client.get("/lm-api/v1/projects")

    assert response.status_code == 404
