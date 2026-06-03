from fastapi.testclient import TestClient

from llama_manager.core.config import NodeConfig, load_config
from llama_manager.main import create_app
from tests.persistence_db_setup import prepare_all_persistence_dbs


def test_runtime_overview_reports_agent_runtime_state(tmp_path):
    prepare_all_persistence_dbs(tmp_path)
    app = create_app(
        config=load_config(
            {
                "mode": "agent",
                "log_dir": str(tmp_path),
                "controller_url": "http://controller",
                "node_name": "agent-a",
                "agent_worker_enabled": True,
                "agent_worker_max_jobs": 3,
                "agent_worker_labels": {"os": "mac", "transfer": "enabled"},
                "agent_worker_capacity": {"gpu": 1, "disk_gb": 500},
                "agent_tools": {
                    "enabled": True,
                    "safe_roots": [str(tmp_path)],
                    "tools": {
                        "list_runtime_status": {
                            "type": "shell",
                            "description": "status",
                            "command": ["printf", "ok"],
                        }
                    },
                },
                "memory": {"enabled": False},
            }
        )
    )
    key = app.state.auth_store.create_key("admin", "admin")["key"]
    client = TestClient(app)
    client.headers.update({"X-Llama-Manager-Key": key})

    response = client.get("/lm-api/v1/runtime/overview")

    assert response.status_code == 200
    body = response.json()
    assert body["mode"] == "agent"
    assert body["agent_tools"] == {
        "enabled": True,
        "tool_count": 1,
        "tools": [{"name": "list_runtime_status", "type": "shell", "description": "status"}],
        "max_iterations": 4,
    }
    assert body["memory"]["configured"] is False
    assert body["memory"]["available"] is False
    assert body["jobs"]["available"] is False
    assert body["worker"] == {
        "enabled": True,
        "running": False,
        "configured_enabled": True,
        "controller_url": "http://controller",
        "node_name": "agent-a",
        "poll_interval_seconds": 2,
        "max_jobs": 3,
        "claim_url": "http://controller/lm-api/v1/nodes/agent-a/work/claim",
        "labels": {"os": "mac", "transfer": "enabled"},
        "capacity": {"gpu": 1, "disk_gb": 500},
        "executors": {"chat": True, "embeddings": False, "model_transfer": True, "model_download": True, "model_install": True},
    }
    assert body["threads"]["available"] is False
    assert body["nodes"]["available"] is False
    assert body["running_models"]["available"] is True
    assert body["running_models"]["count"] == 0
    assert body["downloads"]["available"] is True


def test_runtime_overview_reports_controller_runtime_state(tmp_path):
    prepare_all_persistence_dbs(tmp_path)
    async def fake_request(method, url, api_key, verify_tls, json_body=None):
        assert method == "GET"
        assert url == "http://linux/lm-api/v1/runtime/overview"
        return {
            "mode": "agent",
            "agent_tools": {
                "enabled": True,
                "tool_count": 2,
                "tools": [
                    {"name": "repo_status", "type": "git_status", "description": "status"},
                    {"name": "read_project_file", "type": "file_read_dynamic", "description": "read"},
                ],
                "max_iterations": 4,
            },
            "memory": {"configured": False, "available": False},
            "worker": {
                "enabled": True,
                "running": True,
                "configured_enabled": True,
                "controller_url": "http://controller",
                "node_name": "linux",
                "poll_interval_seconds": 2,
                "max_jobs": 2,
                "claim_url": "http://controller/lm-api/v1/nodes/linux/work/claim",
                "labels": {"role": "transfer"},
                "capacity": {"disk_gb": 800},
                "executors": {"chat": True, "embeddings": False, "model_transfer": True, "model_download": True, "model_install": True},
            },
        }

    app = create_app(
        config=load_config(
            {
                "mode": "controller",
                "log_dir": str(tmp_path),
                "nodes": {
                    "linux": {
                        "url": "http://linux",
                        "request_types": {"coding": {"model": "qwen", "priority": 10}},
                    }
                },
                "memory": {"enabled": True, "path": str(tmp_path / "memory")},
            }
        ),
        controller_request=fake_request,
    )
    app.state.thread_service.create_thread(title="Work", default_model="qwen", metadata={}, created_by="test")
    app.state.orchestrator.create_job(job_type="task", payload={"x": 1}, target="auto")
    key = app.state.auth_store.create_key("admin", "admin")["key"]
    client = TestClient(app)
    client.headers.update({"X-Llama-Manager-Key": key})

    response = client.get("/lm-api/v1/runtime/overview")

    assert response.status_code == 200
    body = response.json()
    assert body["mode"] == "controller"
    assert body["agent_tools"]["enabled"] is False
    assert body["memory"]["configured"] is True
    assert body["memory"]["available"] is False
    assert body["jobs"]["available"] is True
    assert body["jobs"]["counts"].get("queued", 0) >= 1
    assert body["threads"]["available"] is True
    assert body["threads"]["count"] == 1
    assert body["nodes"]["available"] is True
    assert body["nodes"]["count"] == 1
    assert body["nodes"]["items"][0]["name"] == "linux"
    assert body["nodes"]["items"][0]["registration"] == "static"
    assert body["nodes"]["items"][0]["heartbeat_age_seconds"] is None
    assert body["node_runtimes"]["available"] is True
    assert body["node_runtimes"]["items"] == [
        {
            "name": "linux",
            "reachable": True,
            "tools_enabled": True,
            "tool_count": 2,
            "memory_configured": False,
            "memory_available": False,
            "worker_enabled": True,
            "worker_running": True,
            "worker_node_name": "linux",
            "worker_max_jobs": 2,
            "worker_labels": {"role": "transfer"},
            "worker_capacity": {"disk_gb": 800},
            "worker_executors": {"chat": True, "embeddings": False, "model_transfer": True, "model_download": True, "model_install": True},
        }
    ]
    assert body["running_models"]["available"] is False
    assert body["downloads"]["available"] is True


