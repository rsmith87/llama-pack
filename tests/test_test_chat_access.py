from fastapi.testclient import TestClient as RawTestClient

from llama_pack.core.config import load_config
from llama_pack.main import create_app
from tests.persistence_db_setup import prepare_all_persistence_dbs


def _controller_app(tmp_path):
    prepare_all_persistence_dbs(tmp_path)
    app = create_app(
        config=load_config(
            {
                "mode": "controller",
                "log_dir": str(tmp_path),
                "nodes": {
                    "linux-2080ti": {
                        "url": "http://linux",
                        "default_model": "qwen",
                        "request_types": {"coding": {"model": "qwen", "priority": 10}},
                    }
                },
                "test_chat_api_key": "lmt_test_bootstrap",
            }
        )
    )
    app.state.thread_service.routing_policy.model_running = lambda node, model: True
    return app


def test_test_chat_key_can_call_safe_chat_testing_routes(tmp_path):
    app = _controller_app(tmp_path)
    raw_key = app.state.auth_store.create_key("test-chat", "test_chat")["key"]
    client = RawTestClient(app)
    client.headers.update({"X-Llama-Pack-Key": raw_key})

    models_response = client.get("/lm-api/v1/models")
    nodes_response = client.get("/lm-api/v1/nodes")
    sessions_response = client.get("/lm-api/v1/chat/sessions")
    saved_session = client.post(
        "/lm-api/v1/chat/sessions",
        json={"name": "Smoke", "model": "qwen", "target": "auto", "messages": []},
    )
    thread = client.post("/lm-api/v1/threads", json={"metadata": {"request_type": "coding"}})
    events_response = client.get(f"/lm-api/v1/threads/{thread.json()['id']}/events")
    # Use a no-raise client for the streaming endpoint: routing will fail (no real
    # model), but we only care that the test_chat key is not blocked with a 403.
    permissive_client = RawTestClient(app, raise_server_exceptions=False)
    permissive_client.headers.update({"X-Llama-Pack-Key": raw_key})
    stream_response = permissive_client.post(
        f"/lm-api/v1/threads/{thread.json()['id']}/messages/stream",
        json={"role": "user", "content": "hello"},
    )

    assert models_response.status_code == 200
    assert nodes_response.status_code == 200
    assert sessions_response.status_code == 200
    assert saved_session.status_code == 200
    assert thread.status_code == 201
    assert events_response.status_code == 200
    assert stream_response.status_code != 403, "test_chat key must not be forbidden from messages/stream"


def test_test_chat_key_is_forbidden_from_admin_and_mutating_infra_routes(tmp_path):
    app = _controller_app(tmp_path)
    raw_key = app.state.auth_store.create_key("test-chat", "test_chat")["key"]
    client = RawTestClient(app)
    client.headers.update({"X-Llama-Pack-Key": raw_key})

    assert client.get("/lm-api/v1/auth/keys").status_code == 403
    assert client.get("/lm-api/v1/audit/events").status_code == 403
    assert client.post("/lm-api/v1/nodes/linux-2080ti", json={"url": "http://new"}).status_code == 403
    assert client.get("/lm-api/v1/settings/generate-api-keys").status_code == 403


def test_test_chat_bootstrap_starts_server_scoped_session_without_leaking_key(tmp_path):
    app = _controller_app(tmp_path)
    client = RawTestClient(app)
    app.state.auth_store.resolve_key = lambda raw: {
        "id": "key-1",
        "username": "test-chat",
        "role": "test_chat",
        "revoked": 0,
    } if raw == "lmt_test_bootstrap" else None

    response = client.get("/lm-api/v1/test-chat/bootstrap")

    assert response.status_code == 200
    assert response.json() == {
        "enabled": True,
        "mode": "controller",
        "key_hint": "lmt_te...trap",
    }
    assert "api_key" not in response.text
    assert "lm_test_chat_session" in response.headers["set-cookie"]
    assert "lmt_test_bootstrap" not in response.headers["set-cookie"]


def test_test_chat_session_cookie_can_call_safe_routes_without_key_header(tmp_path):
    app = _controller_app(tmp_path)
    client = RawTestClient(app)
    app.state.auth_store.resolve_key = lambda raw: {
        "id": "key-1",
        "username": "test-chat",
        "role": "test_chat",
        "revoked": 0,
    } if raw == "lmt_test_bootstrap" else None

    bootstrap = client.get("/lm-api/v1/test-chat/bootstrap")
    response = client.get("/lm-api/v1/chat/sessions")

    assert bootstrap.status_code == 200
    assert response.status_code == 200


def test_test_chat_session_cookie_scopes_saved_sessions_per_browser(tmp_path):
    app = _controller_app(tmp_path)
    app.state.auth_store.resolve_key = lambda raw: {
        "id": "key-1",
        "username": "test-chat",
        "role": "test_chat",
        "revoked": 0,
    } if raw == "lmt_test_bootstrap" else None
    first_browser = RawTestClient(app)
    second_browser = RawTestClient(app)

    assert first_browser.get("/lm-api/v1/test-chat/bootstrap").status_code == 200
    first_saved = first_browser.post(
        "/lm-api/v1/chat/sessions",
        json={"name": "First browser", "model": "qwen", "target": "auto", "messages": []},
    )
    assert second_browser.get("/lm-api/v1/test-chat/bootstrap").status_code == 200
    second_saved = second_browser.post(
        "/lm-api/v1/chat/sessions",
        json={"name": "Second browser", "model": "qwen", "target": "auto", "messages": []},
    )

    first_id = first_saved.json()["id"]
    second_id = second_saved.json()["id"]

    assert first_saved.status_code == 200
    assert second_saved.status_code == 200
    assert [item["id"] for item in first_browser.get("/lm-api/v1/chat/sessions").json()] == [first_id]
    assert [item["id"] for item in second_browser.get("/lm-api/v1/chat/sessions").json()] == [second_id]
    assert second_browser.get(f"/lm-api/v1/chat/sessions/{first_id}").status_code == 404
    assert second_browser.delete(f"/lm-api/v1/chat/sessions/{first_id}").status_code == 404
    assert second_browser.post(
        "/lm-api/v1/chat/sessions",
        json={"id": first_id, "name": "Overwrite", "model": "qwen", "target": "auto", "messages": []},
    ).status_code == 404
    assert first_browser.get(f"/lm-api/v1/chat/sessions/{first_id}").json()["name"] == "First browser"


