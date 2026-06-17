from pathlib import Path
from unittest.mock import patch
from datetime import UTC, datetime, timedelta
from fastapi.testclient import TestClient as RawTestClient
import json
import httpx
import pytest
import ssl
from sqlalchemy import update

import time

from tests.helpers import authenticated_client as TestClient
from llama_pack.core.persistence.audit_store_orm import AuditStoreOrm
from llama_pack.core.persistence.auth_store_orm import AuthStoreOrm
from llama_pack.core.persistence.chat_session_store_orm import ChatSessionStoreOrm
from llama_pack.core.model_assets.catalog_service import ModelCatalogService
from llama_pack.core.persistence.model_asset_store_orm import ModelAssetStoreOrm
from llama_pack.core.persistence.db_infra import session_scope
from llama_pack.core.persistence.models.model_asset import ModelAssetOrm
from llama_pack.core.persistence.models.orchestration import JobOrm
from llama_pack.core.orchestration.store_orm import OrchestrationStoreOrm
from tests.persistence_db_setup import prepare_all_persistence_dbs, prepare_models_db

WORKER_HEADERS = {"X-Llama-Pack-Key": "node-secret"}


def worker_nodes(*names):
    return {
        name: {"url": f"http://{name}.example:9000", "api_key": "node-secret"}
        for name in names
    }


