from __future__ import annotations

import json

from fastapi.testclient import TestClient as RawTestClient

from llama_pack.core.config import load_config
from llama_pack.main import create_app
from tests.helpers import authenticated_client as TestClient
from tests.persistence_db_setup import prepare_all_persistence_dbs


_DEFAULT_MODEL_RUNNING = object()


def _controller_app(
    tmp_path,
    chat_responses=None,
    stream_chunks=None,
    model_running=True,
    controller_request=None,
    chat_request=None,
    patch_chat_proxy=True,
):
    prepare_all_persistence_dbs(tmp_path)
    calls = []
    stream_calls = []

    async def fake_chat(model_name, payload):
        recorded_payload = {key: value for key, value in payload.items() if not key.startswith("_")}
        calls.append({"model_name": model_name, "payload": recorded_payload})
        content = (chat_responses or ["hello from routed node"])[len(calls) - 1]
        return {"choices": [{"message": {"role": "assistant", "content": content}}]}, {"route": payload["target"]}

    async def fake_stream(model_name, payload):
        recorded_payload = {key: value for key, value in payload.items() if not key.startswith("_")}
        stream_calls.append({"model_name": model_name, "payload": recorded_payload})
        async def stream():
            for chunk in stream_chunks or [
                b'data: {"choices":[{"delta":{"content":"hel"}}]}\n\n',
                b'data: {"choices":[{"delta":{"content":"lo"}}]}\n\n',
                b"data: [DONE]\n\n",
            ]:
                yield chunk

        return stream(), {"route": payload["target"]}

    app = create_app(
        config=load_config(
            {
                "mode": "controller",
                "log_dir": str(tmp_path),
                "nodes": {
                    "mac-mini": {
                        "url": "http://mac",
                        "default_model": "gemma",
                        "request_types": {"general": {"model": "gemma", "priority": 10}},
                    },
                    "linux-2080ti": {
                        "url": "http://linux",
                        "default_model": "qwen",
                        "request_types": {"coding": {"model": "qwen", "priority": 10}},
                    },
                },
            }
        ),
        controller_request=controller_request,
        chat_request=chat_request,
    )
    if patch_chat_proxy:
        app.state.chat_proxy.chat_with_meta = fake_chat
        app.state.chat_proxy.stream_with_meta = fake_stream
    if model_running is not _DEFAULT_MODEL_RUNNING:
        app.state.thread_service.routing_policy.model_running = lambda node, model: model_running
    return app, calls, stream_calls


