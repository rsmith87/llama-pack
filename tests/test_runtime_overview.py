import json

import httpx
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


def test_tool_loop_eval_latest_reports_missing_file(tmp_path):
    prepare_all_persistence_dbs(tmp_path)
    app = create_app(config=load_config({"mode": "agent", "log_dir": str(tmp_path)}))
    key = app.state.auth_store.create_key("admin", "admin")["key"]
    client = TestClient(app)
    client.headers.update({"X-Llama-Manager-Key": key})

    response = client.get("/lm-api/v1/runtime/tool-loop-evals/latest")

    assert response.status_code == 200
    assert response.json() == {
        "available": False,
        "path": str(tmp_path / "tool_loop_eval_latest.json"),
        "generated_at": None,
        "suite_count": 0,
        "models": [],
        "suites": [],
    }


def test_tool_loop_eval_latest_returns_runner_summary(tmp_path):
    prepare_all_persistence_dbs(tmp_path)
    latest = {
        "generated_at": "2026-06-11T12:00:00+00:00",
        "suite_count": 1,
        "models": ["gpt-oss-20b"],
        "suites": [
            {
                "model": "gpt-oss-20b",
                "status": "passed",
                "case_count": 1,
                "passed_count": 1,
                "failed_count": 0,
                "average_score": 1.0,
                "cases": [],
            }
        ],
    }
    (tmp_path / "tool_loop_eval_latest.json").write_text(json.dumps(latest), encoding="utf-8")
    app = create_app(config=load_config({"mode": "agent", "log_dir": str(tmp_path)}))
    key = app.state.auth_store.create_key("admin", "admin")["key"]
    client = TestClient(app)
    client.headers.update({"X-Llama-Manager-Key": key})

    response = client.get("/lm-api/v1/runtime/tool-loop-evals/latest")

    assert response.status_code == 200
    body = response.json()
    assert body["available"] is True
    assert body["path"] == str(tmp_path / "tool_loop_eval_latest.json")
    assert body["generated_at"] == latest["generated_at"]
    assert body["models"] == ["gpt-oss-20b"]
    assert body["suites"][0]["average_score"] == 1.0


def test_controller_tool_loop_eval_node_chat_forwards_to_agent_openai_tool_runtime(tmp_path):
    prepare_all_persistence_dbs(tmp_path)
    calls = []

    async def fake_request(method, url, api_key, verify_tls, json_body=None):
        calls.append((method, url, api_key, verify_tls, json_body))
        return {"choices": [{"message": {"role": "assistant", "content": "ok"}}]}

    app = create_app(
        config=load_config(
            {
                "mode": "controller",
                "log_dir": str(tmp_path),
                "nodes": {"mac-mini": {"url": "http://mac-mini", "api_key": "node-secret", "verify_tls": False}},
            }
        ),
        controller_request=fake_request,
    )
    key = app.state.auth_store.create_key("admin", "admin")["key"]
    client = TestClient(app)
    client.headers.update({"X-Llama-Manager-Key": key})

    response = client.post(
        "/lm-api/v1/runtime/tool-loop-evals/node-chat",
        json={
            "node": "mac-mini",
            "model": "gpt-oss-20b",
            "payload": {
                "messages": [{"role": "user", "content": "hi"}],
                "tools": [
                    {
                        "type": "function",
                        "function": {
                            "name": "read_status",
                            "description": "Read status.",
                            "parameters": {"type": "object", "properties": {}},
                        },
                    }
                ],
            },
        },
    )

    assert response.status_code == 200
    assert response.json()["choices"][0]["message"]["content"] == "ok"
    assert calls == [
        (
            "POST",
            "http://mac-mini/v1/chat/completions",
            "node-secret",
            False,
            {
                "model": "gpt-oss-20b",
                "messages": [{"role": "user", "content": "hi"}],
                "tools": [
                    {
                        "type": "function",
                        "function": {
                            "name": "read_status",
                            "description": "Read status.",
                            "parameters": {"type": "object", "properties": {}},
                        },
                    }
                ],
                "tool_runtime": "agent",
                "stream": False,
            },
        )
    ]