@pytest.fixture(autouse=True)
def _prepare_migrated_persistence(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    prepare_all_persistence_dbs(tmp_path)
    prepare_all_persistence_dbs(tmp_path / "logs")


def test_controller_background_sweeper_requeues_expired_attempt(tmp_path):
    app = create_app(
        config=load_config({"mode": "controller", "log_dir": str(tmp_path), "nodes": worker_nodes("win")})
    )
    app.state.controller_sweeper_interval_seconds = 0.05

    with TestClient(app) as client:
        job = client.post("/lm-api/v1/jobs", json={"type": "chat", "payload": {"prompt": "hi"}}).json()
        claim = client.post("/lm-api/v1/nodes/win/work/claim", json={"max_jobs": 1}, headers=WORKER_HEADERS).json()
        attempt_id = claim[0]["attempt_id"]

        app.state.orchestrator.repo.attempt_progress("win", attempt_id, {"pct": 5}, lease_seconds=-1)

        deadline = time.time() + 2.0
        while time.time() < deadline:
            refreshed = client.get(f"/lm-api/v1/jobs/{job['id']}").json()
            if refreshed["status"] == "queued":
                break
            time.sleep(0.05)

        assert refreshed["status"] == "queued"

from llama_pack.core.config import NodeConfig, load_config
from llama_pack.core.runtime.process_manager import ProcessManager
from llama_pack.main import create_app


def _catalog_config(tmp_path, **overrides):
    db_path = tmp_path / "models.db"
    prepare_models_db(db_path)
    payload = {
        "mode": "agent",
        "log_dir": str(tmp_path),
        "models_db_url": f"sqlite+pysqlite:///{db_path}",
    }
    payload.update(overrides)
    config = load_config(payload)
    store = ModelAssetStoreOrm(db_path=db_path)
    catalog = ModelCatalogService(store)
    return config, store, catalog


def _register_catalog_model(
    store: ModelAssetStoreOrm,
    *,
    model_name: str,
    path: str,
    port: int,
    prompt_template: str | None = None,
    vision: bool = False,
    mmproj_path: str | None = None,
    profiles: list[dict[str, object]] | None = None,
) -> dict[str, object]:
    asset = store.upsert_asset(
        canonical_path=path,
        filename=Path(path).name,
        display_name=model_name,
        size_bytes=10,
        asset_kind="gguf",
        source_type="manual",
    )
    mmproj_asset_id = None
    if mmproj_path is not None:
        mmproj_asset_id = store.upsert_asset(
            canonical_path=mmproj_path,
            filename=Path(mmproj_path).name,
            display_name=f"{model_name}-mmproj",
            size_bytes=4,
            asset_kind="mmproj",
            source_type="download",
        )["asset_id"]
    row = store.upsert_model(
        model_name=model_name,
        asset_id=asset["asset_id"],
        config_source="db",
        vision=vision,
        mmproj_asset_id=mmproj_asset_id,
        prompt_template=prompt_template,
    )
    store.upsert_model_deployment(
        model_id=str(row["model_id"]),
        deployment_name="default",
        node_name=None,
        host="127.0.0.1",
        port=port,
    )
    for profile in profiles or []:
        store.upsert_model_profile(
            model_id=str(row["model_id"]),
            profile_key=str(profile["profile_key"]),
            label=profile.get("label"),
            order=int(profile.get("order", 100)),
            kind=profile.get("kind"),
            ctx=profile.get("ctx"),
            gpu_layers=profile.get("gpu_layers"),
            host=profile.get("host"),
        )
        if profile.get("port") is not None:
            store.upsert_model_deployment(
                model_id=str(row["model_id"]),
                deployment_name=f"profile:{profile['profile_key']}",
                node_name=None,
                host=str(profile.get("host") or "127.0.0.1"),
                port=int(profile["port"]),
                profile_key=str(profile["profile_key"]),
            )
    return row


class StubProcessManager:
    def __init__(self, running=False):
        self.running = running

    def list_statuses(self):
        return [
            {
                "name": "qwen",
                "running": self.running,
                "pid": 123 if self.running else None,
                "port": 8081,
                "model_path": "/models/qwen.gguf",
                "log_path": "/tmp/qwen.log",
            }
        ]

    def start(self, name):
        return {
            "name": name,
            "running": True,
            "pid": 123,
            "port": 8081,
            "model_path": "/models/qwen.gguf",
            "log_path": "/tmp/qwen.log",
        }

    def stop(self, name):
        return {
            "name": name,
            "running": False,
            "pid": None,
            "port": 8081,
            "model_path": "/models/qwen.gguf",
            "log_path": "/tmp/qwen.log",
        }

    def restart(self, name):
        return self.start(name)

    def tail_logs(self, name, lines=200):
        return "hello\n"

    def status(self, name):
        return self.list_statuses()[0]


def test_models_route_reports_vision_config_for_chat_ui(tmp_path):
    config, store, catalog = _catalog_config(tmp_path)
    _register_catalog_model(
        store,
        model_name="llava",
        path="/models/llava.gguf",
        port=8081,
        vision=True,
        mmproj_path="/models/mmproj.gguf",
    )
    app = create_app(
        config=config,
        process_manager=ProcessManager(config, catalog_service=catalog),
    )
    client = TestClient(app)

    response = client.get("/lm-api/v1/models")

    assert response.status_code == 200
    [model] = response.json()
    assert model["vision"] is True
    assert model["mmproj"] == "/models/mmproj.gguf"


def test_models_route_includes_catalog_profiles_and_deployments(tmp_path):
    config, store, catalog = _catalog_config(tmp_path)
    row = _register_catalog_model(
        store,
        model_name="qwen",
        path="/models/qwen.gguf",
        port=8081,
        profiles=[
            {
                "profile_key": "fast",
                "label": "Fast",
                "order": 10,
                "kind": "interactive",
                "ctx": 8192,
                "port": 8083,
            }
        ],
    )
    store.upsert_model(
        model_name="qwen",
        asset_id=row["asset_id"],
        config_source="db",
        strengths=["coding", "vision"],
        cost_tier="medium",
    )
    app = create_app(
        config=config,
        process_manager=ProcessManager(config, catalog_service=catalog),
    )
    client = TestClient(app)

    response = client.get("/lm-api/v1/models")

    assert response.status_code == 200
    [model] = response.json()
    assert model["name"] == "qwen:fast"
    assert model["strengths"] == ["coding", "vision"]
    assert model["cost_tier"] == "medium"
    assert model["model_catalog"]["model_name"] == "qwen"
    assert model["model_profiles"][0]["profile_key"] == "fast"
    assert model["model_deployments"][0]["deployment_name"] == "default"


class StubProfileProcessManager:
    def __init__(self, statuses, active):
        self._statuses = [dict(status) for status in statuses]
        self._active = dict(active)
        self.stopped = []
        self.started = []

    def _get_model(self, name):
        if any(status.get("name") == name for status in self._statuses):
            return {"name": name}
        raise KeyError(name)

    def list_statuses(self):
        return [dict(status) for status in self._statuses]

    def active_count(self, name):
        return self._active.get(name, 0)

    def stop(self, name):
        self.stopped.append(name)
        for status in self._statuses:
            if status["name"] == name:
                status["running"] = False
                return dict(status)
        raise KeyError(name)

    def start(self, name):
        self.started.append(name)
        for status in self._statuses:
            if status["name"] == name:
                status["running"] = True
                return dict(status)
        raise KeyError(name)


class FakeProcess:
    def __init__(self, pid=1234):
        self.pid = pid
        self._returncode = None

    def poll(self):
        return self._returncode

    def terminate(self):
        self._returncode = 0

    def wait(self, timeout=None):
        return self._returncode

    def kill(self):
        self._returncode = -9


class StubConversionManager:
    def list_models(self):
        return [
            {
                "name": "hf-qwen",
                "path": "/Volumes/4TB/HFModels/hf-qwen",
                "convertible": True,
                "output_path": "/Volumes/4TB/HFModels/hf-qwen/hf-qwen.gguf",
                "gguf_exists": False,
                "gguf_files": [],
                "converter_path": "/Users/robertsmith/Apps/llama.cpp/convert_hf_to_gguf.py",
                "python_bin": "/Users/robertsmith/Apps/llama.cpp/.venv/bin/python",
                "running": False,
                "pid": None,
                "returncode": None,
                "log_path": "/tmp/hf-qwen.log",
            }
        ]

    def start(self, name):
        return {**self.list_models()[0], "running": True, "pid": 456}

    def status(self, name):
        return self.list_models()[0]

    def tail_logs(self, name, lines=200):
        return "convert log\n"


class StubGgufLibrary:
    def list_files(self, model_statuses=None):
        status = (model_statuses or [{}])[0]
        return [
            {
                "id": "abc",
                "name": "model",
                "filename": "model.gguf",
                "model_dir": "gemma",
                "path": "/Volumes/4TB/HFModels/gemma/model.gguf",
                "registered": True,
                "registered_as": "qwen",
                "running": bool(status.get("running")),
                "pid": status.get("pid"),
            }
        ]

    def add_model(
        self,
        file_id,
        name,
        port,
        ctx,
        gpu_layers,
        host,
        reasoning=None,
        reasoning_budget=None,
        prompt_template=None,
        vision=False,
        mmproj=None,
        supports_mtp=False,
        draft_model_path=None,
    ):
        return {
            "name": name,
            "path": "/Volumes/4TB/HFModels/gemma/model.gguf",
            "port": port,
            "ctx": ctx,
            "gpu_layers": gpu_layers,
            "host": host,
            "reasoning": reasoning,
            "reasoning_budget": reasoning_budget,
            "prompt_template": prompt_template,
            "vision": vision,
            "mmproj": mmproj,
            "supports_mtp": supports_mtp,
            "speculative": {
                "mode": "mtp",
                "draft_model_path": draft_model_path,
            } if supports_mtp else None,
        }

    def update_model(self, name, **kwargs):
        raise KeyError(name)

    def delete_file(self, file_id):
        return {
            "deleted": True,
            "id": file_id,
            "filename": "model.gguf",
            "path": "/Volumes/4TB/HFModels/gemma/model.gguf",
            "unregistered_models": [],
        }


class StubQuantizationManager:
    def list_files(self):
        return [
            {
                "id": "quant-abc",
                "name": "model",
                "filename": "model.gguf",
                "model_dir": "gemma",
                "path": "/Volumes/4TB/HFModels/gemma/model.gguf",
                "size_bytes": 1024,
                "size_gb": 0.0,
                "type": "Q4_K_M",
                "supported_types": ["Q4_K_M", "Q5_K_M"],
                "output_path": "/Volumes/4TB/HFModels/gemma/model-Q4_K_M.gguf",
                "existing_outputs": [],
                "quantize_bin": "/Users/robertsmith/Apps/llama.cpp/build/bin/llama-quantize",
                "running": False,
                "pid": None,
                "returncode": None,
                "log_path": "/tmp/quant-abc.log",
            }
        ]

    def start(self, file_id, quant_type):
        return {**self.list_files()[0], "id": file_id, "type": quant_type, "running": True, "pid": 789}

    def status(self, file_id):
        return {**self.list_files()[0], "id": file_id}

    def tail_logs(self, file_id, lines=200):
        return "quant log\n"


class FakeHfApi:
    def __init__(self, models=None):
        self.models = models or []

    def list_models(self, **kwargs):
        return self.models


def test_agent_model_routes():
    config = load_config(
        {
            "mode": "agent",
            "models": {
                "qwen": {
                    "path": "/models/qwen.gguf",
                    "port": 8081,
                }
            },
        }
    )
    app = create_app(
        config=config,
        process_manager=StubProcessManager(),
        conversion_manager=StubConversionManager(),
        gguf_library=StubGgufLibrary(),
    )
    client = TestClient(app)

    health = client.get("/lm-api/v1/health").json()
    assert health["mode"] == "agent"
    assert "config_source" in health
    assert client.get("/lm-api/v1/models").json()[0]["name"] == "qwen"
    assert client.post("/lm-api/v1/models/qwen/start").json()["running"] is True
    assert client.post("/lm-api/v1/models/qwen/stop").json()["running"] is False
    assert client.get("/lm-api/v1/logs/qwen").json()["text"] == "hello\n"


def test_profile_catalog_groups_local_profiles(tmp_path):
    app = create_app(
        config=load_config(
            {
                "mode": "agent",
                "log_dir": str(tmp_path),
                "models": {
                    "gemma": {
                        "path": "/models/gemma.gguf",
                        "port": 8081,
                        "ctx": 8192,
                        "gpu_layers": 10,
                        "profiles": {
                            "fast": {
                                "ctx": 8192,
                                "order": 10,
                                "kind": "interactive",
                                "kv_cache_policy": "gpu-preferred",
                                "resource_tier": "low",
                            },
                            "long": {
                                "ctx": 131072,
                                "port": 8083,
                                "order": 30,
                                "label": "Long Context",
                                "kind": "long-context",
                                "kv_cache_policy": "cpu-ok",
                                "resource_tier": "high",
                            },
                        },
                    }
                },
            }
        )
    )
    client = TestClient(app)

    response = client.get("/lm-api/v1/models/profiles")

    assert response.status_code == 200
    payload = response.json()
    assert payload["families"][0]["family"] == "gemma"
    profiles = payload["families"][0]["profiles"]
    assert [profile["profile"] for profile in profiles] == ["fast", "long"]
    assert profiles[0]["label"] == "Fast"
    assert profiles[0]["identity"] == "gemma:fast"
    assert profiles[0]["ctx"] == 8192
    assert profiles[0]["port"] == 8091
    assert profiles[0]["route"] == "local"
    assert profiles[0]["resource_tier"] == "low"
    assert profiles[1]["label"] == "Long Context"
    assert profiles[1]["ctx"] == 131072
    assert profiles[1]["port"] == 8083


def test_profile_activation_starts_requested_profile_and_stops_idle_sibling(tmp_path):
    app = create_app(
        config=load_config(
            {
                "mode": "agent",
                "log_dir": str(tmp_path),
                "models": {
                    "gemma": {
                        "path": "/models/gemma.gguf",
                        "port": 8081,
                        "profiles": {
                            "fast": {"ctx": 8192, "port": 8082},
                            "long": {"ctx": 131072, "port": 8083},
                        },
                    }
                },
            }
        )
    )
    app.state.process_manager = StubProfileProcessManager(
        statuses=[
            {"name": "gemma:fast", "family": "gemma", "profile": "fast", "running": True},
            {"name": "gemma:long", "family": "gemma", "profile": "long", "running": False},
        ],
        active={},
    )
    client = TestClient(app)

    response = client.post(
        "/lm-api/v1/models/profiles/activate",
        json={"family": "gemma", "profile": "long", "target": "local"},
    )

    assert response.status_code == 200
    assert response.json()["identity"] == "gemma:long"
    assert app.state.process_manager.stopped == ["gemma:fast"]
    assert app.state.process_manager.started == ["gemma:long"]


def test_profile_activation_refuses_to_stop_busy_sibling(tmp_path):
    app = create_app(
        config=load_config(
            {
                "mode": "agent",
                "log_dir": str(tmp_path),
                "models": {
                    "gemma": {
                        "path": "/models/gemma.gguf",
                        "port": 8081,
                        "profiles": {
                            "fast": {"ctx": 8192, "port": 8082},
                            "long": {"ctx": 131072, "port": 8083},
                        },
                    }
                },
            }
        )
    )
    app.state.process_manager = StubProfileProcessManager(
        statuses=[
            {"name": "gemma:fast", "family": "gemma", "profile": "fast", "running": True},
            {"name": "gemma:long", "family": "gemma", "profile": "long", "running": False},
        ],
        active={"gemma:fast": 1},
    )
    client = TestClient(app)

    response = client.post(
        "/lm-api/v1/models/profiles/activate",
        json={"family": "gemma", "profile": "long", "target": "local"},
    )

    assert response.status_code == 409
    assert "busy" in response.text.lower()
    assert app.state.process_manager.stopped == []
    assert app.state.process_manager.started == []


def test_controller_lists_nodes_and_proxies_model_start():
    config = load_config(
        {
            "mode": "controller",
            "node_heartbeat_timeout_seconds": 999999,
            "nodes": {"win": {"url": "http://win-agent:9000"}},
        }
    )

    async def fake_request(method, url, api_key, verify_tls):
        assert method == "POST"
        assert url == "http://win-agent:9000/lm-api/v1/models/qwen/start"
        assert api_key is None
        assert verify_tls is True
        return {"running": True, "name": "qwen"}

    app = create_app(config=config, controller_request=fake_request)
    client = TestClient(app)

    nodes = client.get("/lm-api/v1/nodes").json()
    assert nodes[0]["name"] == "win"
    assert nodes[0]["url"] == "http://win-agent:9000"
    assert "controller_config_source" in nodes[0]
    response = client.post("/lm-api/v1/nodes/win/models/qwen/start")
    assert response.status_code == 200
    assert response.json()["running"] is True


def test_controller_updates_node_and_routes_to_new_url():
    config = load_config(
        {
            "mode": "controller",
            "node_heartbeat_timeout_seconds": 999999,
            "nodes": {"win": {"url": "http://old-win:9000", "api_key": "old-key"}},
        }
    )
    seen = []

    async def fake_request(method, url, api_key, verify_tls):
        seen.append((method, url, api_key, verify_tls))
        return {"running": True, "name": "qwen"}

    app = create_app(config=config, controller_request=fake_request)
    client = TestClient(app)

    response = client.put(
        "/lm-api/v1/nodes/win",
        json={"url": "http://new-win:9000", "api_key": "new-key", "verify_tls": False},
    )

    assert response.status_code == 200
    assert response.json()["url"] == "http://new-win:9000"
    assert response.json()["verify_tls"] is False
    assert response.json()["registration"] == "static"
    assert client.get("/lm-api/v1/nodes").json()[0]["url"] == "http://new-win:9000"

    proxy = client.post("/lm-api/v1/nodes/win/models/qwen/start")
    assert proxy.status_code == 200
    assert seen == [("POST", "http://new-win:9000/lm-api/v1/models/qwen/start", "new-key", False)]


def test_controller_update_preserves_existing_node_api_key_when_blank():
    config = load_config(
        {
            "mode": "controller",
            "node_heartbeat_timeout_seconds": 999999,
            "nodes": {"pi": {"url": "http://pi.local:9000", "api_key": "node-secret", "verify_tls": True}},
        }
    )
    seen = []

    async def fake_request(method, url, api_key, verify_tls):
        seen.append((method, url, api_key, verify_tls))
        return {"running": True, "name": "qwen"}

    app = create_app(config=config, controller_request=fake_request)
    client = TestClient(app)

    response = client.put(
        "/lm-api/v1/nodes/pi",
        json={"url": "http://pi.local:9001", "api_key": "", "verify_tls": False},
    )

    assert response.status_code == 200
    proxy = client.post("/lm-api/v1/nodes/pi/models/qwen/start")
    assert proxy.status_code == 200
    assert seen == [("POST", "http://pi.local:9001/lm-api/v1/models/qwen/start", "node-secret", False)]


def test_controller_aggregates_models_from_nodes():
    config = load_config(
        {
            "mode": "controller",
            "node_heartbeat_timeout_seconds": 999999,
            "nodes": {
                "mac": {"url": "http://mac-agent:9000"},
                "win": {"url": "http://win-agent:9000"},
            },
        }
    )

    async def fake_request(method, url, api_key, verify_tls):
        if url == "http://mac-agent:9000/lm-api/v1/models":
            return [{"name": "small", "running": True}]
        if url == "http://win-agent:9000/lm-api/v1/models":
            return [{"name": "coder", "running": False}]
        if url == "http://mac-agent:9000/health":
            return {"config_source": "C:/mac-agent-config.yaml"}
        if url == "http://win-agent:9000/health":
            return {"config_source": "D:/win-agent-config.yaml"}
        raise AssertionError(url)

    app = create_app(config=config, controller_request=fake_request)
    client = TestClient(app)

    response = client.get("/lm-api/v1/nodes/models")

    assert response.status_code == 200
    payload = response.json()
    assert payload[0]["name"] == "mac"
    assert payload[0]["reachable"] is True
    assert payload[0]["agent_config_source"] == "C:/mac-agent-config.yaml"
    assert payload[0]["models_source"] == "unknown"
    assert payload[1]["name"] == "win"
    assert payload[1]["reachable"] is True
    assert payload[1]["agent_config_source"] == "D:/win-agent-config.yaml"


def test_controller_aggregates_gguf_files_from_nodes():
    config = load_config(
        {
            "mode": "controller",
            "node_heartbeat_timeout_seconds": 999999,
            "nodes": {
                "linux": {"url": "http://linux-agent:9000"},
                "mac": {"url": "http://mac-agent:9000"},
            },
        }
    )

    async def fake_request(method, url, api_key, verify_tls):
        if url == "http://linux-agent:9000/lm-api/v1/library/ggufs":
            return {
                "files": [
                    {"id": "linux-added", "filename": "added.gguf", "registered": True},
                    {"id": "linux-raw", "filename": "raw.gguf", "registered": False},
                ]
            }
        if url == "http://mac-agent:9000/lm-api/v1/library/ggufs":
            return [{"id": "mac-raw", "filename": "mac.gguf", "registered": False}]
        raise AssertionError(url)

    app = create_app(config=config, controller_request=fake_request)
    client = TestClient(app)

    response = client.get("/lm-api/v1/nodes/ggufs")

    assert response.status_code == 200
    payload = response.json()
    assert payload[0]["name"] == "linux"
    assert payload[0]["reachable"] is True
    assert [file["filename"] for file in payload[0]["files"]] == ["added.gguf", "raw.gguf"]
    assert payload[1]["name"] == "mac"
    assert payload[1]["reachable"] is True
    assert payload[1]["files"][0]["filename"] == "mac.gguf"


def test_controller_profile_catalog_groups_node_profiles():
    config = load_config(
        {
            "mode": "controller",
            "node_heartbeat_timeout_seconds": 999999,
            "nodes": {
                "mac": {"url": "http://mac-agent:9000"},
                "win": {"url": "http://win-agent:9000"},
            },
        }
    )

    async def fake_request(method, url, api_key, verify_tls):
        if url == "http://mac-agent:9000/lm-api/v1/models":
            return [
                {
                    "name": "gemma:fast",
                    "family": "gemma",
                    "profile": "fast",
                    "profile_label": "Fast",
                    "profile_order": 10,
                    "running": True,
                    "ctx": 8192,
                    "port": 8082,
                    "model_path": "/models/gemma.gguf",
                    "resource_tier": "low",
                }
            ]
        if url == "http://win-agent:9000/lm-api/v1/models":
            return [
                {
                    "name": "gemma:long",
                    "family": "gemma",
                    "profile": "long",
                    "profile_label": "Long",
                    "profile_order": 30,
                    "running": False,
                    "ctx": 131072,
                    "port": 8083,
                    "model_path": "/models/gemma.gguf",
                    "resource_tier": "high",
                }
            ]
        if url.endswith("/health"):
            return {"config_source": "agent.yaml"}
        raise AssertionError(url)

    app = create_app(config=config, controller_request=fake_request)
    client = TestClient(app)

    response = client.get("/lm-api/v1/nodes/models/profiles")

    assert response.status_code == 200
    payload = response.json()
    assert payload["families"][0]["family"] == "gemma"
    profiles = payload["families"][0]["profiles"]
    assert [profile["node"] for profile in profiles] == ["mac", "win"]
    assert [profile["profile"] for profile in profiles] == ["fast", "long"]
    assert profiles[0]["route"] == "node:mac"
    assert profiles[1]["route"] == "node:win"
    assert profiles[1]["ctx"] == 131072


def test_controller_node_models_sync_remote_deployments_into_db(tmp_path):
    config, store, catalog = _catalog_config(
        tmp_path,
        mode="controller",
        node_heartbeat_timeout_seconds=999999,
        nodes={"mac": {"url": "http://mac-agent:9000"}},
    )
    row = _register_catalog_model(
        store,
        model_name="gemma",
        path="/models/gemma.gguf",
        port=8081,
        profiles=[
            {
                "profile_key": "fast",
                "label": "Fast",
                "order": 10,
                "ctx": 8192,
            }
        ],
    )

    async def fake_request(method, url, api_key, verify_tls):
        if url == "http://mac-agent:9000/lm-api/v1/models":
            return [
                {
                    "name": "gemma:fast",
                    "family": "gemma",
                    "profile": "fast",
                    "running": True,
                    "port": 8092,
                    "model_path": "/models/gemma.gguf",
                }
            ]
        if url == "http://mac-agent:9000/health":
            return {"config_source": "agent.yaml"}
        raise AssertionError(url)

    app = create_app(config=config, controller_request=fake_request)
    app.state.model_asset_store = store
    app.state.model_catalog_service = catalog
    client = TestClient(app)

    response = client.get("/lm-api/v1/nodes/models")

    assert response.status_code == 200
    deployments = store.list_model_deployments(str(row["model_id"]))
    remote = next(item for item in deployments if item["deployment_name"] == "remote:mac:fast")
    assert remote["node_name"] == "mac"
    assert remote["profile_key"] == "fast"
    assert remote["port"] == 8092
    assert remote["host"] == "mac-agent"


def test_agent_api_key_enforcement():
    app = create_app(
        config=load_config(
            {
                "mode": "agent",
                "agent_api_key": "secret",
                "models": {"qwen": {"path": "/models/qwen.gguf", "port": 8081}},
            }
        ),
        process_manager=StubProcessManager(),
        conversion_manager=StubConversionManager(),
        gguf_library=StubGgufLibrary(),
    )
    client = RawTestClient(app)

    assert client.get("/lm-api/v1/health").status_code == 200
    assert client.get("/lm-api/v1/models").status_code == 401
    assert client.get("/lm-api/v1/models", headers={"X-Llama-Pack-Key": "secret"}).status_code == 200


def test_controller_can_register_node_and_track_heartbeat():
    app = create_app(
        config=load_config(
            {"mode": "controller", "controller_registration_key": "join-key", "nodes": {}}
        )
    )
    client = TestClient(app)

    response = client.post(
        "/lm-api/v1/nodes/register",
        json={
            "name": "win",
            "url": "http://win-agent:9000",
            "registration_key": "join-key",
        },
    )
    assert response.status_code == 200
    nodes = client.get("/lm-api/v1/nodes").json()
    assert nodes[0]["name"] == "win"
    assert nodes[0]["registration"] == "dynamic"
    assert nodes[0]["last_heartbeat"] is not None

    beat = client.post("/lm-api/v1/nodes/win/heartbeat")
    assert beat.status_code == 200


def test_in_memory_controller_config_does_not_write_node_state_to_cwd(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    app = create_app(
        config=load_config(
            {"mode": "controller", "controller_registration_key": "join-key", "nodes": {}}
        )
    )
    client = TestClient(app)

    response = client.post(
        "/lm-api/v1/nodes/register",
        json={
            "name": "win",
            "url": "http://win-agent:9000",
            "registration_key": "join-key",
        },
    )

    assert response.status_code == 200
    assert not (tmp_path / "logs" / "controller_nodes_state.json").exists()


def test_nodes_status_marks_stale_heartbeat_offline():
    app = create_app(
        config=load_config(
            {"mode": "controller", "node_heartbeat_timeout_seconds": -1, "nodes": {}}
        )
    )
    client = TestClient(app)
    client.post(
        "/lm-api/v1/nodes/register",
        json={"name": "win", "url": "http://win-agent:9000"},
    )
    status = client.get("/lm-api/v1/nodes/status")
    assert status.status_code == 200
    payload = status.json()
    assert payload[0]["reachable"] is False
    assert payload[0]["error"] == "stale heartbeat"


def test_nodes_models_marks_stale_heartbeat_offline():
    app = create_app(
        config=load_config(
            {"mode": "controller", "node_heartbeat_timeout_seconds": -1, "nodes": {}}
        )
    )
    client = TestClient(app)
    client.post(
        "/lm-api/v1/nodes/register",
        json={"name": "win", "url": "http://win-agent:9000"},
    )
    response = client.get("/lm-api/v1/nodes/models")
    assert response.status_code == 200
    payload = response.json()
    assert payload[0]["reachable"] is False
    assert payload[0]["error"] == "stale heartbeat"
    assert payload[0]["models"] == []
    assert payload[0]["agent_config_source"] is None
    assert payload[0]["models_source"] == "unknown"


def test_nodes_status_reports_upstream_http_error_classification():
    config = load_config(
        {
            "mode": "controller",
            "node_heartbeat_timeout_seconds": 999999,
            "nodes": {"win": {"url": "http://win-agent:9000"}},
        }
    )

    async def fake_request(method, url, api_key, verify_tls):
        req = httpx.Request(method, url)
        resp = httpx.Response(503, request=req, text="agent unavailable")
        raise httpx.HTTPStatusError("upstream failure", request=req, response=resp)

    app = create_app(config=config, controller_request=fake_request)
    client = TestClient(app)
    response = client.get("/lm-api/v1/nodes/status")
    assert response.status_code == 200
    payload = response.json()
    assert payload[0]["reachable"] is False
    assert payload[0]["error"] == "upstream http 503: agent unavailable"


def test_nodes_status_includes_cert_expiry_seconds(monkeypatch):
    config = load_config(
        {
            "mode": "controller",
            "node_heartbeat_timeout_seconds": -1,
            "nodes": {"win": {"url": "https://win-agent:9000"}},
        }
    )
    app = create_app(config=config)
    client = TestClient(app)

    async def fake_probe(url: str, timeout: float = 5.0):
        assert url == "https://win-agent:9000"
        return -42

    monkeypatch.setattr(
        "llama_pack.api.routes.nodes.aggregate.probe_cert_expiry_seconds",
        fake_probe,
    )

    response = client.get("/lm-api/v1/nodes/status")
    assert response.status_code == 200
    payload = response.json()
    assert payload[0]["cert_expires_in_seconds"] == -42


def test_nodes_models_reports_upstream_transport_error_classification():
    config = load_config(
        {
            "mode": "controller",
            "node_heartbeat_timeout_seconds": 999999,
            "nodes": {"win": {"url": "http://win-agent:9000"}},
        }
    )

    async def fake_request(method, url, api_key, verify_tls):
        raise httpx.ConnectError("connection refused")

    app = create_app(config=config, controller_request=fake_request)
    client = TestClient(app)
    response = client.get("/lm-api/v1/nodes/models")
    assert response.status_code == 200
    payload = response.json()
    assert payload[0]["reachable"] is False
    assert payload[0]["error"].startswith("upstream transport error:")
    assert payload[0]["models"] == []
    assert payload[0]["agent_config_source"] is None
    assert payload[0]["models_source"] == "unknown"


def test_nodes_models_includes_cert_expiry_seconds(monkeypatch):
    config = load_config(
        {
            "mode": "controller",
            "node_heartbeat_timeout_seconds": -1,
            "nodes": {"win": {"url": "https://win-agent:9000"}},
        }
    )
    app = create_app(config=config)
    client = TestClient(app)

    async def fake_probe(url: str, timeout: float = 5.0):
        assert url == "https://win-agent:9000"
        return 3600

    monkeypatch.setattr(
        "llama_pack.api.routes.nodes.aggregate.probe_cert_expiry_seconds",
        fake_probe,
    )

    response = client.get("/lm-api/v1/nodes/models")
    assert response.status_code == 200
    payload = response.json()
    assert payload[0]["cert_expires_in_seconds"] == 3600


def test_ui_index_is_served(monkeypatch, tmp_path):
    from llama_pack.api.routes import ui

    ui_dir = tmp_path / "ui"
    ui_dir.mkdir(parents=True, exist_ok=True)
    (ui_dir / "index.html").write_text("<html><body>Llama Pack</body></html>", encoding="utf-8")
    monkeypatch.setattr(ui, "UI_DIR", ui_dir)
    app = create_app(
        config=load_config({"mode": "agent"}),
        process_manager=StubProcessManager(),
        conversion_manager=StubConversionManager(),
        gguf_library=StubGgufLibrary(),
    )
    client = TestClient(app)

    response = client.get("/")

    assert response.status_code == 200
    assert "Llama Pack" in response.text


def test_conversion_routes():
    app = create_app(
        config=load_config({"mode": "agent"}),
        process_manager=StubProcessManager(),
        conversion_manager=StubConversionManager(),
        gguf_library=StubGgufLibrary(),
    )
    client = TestClient(app)

    assert client.get("/lm-api/v1/conversions/models").json()[0]["name"] == "hf-qwen"
    assert client.post("/lm-api/v1/conversions/hf-qwen/start").json()["running"] is True
    assert client.get("/lm-api/v1/conversions/hf-qwen").json()["output_path"].endswith("hf-qwen.gguf")
    assert client.get("/lm-api/v1/conversions/hf-qwen/logs").json()["text"] == "convert log\n"


def test_quantization_routes():
    app = create_app(
        config=load_config({"mode": "agent"}),
        process_manager=StubProcessManager(),
        conversion_manager=StubConversionManager(),
        gguf_library=StubGgufLibrary(),
        quantization_manager=StubQuantizationManager(),
    )
    client = TestClient(app)

    assert client.get("/lm-api/v1/quantizations/files").json()[0]["id"] == "quant-abc"
    assert client.post("/lm-api/v1/quantizations/quant-abc/start", json={"type": "Q5_K_M"}).json()["running"] is True
    assert client.get("/lm-api/v1/quantizations/quant-abc").json()["output_path"].endswith("model-Q4_K_M.gguf")
    assert client.get("/lm-api/v1/quantizations/quant-abc/logs").json()["text"] == "quant log\n"


def test_download_log_stream_route_replays_existing_log(tmp_path, monkeypatch):
    from llama_pack.api.routes import downloads as download_routes

    log_path = tmp_path / "logs" / "downloads" / "hf-qwen.log"
    log_path.parent.mkdir(parents=True)
    log_path.write_text("first\nsecond\n", encoding="utf-8")
    streamed = {}

    async def fake_stream_log_file(path, lines=200):
        streamed["path"] = path
        streamed["lines"] = lines
        yield 'event: chunk\ndata: {"text":"second\\n"}\n\n'

    monkeypatch.setattr(download_routes, "stream_log_file", fake_stream_log_file)
    app = create_app(
        config=load_config({"mode": "agent", "log_dir": str(tmp_path / "logs")}),
        process_manager=StubProcessManager(),
        conversion_manager=StubConversionManager(),
        gguf_library=StubGgufLibrary(),
    )
    record = app.state.model_download_store.create_download(
        repo_id="Qwen/Qwen2.5",
        revision=None,
        local_path=str(tmp_path / "models" / "Qwen__Qwen2.5"),
        command="hf download Qwen/Qwen2.5",
        log_path=str(log_path),
        triggered_by="test",
    )
    client = TestClient(app)

    with client.stream("GET", f"/lm-api/v1/downloads/{record['id']}/logs/stream?lines=1") as response:
        assert response.headers["content-type"].startswith("text/event-stream")
        first_event = response.read().decode()

    assert streamed == {"path": log_path, "lines": 1}
    assert 'event: chunk\ndata: {"text":"second\\n"}\n\n' in first_event


def test_download_remote_quants_route(tmp_path):
    app = create_app(
        config=load_config({"mode": "agent", "log_dir": str(tmp_path / "logs")}),
        process_manager=StubProcessManager(),
        conversion_manager=StubConversionManager(),
        gguf_library=StubGgufLibrary(),
    )
    app.state.download_manager.list_remote_quants = lambda repo_id, revision=None: [
        {"filename": "model-Q4_K_M.gguf", "path": "model-Q4_K_M.gguf", "size_bytes": 1024, "quant": "Q4_K_M"}
    ]
    client = TestClient(app)

    response = client.get("/lm-api/v1/downloads/quants?repo_id=owner/model&revision=main")

    assert response.status_code == 200
    assert response.json() == [
        {"filename": "model-Q4_K_M.gguf", "path": "model-Q4_K_M.gguf", "size_bytes": 1024, "quant": "Q4_K_M"}
    ]


def test_download_remote_quants_route_returns_preflight_error(tmp_path):
    app = create_app(
        config=load_config({"mode": "agent", "log_dir": str(tmp_path / "logs")}),
        process_manager=StubProcessManager(),
        conversion_manager=StubConversionManager(),
        gguf_library=StubGgufLibrary(),
    )

    def fail(repo_id, revision=None):
        raise ValueError("This repo requires a Hugging Face login or accepted license before download. Sign in with `hf auth login` and accept the repo terms on Hugging Face, then try again.")

    app.state.download_manager.list_remote_quants = fail
    client = TestClient(app)

    response = client.get("/lm-api/v1/downloads/quants?repo_id=owner/model&revision=main")

    assert response.status_code == 400
    assert "accepted license" in response.json()["detail"]


def test_start_download_route_returns_preflight_error(tmp_path):
    app = create_app(
        config=load_config({"mode": "agent", "log_dir": str(tmp_path / "logs")}),
        process_manager=StubProcessManager(),
        conversion_manager=StubConversionManager(),
        gguf_library=StubGgufLibrary(),
    )

    def fail(repo_id, *, triggered_by="unknown", revision=None, include_file=None, mmproj_file=None):
        raise ValueError("This repo requires a Hugging Face login or accepted license before download. Sign in with `hf auth login` and accept the repo terms on Hugging Face, then try again.")

    app.state.download_manager.start = fail
    client = TestClient(app)

    response = client.post(
        "/lm-api/v1/downloads/owner/model/start",
        json={"revision": "main", "include_file": "nested/model-Q5_K_M.gguf"},
    )

    assert response.status_code == 409
    assert "accepted license" in response.json()["detail"]


def test_start_download_route_accepts_mmproj_file(tmp_path):
    app = create_app(
        config=load_config({"mode": "agent", "log_dir": str(tmp_path / "logs")}),
        process_manager=StubProcessManager(),
        conversion_manager=StubConversionManager(),
        gguf_library=StubGgufLibrary(),
    )
    captured = {}

    def start(repo_id, *, triggered_by="unknown", revision=None, include_file=None, mmproj_file=None):
        captured.update(
            {
                "repo_id": repo_id,
                "revision": revision,
                "include_file": include_file,
                "mmproj_file": mmproj_file,
            }
        )
        return {"id": "download-1", "status": "running"}

    app.state.download_manager.start = start
    client = TestClient(app)

    response = client.post(
        "/lm-api/v1/downloads/owner/model/start",
        json={"revision": "main", "include_file": "model-Q4_K_M.gguf", "mmproj_file": "mmproj-F16.gguf"},
    )

    assert response.status_code == 200
    assert captured == {
        "repo_id": "owner/model",
        "revision": "main",
        "include_file": "model-Q4_K_M.gguf",
        "mmproj_file": "mmproj-F16.gguf",
    }


def test_settings_disks_route_reports_model_root_capacity(tmp_path):
    model_root = tmp_path / "models"
    nested = model_root / "owner__model"
    nested.mkdir(parents=True)
    (nested / "a.gguf").write_bytes(b"x" * 1024)
    (nested / "b.gguf").write_bytes(b"y" * 2048)

    app = create_app(
        config=load_config(
            {
                "mode": "agent",
                "log_dir": str(tmp_path / "logs"),
                "hf_models_dirs": [str(model_root)],
            }
        ),
        process_manager=StubProcessManager(),
        conversion_manager=StubConversionManager(),
        gguf_library=StubGgufLibrary(),
    )

    def fake_disk_usage(path):
        assert str(path).endswith("models")
        return (100_000, 40_000, 60_000)

    app.state.settings_disk_usage = fake_disk_usage
    client = TestClient(app)

    response = client.get("/lm-api/v1/settings/disks")

    assert response.status_code == 200
    assert response.json() == [
        {
            "node_name": "local",
            "path": str(model_root),
            "reachable": True,
            "total_bytes": 100_000,
            "free_bytes": 60_000,
            "used_bytes": 40_000,
            "consumed_bytes": 3072,
            "available_percent": 60.0,
            "used_percent": 40.0,
            "status": "warning",
            "warning": "Low space: less than 10 GB free headroom for model downloads.",
            "error": None,
            "headroom_bytes": 10737418240,
            "required_free_bytes": 10737418240,
        }
    ]


def test_settings_disks_route_aggregates_controller_agent_disks(tmp_path):
    config = load_config(
        {
            "mode": "controller",
            "log_dir": str(tmp_path / "logs"),
            "nodes": worker_nodes("agent-a", "agent-b"),
            "hf_models_dirs": [str(tmp_path / "controller-models")],
        }
    )

    async def fake_request(method, url, api_key, verify_tls, json_body=None):
        assert method == "GET"
        if "agent-a" in url:
            return [
                {
                    "node_name": "local",
                    "path": "/models/a",
                    "reachable": True,
                    "total_bytes": 1000,
                    "free_bytes": 500,
                    "used_bytes": 500,
                    "consumed_bytes": 200,
                    "available_percent": 50.0,
                    "used_percent": 50.0,
                    "status": "warning",
                    "warning": "Low space: less than 10 GB free headroom for model downloads.",
                    "error": None,
                    "headroom_bytes": 10737418240,
                    "required_free_bytes": 10737418240,
                }
            ]
        raise RuntimeError("agent offline")

    app = create_app(config=config, controller_request=fake_request)
    app.state.settings_disk_usage = lambda path: (20_000_000_000, 8_000_000_000, 12_000_000_000)
    client = TestClient(app)

    response = client.get("/lm-api/v1/settings/disks")

    assert response.status_code == 200
    assert response.json() == [
        {
            "node_name": "local",
            "path": str(tmp_path / "controller-models"),
            "reachable": True,
            "total_bytes": 20_000_000_000,
            "free_bytes": 12_000_000_000,
            "used_bytes": 8_000_000_000,
            "consumed_bytes": 0,
            "available_percent": 60.0,
            "used_percent": 40.0,
            "status": "ok",
            "warning": None,
            "error": None,
            "headroom_bytes": 10737418240,
            "required_free_bytes": 10737418240,
        },
        {
            "node_name": "agent-a",
            "path": "/models/a",
            "reachable": True,
            "total_bytes": 1000,
            "free_bytes": 500,
            "used_bytes": 500,
            "consumed_bytes": 200,
            "available_percent": 50.0,
            "used_percent": 50.0,
            "status": "warning",
            "warning": "Low space: less than 10 GB free headroom for model downloads.",
            "error": None,
            "headroom_bytes": 10737418240,
            "required_free_bytes": 10737418240,
        },
        {
            "node_name": "agent-b",
            "path": "",
            "reachable": False,
            "total_bytes": 0,
            "free_bytes": 0,
            "used_bytes": 0,
            "consumed_bytes": 0,
            "available_percent": 0.0,
            "used_percent": 0.0,
            "status": "error",
            "warning": None,
            "error": "agent offline",
            "headroom_bytes": 10737418240,
            "required_free_bytes": 10737418240,
        },
    ]


def test_settings_runtime_route_returns_effective_document(tmp_path):
    app = create_app(
        config=load_config(
            {
                "mode": "agent",
                "log_dir": str(tmp_path / "logs"),
                "routing_fanout_max": 3,
            }
        ),
        process_manager=StubProcessManager(),
        conversion_manager=StubConversionManager(),
        gguf_library=StubGgufLibrary(),
    )
    client = TestClient(app)

    response = client.get("/lm-api/v1/settings/runtime")

    assert response.status_code == 200
    payload = response.json()
    assert payload["settings"]["routing_fanout_max"] == 3
    assert payload["sources"]["routing_fanout_max"] == "config"


def test_settings_runtime_patch_requires_admin_ui_session(tmp_path):
    app = create_app(
        config=load_config({"mode": "agent", "log_dir": str(tmp_path / "logs")}),
        process_manager=StubProcessManager(),
        conversion_manager=StubConversionManager(),
        gguf_library=StubGgufLibrary(),
    )
    client = TestClient(app)

    response = client.patch("/lm-api/v1/settings/runtime", json={"routing_fanout_max": 4})

    assert response.status_code == 401


def test_settings_runtime_patch_persists_database_value(tmp_path):
    app = create_app(
        config=load_config({"mode": "agent", "log_dir": str(tmp_path / "logs"), "routing_fanout_max": 2}),
        process_manager=StubProcessManager(),
        conversion_manager=StubConversionManager(),
        gguf_library=StubGgufLibrary(),
    )
    app.state.ui_sessions["admin-token"] = {
        "username": "admin-user",
        "role": "admin",
    }
    client = TestClient(app)

    response = client.patch(
        "/lm-api/v1/settings/runtime",
        json={"routing_fanout_max": 5, "agent_worker_labels": {"gpu": "metal"}},
        headers={"X-UI-Session": "admin-token"},
    )
    reloaded = client.get("/lm-api/v1/settings/runtime")

    assert response.status_code == 200
    assert response.json()["settings"]["routing_fanout_max"] == 5
    assert response.json()["sources"]["routing_fanout_max"] == "database"
    assert reloaded.json()["settings"]["agent_worker_labels"] == {"gpu": "metal"}


def test_settings_runtime_patch_persists_agent_tool_controls(tmp_path):
    app = create_app(
        config=load_config(
            {
                "mode": "agent",
                "log_dir": str(tmp_path / "logs"),
                "agent_tools": {
                    "enabled": False,
                    "max_iterations": 4,
                    "tool_timeout_seconds": 10.0,
                    "safe_roots": [str(tmp_path)],
                    "tools": {},
                },
            }
        ),
        process_manager=StubProcessManager(),
        conversion_manager=StubConversionManager(),
        gguf_library=StubGgufLibrary(),
    )
    app.state.ui_sessions["admin-token"] = {"username": "admin-user", "role": "admin"}
    client = TestClient(app)

    response = client.patch(
        "/lm-api/v1/settings/runtime",
        json={
            "agent_tools_enabled": True,
            "agent_tools_max_iterations": 6,
            "agent_tools_tool_timeout_seconds": 15.5,
            "agent_tools_safe_roots": [str(tmp_path / "workspace")],
        },
        headers={"X-UI-Session": "admin-token"},
    )
    reloaded = client.get("/lm-api/v1/settings/runtime")

    assert response.status_code == 200
    assert response.json()["settings"]["agent_tools_enabled"] is True
    assert response.json()["sources"]["agent_tools_enabled"] == "database"
    assert reloaded.json()["settings"]["agent_tools_safe_roots"] == [str(tmp_path / "workspace")]


def test_settings_tool_catalog_lists_effective_agent_tools(tmp_path):
    workspace = tmp_path / "workspace"
    workspace.mkdir()
    app = create_app(
        config=load_config(
            {
                "mode": "agent",
                "log_dir": str(tmp_path / "logs"),
                "agent_tools": {
                    "enabled": True,
                    "max_iterations": 4,
                    "tool_timeout_seconds": 10.0,
                    "safe_roots": [str(workspace)],
                    "tools": {
                        "read_project_file": {
                            "type": "file_read_dynamic",
                            "description": "Read a project file.",
                            "path": str(workspace),
                        },
                        "local_health": {
                            "type": "http",
                            "description": "Check local health.",
                            "method": "GET",
                            "url": "http://127.0.0.1:9137/health",
                            "allowed_domains": ["127.0.0.1"],
                        },
                    },
                },
            }
        ),
        process_manager=StubProcessManager(),
        conversion_manager=StubConversionManager(),
        gguf_library=StubGgufLibrary(),
    )
    client = TestClient(app)

    response = client.get("/lm-api/v1/settings/tool-catalog")

    assert response.status_code == 200
    payload = response.json()
    assert payload["enabled"] is True
    assert payload["tool_count"] == 2
    assert payload["safe_roots"] == [str(workspace)]
    read_tool = next(tool for tool in payload["tools"] if tool["name"] == "read_project_file")
    assert read_tool["type"] == "file_read_dynamic"
    assert read_tool["description"] == "Read a project file."
    assert read_tool["summary"]["path"] == str(workspace)
    assert read_tool["safety"]["status"] == "ok"
    assert read_tool["parameters"]["required"] == ["path"]
    health_tool = next(tool for tool in payload["tools"] if tool["name"] == "local_health")
    assert health_tool["summary"]["url"] == "http://127.0.0.1:9137/health"
    assert health_tool["safety"]["status"] == "not_applicable"


def test_settings_tool_catalog_patch_persists_database_profile(tmp_path):
    workspace = tmp_path / "workspace"
    workspace.mkdir()
    app = create_app(
        config=load_config(
            {
                "mode": "agent",
                "log_dir": str(tmp_path / "logs"),
                "agent_tools": {
                    "enabled": True,
                    "safe_roots": [str(tmp_path)],
                    "tools": {
                        "config_status": {
                            "type": "shell",
                            "description": "Config status.",
                            "command": ["printf", "ok"],
                        }
                    },
                },
            }
        ),
        process_manager=StubProcessManager(),
        conversion_manager=StubConversionManager(),
        gguf_library=StubGgufLibrary(),
    )
    app.state.ui_sessions["admin-token"] = {"username": "admin-user", "role": "admin"}
    client = TestClient(app)

    response = client.patch(
        "/lm-api/v1/settings/tool-catalog",
        json={
            "tools": {
                "read_project_file": {
                    "type": "file_read_dynamic",
                    "description": "Read project file.",
                    "path": str(workspace),
                }
            },
            "profiles": {
                "llama_pack": {
                    "description": "Llama Pack workspace.",
                    "safe_roots": [str(workspace)],
                    "tools": ["read_project_file"],
                }
            },
            "active_profile": "llama_pack",
        },
        headers={"X-UI-Session": "admin-token"},
    )
    reloaded = client.get("/lm-api/v1/settings/tool-catalog")

    assert response.status_code == 200
    assert response.json()["active_profile"] == "llama_pack"
    assert response.json()["profiles"]["llama_pack"]["tools"] == ["read_project_file"]
    assert reloaded.json()["tool_count"] == 1
    assert reloaded.json()["tools"][0]["name"] == "read_project_file"
    assert app.state.config.agent_tools.safe_roots == [workspace]


def test_settings_tool_catalog_patch_requires_admin_ui_session(tmp_path):
    app = create_app(
        config=load_config({"mode": "agent", "log_dir": str(tmp_path / "logs")}),
        process_manager=StubProcessManager(),
        conversion_manager=StubConversionManager(),
        gguf_library=StubGgufLibrary(),
    )
    client = TestClient(app)

    response = client.patch("/lm-api/v1/settings/tool-catalog", json={"active_profile": None})

    assert response.status_code == 401


def test_settings_runtime_patch_rejects_unsupported_key(tmp_path):
    app = create_app(
        config=load_config({"mode": "agent", "log_dir": str(tmp_path / "logs")}),
        process_manager=StubProcessManager(),
        conversion_manager=StubConversionManager(),
        gguf_library=StubGgufLibrary(),
    )
    app.state.ui_sessions["admin-token"] = {"username": "admin-user", "role": "admin"}
    client = TestClient(app)

    response = client.patch(
        "/lm-api/v1/settings/runtime",
        json={"mode": "controller"},
        headers={"X-UI-Session": "admin-token"},
    )

    assert response.status_code == 422


def test_cancel_download_route_returns_updated_record(tmp_path):
    app = create_app(
        config=load_config({"mode": "agent", "log_dir": str(tmp_path / "logs")}),
        process_manager=StubProcessManager(),
        conversion_manager=StubConversionManager(),
        gguf_library=StubGgufLibrary(),
    )
    app.state.download_manager.cancel = lambda download_id: {"id": download_id, "status": "cancelled"}
    client = TestClient(app)

    response = client.post("/lm-api/v1/downloads/download-1/cancel")

    assert response.status_code == 200
    assert response.json() == {"id": "download-1", "status": "cancelled"}


def test_chat_route_requires_running_model():
    app = create_app(
        config=load_config(
            {
                "mode": "agent",
                "models": {"qwen": {"path": "/models/qwen.gguf", "port": 8081}},
            }
        ),
        process_manager=StubProcessManager(running=False),
        conversion_manager=StubConversionManager(),
        gguf_library=StubGgufLibrary(),
    )
    client = TestClient(app)

    response = client.post("/lm-api/v1/chat/qwen", json={"messages": [{"role": "user", "content": "hi"}]})

    assert response.status_code == 409


def test_chat_route_proxies_to_llama_server():
    calls = []

    async def fake_chat_request(url, payload):
        calls.append((url, payload))
        return {
            "choices": [
                {"message": {"role": "assistant", "content": "hello"}}
            ]
        }

    app = create_app(
        config=load_config(
            {
                "mode": "agent",
                "models": {"qwen": {"path": "/models/qwen.gguf", "port": 8081}},
            }
        ),
        process_manager=StubProcessManager(running=True),
        conversion_manager=StubConversionManager(),
        gguf_library=StubGgufLibrary(),
        chat_request=fake_chat_request,
    )
    client = TestClient(app)

    response = client.post(
        "/lm-api/v1/chat/qwen",
        json={
            "messages": [{"role": "user", "content": "hi"}],
            "temperature": 0.2,
            "max_tokens": 64,
        },
    )

    assert response.status_code == 200
    assert response.json()["choices"][0]["message"]["content"] == "hello"
    assert calls == [
        (
            "http://127.0.0.1:8081/v1/chat/completions",
            {
                "messages": [{"role": "user", "content": "hi"}],
                "temperature": 0.2,
                "max_tokens": 64,
                "stream": False,
                "chat_template_kwargs": {"enable_thinking": False},
            },
        )
    ]


def test_openai_compat_chat_completions_route_proxies_to_llama_server():
    calls = []

    async def fake_chat_request(url, payload):
        calls.append((url, payload))
        return {"choices": [{"message": {"role": "assistant", "content": "hello"}}]}

    app = create_app(
        config=load_config(
            {
                "mode": "agent",
                "models": {"qwen": {"path": "/models/qwen.gguf", "port": 8081}},
            }
        ),
        process_manager=StubProcessManager(running=True),
        conversion_manager=StubConversionManager(),
        gguf_library=StubGgufLibrary(),
        chat_request=fake_chat_request,
    )
    client = TestClient(app)

    response = client.post(
        "/v1/chat/completions",
        json={
            "model": "qwen",
            "messages": [{"role": "user", "content": "hi"}],
            "temperature": 0.2,
            "max_tokens": 64,
        },
    )

    assert response.status_code == 200
    assert response.json()["choices"][0]["message"]["content"] == "hello"
    assert calls == [
        (
            "http://127.0.0.1:8081/v1/chat/completions",
            {
                "messages": [{"role": "user", "content": "hi"}],
                "temperature": 0.2,
                "max_tokens": 64,
                "stream": False,
                "chat_template_kwargs": {"enable_thinking": False},
            },
        )
    ]


def test_openai_compat_agent_tool_runtime_executes_local_tool_loop(tmp_path):
    calls = []
    status = tmp_path / "status.txt"
    status.write_text("agent ok", encoding="utf-8")

    async def fake_chat_request(url, payload):
        calls.append((url, payload))
        if len(calls) == 1:
            return {
                "choices": [
                    {
                        "message": {
                            "role": "assistant",
                            "content": "",
                            "tool_calls": [
                                {
                                    "id": "call-1",
                                    "type": "function",
                                    "function": {"name": "read_status", "arguments": "{}"},
                                }
                            ],
                        }
                    }
                ]
            }
        return {"choices": [{"message": {"role": "assistant", "content": "status is agent ok"}}]}

    app = create_app(
        config=load_config(
            {
                "mode": "agent",
                "log_dir": str(tmp_path),
                "models": {"qwen": {"path": "/models/qwen.gguf", "port": 8081}},
                "agent_tools": {
                    "enabled": True,
                    "safe_roots": [str(tmp_path)],
                    "tools": {
                        "read_status": {
                            "type": "file_read",
                            "description": "Read status.",
                            "path": str(status),
                        }
                    },
                },
            }
        ),
        process_manager=StubProcessManager(running=True),
        conversion_manager=StubConversionManager(),
        gguf_library=StubGgufLibrary(),
        chat_request=fake_chat_request,
    )
    client = TestClient(app)

    response = client.post(
        "/v1/chat/completions",
        json={
            "model": "qwen",
            "messages": [{"role": "user", "content": "check status"}],
            "tool_runtime": "agent",
        },
    )

    assert response.status_code == 200
    assert response.json()["choices"][0]["message"]["content"] == "status is agent ok"
    assert calls[0][1]["tools"][0]["function"]["name"] == "read_status"
    assert calls[1][1]["messages"][-1]["role"] == "tool"
    trace = json.loads((tmp_path / "agent_tool_calls.jsonl").read_text(encoding="utf-8").strip())
    assert trace["tool_name"] == "read_status"
    assert trace["status"] == "ok"


def test_openai_compat_agent_tool_runtime_uses_chat_scheduler_admission_hooks(tmp_path):
    async def fake_chat_request(url, payload):
        return {"choices": [{"message": {"role": "assistant", "content": "should be blocked"}}]}

    app = create_app(
        config=load_config(
            {
                "mode": "agent",
                "log_dir": str(tmp_path),
                "models": {"qwen": {"path": "/models/qwen.gguf", "port": 8081}},
                "agent_tools": {"enabled": True},
            }
        ),
        process_manager=StubProcessManager(running=True),
        conversion_manager=StubConversionManager(),
        gguf_library=StubGgufLibrary(),
        chat_request=fake_chat_request,
    )
    app.state.plugin_registry.hooks.add_policy_hook(
        "test_plugin",
        "llama_pack.chat_admission",
        lambda payload: {"allowed": False, "message": "blocked by business policy"},
    )
    client = TestClient(app)

    response = client.post(
        "/v1/chat/completions",
        json={
            "model": "qwen",
            "messages": [{"role": "user", "content": "check status"}],
            "tool_runtime": "agent",
        },
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "blocked by business policy"


def test_extract_openai_sse_json_ignores_done_and_bad_json():
    from llama_pack.api.routes.compat_chat import extract_openai_sse_json

    chunk = (
        b'data: {"choices":[{"delta":{"content":"hi"}}]}\n\n'
        b"data: [DONE]\n\n"
        b"data: not-json\n\n"
    )

    payloads = extract_openai_sse_json(chunk)

    assert payloads == [{"choices": [{"delta": {"content": "hi"}}]}]


def test_stream_payload_has_tool_call_detects_delta_tool_calls():
    from llama_pack.api.routes.compat_chat import stream_payload_has_tool_call

    payload = {
        "choices": [
            {
                "delta": {
                    "tool_calls": [
                        {
                            "index": 0,
                            "id": "call-1",
                            "type": "function",
                            "function": {"name": "read_status", "arguments": "{}"},
                        }
                    ]
                }
            }
        ]
    }

    assert stream_payload_has_tool_call(payload) is True


def test_stream_payload_has_tool_call_detects_finish_reason():
    from llama_pack.api.routes.compat_chat import stream_payload_has_tool_call

    payload = {"choices": [{"delta": {}, "finish_reason": "tool_calls"}]}

    assert stream_payload_has_tool_call(payload) is True


def test_stream_payload_has_tool_call_ignores_content_only_chunks():
    from llama_pack.api.routes.compat_chat import stream_payload_has_tool_call

    payload = {"choices": [{"delta": {"content": "plain answer"}}]}

    assert stream_payload_has_tool_call(payload) is False


def test_openai_compat_agent_tool_runtime_streams_when_no_tool_call(tmp_path):
    calls = []

    async def fake_chat_stream_request(url, payload):
        calls.append((url, payload))
        yield b'data: {"choices":[{"delta":{"content":"hello"}}]}\n\n'
        yield b"data: [DONE]\n\n"

    app = create_app(
        config=load_config(
            {
                "mode": "agent",
                "log_dir": str(tmp_path),
                "models": {"qwen": {"path": "/models/qwen.gguf", "port": 8081}},
                "agent_tools": {
                    "enabled": True,
                    "safe_roots": [str(tmp_path)],
                    "tools": {
                        "read_status": {
                            "type": "file_read",
                            "description": "Read status.",
                            "path": str(tmp_path / "status.txt"),
                        }
                    },
                },
            }
        ),
        process_manager=StubProcessManager(running=True),
        conversion_manager=StubConversionManager(),
        gguf_library=StubGgufLibrary(),
        chat_stream_request=fake_chat_stream_request,
    )
    client = TestClient(app)

    with client.stream(
        "POST",
        "/v1/chat/completions",
        json={
            "model": "qwen",
            "messages": [{"role": "user", "content": "hi"}],
            "tool_runtime": "agent",
            "stream": True,
        },
    ) as response:
        body = response.read().decode("utf-8")

    assert response.status_code == 200
    assert "hello" in body
    assert "data: [DONE]" in body
    assert calls[0][1]["tools"][0]["function"]["name"] == "read_status"
    assert not (tmp_path / "agent_tool_calls.jsonl").exists()


def test_openai_compat_agent_tool_runtime_stream_reports_actual_tool_call(tmp_path):
    async def fake_chat_stream_request(url, payload):
        yield (
            b'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call-1",'
            b'"type":"function","function":{"name":"read_status","arguments":"{}"}}]}}]}\n\n'
        )

    app = create_app(
        config=load_config(
            {
                "mode": "agent",
                "log_dir": str(tmp_path),
                "models": {"qwen": {"path": "/models/qwen.gguf", "port": 8081}},
                "agent_tools": {
                    "enabled": True,
                    "safe_roots": [str(tmp_path)],
                    "tools": {
                        "read_status": {
                            "type": "file_read",
                            "description": "Read status.",
                            "path": str(tmp_path / "status.txt"),
                        }
                    },
                },
            }
        ),
        process_manager=StubProcessManager(running=True),
        conversion_manager=StubConversionManager(),
        gguf_library=StubGgufLibrary(),
        chat_stream_request=fake_chat_stream_request,
    )
    client = TestClient(app)

    with client.stream(
        "POST",
        "/v1/chat/completions",
        json={
            "model": "qwen",
            "messages": [{"role": "user", "content": "check status"}],
            "tool_runtime": "agent",
            "stream": True,
        },
    ) as response:
        body = response.read().decode("utf-8")

    assert response.status_code == 200
    assert '"type": "tool_call"' in body
    assert "streamed agent tool execution is not supported yet" in body
    assert "data: [DONE]" in body
    assert not (tmp_path / "agent_tool_calls.jsonl").exists()


def test_openai_compat_agent_tool_runtime_stream_detects_tool_call_finish_reason(tmp_path):
    async def fake_chat_stream_request(url, payload):
        yield b'data: {"choices":[{"delta":{},"finish_reason":"tool_calls"}]}\n\n'

    app = create_app(
        config=load_config(
            {
                "mode": "agent",
                "log_dir": str(tmp_path),
                "models": {"qwen": {"path": "/models/qwen.gguf", "port": 8081}},
                "agent_tools": {"enabled": True},
            }
        ),
        process_manager=StubProcessManager(running=True),
        conversion_manager=StubConversionManager(),
        gguf_library=StubGgufLibrary(),
        chat_stream_request=fake_chat_stream_request,
    )
    client = TestClient(app)

    with client.stream(
        "POST",
        "/v1/chat/completions",
        json={
            "model": "qwen",
            "messages": [{"role": "user", "content": "check status"}],
            "tool_runtime": "agent",
            "stream": True,
        },
    ) as response:
        body = response.read().decode("utf-8")

    assert response.status_code == 200
    assert '"type": "tool_call"' in body
    assert "data: [DONE]" in body


def test_openai_compat_controller_forwards_agent_tool_runtime_to_selected_agent(tmp_path):
    calls = []

    async def fake_controller_request(method, url, api_key=None, verify_tls=True, json_body=None):
        if url.endswith("/lm-api/v1/models"):
            return [{"name": "qwen", "running": True}]
        return {}

    async def fake_chat_request(url, payload):
        calls.append((url, payload))
        return {"choices": [{"message": {"role": "assistant", "content": "controller"}}]}

    app = create_app(
        config=load_config(
            {
                "mode": "controller",
                "log_dir": str(tmp_path),
                "nodes": {"linux": {"url": "http://linux", "default_model": "qwen"}},
                "agent_tools": {"enabled": True},
            }
        ),
        process_manager=StubProcessManager(running=True),
        conversion_manager=StubConversionManager(),
        gguf_library=StubGgufLibrary(),
        controller_request=fake_controller_request,
        chat_request=fake_chat_request,
    )
    client = TestClient(app)

    response = client.post(
        "/v1/chat/completions",
        json={
            "model": "qwen",
            "messages": [{"role": "user", "content": "hi"}],
            "tool_runtime": "agent",
        },
    )

    assert response.status_code == 200
    assert calls == [
        (
            "http://linux/v1/chat/completions",
            {
                "messages": [{"role": "user", "content": "hi"}],
                "temperature": 0.7,
                "max_tokens": 512,
                "stream": False,
                "chat_template_kwargs": {"enable_thinking": False},
                "tool_runtime": "agent",
                "model": "qwen",
            },
        )
    ]
    assert not (tmp_path / "agent_tool_calls.jsonl").exists()


def test_chat_stream_route_proxies_stream_to_llama_server():
    calls = []

    async def fake_chat_stream_request(url, payload):
        calls.append((url, payload))
        yield b"data: {\"choices\":[{\"delta\":{\"content\":\"hel\"}}]}\n\n"
        yield b"data: {\"choices\":[{\"delta\":{\"content\":\"lo\"}}]}\n\n"
        yield b"data: [DONE]\n\n"

    app = create_app(
        config=load_config(
            {
                "mode": "agent",
                "models": {"qwen": {"path": "/models/qwen.gguf", "port": 8081}},
            }
        ),
        process_manager=StubProcessManager(running=True),
        conversion_manager=StubConversionManager(),
        gguf_library=StubGgufLibrary(),
        chat_stream_request=fake_chat_stream_request,
    )
    client = TestClient(app)

    with client.stream(
        "POST",
        "/lm-api/v1/chat/qwen/stream",
        json={
            "messages": [{"role": "user", "content": "hi"}],
            "temperature": 0.2,
            "max_tokens": 64,
            "reasoning": True,
        },
    ) as response:
        body = response.read()

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")
    assert body == (
        b"data: {\"choices\":[{\"delta\":{\"content\":\"hel\"}}]}\n\n"
        b"data: {\"choices\":[{\"delta\":{\"content\":\"lo\"}}]}\n\n"
        b"data: [DONE]\n\n"
    )
    assert calls == [
        (
            "http://127.0.0.1:8081/v1/chat/completions",
            {
                "messages": [{"role": "user", "content": "hi"}],
                "temperature": 0.2,
                "max_tokens": 64,
                "stream": True,
                "chat_template_kwargs": {"enable_thinking": True},
            },
        )
    ]


def test_chat_stream_resolves_family_profile_before_proxying(tmp_path):
    calls = []
    spawned = []

    async def fake_chat_stream_request(url, payload):
        calls.append((url, payload))
        yield b'data: {"choices":[{"delta":{"content":"ok"}}]}\n\n'
        yield b"data: [DONE]\n\n"

    def fake_popen(command, stdout, stderr, cwd):
        spawned.append(command)
        return FakeProcess(pid=4321)

    config, store, catalog = _catalog_config(tmp_path, llama_server_bin="llama-server")
    _register_catalog_model(
        store,
        model_name="gemma",
        path="/models/gemma.gguf",
        port=8081,
        profiles=[{"profile_key": "long", "ctx": 131072, "order": 30, "port": 8083}],
    )
    manager = ProcessManager(config, catalog_service=catalog, popen=fake_popen)
    app = create_app(
        config=config,
        process_manager=manager,
        conversion_manager=StubConversionManager(),
        gguf_library=StubGgufLibrary(),
        chat_stream_request=fake_chat_stream_request,
    )
    client = TestClient(app)

    with patch.object(manager, "_find_pid_on_port", return_value=None):
        with client.stream(
            "POST",
            "/lm-api/v1/chat/gemma/stream",
            json={
                "messages": [{"role": "user", "content": "hi"}],
                "model_family": "gemma",
                "context_profile": "long",
            },
        ) as response:
            body = response.read()

    assert response.status_code == 200
    assert response.headers["X-Llama-Pack-Resolved-Model"] == "gemma:long"
    assert response.headers["X-Llama-Pack-Model-Family"] == "gemma"
    assert response.headers["X-Llama-Pack-Context-Profile"] == "long"
    assert b"ok" in body
    assert calls[0][0] == "http://127.0.0.1:8083/v1/chat/completions"
    assert spawned[0] == [
        "llama-server",
        "--model",
        "/models/gemma.gguf",
        "--host",
        "127.0.0.1",
        "--port",
        "8083",
        "--ctx-size",
        "131072",
        "--n-gpu-layers",
        "0",
    ]
    assert manager.active_count("gemma:long") == 0


def test_openai_compat_resolves_family_profile_before_proxying(tmp_path):
    calls = []
    spawned = []

    async def fake_chat_request(url, payload):
        calls.append((url, payload))
        return {"choices": [{"message": {"role": "assistant", "content": "hello"}}]}

    def fake_popen(command, stdout, stderr, cwd):
        spawned.append(command)
        return FakeProcess(pid=9876)

    config, store, catalog = _catalog_config(tmp_path, llama_server_bin="llama-server")
    _register_catalog_model(
        store,
        model_name="gemma",
        path="/models/gemma.gguf",
        port=8081,
        profiles=[{"profile_key": "long", "ctx": 131072, "order": 30, "port": 8083}],
    )
    manager = ProcessManager(config, catalog_service=catalog, popen=fake_popen)
    app = create_app(
        config=config,
        process_manager=manager,
        conversion_manager=StubConversionManager(),
        gguf_library=StubGgufLibrary(),
        chat_request=fake_chat_request,
    )
    client = TestClient(app)

    with patch.object(manager, "_find_pid_on_port", return_value=None):
        response = client.post(
            "/v1/chat/completions",
            json={
                "model": "gemma",
                "model_family": "gemma",
                "context_profile": "long",
                "messages": [{"role": "user", "content": "hi"}],
            },
        )

    assert response.status_code == 200
    assert response.headers["X-Llama-Pack-Resolved-Model"] == "gemma:long"
    assert response.headers["X-Llama-Pack-Model-Family"] == "gemma"
    assert response.headers["X-Llama-Pack-Context-Profile"] == "long"
    assert response.json()["choices"][0]["message"]["content"] == "hello"
    assert calls[0][0] == "http://127.0.0.1:8083/v1/chat/completions"
    assert spawned
    assert manager.active_count("gemma:long") == 0


def test_openai_compat_chat_completions_stream_route_proxies_to_llama_server():
    calls = []

    async def fake_chat_stream_request(url, payload):
        calls.append((url, payload))
        yield b"data: {\"choices\":[{\"delta\":{\"content\":\"hel\"}}]}\n\n"
        yield b"data: {\"choices\":[{\"delta\":{\"content\":\"lo\"}}]}\n\n"
        yield b"data: [DONE]\n\n"

    app = create_app(
        config=load_config(
            {
                "mode": "agent",
                "models": {"qwen": {"path": "/models/qwen.gguf", "port": 8081}},
            }
        ),
        process_manager=StubProcessManager(running=True),
        conversion_manager=StubConversionManager(),
        gguf_library=StubGgufLibrary(),
        chat_stream_request=fake_chat_stream_request,
    )
    client = TestClient(app)

    with client.stream(
        "POST",
        "/v1/chat/completions",
        json={
            "model": "qwen",
            "messages": [{"role": "user", "content": "hi"}],
            "temperature": 0.2,
            "max_tokens": 64,
            "reasoning": True,
            "stream": True,
        },
    ) as response:
        body = response.read()

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")
    assert body == (
        b"data: {\"choices\":[{\"delta\":{\"content\":\"hel\"}}]}\n\n"
        b"data: {\"choices\":[{\"delta\":{\"content\":\"lo\"}}]}\n\n"
        b"data: [DONE]\n\n"
    )
    assert calls == [
        (
            "http://127.0.0.1:8081/v1/chat/completions",
            {
                "messages": [{"role": "user", "content": "hi"}],
                "temperature": 0.2,
                "max_tokens": 64,
                "stream": True,
                "chat_template_kwargs": {"enable_thinking": True},
            },
        )
    ]


def test_chat_route_applies_model_prompt_template(tmp_path):
    calls = []

    async def fake_chat_request(url, payload):
        calls.append((url, payload))
        return {"choices": [{"message": {"role": "assistant", "content": "hello"}}]}

    config, store, catalog = _catalog_config(tmp_path)
    _register_catalog_model(
        store,
        model_name="qwen",
        path="/models/qwen.gguf",
        port=8081,
        prompt_template="chatml",
    )
    app = create_app(
        config=config,
        process_manager=StubProcessManager(running=True),
        conversion_manager=StubConversionManager(),
        gguf_library=StubGgufLibrary(),
        chat_request=fake_chat_request,
    )
    app.state.process_manager.catalog_service = catalog
    client = TestClient(app)

    response = client.post("/lm-api/v1/chat/qwen", json={"messages": [{"role": "user", "content": "hi"}]})
    assert response.status_code == 200
    assert calls[0][1]["chat_template"] == "chatml"


def test_chat_sessions_crud_routes(tmp_path):
    app = create_app(
        config=load_config(
            {
                "mode": "agent",
                "log_dir": str(tmp_path),
                "models": {"qwen": {"path": "/models/qwen.gguf", "port": 8081}},
            }
        ),
        process_manager=StubProcessManager(running=True),
        conversion_manager=StubConversionManager(),
        gguf_library=StubGgufLibrary(),
    )
    client = TestClient(app)

    listed = client.get("/lm-api/v1/chat/sessions")
    assert listed.status_code == 200
    assert listed.json() == []

    created = client.post(
        "/lm-api/v1/chat/sessions",
        json={
            "name": "smoke-run",
            "model": "qwen",
            "target": "auto",
            "messages": [
                {"role": "user", "content": "hello"},
                {"role": "assistant", "content": "hi"},
            ],
            "request_defaults": {
                "temperature": 0.4,
                "max_tokens": 128,
                "structured_mode": "json_schema",
                "json_schema_text": "{\"type\":\"object\"}",
                "grammar_text": "",
            },
        },
    )
    assert created.status_code == 200
    payload = created.json()
    assert payload["name"] == "smoke-run"
    assert payload["model"] == "qwen"
    assert payload["target_selector"] == "auto"
    assert len(payload["messages"]) == 2
    session_id = payload["id"]

    listed_after = client.get("/lm-api/v1/chat/sessions")
    assert listed_after.status_code == 200
    entries = listed_after.json()
    assert len(entries) == 1
    assert entries[0]["id"] == session_id
    assert entries[0]["name"] == "smoke-run"

    loaded = client.get(f"/lm-api/v1/chat/sessions/{session_id}")
    assert loaded.status_code == 200
    loaded_payload = loaded.json()
    assert loaded_payload["id"] == session_id
    assert loaded_payload["request_defaults"]["max_tokens"] == 128
    assert loaded_payload["request_defaults"]["structured_mode"] == "json_schema"
    assert loaded_payload["request_defaults"]["json_schema_text"] == "{\"type\":\"object\"}"
    assert loaded_payload["messages"][0]["content"] == "hello"

    deleted = client.delete(f"/lm-api/v1/chat/sessions/{session_id}")
    assert deleted.status_code == 200
    assert deleted.json()["deleted"] is True

    missing = client.get(f"/lm-api/v1/chat/sessions/{session_id}")
    assert missing.status_code == 404


def test_chat_sessions_post_overwrites_existing_when_id_is_provided(tmp_path):
    app = create_app(
        config=load_config(
            {
                "mode": "agent",
                "log_dir": str(tmp_path),
                "models": {"qwen": {"path": "/models/qwen.gguf", "port": 8081}},
            }
        ),
        process_manager=StubProcessManager(running=True),
        conversion_manager=StubConversionManager(),
        gguf_library=StubGgufLibrary(),
    )
    client = TestClient(app)

    created = client.post(
        "/lm-api/v1/chat/sessions",
        json={
            "name": "Obliterated-session-5-12-2026",
            "model": "qwen",
            "target": "auto",
            "messages": [{"role": "user", "content": "hello"}],
            "request_defaults": {"temperature": 0.4},
        },
    )
    assert created.status_code == 200
    session_id = created.json()["id"]

    updated = client.post(
        "/lm-api/v1/chat/sessions",
        json={
            "id": session_id,
            "name": "Obliterated-session-5-12-2026",
            "model": "qwen",
            "target": "node-a",
            "messages": [{"role": "user", "content": "hello again"}],
            "request_defaults": {"temperature": 0.1},
        },
    )
    assert updated.status_code == 200
    updated_payload = updated.json()
    assert updated_payload["id"] == session_id
    assert updated_payload["target_selector"] == "node-a"
    assert updated_payload["messages"] == [{"role": "user", "content": "hello again"}]
    assert updated_payload["request_defaults"] == {"temperature": 0.1}

    listed = client.get("/lm-api/v1/chat/sessions")
    assert listed.status_code == 200
    entries = listed.json()
    assert len(entries) == 1
    assert entries[0]["id"] == session_id


def test_chat_sessions_post_creates_new_row_when_id_is_omitted(tmp_path):
    app = create_app(
        config=load_config(
            {
                "mode": "agent",
                "log_dir": str(tmp_path),
                "models": {"qwen": {"path": "/models/qwen.gguf", "port": 8081}},
            }
        ),
        process_manager=StubProcessManager(running=True),
        conversion_manager=StubConversionManager(),
        gguf_library=StubGgufLibrary(),
    )
    client = TestClient(app)

    first = client.post(
        "/lm-api/v1/chat/sessions",
        json={
            "name": "Obliterated-session-5-12-2026",
            "model": "qwen",
            "target": "auto",
            "messages": [{"role": "user", "content": "hello"}],
            "request_defaults": {"temperature": 0.4},
        },
    )
    assert first.status_code == 200

    second = client.post(
        "/lm-api/v1/chat/sessions",
        json={
            "name": "Obliterated-session-5-12-2026",
            "model": "qwen",
            "target": "auto",
            "messages": [{"role": "user", "content": "hello"}],
            "request_defaults": {"temperature": 0.4},
        },
    )
    assert second.status_code == 200
    assert second.json()["id"] != first.json()["id"]

    listed = client.get("/lm-api/v1/chat/sessions")
    assert listed.status_code == 200
    assert len(listed.json()) == 2


def test_chat_sessions_missing_returns_404(tmp_path):
    app = create_app(
        config=load_config({"mode": "agent", "log_dir": str(tmp_path)}),
        process_manager=StubProcessManager(running=True),
        conversion_manager=StubConversionManager(),
        gguf_library=StubGgufLibrary(),
    )
    client = TestClient(app)

    response = client.delete("/lm-api/v1/chat/sessions/does-not-exist")
    assert response.status_code == 404


def test_chat_embeddings_route_proxies_to_llama_server():
    calls = []

    async def fake_chat_request(url, payload):
        calls.append((url, payload))
        return {
            "object": "list",
            "model": "qwen",
            "data": [{"object": "embedding", "index": 0, "embedding": [0.1, 0.2], "id": "emb-0"}],
            "usage": {"prompt_tokens": 3, "total_tokens": 3},
        }

    app = create_app(
        config=load_config(
            {
                "mode": "agent",
                "models": {"qwen": {"path": "/models/qwen.gguf", "port": 8081}},
            }
        ),
        process_manager=StubProcessManager(running=True),
        conversion_manager=StubConversionManager(),
        gguf_library=StubGgufLibrary(),
        chat_request=fake_chat_request,
    )
    client = TestClient(app)

    response = client.post("/lm-api/v1/chat/qwen/embeddings", json={"input": ["hello", "world"], "target": "auto"})
    assert response.status_code == 200
    assert response.json()["data"][0]["object"] == "embedding"
    assert calls == [
        (
            "http://127.0.0.1:8081/v1/embeddings",
            {"input": ["hello", "world"], "model": "qwen"},
        )
    ]


def test_chat_embeddings_route_validation_error():
    app = create_app(
        config=load_config(
            {
                "mode": "agent",
                "models": {"qwen": {"path": "/models/qwen.gguf", "port": 8081}},
            }
        ),
        process_manager=StubProcessManager(running=True),
        conversion_manager=StubConversionManager(),
        gguf_library=StubGgufLibrary(),
    )
    client = TestClient(app)

    response = client.post("/lm-api/v1/chat/qwen/embeddings", json={"target": "auto"})
    assert response.status_code == 422


def test_controller_chat_route_proxies_to_node_chat_route():
    controller_calls = []
    chat_calls = []

    async def fake_controller_request(method, url, api_key, verify_tls):
        controller_calls.append((method, url, api_key, verify_tls))
        if url == "http://win-agent:9000/lm-api/v1/models":
            return [{"name": "qwen", "running": True}]
        raise AssertionError(url)

    async def fake_chat_request(url, payload):
        chat_calls.append((url, payload))
        return {"choices": [{"message": {"role": "assistant", "content": "hello"}}]}

    app = create_app(
        config=load_config(
            {
                "mode": "controller",
                "nodes": {"win": {"url": "http://win-agent:9000"}},
            }
        ),
        controller_request=fake_controller_request,
        chat_request=fake_chat_request,
    )
    client = TestClient(app)

    response = client.post(
        "/lm-api/v1/chat/qwen",
        json={"messages": [{"role": "user", "content": "hi"}]},
    )

    assert response.status_code == 200
    assert response.json()["choices"][0]["message"]["content"] == "hello"
    assert controller_calls == [("GET", "http://win-agent:9000/lm-api/v1/models", None, True)]
    assert chat_calls == [
        (
            "http://win-agent:9000/lm-api/v1/chat/qwen",
            {
                "messages": [{"role": "user", "content": "hi"}],
                "temperature": 0.7,
                "max_tokens": 512,
                "stream": False,
                "chat_template_kwargs": {"enable_thinking": False},
            },
        )
    ]


def test_controller_chat_stream_route_proxies_to_node_chat_stream_route():
    controller_calls = []
    chat_calls = []

    async def fake_controller_request(method, url, api_key, verify_tls):
        controller_calls.append((method, url, api_key, verify_tls))
        if url == "http://win-agent:9000/lm-api/v1/models":
            return [{"name": "qwen", "running": True}]
        raise AssertionError(url)

    async def fake_chat_stream_request(url, payload):
        chat_calls.append((url, payload))
        yield b"data: {\"choices\":[{\"delta\":{\"content\":\"ok\"}}]}\n\n"
        yield b"data: [DONE]\n\n"

    app = create_app(
        config=load_config(
            {
                "mode": "controller",
                "nodes": {"win": {"url": "http://win-agent:9000"}},
            }
        ),
        controller_request=fake_controller_request,
        chat_stream_request=fake_chat_stream_request,
    )
    client = TestClient(app)

    with client.stream(
        "POST",
        "/lm-api/v1/chat/qwen/stream",
        json={"messages": [{"role": "user", "content": "hi"}], "reasoning": True},
    ) as response:
        body = response.read()

    assert response.status_code == 200
    assert body == b"data: {\"choices\":[{\"delta\":{\"content\":\"ok\"}}]}\n\ndata: [DONE]\n\n"
    assert controller_calls == [("GET", "http://win-agent:9000/lm-api/v1/models", None, True)]
    assert chat_calls == [
        (
            "http://win-agent:9000/lm-api/v1/chat/qwen/stream",
            {
                "messages": [{"role": "user", "content": "hi"}],
                "temperature": 0.7,
                "max_tokens": 512,
                "stream": True,
                "chat_template_kwargs": {"enable_thinking": True},
            },
        )
    ]


def test_controller_chat_route_uses_local_running_model_when_available():
    controller_calls = []
    chat_calls = []

    async def fake_controller_request(method, url, api_key, verify_tls):
        controller_calls.append((method, url, api_key, verify_tls))
        if url == "http://win-agent:9000/lm-api/v1/models":
            return [{"name": "qwen", "running": True}]
        raise AssertionError(url)

    async def fake_chat_request(url, payload):
        chat_calls.append((url, payload))
        return {"choices": [{"message": {"role": "assistant", "content": "local"}}]}

    app = create_app(
        config=load_config(
            {
                "mode": "controller",
                "models": {"qwen": {"path": "/models/qwen.gguf", "port": 8089}},
                "nodes": {"win": {"url": "http://win-agent:9000"}},
            }
        ),
        process_manager=StubProcessManager(running=True),
        controller_request=fake_controller_request,
        chat_request=fake_chat_request,
    )
    client = TestClient(app)

    response = client.post(
        "/lm-api/v1/chat/qwen",
        json={"messages": [{"role": "user", "content": "hi"}]},
    )

    assert response.status_code == 200
    assert response.json()["choices"][0]["message"]["content"] == "local"
    assert controller_calls == []
    assert chat_calls == [
        (
            "http://127.0.0.1:8081/v1/chat/completions",
            {
                "messages": [{"role": "user", "content": "hi"}],
                "temperature": 0.7,
                "max_tokens": 512,
                "stream": False,
                "chat_template_kwargs": {"enable_thinking": False},
            },
        )
    ]


def test_chat_route_supports_advanced_sampling_and_n_predict_alias():
    calls = []

    async def fake_chat_request(url, payload):
        calls.append((url, payload))
        return {"choices": [{"message": {"role": "assistant", "content": "ok"}}]}

    app = create_app(
        config=load_config(
            {"mode": "agent", "models": {"qwen": {"path": "/models/qwen.gguf", "port": 8081}}}
        ),
        process_manager=StubProcessManager(running=True),
        conversion_manager=StubConversionManager(),
        gguf_library=StubGgufLibrary(),
        chat_request=fake_chat_request,
    )
    client = TestClient(app)

    response = client.post(
        "/lm-api/v1/chat/qwen",
        json={
            "messages": [{"role": "user", "content": "hi"}],
            "n_predict": 77,
            "top_p": 0.95,
            "top_k": 50,
            "min_p": 0.05,
            "repeat_penalty": 1.15,
            "seed": 123,
            "stop": ["</s>", "User:"],
        },
    )
    assert response.status_code == 200
    forwarded = calls[0][1]
    assert forwarded["max_tokens"] == 77
    assert forwarded["top_p"] == 0.95
    assert forwarded["top_k"] == 50
    assert forwarded["min_p"] == 0.05
    assert forwarded["repeat_penalty"] == 1.15
    assert forwarded["seed"] == 123
    assert forwarded["stop"] == ["</s>", "User:"]


def test_chat_route_supports_structured_output_json_schema_and_grammar():
    calls = []

    async def fake_chat_request(url, payload):
        calls.append((url, payload))
        return {"choices": [{"message": {"role": "assistant", "content": "ok"}}]}

    app = create_app(
        config=load_config(
            {"mode": "agent", "models": {"qwen": {"path": "/models/qwen.gguf", "port": 8081}}}
        ),
        process_manager=StubProcessManager(running=True),
        conversion_manager=StubConversionManager(),
        gguf_library=StubGgufLibrary(),
        chat_request=fake_chat_request,
    )
    client = TestClient(app)

    response_schema = client.post(
        "/lm-api/v1/chat/qwen",
        json={
            "messages": [{"role": "user", "content": "hi"}],
            "json_schema": {"type": "object", "properties": {"answer": {"type": "string"}}},
        },
    )
    assert response_schema.status_code == 200
    assert calls[-1][1]["json_schema"]["type"] == "object"
    assert "grammar" not in calls[-1][1]

    response_grammar = client.post(
        "/lm-api/v1/chat/qwen",
        json={
            "messages": [{"role": "user", "content": "hi"}],
            "grammar": "root ::= \"yes\" | \"no\"",
        },
    )
    assert response_grammar.status_code == 200
    assert calls[-1][1]["grammar"] == "root ::= \"yes\" | \"no\""
    assert "json_schema" not in calls[-1][1]


def test_chat_route_supports_multimodal_message_content_blocks():
    calls = []

    async def fake_chat_request(url, payload):
        calls.append((url, payload))
        return {"choices": [{"message": {"role": "assistant", "content": "ok"}}]}

    app = create_app(
        config=load_config(
            {"mode": "agent", "models": {"qwen": {"path": "/models/qwen.gguf", "port": 8081}}}
        ),
        process_manager=StubProcessManager(running=True),
        conversion_manager=StubConversionManager(),
        gguf_library=StubGgufLibrary(),
        chat_request=fake_chat_request,
    )
    client = TestClient(app)

    response = client.post(
        "/lm-api/v1/chat/qwen",
        json={
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": "describe this"},
                        {
                            "type": "image_url",
                            "image_url": {"url": "data:image/png;base64,AAAA"},
                        },
                    ],
                }
            ]
        },
    )
    assert response.status_code == 200
    forwarded = calls[0][1]["messages"][0]["content"]
    assert isinstance(forwarded, list)
    assert forwarded[0]["type"] == "text"
    assert forwarded[1]["type"] == "image_url"