def test_test_chat_bootstrap_reuses_existing_browser_session_boundary(tmp_path):
    app = _controller_app(tmp_path)
    app.state.auth_store.resolve_key = lambda raw: {
        "id": "key-1",
        "username": "test-chat",
        "role": "test_chat",
        "revoked": 0,
    } if raw == "lmt_test_bootstrap" else None
    client = RawTestClient(app)

    assert client.get("/lm-api/v1/test-chat/bootstrap").status_code == 200
    saved = client.post(
        "/lm-api/v1/chat/sessions",
        json={"name": "Reload survives", "model": "qwen", "target": "auto", "messages": []},
    )
    assert client.get("/lm-api/v1/test-chat/bootstrap").status_code == 200

    assert [item["id"] for item in client.get("/lm-api/v1/chat/sessions").json()] == [saved.json()["id"]]


def test_local_account_chat_sessions_are_scoped_per_logged_in_key(tmp_path):
    app = _controller_app(tmp_path)
    alice_key = app.state.auth_store.create_key("alice", "operator")["key"]
    bob_key = app.state.auth_store.create_key("bob", "operator")["key"]
    client = RawTestClient(app)

    alice_login = client.post("/lm-api/v1/auth/login", json={"username": "alice", "api_key": alice_key})
    bob_login = client.post("/lm-api/v1/auth/login", json={"username": "bob", "api_key": bob_key})

    alice_headers = {"X-UI-Session": alice_login.json()["token"]}
    bob_headers = {"X-UI-Session": bob_login.json()["token"]}
    saved = client.post(
        "/lm-api/v1/chat/sessions",
        headers=alice_headers,
        json={"name": "Alice private", "model": "qwen", "target": "auto", "messages": []},
    )
    session_id = saved.json()["id"]

    assert alice_login.status_code == 200
    assert bob_login.status_code == 200
    assert saved.status_code == 200
    assert [item["id"] for item in client.get("/lm-api/v1/chat/sessions", headers=alice_headers).json()] == [session_id]
    assert client.get(f"/lm-api/v1/chat/sessions/{session_id}", headers=alice_headers).status_code == 200
    assert client.get("/lm-api/v1/chat/sessions", headers=bob_headers).json() == []
    assert client.get(f"/lm-api/v1/chat/sessions/{session_id}", headers=bob_headers).status_code == 404
    assert client.delete(f"/lm-api/v1/chat/sessions/{session_id}", headers=bob_headers).status_code == 404
    assert client.post(
        "/lm-api/v1/chat/sessions",
        headers=bob_headers,
        json={"id": session_id, "name": "Overwrite", "model": "qwen", "target": "auto", "messages": []},
    ).status_code == 404
    assert client.get(f"/lm-api/v1/chat/sessions/{session_id}", headers=alice_headers).json()["name"] == "Alice private"


def test_test_chat_bootstrap_does_not_start_session_for_unscoped_key(tmp_path):
    app = _controller_app(tmp_path)
    client = RawTestClient(app)
    app.state.auth_store.resolve_key = lambda raw: {
        "id": "key-1",
        "username": "admin",
        "role": "admin",
        "revoked": 0,
    } if raw == "lmt_test_bootstrap" else None

    response = client.get("/lm-api/v1/test-chat/bootstrap")

    assert response.status_code == 200
    assert response.json() == {
        "enabled": False,
        "mode": "controller",
        "key_hint": "lmt_te...trap",
    }
    assert "set-cookie" not in response.headers


def test_test_chat_bootstrap_on_agent_points_to_controller(tmp_path):
    prepare_all_persistence_dbs(tmp_path)
    app = create_app(
        config=load_config(
            {
                "mode": "agent",
                "log_dir": str(tmp_path),
                "controller_url": "http://controller.local:9137",
            }
        )
    )
    client = RawTestClient(app)

    response = client.get("/lm-api/v1/test-chat/bootstrap")

    assert response.status_code == 200
    assert response.json() == {
        "enabled": False,
        "mode": "agent",
        "controller_url": "http://controller.local:9137",
        "controller_test_chat_url": "http://controller.local:9137/ui/test-chat",
        "key_hint": "",
    }


def test_test_chat_key_cannot_read_internal_thread_events(tmp_path):
    app = _controller_app(tmp_path)
    admin_key = app.state.auth_store.create_key("admin", "admin")["key"]
    test_key = app.state.auth_store.create_key("test-chat", "test_chat")["key"]
    admin = RawTestClient(app)
    admin.headers.update({"X-Llama-Pack-Key": admin_key})
    tester = RawTestClient(app)
    tester.headers.update({"X-Llama-Pack-Key": test_key})
    thread = admin.post("/lm-api/v1/threads", json={"metadata": {"request_type": "coding"}}).json()

    response = tester.get(f"/lm-api/v1/threads/{thread['id']}/events?include_internal=true")

    assert response.status_code == 403
