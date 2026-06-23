from __future__ import annotations

import sys
from pathlib import Path

from fastapi.testclient import TestClient

from llama_pack.core.config import load_config
from llama_pack.main import create_app
from tests.persistence_db_setup import prepare_all_persistence_dbs


PLUGIN_ROOT = Path(__file__).resolve().parents[1] / "plugins" / "llama-pack-business"


def test_external_app_key_can_create_business_clients(tmp_path: Path) -> None:
    sys.path.insert(0, str(PLUGIN_ROOT))
    log_dir = tmp_path / "logs"
    prepare_all_persistence_dbs(log_dir)
    app = create_app(
        config=load_config(
            {
                "mode": "controller",
                "log_dir": str(log_dir),
                "enabled_plugins": ["llama_pack_business"],
                "plugins": {
                    "llama_pack_business": {
                        "path": str(PLUGIN_ROOT),
                        "enabled": True,
                        "config": {"organization_name": "Acme", "license_key": "private-license"},
                    }
                },
            }
        )
    )
    created_key = app.state.auth_store.create_external_key("Campfire", "http://localhost")
    client = TestClient(app)
    client.headers.update({"X-Llama-Pack-Key": created_key["key"]})

    response = client.post(
        "/lm-api/v1/plugins/llama_pack_business/clients",
        json={"name": "Acme Manufacturing", "legal_name": "Acme Manufacturing LLC", "status": "active"},
    )

    assert response.status_code == 201
    assert response.json()["name"] == "Acme Manufacturing"


def test_external_app_key_cannot_access_non_business_plugin_routes(tmp_path: Path) -> None:
    log_dir = tmp_path / "logs"
    prepare_all_persistence_dbs(log_dir)
    app = create_app(config=load_config({"mode": "controller", "nodes": {}, "log_dir": str(log_dir)}))
    created_key = app.state.auth_store.create_external_key("Campfire", "http://localhost")
    client = TestClient(app)
    client.headers.update({"X-Llama-Pack-Key": created_key["key"]})

    response = client.get("/lm-api/v1/plugins/status")

    assert response.status_code == 403