def test_chat_route_rejects_invalid_advanced_sampling_values():
    app = create_app(
        config=load_config(
            {"mode": "agent", "models": {"qwen": {"path": "/models/qwen.gguf", "port": 8081}}}
        ),
        process_manager=StubProcessManager(running=True),
        conversion_manager=StubConversionManager(),
        gguf_library=StubGgufLibrary(),
    )
    client = TestClient(app)

    response = client.post(
        "/lm-api/v1/chat/qwen",
        json={"messages": [{"role": "user", "content": "hi"}], "top_p": 1.5},
    )
    assert response.status_code == 422
    response_structured = client.post(
        "/lm-api/v1/chat/qwen",
        json={
            "messages": [{"role": "user", "content": "hi"}],
            "json_schema": {"type": "object"},
            "grammar": "root ::= \"yes\"",
        },
    )
    assert response_structured.status_code == 422


def test_chat_route_normalizes_stop_string_to_list():
    calls = []

    async def fake_chat_request(url, payload):
        calls.append((url, payload))
        return {"choices": [{"message": {"role": "assistant", "content": "ok"}}]}

    app = create_app(
        config=load_config(
            {"mode": "agent", "models": {"qwen": {"path": "/models/qwen.gguf", "port": 8081}}}
        ),
        process_manager=StubProcessManager(running=True),
        conversion_manager=StubConversionManager(),
        gguf_library=StubGgufLibrary(),
        chat_request=fake_chat_request,
    )
    client = TestClient(app)
    response = client.post(
        "/lm-api/v1/chat/qwen",
        json={
            "messages": [{"role": "user", "content": "hi"}],
            "stop": "</s>, User: ,",
        },
    )
    assert response.status_code == 200
    assert calls[0][1]["stop"] == ["</s>", "User:"]