def test_openai_chat_completions_routes_by_request_type_and_creates_thread(tmp_path):
    app, calls, _ = _controller_app(tmp_path)
    client = TestClient(app)

    response = client.post(
        "/v1/chat/completions",
        json={
            "model": "qwen",
            "messages": [{"role": "user", "content": "write code"}],
            "request_type": "coding",
            "metadata": {"app": "integration-test"},
            "stream": False,
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["choices"] == [{"message": {"role": "assistant", "content": "hello from routed node"}}]
    assert response.headers["X-Llama-Pack-Route"] == "node:linux-2080ti"
    assert response.headers["X-Llama-Pack-Node"] == "linux-2080ti"
    assert response.headers["X-Llama-Pack-Model"] == "qwen"
    thread_id = response.headers["X-Llama-Pack-Thread-Id"]
    assert body["thread_id"] == thread_id
    assert calls[0]["model_name"] == "qwen"
    assert calls[0]["payload"]["messages"] == [{"role": "user", "content": "write code"}]
    assert calls[0]["payload"]["target"] == "node:linux-2080ti"
    public_events = client.get(f"/lm-api/v1/threads/{thread_id}/events").json()
    assert [event["event_type"] for event in public_events] == ["user_message", "assistant_message"]


def test_routed_openai_chat_does_not_probe_selected_node_twice(tmp_path):
    controller_calls = []
    chat_calls = []

    async def fake_controller_request(method, url, api_key, verify_tls, json_body=None):
        controller_calls.append({"method": method, "url": url})
        if method == "GET" and url == "http://linux/lm-api/v1/models":
            return [{"name": "qwen", "running": True}]
        raise AssertionError(f"unexpected controller request: {method} {url}")

    async def fake_chat_request(url, payload):
        chat_calls.append({"url": url, "payload": payload})
        return {"choices": [{"message": {"role": "assistant", "content": "direct"}}]}

    app, _, _ = _controller_app(
        tmp_path,
        controller_request=fake_controller_request,
        chat_request=fake_chat_request,
        model_running=_DEFAULT_MODEL_RUNNING,
        patch_chat_proxy=False,
    )
    client = TestClient(app)

    response = client.post(
        "/v1/chat/completions",
        json={
            "model": "qwen",
            "messages": [{"role": "user", "content": "write code"}],
            "request_type": "coding",
            "stream": False,
        },
    )

    assert response.status_code == 200
    assert response.headers["X-Llama-Pack-Route"] == "node:linux-2080ti"
    assert controller_calls == [{"method": "GET", "url": "http://linux/lm-api/v1/models"}]
    assert len(chat_calls) == 1
    assert chat_calls[0]["url"] == "http://linux/lm-api/v1/chat/qwen"
    assert chat_calls[0]["payload"]["messages"] == [{"role": "user", "content": "write code"}]
    assert "_trusted_controller_target" not in chat_calls[0]["payload"]


def test_openai_chat_completions_routes_from_persisted_remote_deployment_when_live_models_are_empty(tmp_path):
    async def fake_request(method, url, api_key, verify_tls, json_body=None):
        assert method == "GET"
        if url == "http://linux/lm-api/v1/models":
            return []
        if url == "http://linux/lm-api/v1/library/ggufs":
            return []
        if url == "http://mac/lm-api/v1/models":
            return []
        if url == "http://mac/lm-api/v1/library/ggufs":
            return []
        raise AssertionError(f"unexpected url: {url}")

    app, calls, _ = _controller_app(tmp_path, model_running=False, controller_request=fake_request)
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
        deployment_name="remote:linux-2080ti:default",
        node_name="linux-2080ti",
        host="linux",
        port=8091,
        profile_key=None,
        enabled=True,
    )

    client = TestClient(app)
    response = client.post(
        "/v1/chat/completions",
        json={
            "model": "qwen",
            "messages": [{"role": "user", "content": "write code"}],
            "request_type": "coding",
            "metadata": {"app": "integration-test"},
            "stream": False,
        },
    )

    assert response.status_code == 200
    assert response.headers["X-Llama-Pack-Route"] == "node:linux-2080ti"
    assert response.headers["X-Llama-Pack-Node"] == "linux-2080ti"
    assert calls[0]["payload"]["target"] == "node:linux-2080ti"


def test_openai_chat_completions_appends_to_existing_thread(tmp_path):
    app, calls, _ = _controller_app(tmp_path, chat_responses=["first", "second"])
    client = TestClient(app)
    thread_id = client.post("/lm-api/v1/threads", json={"metadata": {"request_type": "coding"}}).json()["id"]

    first = client.post(
        "/v1/chat/completions",
        json={"model": "qwen", "thread_id": thread_id, "messages": [{"role": "user", "content": "first"}]},
    )
    second = client.post(
        "/v1/chat/completions",
        json={"model": "qwen", "thread_id": thread_id, "messages": [{"role": "user", "content": "second"}]},
    )

    assert first.headers["X-Llama-Pack-Thread-Id"] == thread_id
    assert second.headers["X-Llama-Pack-Thread-Id"] == thread_id
    assert second.json()["choices"][0]["message"]["content"] == "second"
    assert [call["payload"]["messages"] for call in calls] == [
        [{"role": "user", "content": "first"}],
        [
            {"role": "user", "content": "first"},
            {"role": "assistant", "content": "first"},
            {"role": "user", "content": "second"},
        ],
    ]
    events = client.get(f"/lm-api/v1/threads/{thread_id}/events").json()
    assert [event["event_type"] for event in events] == [
        "user_message",
        "assistant_message",
        "user_message",
        "assistant_message",
    ]


def test_openai_chat_completions_rejects_node_switch_on_existing_thread(tmp_path):
    app, _, _ = _controller_app(tmp_path, chat_responses=["first"])
    client = TestClient(app)

    first = client.post(
        "/v1/chat/completions",
        json={
            "model": "qwen",
            "messages": [{"role": "user", "content": "first"}],
            "request_type": "coding",
            "stream": False,
        },
    )
    thread_id = first.headers["X-Llama-Pack-Thread-Id"]

    second = client.post(
        "/v1/chat/completions",
        json={
            "model": "gemma",
            "thread_id": thread_id,
            "messages": [{"role": "user", "content": "second"}],
            "target": "node:mac-mini",
            "stream": False,
        },
    )

    assert second.status_code == 409
    assert second.json()["detail"] == (
        "This thread is already routed to node 'linux-2080ti'. Start a new thread to use node 'mac-mini'."
    )
    assert second.headers["X-Llama-Pack-Thread-Id"] == thread_id


def test_ollama_chat_returns_ollama_shape_with_routing_headers(tmp_path):
    app, calls, _ = _controller_app(tmp_path)
    client = TestClient(app)

    response = client.post(
        "/api/chat",
        json={
            "model": "qwen",
            "messages": [{"role": "user", "content": "hello"}],
            "request_type": "coding",
            "stream": False,
            "options": {"temperature": 0.2, "num_predict": 64, "top_p": 0.8},
        },
    )

    assert response.status_code == 200
    assert response.json()["message"] == {"role": "assistant", "content": "hello from routed node"}
    assert response.json()["model"] == "qwen"
    assert response.json()["done"] is True
    assert "route" not in response.json()
    assert response.headers["X-Llama-Pack-Node"] == "linux-2080ti"
    assert calls[0]["payload"] == {
        "messages": [{"role": "user", "content": "hello"}],
        "temperature": 0.2,
        "max_tokens": 64,
        "top_p": 0.8,
        "target": "node:linux-2080ti",
    }


def test_ollama_chat_stream_returns_ndjson_chunks(tmp_path):
    app, _, stream_calls = _controller_app(tmp_path)
    client = TestClient(app)

    with client.stream(
        "POST",
        "/api/chat",
        json={
            "model": "qwen",
            "messages": [{"role": "user", "content": "hello"}],
            "request_type": "coding",
            "stream": True,
        },
    ) as response:
        lines = [json.loads(line) for line in response.read().decode("utf-8").splitlines() if line]

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/x-ndjson")
    assert response.headers["X-Llama-Pack-Node"] == "linux-2080ti"
    assert lines == [
        {"model": "qwen", "message": {"role": "assistant", "content": "hel"}, "done": False},
        {"model": "qwen", "message": {"role": "assistant", "content": "lo"}, "done": False},
        {"model": "qwen", "message": {"role": "assistant", "content": ""}, "done": True},
    ]
    assert stream_calls[0]["payload"]["target"] == "node:linux-2080ti"


def test_external_app_key_can_call_consumer_chat_apis_but_not_admin_routes(tmp_path):
    app, _, _ = _controller_app(tmp_path, chat_responses=["openai ok", "ollama ok"])
    raw_key = app.state.auth_store.create_external_key("Home App", "https://home.local")["key"]
    client = RawTestClient(app)
    client.headers.update({"X-Llama-Pack-Key": raw_key})

    openai_response = client.post(
        "/v1/chat/completions",
        json={
            "model": "qwen",
            "messages": [{"role": "user", "content": "hello"}],
            "request_type": "coding",
            "stream": False,
        },
    )
    ollama_response = client.post(
        "/api/chat",
        json={
            "model": "qwen",
            "messages": [{"role": "user", "content": "hello"}],
            "request_type": "coding",
            "stream": False,
        },
    )

    assert openai_response.status_code == 200
    assert ollama_response.status_code == 200
    assert client.get("/lm-api/v1/auth/keys").status_code == 403
    assert client.get("/lm-api/v1/nodes").status_code == 403


def test_controller_context_budget_proxies_to_routed_agent_model(tmp_path):
    async def fake_request(method, url, api_key, verify_tls, json_body=None):
        assert method == "POST"
        assert url == "http://linux/lm-api/v1/chat/qwen/context-budget"
        assert json_body["request_type"] == "coding"
        assert json_body["target"] == "node:linux-2080ti"
        return {
            "model": "qwen",
            "context_window_tokens": 32768,
            "prompt_tokens_estimated": 4,
            "reserved_completion_tokens": 512,
            "available_input_tokens": 32256,
            "remaining_context_tokens": 32252,
            "usage_ratio": 0.0157470703125,
            "status": "comfortable",
            "estimation_method": "approx_chars_div_4",
            "precision": "approximate",
            "warnings": [],
        }

    app, _, _ = _controller_app(tmp_path, controller_request=fake_request)
    raw_key = app.state.auth_store.create_external_key("Home App", "https://home.local")["key"]
    client = RawTestClient(app)
    client.headers.update({"X-Llama-Pack-Key": raw_key})

    response = client.post(
        "/lm-api/v1/chat/qwen/context-budget",
        json={
            "messages": [{"role": "user", "content": "hello"}],
            "request_type": "coding",
            "max_tokens": 512,
        },
    )

    assert response.status_code == 200
    assert response.json()["remaining_context_tokens"] == 32252
    assert response.headers["X-Llama-Pack-Route"] == "node:linux-2080ti"
    assert response.headers["X-Llama-Pack-Node"] == "linux-2080ti"
    assert response.headers["X-Llama-Pack-Model"] == "qwen"


def test_controller_context_budget_with_thread_id_does_not_append_events(tmp_path):
    budget_calls = []

    async def fake_request(method, url, api_key, verify_tls, json_body=None):
        budget_calls.append({"method": method, "url": url, "json_body": json_body})
        return {
            "model": "qwen",
            "context_window_tokens": 32768,
            "prompt_tokens_estimated": 12,
            "reserved_completion_tokens": 512,
            "available_input_tokens": 32256,
            "remaining_context_tokens": 32244,
            "usage_ratio": 0.016,
            "status": "comfortable",
            "estimation_method": "approx_chars_div_4",
            "precision": "approximate",
            "warnings": [],
        }

    app, _, _ = _controller_app(tmp_path, controller_request=fake_request, chat_responses=["first"])
    client = TestClient(app)
    first = client.post(
        "/v1/chat/completions",
        json={
            "model": "qwen",
            "messages": [{"role": "user", "content": "first"}],
            "request_type": "coding",
            "stream": False,
        },
    )
    thread_id = first.headers["X-Llama-Pack-Thread-Id"]

    response = client.post(
        "/lm-api/v1/chat/qwen/context-budget",
        json={
            "thread_id": thread_id,
            "messages": [{"role": "user", "content": "second"}],
            "request_type": "coding",
            "max_tokens": 512,
        },
    )

    assert response.status_code == 200
    assert budget_calls[0]["json_body"]["messages"] == [
        {"role": "user", "content": "first"},
        {"role": "assistant", "content": "first"},
        {"role": "user", "content": "second"},
    ]
    events = client.get(f"/lm-api/v1/threads/{thread_id}/events").json()
    assert [event["event_type"] for event in events] == ["user_message", "assistant_message"]


def test_external_app_key_can_list_client_safe_models(tmp_path):
    app, _, _ = _controller_app(tmp_path)
    raw_key = app.state.auth_store.create_external_key("Home App", "https://home.local")["key"]
    client = RawTestClient(app)
    client.headers.update({"X-Llama-Pack-Key": raw_key})

    response = client.get("/v1/models")

    assert response.status_code == 200
    assert response.json() == {
        "object": "list",
        "data": [
            {
                "id": "gemma",
                "object": "model",
                "owned_by": "llama-pack",
                "metadata": {
                    "display_label": "gemma",
                    "request_types": ["general"],
                    "default_request_type": "general",
                    "context_identity": "gemma",
                    "model_family": "gemma",
                    "context_profile": None,
                    "capabilities": {"streaming": True, "json_schema": False, "grammar": False, "vision": False},
                },
            },
            {
                "id": "qwen",
                "object": "model",
                "owned_by": "llama-pack",
                "metadata": {
                    "display_label": "qwen",
                    "request_types": ["coding"],
                    "default_request_type": "coding",
                    "context_identity": "qwen",
                    "model_family": "qwen",
                    "context_profile": None,
                    "capabilities": {"streaming": True, "json_schema": False, "grammar": False, "vision": False},
                },
            },
        ],
    }


def test_external_app_key_can_list_live_controller_node_models_without_static_routes(tmp_path):
    prepare_all_persistence_dbs(tmp_path)

    async def fake_node_request(method, url, api_key, verify_tls, json_body=None):
        assert method == "GET"
        assert url == "http://mac/lm-api/v1/models"
        return [
            {
                "name": "gemma-4-E4B-it",
                "running": True,
                "supports_json_schema": True,
                "supports_grammar": False,
                "vision": False,
            }
        ]

    app = create_app(
        config=load_config(
            {
                "mode": "controller",
                "log_dir": str(tmp_path),
                "nodes": {"mac-mini": {"url": "http://mac"}},
            }
        ),
        controller_request=fake_node_request,
    )
    raw_key = app.state.auth_store.create_external_key("Home App", "https://home.local")["key"]
    client = RawTestClient(app)
    client.headers.update({"X-Llama-Pack-Key": raw_key})

    response = client.get("/v1/models")

    assert response.status_code == 200
    assert response.json()["data"] == [
        {
            "id": "gemma-4-E4B-it",
            "object": "model",
            "owned_by": "llama-pack",
            "metadata": {
                "display_label": "gemma-4-E4B-it",
                "request_types": [],
                "default_request_type": None,
                "context_identity": "gemma-4-E4B-it",
                "model_family": "gemma-4-E4B-it",
                "context_profile": None,
                "capabilities": {"streaming": True, "json_schema": True, "grammar": False, "vision": False},
            },
        }
    ]


def test_external_app_key_can_read_client_session_capabilities(tmp_path):
    app, _, _ = _controller_app(tmp_path)
    created = app.state.auth_store.create_external_key("Home App", "https://home.local")
    client = RawTestClient(app)
    client.headers.update({"X-Llama-Pack-Key": created["key"]})

    response = client.get("/v1/client/session")

    assert response.status_code == 200
    payload = response.json()
    assert payload["auth"] == {"method": "external_key", "role": "external", "username": "Home App"}
    assert payload["capabilities"]["openaiChatCompletions"] is True
    assert payload["capabilities"]["streaming"] is True
    assert payload["capabilities"]["serverHistory"] is True
    assert payload["capabilities"]["projectContext"] is True
    assert payload["projectContext"] == {
        "actions": ["summarize_project", "summarize_path", "refresh_context_item"],
        "endpoint": "/v1/client/project-context/{action}",
        "inputPolicy": "explicit_user_selected_inputs_and_saved_artifact_metadata_only",
    }
    assert [model["id"] for model in payload["models"]] == ["gemma", "qwen"]


def test_external_app_key_can_summarize_project_context_from_selected_inputs(tmp_path):
    app, _, _ = _controller_app(tmp_path)
    created = app.state.auth_store.create_external_key("Home App", "https://home.local")
    client = RawTestClient(app)
    client.headers.update({"X-Llama-Pack-Key": created["key"]})

    response = client.post(
        "/v1/client/project-context/summarize_project",
        json={
            "project": {"name": "Spitball", "root": "/workspace/spitball"},
            "selected_paths": [
                {"path": "packages/spitball/src/styles/app.css", "content": ".board { display: grid; }"},
                {"path": "packages/spitball/README.md", "content": "# Spitball\nA planning app."},
            ],
            "artifacts": [
                {
                    "id": "wireframe-1",
                    "kind": "design",
                    "path": "artifacts/wireframe.md",
                    "title": "Board wireframe",
                    "metadata": {"status": "saved"},
                }
            ],
            "focused_path": None,
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["action"] == "summarize_project"
    assert payload["policy"] == "explicit_user_selected_inputs_and_saved_artifact_metadata_only"
    assert payload["summary"]["project"] == {"name": "Spitball", "root": "/workspace/spitball"}
    assert payload["summary"]["selectedPathCount"] == 2
    assert payload["summary"]["artifactCount"] == 1
    assert payload["summary"]["paths"] == [
        {"path": "packages/spitball/src/styles/app.css", "characters": 25},
        {"path": "packages/spitball/README.md", "characters": 26},
    ]
    assert payload["summary"]["artifacts"] == [
        {
            "id": "wireframe-1",
            "kind": "design",
            "path": "artifacts/wireframe.md",
            "title": "Board wireframe",
            "metadata": {"status": "saved"},
        }
    ]


def test_project_context_rejects_path_without_explicit_content_or_saved_metadata(tmp_path):
    app, _, _ = _controller_app(tmp_path)
    created = app.state.auth_store.create_external_key("Home App", "https://home.local")
    client = RawTestClient(app)
    client.headers.update({"X-Llama-Pack-Key": created["key"]})

    response = client.post(
        "/v1/client/project-context/summarize_path",
        json={
            "project": None,
            "selected_paths": [{"path": "packages/spitball/src/styles/app.css"}],
            "artifacts": [],
            "focused_path": "packages/spitball/src/styles/app.css",
        },
    )

    assert response.status_code == 422
    assert "selected_paths[0] must include explicit content or saved artifact metadata" in response.text


def test_external_app_key_can_summarize_focused_project_path_from_explicit_content(tmp_path):
    app, _, _ = _controller_app(tmp_path)
    created = app.state.auth_store.create_external_key("Home App", "https://home.local")
    client = RawTestClient(app)
    client.headers.update({"X-Llama-Pack-Key": created["key"]})

    response = client.post(
        "/v1/client/project-context/summarize_path",
        json={
            "project": {"name": "Spitball", "root": "/workspace/spitball"},
            "selected_paths": [
                {"path": "packages/spitball/README.md", "content": "# Spitball\nA planning app."},
                {
                    "path": "packages/spitball/src/styles/app.css",
                    "artifact_metadata": {"artifact_id": "style-context", "status": "saved"},
                },
            ],
            "artifacts": [],
            "focused_path": "packages/spitball/src/styles/app.css",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["action"] == "summarize_path"
    assert payload["policy"] == "explicit_user_selected_inputs_and_saved_artifact_metadata_only"
    assert payload["summary"] == {
        "project": {"name": "Spitball", "root": "/workspace/spitball"},
        "path": {
            "path": "packages/spitball/src/styles/app.css",
            "artifactMetadata": {"artifact_id": "style-context", "status": "saved"},
        },
        "artifacts": [],
    }


def test_external_app_key_can_refresh_project_context_item_from_focused_path(tmp_path):
    app, _, _ = _controller_app(tmp_path)
    created = app.state.auth_store.create_external_key("Home App", "https://home.local")
    client = RawTestClient(app)
    client.headers.update({"X-Llama-Pack-Key": created["key"]})

    response = client.post(
        "/v1/client/project-context/refresh_context_item",
        json={
            "project": {"name": "Spitball", "root": "/workspace/spitball"},
            "selected_paths": [
                {"path": "packages/spitball/src/styles/app.css", "content": ".board { display: grid; }"}
            ],
            "artifacts": [
                {
                    "id": "style-context",
                    "kind": "summary",
                    "path": "artifacts/style-context.json",
                    "title": "Style context",
                    "metadata": {"source_path": "packages/spitball/src/styles/app.css"},
                }
            ],
            "focused_path": "packages/spitball/src/styles/app.css",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["action"] == "refresh_context_item"
    assert payload["summary"] == {
        "project": {"name": "Spitball", "root": "/workspace/spitball"},
        "path": {"path": "packages/spitball/src/styles/app.css", "characters": 25},
        "artifactCount": 1,
    }


def test_external_app_key_can_refresh_and_reuse_persisted_project_context_artifact(tmp_path):
    app, _, _ = _controller_app(tmp_path)
    created = app.state.auth_store.create_external_key("Home App", "https://home.local")
    client = RawTestClient(app)
    client.headers.update({"X-Llama-Pack-Key": created["key"]})
    project = client.post("/v1/client/projects", json={"name": "Spitball", "root_hint": "/workspace/spitball"}).json()

    refresh_response = client.post(
        "/v1/client/project-context/refresh_context_item",
        json={
            "project_id": project["id"],
            "project": {"name": "Spitball", "root": "/workspace/spitball"},
            "selected_paths": [
                {"path": "packages/spitball/src/styles/app.css", "content": ".board { display: grid; }"}
            ],
            "artifacts": [],
            "focused_path": "packages/spitball/src/styles/app.css",
        },
    )
    artifact_metadata = refresh_response.json()["summary"]["artifactMetadata"]
    summarize_response = client.post(
        "/v1/client/project-context/summarize_path",
        json={
            "project_id": project["id"],
            "project": {"name": "Spitball", "root": "/workspace/spitball"},
            "selected_paths": [
                {
                    "path": "packages/spitball/src/styles/app.css",
                    "artifact_metadata": artifact_metadata,
                }
            ],
            "artifacts": [],
            "focused_path": "packages/spitball/src/styles/app.css",
        },
    )

    assert refresh_response.status_code == 200
    assert artifact_metadata["kind"] == "path_summary"
    assert artifact_metadata["path"] == "packages/spitball/src/styles/app.css"
    assert artifact_metadata["size_bytes"] == 25
    assert "content_hash" in artifact_metadata
    assert summarize_response.status_code == 200
    assert summarize_response.json()["summary"]["path"]["artifactMetadata"] == artifact_metadata


def test_project_context_rejects_unknown_action(tmp_path):
    app, _, _ = _controller_app(tmp_path)
    created = app.state.auth_store.create_external_key("Home App", "https://home.local")
    client = RawTestClient(app)
    client.headers.update({"X-Llama-Pack-Key": created["key"]})

    response = client.post(
        "/v1/client/project-context/browse_project",
        json={
            "project": {"name": "Spitball", "root": "/workspace/spitball"},
            "selected_paths": [
                {"path": "packages/spitball/src/styles/app.css", "content": ".board { display: grid; }"}
            ],
            "artifacts": [],
            "focused_path": "packages/spitball/src/styles/app.css",
        },
    )

    assert response.status_code == 422
    assert "browse_project" in response.text


def test_external_app_key_can_run_non_streaming_chat_diagnostics(tmp_path):
    app, calls, _ = _controller_app(tmp_path, chat_responses=["diagnostic ok"])
    created = app.state.auth_store.create_external_key("Home App", "https://home.local")
    client = RawTestClient(app)
    client.headers.update({"X-Llama-Pack-Key": created["key"]})

    response = client.post(
        "/v1/client/diagnostics/chat",
        json={"model": "qwen", "request_type": "coding", "stream": False},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["ok"] is True
    assert payload["checks"] == {
        "auth": True,
        "modelUsable": True,
        "routeResolved": True,
        "chat": True,
        "streaming": None,
    }
    assert payload["route"] == {"node": "linux-2080ti", "model": "qwen", "route": "node:linux-2080ti"}
    assert payload["error"] is None
    assert calls[0]["model_name"] == "qwen"
    assert calls[0]["payload"]["messages"] == [{"role": "user", "content": "Llama Pack client diagnostic: reply with ok."}]


def test_external_app_key_can_run_streaming_chat_diagnostics(tmp_path):
    app, _, stream_calls = _controller_app(tmp_path)
    created = app.state.auth_store.create_external_key("Home App", "https://home.local")
    client = RawTestClient(app)
    client.headers.update({"X-Llama-Pack-Key": created["key"]})

    response = client.post(
        "/v1/client/diagnostics/chat",
        json={"model": "qwen", "request_type": "coding", "stream": True},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["ok"] is True
    assert payload["checks"]["chat"] is True
    assert payload["checks"]["streaming"] is True
    assert payload["route"] == {"node": "linux-2080ti", "model": "qwen", "route": "node:linux-2080ti"}
    assert stream_calls[0]["model_name"] == "qwen"


def test_chat_diagnostics_reports_route_failure_without_raising(tmp_path):
    app, _, _ = _controller_app(tmp_path, model_running=False)
    created = app.state.auth_store.create_external_key("Home App", "https://home.local")
    client = RawTestClient(app)
    client.headers.update({"X-Llama-Pack-Key": created["key"]})

    response = client.post(
        "/v1/client/diagnostics/chat",
        json={"model": "qwen", "request_type": "coding", "stream": False},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["ok"] is False
    assert payload["checks"] == {
        "auth": True,
        "modelUsable": True,
        "routeResolved": False,
        "chat": False,
        "streaming": None,
    }
    assert payload["route"] is None
    assert payload["error"]["detail"] == {
        "code": "NO_ELIGIBLE_ROUTE",
        "message": "No eligible running model found",
        "action": "Start an eligible model on a configured node or change the request model, target, or request_type.",
    }


def test_external_app_key_chat_call_writes_safe_audit_metadata(tmp_path):
    app, _, _ = _controller_app(tmp_path)
    created = app.state.auth_store.create_external_key("Docs App", "https://docs.local")
    client = RawTestClient(app)
    client.headers.update({"X-Llama-Pack-Key": created["key"]})

    response = client.post(
        "/v1/chat/completions",
        json={
            "model": "qwen",
            "messages": [{"role": "user", "content": "do not store this prompt"}],
            "request_type": "coding",
            "stream": False,
        },
    )

    assert response.status_code == 200
    events = app.state.audit_store.list_events(event_type="external_chat_completion")
    assert len(events) == 1
    event = events[0]
    assert event["actor"] == "Docs App"
    assert event["target"] == "qwen"
    assert event["route"] == "node:linux-2080ti"
    assert event["payload"] == {
        "key_id": created["id"],
        "endpoint": "/v1/chat/completions",
        "request_type": "coding",
        "node": "linux-2080ti",
        "model": "qwen",
        "stream": False,
    }


def test_external_app_key_chat_call_updates_key_usage_summary(tmp_path):
    app, _, _ = _controller_app(tmp_path)
    created = app.state.auth_store.create_external_key("Docs App", "https://docs.local")
    client = RawTestClient(app)
    client.headers.update({"X-Llama-Pack-Key": created["key"]})

    response = client.post(
        "/api/chat",
        json={
            "model": "qwen",
            "messages": [{"role": "user", "content": "hello"}],
            "request_type": "coding",
            "stream": False,
        },
    )

    assert response.status_code == 200
    [key] = [item for item in app.state.auth_store.list_external_keys() if item["id"] == created["id"]]
    assert key["last_used_at"]
    assert key["last_used_endpoint"] == "/api/chat"
    assert key["last_used_route"] == "node:linux-2080ti"
    assert key["last_used_node"] == "linux-2080ti"
    assert key["last_used_model"] == "qwen"
    assert key["last_used_request_type"] == "coding"


def test_admin_can_read_external_app_key_analytics(tmp_path):
    app, _, _ = _controller_app(tmp_path, chat_responses=["one", "two"])
    created = app.state.auth_store.create_external_key("Docs App", "https://docs.local")
    external = RawTestClient(app)
    external.headers.update({"X-Llama-Pack-Key": created["key"]})
    admin = TestClient(app)
    app.state.ui_sessions["admin-token"] = {"username": "admin", "role": "admin"}

    for endpoint in ["/v1/chat/completions", "/api/chat"]:
        external.post(
            endpoint,
            json={
                "model": "qwen",
                "messages": [{"role": "user", "content": "hello"}],
                "request_type": "coding",
                "stream": False,
            },
        )

    response = admin.get(f"/lm-api/v1/external-keys/{created['id']}/analytics", headers={"X-UI-Session": "admin-token"})

    assert response.status_code == 200
    body = response.json()
    assert body["key_id"] == created["id"]
    assert body["total_calls"] == 2
    assert body["endpoint_counts"] == {"/api/chat": 1, "/v1/chat/completions": 1}
    assert body["model_counts"] == {"qwen": 2}
    assert body["route_counts"] == {"node:linux-2080ti": 2}
    assert body["request_type_counts"] == {"coding": 2}
    assert len(body["recent_calls"]) == 2
    assert body["recent_calls"][0]["endpoint"] == "/api/chat"


def test_openai_chat_completions_stream_keeps_sse_shape_and_records_thread(tmp_path):
    app, _, stream_calls = _controller_app(tmp_path)
    client = TestClient(app)

    with client.stream(
        "POST",
        "/v1/chat/completions",
        json={
            "model": "qwen",
            "messages": [{"role": "user", "content": "hello"}],
            "request_type": "coding",
            "stream": True,
        },
    ) as response:
        body = response.read()

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")
    assert response.headers["X-Llama-Pack-Node"] == "linux-2080ti"
    thread_id = response.headers["X-Llama-Pack-Thread-Id"]
    events = [line.removeprefix("data: ").strip() for line in body.decode("utf-8").split("\n\n") if line.strip()]
    meta = json.loads(events[0])
    assert meta["type"] == "thread"
    assert meta["thread_id"] == thread_id
    assert events[1:] == [
        '{"choices":[{"delta":{"content":"hel"}}]}',
        '{"choices":[{"delta":{"content":"lo"}}]}',
        "[DONE]",
    ]
    assert stream_calls[0]["payload"]["target"] == "node:linux-2080ti"
    events = client.get(f"/lm-api/v1/threads/{thread_id}/events").json()
    assert [event["event_type"] for event in events] == ["user_message", "assistant_message"]


def test_openai_chat_completions_records_error_when_routing_fails(tmp_path):
    app, _, _ = _controller_app(tmp_path, model_running=False)
    client = TestClient(app)

    response = client.post(
        "/v1/chat/completions",
        json={
            "model": "qwen",
            "messages": [{"role": "user", "content": "hello"}],
            "request_type": "coding",
        },
    )

    assert response.status_code == 409
    thread_id = response.headers["X-Llama-Pack-Thread-Id"]
    events = client.get(f"/lm-api/v1/threads/{thread_id}/events").json()
    assert [event["event_type"] for event in events] == ["user_message", "error"]
    assert events[-1]["error_code"] == "ROUTING_ERROR"


def test_openai_chat_completions_records_error_when_proxy_fails(tmp_path):
    app, _, _ = _controller_app(tmp_path)

    async def fail_chat(model_name, payload):
        raise RuntimeError("proxy down")

    app.state.chat_proxy.chat_with_meta = fail_chat
    client = TestClient(app)

    response = client.post(
        "/v1/chat/completions",
        json={
            "model": "qwen",
            "messages": [{"role": "user", "content": "hello"}],
            "request_type": "coding",
        },
    )

    assert response.status_code == 502
    thread_id = response.headers["X-Llama-Pack-Thread-Id"]
    body = response.json()
    assert body["detail"] == "proxy down"
    assert "route" not in body
    events = client.get(f"/lm-api/v1/threads/{thread_id}/events").json()
    assert [event["event_type"] for event in events] == ["user_message", "error"]
    assert events[-1]["error_code"] == "CHAT_PROXY_ERROR"