def test_route_preview_selects_explicit_request_type_candidate_with_requirements(tmp_path):
    prepare_all_persistence_dbs(tmp_path)

    async def fake_request(method, url, api_key, verify_tls, json_body=None):
        assert method == "GET"
        if url == "http://small/lm-api/v1/models":
            return [
                {
                    "name": "tiny",
                    "running": True,
                    "ctx": 4096,
                    "supports_json_schema": True,
                }
            ]
        if url == "http://large/lm-api/v1/models":
            return [
                {
                    "name": "qwen-long",
                    "running": True,
                    "ctx": 32768,
                    "supports_json_schema": True,
                }
            ]
        raise AssertionError(f"unexpected url: {url}")

    app = create_app(
        config=load_config(
            {
                "mode": "controller",
                "log_dir": str(tmp_path),
                "nodes": {
                    "small": {
                        "url": "http://small",
                        "request_types": {"summarization": {"model": "tiny", "priority": 10}},
                    },
                    "large": {
                        "url": "http://large",
                        "request_types": {"summarization": {"model": "qwen-long", "priority": 20}},
                    },
                },
            }
        ),
        controller_request=fake_request,
    )
    key = app.state.auth_store.create_key("admin", "admin")["key"]
    client = TestClient(app)
    client.headers.update({"X-Llama-Manager-Key": key})

    response = client.post(
        "/lm-api/v1/runtime/route-preview",
        json={
            "task": "Summarize a long transcript",
            "request_type": "summarization",
            "requirements": {"min_context": 8192, "needs_json": True},
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["selected"]["node"] == "large"
    assert body["selected"]["model"] == "qwen-long"
    assert body["selected"]["reason"] == "highest_score"
    assert body["candidates"][0]["node"] == "small"
    assert body["candidates"][0]["eligible"] is False
    assert "context_too_small" in body["candidates"][0]["rejections"]
    assert body["candidates"][1]["eligible"] is True


def test_route_preview_reports_no_selection_when_requirements_reject_every_candidate(tmp_path):
    prepare_all_persistence_dbs(tmp_path)

    async def fake_request(method, url, api_key, verify_tls, json_body=None):
        return [{"name": "tiny", "running": True, "ctx": 4096, "supports_json_schema": False}]

    app = create_app(
        config=load_config(
            {
                "mode": "controller",
                "log_dir": str(tmp_path),
                "nodes": {
                    "small": {
                        "url": "http://small",
                        "request_types": {"structured": {"model": "tiny", "priority": 10}},
                    },
                },
            }
        ),
        controller_request=fake_request,
    )
    key = app.state.auth_store.create_key("admin", "admin")["key"]
    client = TestClient(app)
    client.headers.update({"X-Llama-Manager-Key": key})

    response = client.post(
        "/lm-api/v1/runtime/route-preview",
        json={
            "task": "Return a JSON object",
            "request_type": "structured",
            "requirements": {"needs_json": True},
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["selected"] is None
    assert body["candidates"][0]["rejections"] == ["json_schema_unsupported"]


def test_route_preview_prefers_model_strength_match_over_lower_priority(tmp_path):
    prepare_all_persistence_dbs(tmp_path)

    async def fake_request(method, url, api_key, verify_tls, json_body=None):
        if url == "http://fast/lm-api/v1/models":
            return [{"name": "tiny", "running": True, "ctx": 8192}]
        if url == "http://coder/lm-api/v1/models":
            return [{"name": "qwen-coder", "running": True, "ctx": 8192}]
        raise AssertionError(f"unexpected url: {url}")

    app = create_app(
        config=load_config(
            {
                "mode": "controller",
                "log_dir": str(tmp_path),
                "models": {
                    "tiny": {
                        "path": "/models/tiny.gguf",
                        "port": 8101,
                        "strengths": ["general"],
                        "cost_tier": "low",
                    },
                    "qwen-coder": {
                        "path": "/models/qwen-coder.gguf",
                        "port": 8102,
                        "strengths": ["coding", "structured"],
                        "cost_tier": "medium",
                    },
                },
                "nodes": {
                    "fast": {
                        "url": "http://fast",
                        "request_types": {"coding": {"model": "tiny", "priority": 10}},
                    },
                    "coder": {
                        "url": "http://coder",
                        "request_types": {"coding": {"model": "qwen-coder", "priority": 20}},
                    },
                },
            }
        ),
        controller_request=fake_request,
    )
    key = app.state.auth_store.create_key("admin", "admin")["key"]
    client = TestClient(app)
    client.headers.update({"X-Llama-Manager-Key": key})

    response = client.post(
        "/lm-api/v1/runtime/route-preview",
        json={"task": "Refactor Python code", "request_type": "coding"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["selected"]["node"] == "coder"
    assert body["selected"]["model"] == "qwen-coder"
    coder = next(candidate for candidate in body["candidates"] if candidate["node"] == "coder")
    assert coder["strengths"] == ["coding", "structured"]
    assert coder["cost_tier"] == "medium"
    assert coder["strength_match"] is True


def test_route_preview_applies_profile_metadata_over_base_model(tmp_path):
    prepare_all_persistence_dbs(tmp_path)

    async def fake_request(method, url, api_key, verify_tls, json_body=None):
        return [{"name": "qwen:cheap", "running": True, "ctx": 8192}]

    app = create_app(
        config=load_config(
            {
                "mode": "controller",
                "log_dir": str(tmp_path),
                "models": {
                    "qwen": {
                        "path": "/models/qwen.gguf",
                        "port": 8101,
                        "strengths": ["coding"],
                        "cost_tier": "high",
                        "profiles": {
                            "cheap": {
                                "strengths": ["summarization"],
                                "cost_tier": "low",
                            }
                        },
                    },
                },
                "nodes": {
                    "mac": {
                        "url": "http://mac",
                        "request_types": {"summarization": {"model": "qwen:cheap", "priority": 10}},
                    },
                },
            }
        ),
        controller_request=fake_request,
    )
    key = app.state.auth_store.create_key("admin", "admin")["key"]
    client = TestClient(app)
    client.headers.update({"X-Llama-Manager-Key": key})

    response = client.post(
        "/lm-api/v1/runtime/route-preview",
        json={
            "task": "Summarize notes",
            "request_type": "summarization",
            "requirements": {"latency": "economy"},
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["selected"]["model"] == "qwen:cheap"
    assert body["candidates"][0]["strengths"] == ["summarization"]
    assert body["candidates"][0]["cost_tier"] == "low"


def test_route_preview_includes_startup_metadata_for_available_stopped_model(tmp_path):
    prepare_all_persistence_dbs(tmp_path)

    async def fake_request(method, url, api_key, verify_tls, json_body=None):
        assert method == "GET"
        if url == "http://mac/lm-api/v1/models":
            return [
                {"name": "qwen", "running": False, "ctx": 8192},
                {"name": "other", "running": True, "ctx": 8192},
            ]
        raise AssertionError(f"unexpected url: {url}")

    app = create_app(
        config=load_config(
            {
                "mode": "controller",
                "log_dir": str(tmp_path),
                "nodes": {
                    "mac": {
                        "url": "http://mac",
                        "max_running_models": 2,
                        "request_types": {"general": {"model": "qwen", "priority": 10}},
                    },
                },
            }
        ),
        controller_request=fake_request,
    )
    key = app.state.auth_store.create_key("admin", "admin")["key"]
    client = TestClient(app)
    client.headers.update({"X-Llama-Manager-Key": key})

    response = client.post(
        "/lm-api/v1/runtime/route-preview",
        json={"task": "Answer a question", "request_type": "general"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["selected"]["node"] == "mac"
    assert body["selected"]["model"] == "qwen"
    assert body["selected"]["startup_needed"] is True
    assert body["selected"]["startup_decision"] == "start_now"
    assert body["candidates"][0]["startup_needed"] is True
    assert body["candidates"][0]["startup_decision"] == "start_now"


def test_route_preview_discovers_registered_node_models_without_configured_route(tmp_path):
    prepare_all_persistence_dbs(tmp_path)

    async def fake_request(method, url, api_key, verify_tls, json_body=None):
        assert method == "GET"
        if url == "http://mac/lm-api/v1/models":
            return [
                {"name": "qwen", "running": False, "ctx": 8192, "strengths": ["general"]},
            ]
        raise AssertionError(f"unexpected url: {url}")

    app = create_app(
        config=load_config(
            {
                "mode": "controller",
                "log_dir": str(tmp_path),
            }
        ),
        controller_request=fake_request,
    )
    app.state.node_registry.register_node("mac", NodeConfig(url="http://mac"))
    key = app.state.auth_store.create_key("admin", "admin")["key"]
    client = TestClient(app)
    client.headers.update({"X-Llama-Manager-Key": key})

    response = client.post(
        "/lm-api/v1/runtime/route-preview",
        json={
            "task": "Summarize a long document",
            "request_type": "general",
            "requirements": {"min_context": 8192},
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["selected"]["node"] == "mac"
    assert body["selected"]["model"] == "qwen"
    assert body["candidates"][0]["source"] == "runtime_model"
    assert body["candidates"][0]["startup_needed"] is True
    assert body["candidates"][0]["startup_decision"] == "start_now"