def test_chat_route_normalizes_stop_list_and_drops_empty_entries():
    calls = []

    async def fake_chat_request(url, payload):
        calls.append((url, payload))
        return {"choices": [{"message": {"role": "assistant", "content": "ok"}}]}

    app = create_app(
        config=load_config(
            {"mode": "agent", "models": {"qwen": {"path": "/models/qwen.gguf", "port": 8081}}}
        ),
        process_manager=StubProcessManager(running=True),
        conversion_manager=StubConversionManager(),
        gguf_library=StubGgufLibrary(),
        chat_request=fake_chat_request,
    )
    client = TestClient(app)
    response = client.post(
        "/lm-api/v1/chat/qwen",
        json={
            "messages": [{"role": "user", "content": "hi"}],
            "stop": ["</s>", "", "   ", "User:"],
        },
    )
    assert response.status_code == 200
    assert calls[0][1]["stop"] == ["</s>", "User:"]


def test_chat_capabilities_route():
    app = create_app(
        config=load_config(
            {"mode": "agent", "models": {"qwen": {"path": "/models/qwen.gguf", "port": 8081}}}
        ),
        process_manager=StubProcessManager(running=True),
        conversion_manager=StubConversionManager(),
        gguf_library=StubGgufLibrary(),
    )
    client = TestClient(app)

    response = client.get("/lm-api/v1/chat/capabilities/qwen")
    assert response.status_code == 200
    payload = response.json()
    assert payload["model"] == "qwen"
    assert payload["supports"]["sampling"]["top_p"] is True
    assert payload["supports"]["structured_output"]["json_schema"] is False
    assert payload["supports"]["structured_output"]["grammar"] is False
    assert payload["supports"]["structured_output_source"]["json_schema"] == "default"
    assert payload["supports"]["structured_output_source"]["grammar"] == "default"