def test_agent_tool_loop_eval_run_uses_local_agent_tools(tmp_path):
    prepare_all_persistence_dbs(tmp_path)

    async def fake_chat_request(url, payload):
        return {"choices": [{"message": {"role": "assistant", "content": "tool loop ready"}}]}

    app = create_app(
        config=load_config(
            {
                "mode": "agent",
                "log_dir": str(tmp_path),
                "models": {"qwen": {"path": "/models/qwen.gguf", "port": 8081}},
                "agent_tools": {
                    "enabled": True,
                    "tools": {
                        "read_status": {
                            "type": "shell",
                            "description": "Read status.",
                            "command": ["printf", "ok"],
                        }
                    },
                },
            }
        ),
        process_manager=type("PM", (), {"status": lambda self, name: {"running": True, "port": 8081}})(),
        chat_request=fake_chat_request,
    )
    key = app.state.auth_store.create_key("admin", "admin")["key"]
    client = TestClient(app)
    client.headers.update({"X-Llama-Manager-Key": key})

    response = client.post(
        "/lm-api/v1/runtime/tool-loop-evals/run",
        json={"model": "qwen", "case_ids": ["avoid-unneeded-tools"]},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["model"] == "qwen"
    assert body["status"] == "passed"
    assert body["cases"][0]["case_id"] == "avoid-unneeded-tools"


def test_agent_tool_loop_eval_run_starts_or_adopts_model_before_eval(tmp_path):
    prepare_all_persistence_dbs(tmp_path)
    calls = []

    class PM:
        def __init__(self):
            self.running = False

        def start(self, name):
            calls.append(("start", name))
            self.running = True
            return {"running": True, "port": 8081}

        def status(self, name):
            calls.append(("status", name))
            return {"running": self.running, "port": 8081}

    async def fake_chat_request(url, payload):
        calls.append(("chat", url))
        return {"choices": [{"message": {"role": "assistant", "content": "tool loop ready"}}]}

    app = create_app(
        config=load_config(
            {
                "mode": "agent",
                "log_dir": str(tmp_path),
                "models": {"qwen": {"path": "/models/qwen.gguf", "port": 8081}},
                "agent_tools": {"enabled": True, "tools": {}},
            }
        ),
        process_manager=PM(),
        chat_request=fake_chat_request,
    )
    key = app.state.auth_store.create_key("admin", "admin")["key"]
    client = TestClient(app)
    client.headers.update({"X-Llama-Manager-Key": key})

    response = client.post(
        "/lm-api/v1/runtime/tool-loop-evals/run",
        json={"model": "qwen", "case_ids": ["avoid-unneeded-tools"]},
    )

    assert response.status_code == 200
    assert response.json()["status"] == "passed"
    assert calls[0] == ("start", "qwen")
    assert ("chat", "http://127.0.0.1:8081/v1/chat/completions") in calls


def test_agent_tool_loop_eval_run_executes_live_workspace_scenario(tmp_path):
    prepare_all_persistence_dbs(tmp_path)
    tool_calls = [
        ("list_workspace", {}),
        ("read_workspace_file", {"path": "README.md"}),
        ("search_workspace", {"query": "user_id"}),
        (
            "write_notes_app_design",
            {
                "content": (
                    "Overview: collaborative notes app without registration.\n"
                    "Data model: notes users collaborators user_id note_id.\n"
                    "API: CRUD notes and share collaborators.\n"
                    "Frontend: notes list editor collaborator panel.\n"
                    "Collaboration: sharing and conflict handling.\n"
                    "Risk: avoid auth scope creep.\n"
                )
            },
        ),
    ]
    calls = []

    async def fake_chat_request(url, payload):
        calls.append(payload)
        index = len(calls) - 1
        if index < len(tool_calls):
            name, arguments = tool_calls[index]
            return {
                "choices": [
                    {
                        "message": {
                            "role": "assistant",
                            "content": "",
                            "tool_calls": [
                                {
                                    "id": f"live-{index}",
                                    "type": "function",
                                    "function": {"name": name, "arguments": json.dumps(arguments)},
                                }
                            ],
                        }
                    }
                ]
            }
        return {"choices": [{"message": {"role": "assistant", "content": "Created notes app design."}}]}

    app = create_app(
        config=load_config(
            {
                "mode": "agent",
                "log_dir": str(tmp_path),
                "models": {"qwen": {"path": "/models/qwen.gguf", "port": 8081}},
                "agent_tools": {"enabled": True, "tools": {}},
            }
        ),
        process_manager=type("PM", (), {"status": lambda self, name: {"running": True, "port": 8081}})(),
        chat_request=fake_chat_request,
    )
    key = app.state.auth_store.create_key("admin", "admin")["key"]
    client = TestClient(app)
    client.headers.update({"X-Llama-Manager-Key": key})

    response = client.post(
        "/lm-api/v1/runtime/tool-loop-evals/run",
        json={"model": "qwen", "case_ids": ["live-collaborative-notes-design"]},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "passed"
    assert body["cases"][0]["case_id"] == "live-collaborative-notes-design"
    assert body["cases"][0]["case_category"] == "live_workspace"
    assert body["cases"][0]["checks"]["expected_artifacts"] is True
    assert body["cases"][0]["artifacts"][0]["path"] == "docs/notes-app-design.md"


def test_controller_tool_loop_eval_node_run_forwards_to_agent_runtime_eval(tmp_path):
    prepare_all_persistence_dbs(tmp_path)
    calls = []

    async def fake_request(method, url, api_key, verify_tls, json_body=None):
        calls.append((method, url, api_key, verify_tls, json_body))
        return {"model": "gpt-oss-20b", "status": "passed", "case_count": 1, "passed_count": 1, "failed_count": 0, "average_score": 1.0, "cases": []}

    app = create_app(
        config=load_config(
            {
                "mode": "controller",
                "log_dir": str(tmp_path),
                "nodes": {"mac-mini": {"url": "http://mac-mini", "api_key": "node-secret", "verify_tls": False}},
            }
        ),
        controller_request=fake_request,
    )
    key = app.state.auth_store.create_key("admin", "admin")["key"]
    client = TestClient(app)
    client.headers.update({"X-Llama-Manager-Key": key})

    response = client.post(
        "/lm-api/v1/runtime/tool-loop-evals/node-run",
        json={"node": "mac-mini", "model": "gpt-oss-20b", "case_ids": ["avoid-unneeded-tools"]},
    )

    assert response.status_code == 200
    assert response.json()["status"] == "passed"
    persisted_runs = app.state.benchmark_store.list_tool_loop_eval_runs()
    assert len(persisted_runs) == 1
    assert persisted_runs[0]["model"] == "gpt-oss-20b"
    assert persisted_runs[0]["target_selector"] == "node:mac-mini"
    assert persisted_runs[0]["target_node"] == "mac-mini"
    assert calls == [
        (
            "POST",
            "http://mac-mini/lm-api/v1/runtime/tool-loop-evals/run",
            "node-secret",
            False,
            {"model": "gpt-oss-20b", "case_ids": ["avoid-unneeded-tools"]},
        )
    ]


def test_controller_tool_loop_eval_node_run_returns_agent_error_detail(tmp_path):
    prepare_all_persistence_dbs(tmp_path)

    async def fake_request(method, url, api_key, verify_tls, json_body, timeout=10):
        request = httpx.Request(method, url)
        response = httpx.Response(
            400,
            request=request,
            json={"detail": "Unknown tool-loop eval case(s): technical-design-doc-draft"},
        )
        raise httpx.HTTPStatusError("Bad Request", request=request, response=response)

    app = create_app(
        config=load_config(
            {
                "mode": "controller",
                "log_dir": str(tmp_path),
                "nodes": {"mac-mini": {"url": "http://mac-mini", "api_key": "node-secret", "verify_tls": False}},
            }
        ),
        controller_request=fake_request,
    )
    key = app.state.auth_store.create_key("admin", "admin")["key"]
    client = TestClient(app)
    client.headers.update({"X-Llama-Manager-Key": key})

    response = client.post(
        "/lm-api/v1/runtime/tool-loop-evals/node-run",
        json={"node": "mac-mini", "model": "gpt-oss-20b", "case_ids": ["technical-design-doc-draft"]},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Node mac-mini tool-loop eval failed: Unknown tool-loop eval case(s): technical-design-doc-draft"


def test_controller_tool_loop_eval_node_run_rejects_node_url_without_scheme(tmp_path):
    prepare_all_persistence_dbs(tmp_path)
    app = create_app(
        config=load_config(
            {
                "mode": "controller",
                "log_dir": str(tmp_path),
                "nodes": {"mac-mini": {"url": "mac-mini.local"}},
            }
        )
    )
    key = app.state.auth_store.create_key("admin", "admin")["key"]
    client = TestClient(app)
    client.headers.update({"X-Llama-Manager-Key": key})

    response = client.post(
        "/lm-api/v1/runtime/tool-loop-evals/node-run",
        json={"node": "mac-mini", "model": "gpt-oss-20b", "case_ids": ["avoid-unneeded-tools"]},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "nodes.mac-mini.url must start with http:// or https://"


def test_tool_loop_eval_runs_api_lists_persisted_history(tmp_path):
    prepare_all_persistence_dbs(tmp_path)
    app = create_app(config=load_config({"mode": "controller", "log_dir": str(tmp_path)}))
    key = app.state.auth_store.create_key("admin", "admin")["key"]
    app.state.benchmark_store.create_tool_loop_eval_run(
        generated_at="2026-06-11T04:10:00+00:00",
        target_selector="node:mac-mini",
        target_node="mac-mini",
        suite={
            "model": "gpt-oss-20b",
            "status": "passed",
            "case_count": 1,
            "passed_count": 1,
            "failed_count": 0,
            "average_score": 1.0,
            "cases": [],
        },
    )
    client = TestClient(app)
    client.headers.update({"X-Llama-Manager-Key": key})

    response = client.get("/lm-api/v1/runtime/tool-loop-evals/runs?model=gpt-oss-20b&status=passed")

    assert response.status_code == 200
    body = response.json()
    assert body["runs"][0]["model"] == "gpt-oss-20b"
    assert body["runs"][0]["target_node"] == "mac-mini"
    assert body["runs"][0]["status"] == "passed"
    assert "cases" not in body["runs"][0]


def test_tool_loop_eval_run_api_returns_case_detail(tmp_path):
    prepare_all_persistence_dbs(tmp_path)
    app = create_app(config=load_config({"mode": "controller", "log_dir": str(tmp_path)}))
    key = app.state.auth_store.create_key("admin", "admin")["key"]
    run = app.state.benchmark_store.create_tool_loop_eval_run(
        generated_at="2026-06-11T04:10:00+00:00",
        target_selector="node:mac-mini",
        target_node="mac-mini",
        suite={
            "model": "gpt-oss-20b",
            "status": "passed",
            "case_count": 1,
            "passed_count": 1,
            "failed_count": 0,
            "average_score": 1.0,
            "cases": [
                {
                    "case_id": "avoid-unneeded-tools",
                    "status": "passed",
                    "score": 1.0,
                    "checks": {"completed": True},
                    "error": "",
                    "iteration_count": 1,
                    "tool_call_count": 0,
                    "observed_tool_sequence": [],
                    "expected_tool_sequence": [],
                    "scoring_mode": "strict_sequence",
                    "tool_results": [],
                    "final_answer": "tool loop ready",
                }
            ],
        },
    )
    client = TestClient(app)
    client.headers.update({"X-Llama-Manager-Key": key})

    response = client.get(f"/lm-api/v1/runtime/tool-loop-evals/runs/{run['id']}")

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == run["id"]
    assert body["cases"][0]["case_id"] == "avoid-unneeded-tools"
    assert body["cases"][0]["checks"] == {"completed": True}


def test_tool_loop_eval_run_api_returns_404_for_missing_run(tmp_path):
    prepare_all_persistence_dbs(tmp_path)
    app = create_app(config=load_config({"mode": "controller", "log_dir": str(tmp_path)}))
    key = app.state.auth_store.create_key("admin", "admin")["key"]
    client = TestClient(app)
    client.headers.update({"X-Llama-Manager-Key": key})

    response = client.get("/lm-api/v1/runtime/tool-loop-evals/runs/missing")

    assert response.status_code == 404
    assert response.json()["detail"] == "Tool-loop eval run not found"


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
            "tools": [
                {"name": "repo_status", "type": "git_status", "description": "status"},
                {"name": "read_project_file", "type": "file_read_dynamic", "description": "read"},
            ],
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
