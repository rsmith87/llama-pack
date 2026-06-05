from __future__ import annotations

import json

from fastapi.testclient import TestClient as RawTestClient

from llama_manager.core.config import load_config
from llama_manager.main import create_app
from tests.helpers import authenticated_client as TestClient
from tests.persistence_db_setup import prepare_all_persistence_dbs


def _controller_app(tmp_path, chat_responses=None, stream_chunks=None, model_running=True):
    prepare_all_persistence_dbs(tmp_path)
    calls = []
    stream_calls = []

    async def fake_chat(model_name, payload):
        calls.append({"model_name": model_name, "payload": payload})
        content = (chat_responses or ["hello from routed node"])[len(calls) - 1]
        return {"choices": [{"message": {"role": "assistant", "content": content}}]}, {"route": payload["target"]}

    async def fake_stream(model_name, payload):
        stream_calls.append({"model_name": model_name, "payload": payload})
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
        )
    )
    app.state.chat_proxy.chat_with_meta = fake_chat
    app.state.chat_proxy.stream_with_meta = fake_stream
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
    assert response.json() == {"choices": [{"message": {"role": "assistant", "content": "hello from routed node"}}]}
    assert response.headers["X-Llama-Manager-Route"] == "node:linux-2080ti"
    assert response.headers["X-Llama-Manager-Node"] == "linux-2080ti"
    assert response.headers["X-Llama-Manager-Model"] == "qwen"
    thread_id = response.headers["X-Llama-Manager-Thread-Id"]
    assert calls[0]["model_name"] == "qwen"
    assert calls[0]["payload"]["messages"] == [{"role": "user", "content": "write code"}]
    assert calls[0]["payload"]["target"] == "node:linux-2080ti"
    public_events = client.get(f"/lm-api/v1/threads/{thread_id}/events").json()
    assert [event["event_type"] for event in public_events] == ["user_message", "assistant_message"]


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

    assert first.headers["X-Llama-Manager-Thread-Id"] == thread_id
    assert second.headers["X-Llama-Manager-Thread-Id"] == thread_id
    assert second.json()["choices"][0]["message"]["content"] == "second"
    assert [call["payload"]["messages"] for call in calls] == [
        [{"role": "user", "content": "first"}],
        [{"role": "user", "content": "second"}],
    ]
    events = client.get(f"/lm-api/v1/threads/{thread_id}/events").json()
    assert [event["event_type"] for event in events] == [
        "user_message",
        "assistant_message",
        "user_message",
        "assistant_message",
    ]


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
    assert response.headers["X-Llama-Manager-Node"] == "linux-2080ti"
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
    assert response.headers["X-Llama-Manager-Node"] == "linux-2080ti"
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
    client.headers.update({"X-Llama-Manager-Key": raw_key})

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


def test_external_app_key_can_list_client_safe_models(tmp_path):
    app, _, _ = _controller_app(tmp_path)
    raw_key = app.state.auth_store.create_external_key("Home App", "https://home.local")["key"]
    client = RawTestClient(app)
    client.headers.update({"X-Llama-Manager-Key": raw_key})

    response = client.get("/v1/models")

    assert response.status_code == 200
    assert response.json() == {
        "object": "list",
        "data": [
            {"id": "gemma", "object": "model", "owned_by": "neuraxis", "metadata": {"request_types": ["general"]}},
            {"id": "qwen", "object": "model", "owned_by": "neuraxis", "metadata": {"request_types": ["coding"]}},
        ],
    }


def test_external_app_key_can_read_client_session_capabilities(tmp_path):
    app, _, _ = _controller_app(tmp_path)
    created = app.state.auth_store.create_external_key("Home App", "https://home.local")
    client = RawTestClient(app)
    client.headers.update({"X-Llama-Manager-Key": created["key"]})

    response = client.get("/v1/client/session")

    assert response.status_code == 200
    payload = response.json()
    assert payload["auth"] == {"method": "external_key", "role": "external", "username": "Home App"}
    assert payload["capabilities"]["openaiChatCompletions"] is True
    assert payload["capabilities"]["streaming"] is True
    assert payload["capabilities"]["serverHistory"] is False
    assert [model["id"] for model in payload["models"]] == ["gemma", "qwen"]


def test_external_app_key_chat_call_writes_safe_audit_metadata(tmp_path):
    app, _, _ = _controller_app(tmp_path)
    created = app.state.auth_store.create_external_key("Docs App", "https://docs.local")
    client = RawTestClient(app)
    client.headers.update({"X-Llama-Manager-Key": created["key"]})

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
    client.headers.update({"X-Llama-Manager-Key": created["key"]})

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
    external.headers.update({"X-Llama-Manager-Key": created["key"]})
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
    assert response.headers["X-Llama-Manager-Node"] == "linux-2080ti"
    thread_id = response.headers["X-Llama-Manager-Thread-Id"]
    assert body == (
        b'data: {"choices":[{"delta":{"content":"hel"}}]}\n\n'
        b'data: {"choices":[{"delta":{"content":"lo"}}]}\n\n'
        b"data: [DONE]\n\n"
    )
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
    thread_id = response.headers["X-Llama-Manager-Thread-Id"]
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
    thread_id = response.headers["X-Llama-Manager-Thread-Id"]
    body = response.json()
    assert body["detail"] == "proxy down"
    assert "route" not in body
    events = client.get(f"/lm-api/v1/threads/{thread_id}/events").json()
    assert [event["event_type"] for event in events] == ["user_message", "error"]
    assert events[-1]["error_code"] == "CHAT_PROXY_ERROR"