def test_chat_capabilities_reports_vision_support_from_model_config(tmp_path):
    config, store, catalog = _catalog_config(tmp_path)
    _register_catalog_model(
        store,
        model_name="gemma-4-e2b-it",
        path="/models/gemma.gguf",
        port=8081,
        vision=True,
        mmproj_path="/models/mmproj.gguf",
    )
    app = create_app(
        config=config,
        process_manager=StubProcessManager(running=True),
        conversion_manager=StubConversionManager(),
        gguf_library=StubGgufLibrary(),
    )
    app.state.process_manager.catalog_service = catalog
    client = TestClient(app)
    response = client.get("/lm-api/v1/chat/capabilities/gemma-4-e2b-it")
    assert response.status_code == 200
    assert response.json()["supports"]["vision"] is True


def test_chat_capabilities_reports_structured_output_support_from_config(tmp_path):
    config, store, catalog = _catalog_config(tmp_path)
    row = _register_catalog_model(store, model_name="qwen", path="/models/qwen.gguf", port=8081)
    store.upsert_model(
        model_name="qwen",
        asset_id=row["asset_id"],
        config_source="db",
        supports_json_schema=True,
        supports_grammar=False,
    )
    app = create_app(
        config=config,
        process_manager=StubProcessManager(running=True),
        conversion_manager=StubConversionManager(),
        gguf_library=StubGgufLibrary(),
    )
    app.state.process_manager.catalog_service = catalog
    client = TestClient(app)
    payload = client.get("/lm-api/v1/chat/capabilities/qwen").json()
    assert payload["supports"]["structured_output"]["json_schema"] is True
    assert payload["supports"]["structured_output"]["grammar"] is False
    assert payload["supports"]["structured_output_source"]["json_schema"] == "config_flag"
    assert payload["supports"]["structured_output_source"]["grammar"] == "config_flag"


def test_chat_capabilities_inferrs_structured_output_support_from_extra_args(tmp_path):
    config, store, catalog = _catalog_config(tmp_path)
    row = _register_catalog_model(store, model_name="qwen", path="/models/qwen.gguf", port=8081)
    store.upsert_model(
        model_name="qwen",
        asset_id=row["asset_id"],
        config_source="db",
        extra_args=["--grammar-file", "/tmp/g.gbnf", "--json-schema"],
    )
    app = create_app(
        config=config,
        process_manager=StubProcessManager(running=True),
        conversion_manager=StubConversionManager(),
        gguf_library=StubGgufLibrary(),
    )
    app.state.process_manager.catalog_service = catalog
    client = TestClient(app)
    payload = client.get("/lm-api/v1/chat/capabilities/qwen").json()
    assert payload["supports"]["structured_output"]["json_schema"] is True
    assert payload["supports"]["structured_output"]["grammar"] is True
    assert payload["supports"]["structured_output_source"]["json_schema"] == "extra_args"
    assert payload["supports"]["structured_output_source"]["grammar"] == "extra_args"


def test_controller_chat_route_falls_back_to_remote_when_local_not_running():
    controller_calls = []
    chat_calls = []

    async def fake_controller_request(method, url, api_key, verify_tls):
        controller_calls.append((method, url, api_key, verify_tls))
        if url == "http://win-agent:9000/lm-api/v1/models":
            return [{"name": "qwen", "running": True}]
        raise AssertionError(url)

    async def fake_chat_request(url, payload):
        chat_calls.append((url, payload))
        return {"choices": [{"message": {"role": "assistant", "content": "remote"}}]}

    app = create_app(
        config=load_config(
            {
                "mode": "controller",
                "models": {"qwen": {"path": "/models/qwen.gguf", "port": 8089}},
                "nodes": {"win": {"url": "http://win-agent:9000"}},
            }
        ),
        process_manager=StubProcessManager(running=False),
        controller_request=fake_controller_request,
        chat_request=fake_chat_request,
    )
    client = TestClient(app)

    response = client.post(
        "/lm-api/v1/chat/qwen",
        json={"messages": [{"role": "user", "content": "hi"}]},
    )

    assert response.status_code == 200
    assert response.json()["choices"][0]["message"]["content"] == "remote"
    assert controller_calls == [("GET", "http://win-agent:9000/lm-api/v1/models", None, True)]
    assert chat_calls == [
        (
            "http://win-agent:9000/lm-api/v1/chat/qwen",
            {
                "messages": [{"role": "user", "content": "hi"}],
                "temperature": 0.7,
                "max_tokens": 512,
                "stream": False,
                "chat_template_kwargs": {"enable_thinking": False},
            },
        )
    ]


def test_controller_chat_route_can_force_local_target():
    controller_calls = []
    chat_calls = []

    async def fake_controller_request(method, url, api_key, verify_tls):
        controller_calls.append((method, url, api_key, verify_tls))
        return [{"name": "qwen", "running": True}]

    async def fake_chat_request(url, payload):
        chat_calls.append((url, payload))
        return {"choices": [{"message": {"role": "assistant", "content": "local"}}]}

    app = create_app(
        config=load_config(
            {
                "mode": "controller",
                "models": {"qwen": {"path": "/models/qwen.gguf", "port": 8089}},
                "nodes": {"win": {"url": "http://win-agent:9000"}},
            }
        ),
        process_manager=StubProcessManager(running=True),
        controller_request=fake_controller_request,
        chat_request=fake_chat_request,
    )
    client = TestClient(app)

    response = client.post(
        "/lm-api/v1/chat/qwen",
        json={"messages": [{"role": "user", "content": "hi"}], "target": "local"},
    )

    assert response.status_code == 200
    assert response.json()["choices"][0]["message"]["content"] == "local"
    assert controller_calls == []
    assert chat_calls[0][0] == "http://127.0.0.1:8081/v1/chat/completions"


def test_controller_chat_route_can_force_named_node_target():
    controller_calls = []
    chat_calls = []

    async def fake_controller_request(method, url, api_key, verify_tls):
        controller_calls.append((method, url, api_key, verify_tls))
        if url == "http://win-agent:9000/lm-api/v1/models":
            return [{"name": "qwen", "running": True}]
        raise AssertionError(url)

    async def fake_chat_request(url, payload):
        chat_calls.append((url, payload))
        return {"choices": [{"message": {"role": "assistant", "content": "remote"}}]}

    app = create_app(
        config=load_config(
            {
                "mode": "controller",
                "models": {"qwen": {"path": "/models/qwen.gguf", "port": 8089}},
                "nodes": {"win": {"url": "http://win-agent:9000"}},
            }
        ),
        process_manager=StubProcessManager(running=False),
        controller_request=fake_controller_request,
        chat_request=fake_chat_request,
    )
    client = TestClient(app)

    response = client.post(
        "/lm-api/v1/chat/qwen",
        json={"messages": [{"role": "user", "content": "hi"}], "target": "node:win"},
    )

    assert response.status_code == 200
    assert response.json()["choices"][0]["message"]["content"] == "remote"
    assert controller_calls == [("GET", "http://win-agent:9000/lm-api/v1/models", None, True)]
    assert chat_calls[0][0] == "http://win-agent:9000/lm-api/v1/chat/qwen"


def test_controller_chat_route_uses_persisted_remote_deployment_when_live_models_are_empty(tmp_path):
    prepare_all_persistence_dbs(tmp_path)
    controller_calls = []
    chat_calls = []

    async def fake_controller_request(method, url, api_key, verify_tls):
        controller_calls.append((method, url, api_key, verify_tls))
        if url == "http://win-agent:9000/lm-api/v1/models":
            return []
        raise AssertionError(url)

    async def fake_chat_request(url, payload):
        chat_calls.append((url, payload))
        return {"choices": [{"message": {"role": "assistant", "content": "remote"}}]}

    app = create_app(
        config=load_config(
            {
                "mode": "controller",
                "log_dir": str(tmp_path),
                "nodes": {"win": {"url": "http://win-agent:9000"}},
            }
        ),
        process_manager=StubProcessManager(running=False),
        controller_request=fake_controller_request,
        chat_request=fake_chat_request,
    )
    store = app.state.model_asset_store
    asset = store.upsert_asset(
        canonical_path="/models/qwen.gguf",
        filename="qwen.gguf",
        display_name="qwen",
        size_bytes=10,
        asset_kind="gguf",
        source_type="manual",
    )
    model = store.upsert_model(
        model_name="qwen",
        asset_id=asset["asset_id"],
        config_source="db",
        ctx=8192,
    )
    store.upsert_model_deployment(
        model_id=str(model["model_id"]),
        deployment_name="remote:win:default",
        node_name="win",
        host="win-agent",
        port=9000,
        profile_key=None,
        enabled=True,
    )

    client = TestClient(app)
    response = client.post(
        "/lm-api/v1/chat/qwen",
        json={"messages": [{"role": "user", "content": "hi"}]},
    )

    assert response.status_code == 200
    assert response.json()["choices"][0]["message"]["content"] == "remote"
    assert controller_calls == [("GET", "http://win-agent:9000/lm-api/v1/models", None, True)]
    assert chat_calls[0][0] == "http://win-agent:9000/lm-api/v1/chat/qwen"


def test_controller_chat_route_rejects_unknown_target_selector():
    app = create_app(
        config=load_config(
            {
                "mode": "controller",
                "nodes": {"win": {"url": "http://win-agent:9000"}},
            }
        ),
        process_manager=StubProcessManager(running=False),
    )
    client = TestClient(app)

    response = client.post(
        "/lm-api/v1/chat/qwen",
        json={"messages": [{"role": "user", "content": "hi"}], "target": "node:missing"},
    )
    assert response.status_code == 409
    assert "Unknown controller node: missing" in response.json()["detail"]

def test_gguf_library_routes():
    app = create_app(
        config=load_config({"mode": "agent"}),
        process_manager=StubProcessManager(),
        conversion_manager=StubConversionManager(),
        gguf_library=StubGgufLibrary(),
    )
    client = TestClient(app)

    gguf = client.get("/lm-api/v1/library/ggufs").json()[0]
    assert gguf["filename"] == "model.gguf"
    assert gguf["running"] is False
    assert gguf["pid"] is None
    response = client.post(
        "/lm-api/v1/library/ggufs/abc/add-model",
        json={
            "name": "gemma-local",
            "port": 8088,
            "ctx": 8192,
            "gpu_layers": 999,
            "host": "0.0.0.0",
            "reasoning": "auto",
            "reasoning_budget": 2048,
            "prompt_template": "gemma",
        },
    )
    assert response.status_code == 200
    assert response.json()["name"] == "gemma-local"
    assert response.json()["reasoning"] == "auto"
    assert response.json()["reasoning_budget"] == 2048
    assert response.json()["prompt_template"] == "gemma"

    deleted = client.delete("/lm-api/v1/library/ggufs/abc")
    assert deleted.status_code == 200
    assert deleted.json()["deleted"] is True
    assert deleted.json()["filename"] == "model.gguf"


def test_gguf_library_route_passes_running_model_status():
    app = create_app(
        config=load_config({"mode": "agent"}),
        process_manager=StubProcessManager(running=True),
        conversion_manager=StubConversionManager(),
        gguf_library=StubGgufLibrary(),
    )
    client = TestClient(app)

    gguf = client.get("/lm-api/v1/library/ggufs").json()[0]

    assert gguf["registered_as"] == "qwen"
    assert gguf["running"] is True
    assert gguf["pid"] == 123


def test_gguf_library_add_model_route_persists_model_asset_link(tmp_path):
    hf_dir = tmp_path / "HFModels"
    model_dir = hf_dir / "gemma"
    model_dir.mkdir(parents=True)
    gguf_path = model_dir / "model.gguf"
    gguf_path.write_text("", encoding="utf-8")
    prepare_all_persistence_dbs(tmp_path)
    app = create_app(
        config=load_config(
            {
                "mode": "agent",
                "hf_models_dir": str(hf_dir),
                "log_dir": str(tmp_path / "logs"),
            }
        )
    )
    client = TestClient(app)

    gguf = client.get("/lm-api/v1/library/ggufs").json()[0]
    response = client.post(
        f"/lm-api/v1/library/ggufs/{gguf['id']}/add-model",
        json={
            "name": "gemma-local",
            "port": 8088,
            "ctx": 8192,
            "gpu_layers": 999,
            "host": "0.0.0.0",
        },
    )

    assert response.status_code == 200
    models = app.state.model_asset_store.list_models()
    assert models[0]["model_name"] == "gemma-local"
    assert models[0]["asset_id"] == gguf["asset_id"]


def test_gguf_library_reclassification_persists_and_reads_back(tmp_path):
    hf_dir = tmp_path / "HFModels"
    model_dir = hf_dir / "gemma"
    model_dir.mkdir(parents=True)
    gguf_path = model_dir / "model.gguf"
    gguf_path.write_text("", encoding="utf-8")
    prepare_all_persistence_dbs(tmp_path)
    app = create_app(
        config=load_config(
            {
                "mode": "agent",
                "hf_models_dir": str(hf_dir),
                "log_dir": str(tmp_path / "logs"),
            }
        )
    )
    client = TestClient(app)

    gguf = client.get("/lm-api/v1/library/ggufs").json()[0]
    response = client.patch(
        f"/lm-api/v1/library/ggufs/{gguf['asset_id']}",
        json={"model_line": "Reasoning"},
    )

    assert response.status_code == 200
    assert response.json()["asset_id"] == gguf["asset_id"]
    assert response.json()["model_line"] == "Reasoning"

    reread = client.get("/lm-api/v1/library/ggufs").json()[0]
    assert reread["asset_id"] == gguf["asset_id"]
    assert reread["model_line"] == "Reasoning"


def test_gguf_library_lists_db_backed_catalog_profiles_and_deployments(tmp_path):
    hf_dir = tmp_path / "HFModels"
    model_dir = hf_dir / "qwen"
    model_dir.mkdir(parents=True)
    gguf_path = model_dir / "model.gguf"
    gguf_path.write_text("", encoding="utf-8")
    prepare_all_persistence_dbs(tmp_path)
    app = create_app(
        config=load_config(
            {
                "mode": "agent",
                "hf_models_dir": str(hf_dir),
                "log_dir": str(tmp_path / "logs"),
            }
        )
    )
    client = TestClient(app)

    gguf = client.get("/lm-api/v1/library/ggufs").json()[0]
    added = client.post(
        f"/lm-api/v1/library/ggufs/{gguf['id']}/add-model",
        json={
            "name": "gemma-local",
            "port": 8088,
            "ctx": 8192,
            "gpu_layers": 999,
            "host": "0.0.0.0",
        },
    )
    assert added.status_code == 200

    reread = client.get("/lm-api/v1/library/ggufs").json()[0]
    assert reread["model_catalog"]["model_name"] == "gemma-local"
    assert reread["model_catalog"]["ctx"] == 8192
    assert reread["model_catalog"]["gpu_layers"] == 999
    assert reread["model_profiles"][0]["profile_key"] == "default"
    assert reread["model_profiles"][0]["label"] == "Default"
    assert reread["model_deployments"][0]["deployment_name"] == "default"
    assert reread["model_deployments"][0]["host"] == "0.0.0.0"
    assert reread["model_deployments"][0]["port"] == 8088


def test_model_favorite_toggle_sorts_models_first(tmp_path):
    config_path = tmp_path / "config.yaml"
    config_path.write_text(
        """
mode: agent
log_dir: {log_dir}
models:
  qwen:
    path: /models/qwen.gguf
    port: 8081
  gemma:
    path: /models/gemma.gguf
    port: 8082
""".format(log_dir=tmp_path / "logs"),
        encoding="utf-8",
    )
    app = create_app(config=load_config(config_path))
    client = TestClient(app)

    favorited = client.post("/lm-api/v1/models/gemma/favorite", json={"favorite": True})
    assert favorited.status_code == 200
    assert favorited.json()["favorite"] is True

    models = client.get("/lm-api/v1/models").json()
    assert [model["name"] for model in models] == ["gemma", "qwen"]
    assert models[0]["favorite"] is True

    persisted = app.state.model_asset_store.get_model_by_name("gemma")
    assert persisted is not None
    assert persisted["favorite"] is True


def test_library_remove_model_hides_it_from_models():
    app = create_app(
        config=load_config(
            {
                "mode": "agent",
                "models": {"qwen": {"path": "/models/qwen.gguf", "port": 8081}},
            }
        )
    )
    client = TestClient(app)

    initial_models = client.get("/lm-api/v1/models").json()
    assert any(item["name"] == "qwen" for item in initial_models)

    removed = client.delete("/lm-api/v1/library/models/qwen")
    assert removed.status_code == 200
    assert removed.json()["removed"] is True
    assert removed.json()["name"] == "qwen"

    remaining = client.get("/lm-api/v1/models").json()
    assert all(item["name"] != "qwen" for item in remaining)


def test_library_remove_model_returns_404_for_unknown():
    app = create_app(
        config=load_config({"mode": "agent"})
    )
    client = TestClient(app)

    response = client.delete("/lm-api/v1/library/models/not-a-model")
    assert response.status_code == 404


def test_library_patch_model_updates_mmproj_and_vision():
    app = create_app(
        config=load_config(
            {
                "mode": "agent",
                "models": {"llava": {"path": "/models/llava.gguf", "port": 8082}},
            }
        )
    )
    client = TestClient(app)

    resp = client.patch("/lm-api/v1/library/models/llava", json={"vision": True, "mmproj": "/models/llava-mmproj.gguf"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "llava"
    assert data["vision"] is True
    assert data["mmproj"] == "/models/llava-mmproj.gguf"


def test_library_add_model_accepts_mtp_settings():
    app = create_app(
        config=load_config({"mode": "agent", "hf_models_dir": "/models"}),
        gguf_library=StubGgufLibrary(),
    )
    captured = {}

    def add_model(file_id, **kwargs):
        captured["file_id"] = file_id
        captured.update(kwargs)
        return {"name": kwargs["name"], "supports_mtp": kwargs["supports_mtp"], "speculative": {"mode": "mtp", "draft_model_path": kwargs["draft_model_path"]}}

    app.state.gguf_library.add_model = add_model
    client = TestClient(app)

    resp = client.post(
        "/lm-api/v1/library/ggufs/abc/add-model",
        json={
            "name": "gemma-qat",
            "port": 8080,
            "ctx": 8192,
            "gpu_layers": 999,
            "host": "127.0.0.1",
            "supports_mtp": True,
            "draft_model_path": "/models/mtp-gemma-qat.gguf",
        },
    )

    assert resp.status_code == 200
    assert captured["file_id"] == "abc"
    assert captured["supports_mtp"] is True
    assert captured["draft_model_path"] == "/models/mtp-gemma-qat.gguf"


def test_library_patch_model_updates_mtp_settings():
    app = create_app(
        config=load_config(
            {
                "mode": "agent",
                "models": {"gemma": {"path": "/models/gemma.gguf", "port": 8082}},
            }
        )
    )
    client = TestClient(app)

    resp = client.patch("/lm-api/v1/library/models/gemma", json={"supports_mtp": True, "draft_model_path": "/models/mtp-gemma.gguf"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["supports_mtp"] is True
    assert data["speculative"]["mode"] == "mtp"
    assert data["speculative"]["draft_model_path"] == "/models/mtp-gemma.gguf"


def test_library_patch_model_returns_404_for_unknown():
    app = create_app(
        config=load_config({"mode": "agent"})
    )
    client = TestClient(app)

    resp = client.patch("/lm-api/v1/library/models/no-such-model", json={"vision": True})
    assert resp.status_code == 404


def test_library_catalog_models_lists_persisted_models_from_db(tmp_path):
    config, store, catalog = _catalog_config(tmp_path)
    _register_catalog_model(store, model_name="vision-pro", path="/models/vision-pro.gguf", port=8083, vision=True)
    _register_catalog_model(store, model_name="qwen-7b", path="/models/qwen.gguf", port=8081)
    app = create_app(config=config)
    app.state.model_asset_store = store
    app.state.model_catalog_service = catalog
    client = TestClient(app)

    resp = client.get("/lm-api/v1/library/catalog/models")

    assert resp.status_code == 200
    payload = resp.json()
    assert [item["model_name"] for item in payload] == ["qwen-7b", "vision-pro"]
    assert payload[1]["vision"] is True
    assert all(item["config_source"] == "db" for item in payload)


def test_library_assets_filters_by_repo_download_and_model_line(tmp_path):
    config, store, catalog = _catalog_config(tmp_path)
    keep = store.upsert_asset(
        canonical_path="/models/gemma.gguf",
        filename="gemma.gguf",
        display_name="Gemma",
        size_bytes=100,
        asset_kind="gguf",
        source_type="download",
        source_repo_id="hf/gemma",
        download_id="download-1",
        model_line="gemma",
    )
    store.upsert_asset(
        canonical_path="/models/qwen.gguf",
        filename="qwen.gguf",
        display_name="Qwen",
        size_bytes=120,
        asset_kind="gguf",
        source_type="download",
        source_repo_id="hf/qwen",
        download_id="download-2",
        model_line="qwen",
    )
    app = create_app(config=config)
    app.state.model_asset_store = store
    app.state.model_catalog_service = catalog
    client = TestClient(app)

    resp = client.get(
        "/lm-api/v1/library/assets",
        params={"source_repo_id": "hf/gemma", "download_id": "download-1", "model_line": "gemma"},
    )

    assert resp.status_code == 200
    payload = resp.json()
    assert len(payload) == 1
    assert payload[0]["asset_id"] == keep["asset_id"]
    assert payload[0]["source_repo_id"] == "hf/gemma"


def test_library_profiles_and_deployments_are_queryable_independently(tmp_path):
    config, store, catalog = _catalog_config(tmp_path)
    row = _register_catalog_model(
        store,
        model_name="gemma",
        path="/models/gemma.gguf",
        port=8081,
        profiles=[
            {
                "profile_key": "fast",
                "label": "Fast",
                "order": 10,
                "ctx": 8192,
            }
        ],
    )
    store.upsert_model_deployment(
        model_id=str(row["model_id"]),
        deployment_name="worker-a",
        node_name="node-a",
        host="10.0.0.8",
        port=8091,
        profile_key="fast",
    )
    app = create_app(config=config)
    app.state.model_asset_store = store
    app.state.model_catalog_service = catalog
    client = TestClient(app)

    profiles = client.get("/lm-api/v1/library/profiles", params={"model_name": "gemma"})
    deployments = client.get("/lm-api/v1/library/deployments", params={"model_name": "gemma"})

    assert profiles.status_code == 200
    assert deployments.status_code == 200
    assert [item["profile_key"] for item in profiles.json()] == ["fast"]
    deployment_names = [item["deployment_name"] for item in deployments.json()]
    assert deployment_names == ["default", "worker-a"]
    assert deployments.json()[1]["node_name"] == "node-a"


def test_library_asset_provenance_lists_db_records(tmp_path):
    config, store, catalog = _catalog_config(tmp_path)
    source = store.upsert_asset(
        canonical_path="/models/gemma.gguf",
        filename="gemma.gguf",
        display_name="Gemma",
        size_bytes=100,
        asset_kind="gguf",
        source_type="download",
    )
    output = store.upsert_asset(
        canonical_path="/models/gemma-q4.gguf",
        filename="gemma-q4.gguf",
        display_name="Gemma Q4",
        size_bytes=80,
        asset_kind="gguf",
        source_type="quantization",
    )
    model = store.upsert_model(
        model_name="gemma",
        asset_id=source["asset_id"],
        config_source="db",
    )
    store.record_asset_provenance(
        output_asset_id=output["asset_id"],
        source_asset_id=source["asset_id"],
        source_model_id=model["model_id"],
        job_kind="quantization",
        job_ref="quant:gemma:Q4_K_M",
        detail={"quant_type": "Q4_K_M"},
    )
    app = create_app(config=config)
    app.state.model_asset_store = store
    app.state.model_catalog_service = catalog
    client = TestClient(app)

    resp = client.get(f"/lm-api/v1/library/assets/{output['asset_id']}/provenance")

    assert resp.status_code == 200
    payload = resp.json()
    assert len(payload) == 1
    assert payload[0]["job_kind"] == "quantization"
    assert payload[0]["detail"]["quant_type"] == "Q4_K_M"


def test_library_assets_lists_missing_assets_with_filter(tmp_path):
    config, store, catalog = _catalog_config(tmp_path)
    keep = store.upsert_asset(
        canonical_path="/models/missing.gguf",
        filename="missing.gguf",
        display_name="Missing",
        size_bytes=100,
        asset_kind="gguf",
        source_type="download",
    )
    store.mark_missing_assets(missing_asset_ids={keep["asset_id"]})
    app = create_app(config=config)
    app.state.model_asset_store = store
    app.state.model_catalog_service = catalog
    client = TestClient(app)

    resp = client.get("/lm-api/v1/library/assets", params={"missing": "true"})

    assert resp.status_code == 200
    payload = resp.json()
    assert len(payload) == 1
    assert payload[0]["asset_id"] == keep["asset_id"]
    assert payload[0]["missing"] is True


def test_library_delete_stale_missing_assets_skips_referenced_rows(tmp_path):
    config, store, catalog = _catalog_config(tmp_path)
    deletable = store.upsert_asset(
        canonical_path="/models/stale.gguf",
        filename="stale.gguf",
        display_name="Stale",
        size_bytes=100,
        asset_kind="gguf",
        source_type="download",
    )
    referenced = store.upsert_asset(
        canonical_path="/models/referenced.gguf",
        filename="referenced.gguf",
        display_name="Referenced",
        size_bytes=100,
        asset_kind="gguf",
        source_type="download",
    )
    store.upsert_model(model_name="referenced", asset_id=referenced["asset_id"], config_source="db")
    store.mark_missing_assets(missing_asset_ids={deletable["asset_id"], referenced["asset_id"]})
    stale_time = (datetime.now(UTC) - timedelta(days=14)).isoformat()
    with session_scope(store.session_factory) as session:
        session.execute(
            update(ModelAssetOrm)
            .where(ModelAssetOrm.asset_id.in_([deletable["asset_id"], referenced["asset_id"]]))
            .values(last_seen_at=stale_time, last_scanned_at=stale_time)
        )
    app = create_app(config=config)
    app.state.model_asset_store = store
    app.state.model_catalog_service = catalog
    client = TestClient(app)

    resp = client.delete("/lm-api/v1/library/assets/missing", params={"older_than_days": 7})

    assert resp.status_code == 200
    payload = resp.json()
    assert payload["deleted_asset_ids"] == [deletable["asset_id"]]
    assert payload["skipped_asset_ids"] == [referenced["asset_id"]]
    assert store.get_asset_by_path("/models/stale.gguf") is None
    assert store.get_asset_by_path("/models/referenced.gguf") is not None


def test_controller_job_lifecycle_and_events(tmp_path):
    app = create_app(
        config=load_config({
            "mode": "controller",
            "log_dir": str(tmp_path),
            "nodes": {}
        })
    )
    client = TestClient(app)

    create = client.post("/lm-api/v1/jobs", json={"type": "chat", "payload": {"prompt": "hi"}})
    assert create.status_code == 201


def test_controller_job_failure_and_retry(tmp_path):
    app = create_app(
        config=load_config({
            "mode": "controller",
            "log_dir": str(tmp_path),
            "nodes": worker_nodes("win")
        })
    )
    client = TestClient(app)

    job = client.post("/lm-api/v1/jobs", json={"type": "chat", "payload": {"prompt": "hi"}}).json()
    claim = client.post("/lm-api/v1/nodes/win/work/claim", json={"max_jobs": 1}, headers=WORKER_HEADERS).json()
    attempt_id = claim[0]["attempt_id"]

    fail = client.post(
        f"/lm-api/v1/nodes/win/work/{attempt_id}/fail",
        json={"error_code": "E_TMP", "retryable": True},
        headers=WORKER_HEADERS,
    )
    assert fail.status_code == 200
    assert fail.json()["status"] == "queued"

    claim2 = client.post("/lm-api/v1/nodes/win/work/claim", json={"max_jobs": 1}, headers=WORKER_HEADERS).json()
    assert len(claim2) == 1

    events = client.get(f"/lm-api/v1/jobs/{job['id']}/events").json()
    assert any(e["event_type"] == "retry_scheduled" for e in events)


def test_sweeper_requeues_expired_attempt(tmp_path):
    app = create_app(
        config=load_config({"mode": "controller", "log_dir": str(tmp_path), "nodes": worker_nodes("win")})
    )
    client = TestClient(app)

    job = client.post("/lm-api/v1/jobs", json={"type": "chat", "payload": {"prompt": "hi"}}).json()
    claim = client.post("/lm-api/v1/nodes/win/work/claim", json={"max_jobs": 1}, headers=WORKER_HEADERS).json()
    attempt_id = claim[0]["attempt_id"]

    orch = app.state.orchestrator
    orch.repo.attempt_progress("win", attempt_id, {"pct": 10}, lease_seconds=-1)
    sweep = orch.sweep_expired_leases()
    assert sweep["expired"] >= 1
    assert sweep["requeued"] >= 1

    refreshed = client.get(f"/lm-api/v1/jobs/{job['id']}").json()
    assert refreshed["status"] == "queued"


def test_sweeper_times_out_after_max_attempts(tmp_path):
    app = create_app(
        config=load_config({"mode": "controller", "log_dir": str(tmp_path), "nodes": worker_nodes("win")})
    )
    client = TestClient(app)

    job = client.post("/lm-api/v1/jobs", json={"type": "chat", "payload": {"prompt": "hi"}}).json()
    orch = app.state.orchestrator

    for _ in range(3):
        claim = client.post("/lm-api/v1/nodes/win/work/claim", json={"max_jobs": 1}, headers=WORKER_HEADERS).json()
        attempt_id = claim[0]["attempt_id"]
        orch.repo.attempt_progress("win", attempt_id, {"pct": 10}, lease_seconds=-1)
        orch.sweep_expired_leases()

    refreshed = client.get(f"/lm-api/v1/jobs/{job['id']}").json()
    assert refreshed["status"] == "timed_out"


def test_sweeper_prunes_old_terminal_jobs(tmp_path):
    app = create_app(
        config=load_config({
            "mode": "controller",
            "log_dir": str(tmp_path),
            "nodes": worker_nodes("win"),
            "controller_retention_days": 0,
        })
    )
    client = TestClient(app)

    job = client.post("/lm-api/v1/jobs", json={"type": "chat", "payload": {"prompt": "hi"}}).json()
    claim = client.post("/lm-api/v1/nodes/win/work/claim", json={"max_jobs": 1}, headers=WORKER_HEADERS).json()
    attempt_id = claim[0]["attempt_id"]
    client.post(f"/lm-api/v1/nodes/win/work/{attempt_id}/complete", json={"result": {"ok": True}}, headers=WORKER_HEADERS)

    app.state.orchestrator.sweep_expired_leases()

    gone = client.get(f"/lm-api/v1/jobs/{job['id']}")
    assert gone.status_code == 404


def test_controller_stats_endpoint_reports_sweep_and_counts(tmp_path):
    app = create_app(
        config=load_config({"mode": "controller", "log_dir": str(tmp_path), "nodes": {}})
    )
    client = TestClient(app)

    client.post("/lm-api/v1/jobs", json={"type": "chat", "payload": {"prompt": "hi"}})
    app.state.orchestrator.sweep_expired_leases()

    response = client.get("/lm-api/v1/controller/stats")
    assert response.status_code == 200
    payload = response.json()
    assert "job_counts" in payload
    assert "last_sweep" in payload
    assert payload["retention_days"] == 30


def test_node_work_requires_node_api_key_when_configured(tmp_path):
    app = create_app(
        config=load_config({
            "mode": "controller",
            "log_dir": str(tmp_path),
            "nodes": {"win": {"url": "http://win-agent:9000", "api_key": "node-secret"}},
        })
    )
    client = TestClient(app)

    client.post("/lm-api/v1/jobs", json={"type": "chat", "payload": {"prompt": "hi"}})
    unauthorized = client.post("/lm-api/v1/nodes/win/work/claim", json={"max_jobs": 1})
    assert unauthorized.status_code == 401

    authorized = client.post(
        "/lm-api/v1/nodes/win/work/claim",
        json={"max_jobs": 1},
        headers={"X-Llama-Pack-Key": "node-secret"},
    )
    assert authorized.status_code == 200


def test_node_work_cancellation_check_uses_node_api_key(tmp_path):
    app = create_app(
        config=load_config({
            "mode": "controller",
            "log_dir": str(tmp_path),
            "nodes": {"win": {"url": "http://win-agent:9000", "api_key": "node-secret"}},
        })
    )
    client = TestClient(app)

    job = client.post("/lm-api/v1/jobs", json={"type": "chat", "payload": {"prompt": "hi"}}).json()
    client.post("/lm-api/v1/nodes/win/work/claim", json={"max_jobs": 1}, headers=WORKER_HEADERS)
    client.post(f"/lm-api/v1/jobs/{job['id']}/cancel")

    unauthorized = client.get(f"/lm-api/v1/nodes/win/work/jobs/{job['id']}/cancellation")
    assert unauthorized.status_code == 401

    authorized = client.get(
        f"/lm-api/v1/nodes/win/work/jobs/{job['id']}/cancellation",
        headers={"X-Llama-Pack-Key": "node-secret"},
    )
    assert authorized.status_code == 200
    assert authorized.json() == {"id": job["id"], "cancellation_requested": True}


def test_node_work_rejects_unknown_node(tmp_path):
    app = create_app(
        config=load_config({
            "mode": "controller",
            "log_dir": str(tmp_path),
            "nodes": worker_nodes("win"),
        })
    )
    client = TestClient(app)

    client.post("/lm-api/v1/jobs", json={"type": "chat", "payload": {"prompt": "hi"}})
    response = client.post(
        "/lm-api/v1/nodes/evil/work/claim",
        json={"max_jobs": 1},
        headers=WORKER_HEADERS,
    )

    assert response.status_code == 404


def test_node_work_rejects_registered_node_without_api_key(tmp_path):
    app = create_app(
        config=load_config({
            "mode": "controller",
            "log_dir": str(tmp_path),
            "nodes": {"win": {"url": "http://win-agent:9000"}},
        })
    )
    client = TestClient(app)

    client.post("/lm-api/v1/jobs", json={"type": "chat", "payload": {"prompt": "hi"}})
    response = client.post(
        "/lm-api/v1/nodes/win/work/claim",
        json={"max_jobs": 1},
        headers=WORKER_HEADERS,
    )

    assert response.status_code == 401


def test_job_complete_persists_artifacts_and_lists_them(tmp_path):
    app = create_app(
        config=load_config({"mode": "controller", "log_dir": str(tmp_path), "nodes": worker_nodes("win")})
    )
    client = TestClient(app)

    job = client.post("/lm-api/v1/jobs", json={"type": "chat", "payload": {"prompt": "hi"}}).json()
    claim = client.post("/lm-api/v1/nodes/win/work/claim", json={"max_jobs": 1}, headers=WORKER_HEADERS).json()
    attempt_id = claim[0]["attempt_id"]

    complete = client.post(
        f"/lm-api/v1/nodes/win/work/{attempt_id}/complete",
        json={
            "result": {"text": "done"},
            "artifacts": [
                {"kind": "log", "uri": "s3://bucket/run.log", "meta": {"bytes": 123}},
                {"kind": "trace", "uri": "file:///tmp/trace.json"},
            ],
        },
        headers=WORKER_HEADERS,
    )
    assert complete.status_code == 200
    payload = complete.json()
    assert payload["status"] == "completed"
    assert len(payload["artifacts"]) == 2

    listed = client.get(f"/lm-api/v1/jobs/{job['id']}/artifacts")
    assert listed.status_code == 200
    assert len(listed.json()) == 2


def test_claim_matches_node_labels_and_capacity(tmp_path):
    app = create_app(config=load_config({"mode": "controller", "log_dir": str(tmp_path), "nodes": worker_nodes("win", "linux-a100")}))
    client = TestClient(app)

    client.post(
        "/lm-api/v1/jobs",
        json={
            "type": "task",
            "payload": {
                "requirements": {
                    "labels": {"platform": "linux"},
                    "capacity": {"vram_gb": 16},
                }
            },
        },
    )

    miss = client.post(
        "/lm-api/v1/nodes/win/work/claim",
        json={"max_jobs": 1, "labels": {"platform": "windows"}, "capacity": {"vram_gb": 24}},
        headers=WORKER_HEADERS,
    )
    assert miss.status_code == 200
    assert miss.json() == []

    hit = client.post(
        "/lm-api/v1/nodes/linux-a100/work/claim",
        json={"max_jobs": 1, "labels": {"platform": "linux"}, "capacity": {"vram_gb": 24}},
        headers=WORKER_HEADERS,
    )
    assert hit.status_code == 200
    assert len(hit.json()) == 1


def test_claim_respects_node_target_selector(tmp_path):
    app = create_app(config=load_config({"mode": "controller", "log_dir": str(tmp_path), "nodes": worker_nodes("gpu-1", "gpu-2")}))
    client = TestClient(app)

    client.post(
        "/lm-api/v1/jobs",
        json={"type": "task", "payload": {"x": 1}, "target": "node:gpu-1"},
    )

    other = client.post("/lm-api/v1/nodes/gpu-2/work/claim", json={"max_jobs": 1}, headers=WORKER_HEADERS)
    assert other.status_code == 200
    assert other.json() == []

    right = client.post("/lm-api/v1/nodes/gpu-1/work/claim", json={"max_jobs": 1}, headers=WORKER_HEADERS)
    assert right.status_code == 200
    assert len(right.json()) == 1


def test_retention_policy_endpoint(tmp_path):
    app = create_app(config=load_config({
        "mode": "controller",
        "log_dir": str(tmp_path),
        "controller_retention_days": 14,
        "controller_archive_retention_days": 60,
        "nodes": {},
    }))
    client = TestClient(app)
    response = client.get("/lm-api/v1/controller/retention-policy")
    assert response.status_code == 200
    payload = response.json()
    assert payload["retention_days"] == 14
    assert payload["archive_retention_days"] == 60


def test_archive_export_writes_jsonl(tmp_path):
    app = create_app(config=load_config({"mode": "controller", "log_dir": str(tmp_path), "nodes": worker_nodes("win")}))
    client = TestClient(app)

    job = client.post("/lm-api/v1/jobs", json={"type": "chat", "payload": {"prompt": "hi"}}).json()
    claim = client.post("/lm-api/v1/nodes/win/work/claim", json={"max_jobs": 1}, headers=WORKER_HEADERS).json()
    attempt_id = claim[0]["attempt_id"]
    client.post(f"/lm-api/v1/nodes/win/work/{attempt_id}/complete", json={"result": {"ok": True}}, headers=WORKER_HEADERS)

    # make job old enough for retention_days=0 archive cutoff
    with app.state.orchestrator.repo.store.tx() as session:
        session.execute(
            update(JobOrm)
            .where(JobOrm.id == job["id"])
            .values(completed_at="2000-01-01T00:00:00+00:00")
        )

    export = client.post("/lm-api/v1/controller/archive/export?retention_days=0")
    assert export.status_code == 200
    data = export.json()
    assert data["jobs_exported"] >= 1
    archive_path = Path(data["archive_path"])
    assert archive_path.exists()
    text = archive_path.read_text(encoding="utf-8")
    assert "\"job\"" in text
    assert "\"events\"" in text


def test_auth_login_rejects_dev_fallback_without_bootstrap_key():
    app = create_app(
        config=load_config({"mode": "agent"}),
        process_manager=StubProcessManager(),
        conversion_manager=StubConversionManager(),
        gguf_library=StubGgufLibrary(),
    )
    client = TestClient(app)

    login = client.post("/lm-api/v1/auth/login", json={"username": "alice", "api_key": "dev"})
    assert login.status_code == 401


def test_auth_login_me_logout_flow_with_bootstrapped_admin_key():
    app = create_app(
        config=load_config({"mode": "agent"}),
        process_manager=StubProcessManager(),
        conversion_manager=StubConversionManager(),
        gguf_library=StubGgufLibrary(),
    )
    client = TestClient(app)
    created = app.state.auth_store.create_key("alice", "admin")

    login = client.post("/lm-api/v1/auth/login", json={"username": "alice", "api_key": created["key"]})
    assert login.status_code == 200
    token = login.json()["token"]
    assert login.json()["role"] == "admin"

    me = client.get("/lm-api/v1/auth/me", headers={"X-UI-Session": token})
    assert me.status_code == 200
    assert me.json()["username"] == "alice"
    assert me.json()["role"] == "admin"

    logout = client.post("/lm-api/v1/auth/logout", headers={"X-UI-Session": token})
    assert logout.status_code == 200
    assert logout.json()["ok"] is True

    me_after = client.get("/lm-api/v1/auth/me", headers={"X-UI-Session": token})
    assert me_after.status_code == 401


def test_sensitive_routes_fail_closed_until_auth_is_bootstrapped():
    app = create_app(
        config=load_config({"mode": "controller", "nodes": {}}),
    )
    client = RawTestClient(app)

    assert client.get("/lm-api/v1/health").status_code == 200
    assert client.get("/lm-api/v1/models").status_code == 401
    assert client.get("/lm-api/v1/nodes").status_code == 401

    created = app.state.auth_store.create_key("admin", "admin")
    assert client.get("/lm-api/v1/models", headers={"X-Llama-Pack-Key": created["key"]}).status_code == 200


def test_setup_status_reports_auth_bootstrap_required_without_keys():
    app = create_app(
        config=load_config({"mode": "controller", "nodes": {}, "controller_registration_key": "secret-registration"}),
    )
    client = RawTestClient(app)

    response = client.get("/lm-api/v1/setup/status")
    assert response.status_code == 200
    payload = response.json()
    assert payload["mode"] == "controller"
    assert payload["auth_bootstrap_required"] is True
    assert payload["auth_enabled"] is False
    assert payload["setup_recommended"] is True
    assert payload["models_count"] == 0
    assert payload["has_nodes"] is False
    assert "secret-registration" not in response.text
    assert "config" not in payload
    assert "key" not in payload


def test_setup_status_counts_registered_models_from_db(tmp_path):
    config, store, catalog = _catalog_config(tmp_path, mode="controller", nodes={})
    _register_catalog_model(store, model_name="qwen-7b", path="/models/qwen.gguf", port=8080)
    app = create_app(config=config)
    client = RawTestClient(app)

    payload = client.get("/lm-api/v1/setup/status").json()

    assert payload["models_count"] == 1
    assert app.state.model_catalog_service.list_registered_models()[0]["model_name"] == "qwen-7b"


def test_controller_health_reports_expired_tls_certificate(monkeypatch):
    app = create_app(
        config=load_config({"mode": "agent", "controller_url": "https://pi-controller.local"}),
    )

    class FakeClient:
        def __init__(self, timeout=None, verify=True):
            assert timeout == 5
            assert verify is True

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

        async def get(self, url):
            assert url == "https://pi-controller.local/health"
            try:
                raise ssl.SSLCertVerificationError("certificate has expired")
            except ssl.SSLCertVerificationError as exc:
                raise httpx.ConnectError(
                    "[SSL: CERTIFICATE_VERIFY_FAILED] certificate verify failed: certificate has expired"
                ) from exc

    monkeypatch.setattr("llama_pack.api.routes.health.httpx.AsyncClient", FakeClient)
    client = RawTestClient(app)

    response = client.get("/lm-api/v1/health/controller")

    assert response.status_code == 200
    payload = response.json()
    assert payload["reachable"] is False
    assert "expired" in payload["error"]
    assert "docs/caddy-local-tls.md#recovering-from-expired-certificates" in payload["error"]


def test_setup_bootstrap_admin_creates_key_and_ui_session_once():
    app = create_app(
        config=load_config({"mode": "agent"}),
        process_manager=StubProcessManager(),
        conversion_manager=StubConversionManager(),
        gguf_library=StubGgufLibrary(),
    )
    client = RawTestClient(app)

    bootstrap = client.post("/lm-api/v1/setup/bootstrap-admin", json={"username": "alice"})
    assert bootstrap.status_code == 200
    payload = bootstrap.json()
    assert payload["username"] == "alice"
    assert payload["role"] == "admin"
    assert payload["token"]
    assert payload["key"].startswith("lm_")
    assert payload["key_hint"]

    me = client.get("/lm-api/v1/auth/me", headers={"X-UI-Session": payload["token"]})
    assert me.status_code == 200
    assert me.json()["username"] == "alice"
    assert me.json()["role"] == "admin"

    login = client.post("/lm-api/v1/auth/login", json={"username": "alice", "api_key": payload["key"]})
    assert login.status_code == 200

    second = client.post("/lm-api/v1/setup/bootstrap-admin", json={"username": "bob"})
    assert second.status_code == 409


def test_setup_bootstrap_admin_rejects_static_configured_auth():
    app = create_app(
        config=load_config({"mode": "agent", "agent_api_key": "static-secret"}),
        process_manager=StubProcessManager(),
        conversion_manager=StubConversionManager(),
        gguf_library=StubGgufLibrary(),
    )
    client = RawTestClient(app)

    status = client.get("/lm-api/v1/setup/status")
    assert status.status_code == 200
    assert status.json()["auth_bootstrap_required"] is False
    assert "static-secret" not in status.text

    bootstrap = client.post("/lm-api/v1/setup/bootstrap-admin", json={"username": "alice"})
    assert bootstrap.status_code == 409


def test_setup_bootstrap_admin_response_does_not_leak_config_or_registration_key():
    app = create_app(
        config=load_config(
            {
                "mode": "controller",
                "nodes": {},
                "controller_registration_key": "controller-registration-secret",
            }
        ),
    )
    client = RawTestClient(app)

    response = client.post("/lm-api/v1/setup/bootstrap-admin", json={"username": "admin"})
    assert response.status_code == 200
    text = response.text
    assert "controller-registration-secret" not in text
    assert "config.yaml" not in text
    assert ".llama_pack.env" not in text
    assert "LLAMA" + "_MANAGER" not in text


def test_setup_current_config_returns_safe_snapshot():
    app = create_app(
        config=load_config(
            {
                "mode": "controller",
                "log_dir": "./logs",
                "controller_registration_key": "super-secret-reg-key",
                "node_heartbeat_timeout_seconds": 120,
                "controller_instance_id": "my-controller",
                "nodes": {
                    "agent-1": {"url": "http://agent1.local:9137", "api_key": "node-api-key"},
                },
            }
        ),
    )
    client = TestClient(app)

    response = client.get("/lm-api/v1/setup/current-config")
    assert response.status_code == 200
    payload = response.json()

    # Safe fields are present and correct
    assert payload["mode"] == "controller"
    assert payload["log_dir"] == "logs"  # Path("./logs") normalizes to "logs"
    assert payload["node_heartbeat_timeout_seconds"] == 120
    assert payload["controller_instance_id"] == "my-controller"

    # Secrets are masked, not leaked
    assert payload["controller_registration_key"] == "***"
    assert "super-secret-reg-key" not in response.text

    # Node appears with api_key masked
    assert len(payload["nodes"]) == 1
    assert payload["nodes"][0]["name"] == "agent-1"
    assert payload["nodes"][0]["url"] == "http://agent1.local:9137"
    assert payload["nodes"][0]["api_key"] == "***"
    assert "node-api-key" not in response.text

    # Agent secrets not set → empty strings


def test_settings_node_auth_reports_effective_node_auth_sources():
    app = create_app(
        config=load_config(
            {
                "mode": "controller",
                "nodes": {
                    "pi": {"url": "https://pi.local", "api_key": "config-secret", "verify_tls": True},
                    "mac": {"url": "https://mac.local", "verify_tls": True},
                },
            }
        ),
    )
    registry = app.state.node_registry
    registry.update_node("pi", NodeConfig(url="https://pi-override.local", api_key="", verify_tls=False))
    client = TestClient(app)

    response = client.get("/lm-api/v1/settings/node-auth")

    assert response.status_code == 200
    payload = response.json()
    assert payload[0] == {
        "node_name": "mac",
        "effective_url": "https://mac.local",
        "effective_api_key_source": "missing",
        "effective_api_key_present": False,
        "configured_api_key_present": False,
        "override_api_key_present": False,
        "override_present": False,
        "verify_tls": True,
    }
    assert payload[1] == {
        "node_name": "pi",
        "effective_url": "https://pi-override.local",
        "effective_api_key_source": "override",
        "effective_api_key_present": True,
        "configured_api_key_present": True,
        "override_api_key_present": True,
        "override_present": True,
        "verify_tls": False,
    }


def test_setup_current_config_masks_agent_secrets():
    app = create_app(
        config=load_config(
            {
                "mode": "agent",
                "agent_api_key": "my-agent-key",
                "controller_url": "http://controller.local:9137",
                "controller_registration_key_outbound": "outbound-reg-key",
                "llama_server_bin": "./llama.cpp/build/bin/llama-server",
                "llama_cpp_dir": "./llama.cpp",
            }
        ),
    )
    client = TestClient(app)

    response = client.get("/lm-api/v1/setup/current-config")
    assert response.status_code == 200
    payload = response.json()

    assert payload["mode"] == "agent"
    assert payload["agent_api_key"] == "***"
    assert payload["controller_registration_key_outbound"] == "***"
    assert payload["controller_url"] == "http://controller.local:9137"
    assert "my-agent-key" not in response.text
    assert "outbound-reg-key" not in response.text


def test_setup_current_config_exposes_first_model(tmp_path):
    config, store, _catalog = _catalog_config(tmp_path)
    row = _register_catalog_model(
        store,
        model_name="qwen-7b",
        path="./models/qwen.gguf",
        port=8080,
    )
    store.upsert_model(
        model_name="qwen-7b",
        asset_id=row["asset_id"],
        config_source="db",
        ctx=8192,
        gpu_layers=99,
        strengths=["coding", "general"],
        cost_tier="low",
    )
    app = create_app(config=config)
    client = TestClient(app)

    payload = client.get("/lm-api/v1/setup/current-config").json()
    fm = payload["first_model"]
    assert fm is not None
    assert fm["alias"] == "qwen-7b"
    assert fm["path"] == "./models/qwen.gguf"
    assert fm["port"] == 8080
    assert fm["gpu_layers"] == 99
    assert fm["ctx"] == 8192
    assert fm["strengths"] == ["coding", "general"]
    assert fm["cost_tier"] == "low"


def test_health_reports_configured_models_from_db(tmp_path):
    config, store, _catalog = _catalog_config(tmp_path)
    _register_catalog_model(store, model_name="qwen-7b", path="/models/qwen.gguf", port=8080)
    app = create_app(config=config)
    client = RawTestClient(app)

    payload = client.get("/lm-api/v1/health").json()

    assert payload["configured_models"] == 1
    assert payload["models_configured"] == 1


def test_heartbeat_route_bypasses_ui_session_auth_on_controller():
    app = create_app(
        config=load_config(
            {
                "mode": "controller",
                "nodes": {
                    "linux-2080ti": {
                        "url": "http://127.0.0.1:9137",
                        "verify_tls": False,
                    }
                },
            }
        ),
    )
    client = RawTestClient(app)

    # Bootstrapping auth currently enables UI-session checks for most routes.
    # Heartbeats from remote agents should still be accepted.
    created = app.state.auth_store.create_key("admin", "admin")
    heartbeat = client.post("/lm-api/v1/nodes/linux-2080ti/heartbeat")
    assert heartbeat.status_code == 200

    nodes = client.get("/lm-api/v1/nodes", headers={"X-Llama-Pack-Key": created["key"]})
    assert nodes.status_code == 200
    payload = nodes.json()
    assert payload[0]["name"] == "linux-2080ti"
    assert payload[0]["heartbeat_fresh"] is True


def test_auth_key_management_forbidden_for_non_admin_session():
    app = create_app(
        config=load_config({"mode": "agent"}),
        process_manager=StubProcessManager(),
        conversion_manager=StubConversionManager(),
        gguf_library=StubGgufLibrary(),
    )
    client = TestClient(app)
    app.state.ui_sessions["viewer-token"] = {
        "username": "viewer-user",
        "created_at": "2026-01-01T00:00:00+00:00",
        "expires_at": "2099-01-01T00:00:00+00:00",
        "role": "viewer",
    }

    list_resp = client.get("/lm-api/v1/auth/keys", headers={"X-UI-Session": "viewer-token"})
    assert list_resp.status_code == 403

    create_resp = client.post(
        "/lm-api/v1/auth/keys",
        json={"username": "bob", "role": "operator"},
        headers={"X-UI-Session": "viewer-token"},
    )
    assert create_resp.status_code == 403

    revoke_resp = client.post(
        "/lm-api/v1/auth/keys/some-key/revoke",
        headers={"X-UI-Session": "viewer-token"},
    )
    assert revoke_resp.status_code == 403


def test_auth_key_management_admin_crud():
    app = create_app(
        config=load_config({"mode": "agent"}),
        process_manager=StubProcessManager(),
        conversion_manager=StubConversionManager(),
        gguf_library=StubGgufLibrary(),
    )
    client = TestClient(app)
    app.state.ui_sessions["admin-token"] = {
        "username": "admin-user",
        "created_at": "2026-01-01T00:00:00+00:00",
        "expires_at": "2099-01-01T00:00:00+00:00",
        "role": "admin",
    }

    created = client.post(
        "/lm-api/v1/auth/keys",
        json={"username": "service-account", "role": "operator"},
        headers={"X-UI-Session": "admin-token"},
    )
    assert created.status_code == 200
    key_payload = created.json()
    key_id = key_payload["id"]
    assert key_payload["username"] == "service-account"
    assert key_payload["role"] == "operator"
    assert isinstance(key_payload.get("key"), str) and key_payload["key"]

    listed = client.get("/lm-api/v1/auth/keys", headers={"X-UI-Session": "admin-token"})
    assert listed.status_code == 200
    assert any(item["id"] == key_id for item in listed.json())

    revoked = client.post(f"/lm-api/v1/auth/keys/{key_id}/revoke", headers={"X-UI-Session": "admin-token"})
    assert revoked.status_code == 200
    assert revoked.json()["ok"] is True


def test_auth_store_defaults_to_orm_store(tmp_path):
    prepare_all_persistence_dbs(tmp_path)
    app = create_app(
        config=load_config(
            {
                "mode": "agent",
                "log_dir": str(tmp_path),
            }
        ),
        process_manager=StubProcessManager(),
        conversion_manager=StubConversionManager(),
        gguf_library=StubGgufLibrary(),
    )
    assert isinstance(app.state.auth_store, AuthStoreOrm)

    client = TestClient(app)
    created = app.state.auth_store.create_key("alice", "admin")
    login = client.post("/lm-api/v1/auth/login", json={"username": "alice", "api_key": created["key"]})
    assert login.status_code == 200
    assert login.json()["role"] == "admin"


def test_create_app_fails_when_migrations_not_applied(tmp_path):
    unmigrated_log_dir = tmp_path / "unmigrated"
    with pytest.raises(RuntimeError) as exc:
        create_app(
            config=load_config(
                {
                    "mode": "agent",
                    "log_dir": str(unmigrated_log_dir),
                }
            ),
            process_manager=StubProcessManager(),
            conversion_manager=StubConversionManager(),
            gguf_library=StubGgufLibrary(),
        )

    message = str(exc.value)
    assert "alembic -x db=chat_sessions upgrade chat_sessions@head" in message


def test_module_fallback_app_reports_startup_error_at_root(monkeypatch):
    import llama_pack.main as main_module

    def _raise_startup_error():
        raise RuntimeError("schema missing")

    monkeypatch.setattr(main_module, "create_app", _raise_startup_error)
    app = main_module._create_module_app()
    client = RawTestClient(app)

    response = client.get("/")

    assert response.status_code == 503
    assert response.json() == {"status": "error", "detail": "schema missing"}


def test_audit_store_defaults_to_orm_store(tmp_path):
    prepare_all_persistence_dbs(tmp_path)
    app = create_app(
        config=load_config(
            {
                "mode": "agent",
                "log_dir": str(tmp_path),
            }
        ),
        process_manager=StubProcessManager(),
        conversion_manager=StubConversionManager(),
        gguf_library=StubGgufLibrary(),
    )
    assert isinstance(app.state.audit_store, AuditStoreOrm)

    client = TestClient(app)
    created = client.post(
        "/lm-api/v1/audit/events",
        json={
            "actor": "alice",
            "event_type": "auth_login",
            "dry_run": False,
            "target": "alice",
            "route": "auth",
            "payload": {"ok": True},
        },
    )
    assert created.status_code == 200
    body = created.json()
    assert body["event_type"] == "auth_login"

    listed = client.get("/lm-api/v1/audit/events?event_type=auth")
    assert listed.status_code == 200
    assert any(item["id"] == body["id"] for item in listed.json())


def test_chat_sessions_store_defaults_to_orm_store(tmp_path):
    prepare_all_persistence_dbs(tmp_path)
    app = create_app(
        config=load_config(
            {
                "mode": "agent",
                "log_dir": str(tmp_path),
                "models": {"qwen": {"path": "/models/qwen.gguf", "port": 8081}},
            }
        ),
        process_manager=StubProcessManager(running=True),
        conversion_manager=StubConversionManager(),
        gguf_library=StubGgufLibrary(),
    )
    assert isinstance(app.state.chat_session_store, ChatSessionStoreOrm)

    client = TestClient(app)
    created = client.post(
        "/lm-api/v1/chat/sessions",
        json={
            "name": "orm-chat",
            "model": "qwen",
            "target": "auto",
            "messages": [{"role": "user", "content": "hello"}],
            "request_defaults": {"temperature": 0.2},
        },
    )
    assert created.status_code == 200
    session_id = created.json()["id"]

    listed = client.get("/lm-api/v1/chat/sessions")
    assert listed.status_code == 200
    assert any(item["id"] == session_id for item in listed.json())


def test_orchestration_store_defaults_to_orm_store(tmp_path):
    prepare_all_persistence_dbs(tmp_path)
    app = create_app(
        config=load_config(
            {
                "mode": "controller",
                "log_dir": str(tmp_path),
                "nodes": worker_nodes("win"),
            }
        )
    )
    assert isinstance(app.state.orchestrator.repo.store, OrchestrationStoreOrm)

    client = TestClient(app)
    created = client.post("/lm-api/v1/jobs", json={"type": "chat", "payload": {"prompt": "hi"}})
    assert created.status_code == 201
    job = created.json()

    claim = client.post("/lm-api/v1/nodes/win/work/claim", json={"max_jobs": 1}, headers=WORKER_HEADERS)
    assert claim.status_code == 200
    claim_payload = claim.json()
    assert len(claim_payload) == 1
    assert claim_payload[0]["job"]["id"] == job["id"]


def test_all_persistence_domains_use_orm_together(tmp_path):
    prepare_all_persistence_dbs(tmp_path)
    app = create_app(
        config=load_config(
            {
                "mode": "controller",
                "log_dir": str(tmp_path),
                "nodes": worker_nodes("win"),
                "models": {"qwen": {"path": "/models/qwen.gguf", "port": 8081}},
            }
        ),
        process_manager=StubProcessManager(running=True),
        conversion_manager=StubConversionManager(),
        gguf_library=StubGgufLibrary(),
    )

    assert isinstance(app.state.auth_store, AuthStoreOrm)
    assert isinstance(app.state.audit_store, AuditStoreOrm)
    assert isinstance(app.state.chat_session_store, ChatSessionStoreOrm)
    assert isinstance(app.state.orchestrator.repo.store, OrchestrationStoreOrm)

    client = TestClient(app)

    # auth path (store API)
    created_key = app.state.auth_store.create_key("alice", "admin")
    assert app.state.auth_store.resolve_key(created_key["key"]) is not None

    # audit path (HTTP)
    audit_resp = client.post(
        "/lm-api/v1/audit/events",
        json={
            "actor": "alice",
            "event_type": "toggle_smoke",
            "dry_run": False,
            "target": "all",
            "route": "test",
            "payload": {"ok": True},
        },
        headers={"X-Llama-Pack-Key": created_key["key"]},
    )
    assert audit_resp.status_code == 200

    # chat sessions path (HTTP)
    session_resp = client.post(
        "/lm-api/v1/chat/sessions",
        json={
            "name": "all-orm",
            "model": "qwen",
            "target": "auto",
            "messages": [{"role": "user", "content": "hello"}],
            "request_defaults": {"temperature": 0.2},
        },
        headers={"X-Llama-Pack-Key": created_key["key"]},
    )
    assert session_resp.status_code == 200

    # orchestration path (HTTP)
    job_resp = client.post(
        "/lm-api/v1/jobs",
        json={"type": "chat", "payload": {"prompt": "hi"}},
        headers={"X-Llama-Pack-Key": created_key["key"]},
    )
    assert job_resp.status_code == 201


def test_download_recommendations_route_returns_machine_fit_models(tmp_path):
    config = load_config({"mode": "agent", "hf_models_dirs": [str(tmp_path / "models")], "log_dir": str(tmp_path / "logs")})
    app = create_app(config=config)
    app.state.download_manager._hf_api = FakeHfApi([])

    with patch(
        "llama_pack.core.runtime.health_check.get_system_metrics",
        return_value={
            "platform": "Darwin",
            "architecture": "arm64",
            "ram": {"total": 16 * 1024**3, "available": 12 * 1024**3},
            "vram": [{"memory_total_mb": 8192, "memory_free_mb": 6144}],
        },
    ):
        client = TestClient(app)
        payload = client.get("/lm-api/v1/downloads/recommendations").json()

    assert payload["machine"] == {"ram_gb": 16.0, "vram_gb": 8.0, "platform": "Darwin", "architecture": "arm64"}
    titles = [item["title"] for item in payload["recommendations"]]
    assert "Qwen3.5 9B" in titles
    assert "Qwen3.6 35B A3B" not in titles
    assert payload["recommendations"][0]["repo_id"]
    assert payload["recommendations"][0]["include_file"].endswith(".gguf")
    assert "fit_reason" in payload["recommendations"][0]


def test_download_recommendations_route_works_for_controller(tmp_path):
    config = load_config({"mode": "controller", "hf_models_dirs": [str(tmp_path / "models")], "log_dir": str(tmp_path / "logs")})
    app = create_app(config=config)
    app.state.download_manager._hf_api = FakeHfApi([])

    with patch(
        "llama_pack.core.runtime.health_check.get_system_metrics",
        return_value={
            "platform": "Linux",
            "architecture": "x86_64",
            "ram": {"total": 32 * 1024**3, "available": 28 * 1024**3},
            "vram": [{"memory_total_mb": 12288, "memory_free_mb": 10240}],
        },
    ):
        client = TestClient(app)
        payload = client.get("/lm-api/v1/downloads/recommendations").json()

    assert payload["machine"]["platform"] == "Linux"
    assert "Gemma 4 12B IT" in [item["title"] for item in payload["recommendations"]]


class _FakeHfModel:
    def __init__(self, model_id):
        self.id = model_id


class _FakeRepoFile:
    def __init__(self, path, size):
        self.path = path
        self.size = size


class RouteRecommendationHfApi:
    def list_models(self, **kwargs):
        return [
            _FakeHfModel("newco/Fresh-Text-8B-Instruct-GGUF"),
            _FakeHfModel("bad/Qwen2.5-VL-7B-Instruct-GGUF"),
        ]

    def list_repo_tree(self, repo_id, *, recursive=False, expand=False, revision=None, repo_type=None):
        files = {
            "newco/Fresh-Text-8B-Instruct-GGUF": [_FakeRepoFile("Fresh-Text-8B-Instruct-Q4_K_M.gguf", 5_200_000_000)],
            "bad/Qwen2.5-VL-7B-Instruct-GGUF": [
                _FakeRepoFile("Qwen2.5-VL-7B-Instruct-Q4_K_M.gguf", 5_100_000_000),
                _FakeRepoFile("mmproj-F16.gguf", 134_217_728),
            ],
        }
        return files.get(repo_id, [])


def test_download_recommendations_route_includes_multimodal_discoveries_with_mmproj(tmp_path):
    config = load_config({"mode": "agent", "hf_models_dirs": [str(tmp_path / "models")], "log_dir": str(tmp_path / "logs")})
    app = create_app(config=config)
    app.state.download_manager._hf_api = RouteRecommendationHfApi()

    with patch(
        "llama_pack.core.runtime.health_check.get_system_metrics",
        return_value={"platform": "Darwin", "architecture": "arm64", "ram": {"total": 16 * 1024**3}, "vram": None},
    ):
        client = TestClient(app)
        payload = client.get("/lm-api/v1/downloads/recommendations").json()

    repo_ids = [item["repo_id"] for item in payload["recommendations"]]
    assert "newco/Fresh-Text-8B-Instruct-GGUF" in repo_ids
    vision = next(item for item in payload["recommendations"] if item["repo_id"] == "bad/Qwen2.5-VL-7B-Instruct-GGUF")
    assert vision["vision"] is True
    assert vision["mmproj_file"] == "mmproj-F16.gguf"
