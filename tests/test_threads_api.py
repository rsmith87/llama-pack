import pytest
from fastapi.testclient import TestClient as FastAPITestClient

from llama_pack.core.config import load_config
from llama_pack.core.threads.models import WorkflowStep
from llama_pack.core.threads.service import ThreadService
from llama_pack.core.threads.store import ThreadStore
from llama_pack.main import create_app
from tests.helpers import authenticated_client as TestClient
from tests.persistence_db_setup import prepare_all_persistence_dbs


class FakeChatProxy:
    async def chat_with_meta(self, model_name, payload):
        assert model_name == "qwen"
        assert payload["target"] == "node:linux-2080ti"
        return {"choices": [{"message": {"content": "hello"}}]}, {"route": "node:linux-2080ti"}


class RecordingChatProxy:
    def __init__(self, responses=None, error=None, stream_chunks=None, stream_error=None):
        self.calls = []
        self.responses = list(responses or ["hello"])
        self.error = error
        self._stream_chunks: list[list[bytes]] = list(stream_chunks or [])
        self._stream_error = stream_error

    async def chat_with_meta(self, model_name, payload):
        self.calls.append({"model_name": model_name, "payload": payload})
        if self.error is not None:
            raise self.error
        content = self.responses.pop(0)
        return {"choices": [{"message": {"content": content}}]}, {"route": payload["target"]}

    async def stream_with_meta(self, model_name, payload):
        self.calls.append({"model_name": model_name, "payload": payload})
        if self._stream_error is not None:
            raise self._stream_error
        chunks = self._stream_chunks.pop(0) if self._stream_chunks else [
            b'data: {"choices":[{"delta":{"reasoning_content":"thinking"}}]}\n\n',
            b'data: {"choices":[{"delta":{"content":"answer"}}]}\n\n',
            b"data: [DONE]\n\n",
        ]

        async def _stream():
            for chunk in chunks:
                yield chunk

        return _stream(), {"route": payload["target"]}


def _config():
    return load_config(
        {
            "mode": "controller",
            "nodes": {
                "mac-mini": {
                    "url": "http://mac",
                    "default_model": "gemma",
                    "request_types": {"coding": {"model": "gemma", "priority": 50}},
                },
                "linux-2080ti": {
                    "url": "http://linux",
                    "default_model": "qwen",
                    "request_types": {"coding": {"model": "qwen", "priority": 10}},
                },
            },
        }
    )


def _metadata_routing_config():
    return load_config(
        {
            "mode": "controller",
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


def _service(tmp_path, chat_proxy=None, model_running=None):
    return ThreadService(
        config=_config(),
        store=ThreadStore(tmp_path / "threads.db"),
        chat_proxy=chat_proxy or RecordingChatProxy(),
        model_running=model_running or (lambda node, model: True),
    )


def _thread(service):
    return service.create_thread(
        title="Test",
        default_model=None,
        metadata={"app": "codex", "purpose": "coding", "priority": "medium", "request_type": "coding"},
        created_by="alice",
    )


def _general_thread(service):
    return service.create_thread(
        title="General",
        default_model=None,
        metadata={"app": "codex", "purpose": "chat", "priority": "low", "request_type": "general"},
        created_by="alice",
    )


def test_thread_service_routes_message_and_records_public_events(tmp_path):
    config = load_config(
        {
            "mode": "controller",
            "nodes": {
                "linux-2080ti": {
                    "url": "http://linux",
                    "default_model": "qwen",
                    "request_types": {"coding": {"model": "qwen", "priority": 10}},
                }
            },
        }
    )
    service = ThreadService(
        config=config,
        store=ThreadStore(tmp_path / "threads.db"),
        chat_proxy=FakeChatProxy(),
        model_running=lambda node, model: True,
    )
    thread = service.create_thread(
        title="Test",
        default_model=None,
        metadata={"app": "codex", "purpose": "coding", "priority": "medium", "request_type": "coding"},
        created_by="alice",
    )

    response = service.post_message(
        thread_id=thread["id"],
        role="user",
        content="Say hello",
        model=None,
        target="auto",
        metadata=None,
    )

    assert response["message"]["content"] == "hello"
    assert response["route"]["node"] == "linux-2080ti"
    public_events = service.list_events(thread["id"], include_internal=False)
    assert [event["event_type"] for event in public_events] == ["user_message", "assistant_message"]
    internal_events = service.list_events(thread["id"], include_internal=True)
    assert "routing_decision" in [event["event_type"] for event in internal_events]


@pytest.mark.asyncio
async def test_post_message_async_sends_prior_public_messages_plus_current_user_message(tmp_path):
    chat_proxy = RecordingChatProxy(responses=["first reply", "second reply"])
    service = _service(tmp_path, chat_proxy=chat_proxy)
    thread = _thread(service)

    await service.post_message_async(
        thread_id=thread["id"],
        role="user",
        content="First question",
        model=None,
        target="auto",
        metadata=None,
    )
    await service.post_message_async(
        thread_id=thread["id"],
        role="user",
        content="Second question",
        model=None,
        target="auto",
        metadata=None,
    )

    assert chat_proxy.calls[1]["payload"]["messages"] == [
        {"role": "user", "content": "First question"},
        {"role": "assistant", "content": "first reply"},
        {"role": "user", "content": "Second question"},
    ]


@pytest.mark.asyncio
async def test_post_message_async_summarizes_long_history_before_current_user_message(tmp_path):
    chat_proxy = RecordingChatProxy(
        responses=["first reply", "second reply", "durable summary", "third reply", "updated durable summary", "final reply"]
    )
    config = load_config(
        {
            "mode": "controller",
            "models": {"qwen": {"path": "qwen.gguf", "port": 8080, "ctx": 220}},
            "context_summarization_trigger_ratio": 0.50,
            "nodes": {
                "linux-2080ti": {
                    "url": "http://linux",
                    "default_model": "qwen",
                    "request_types": {"coding": {"model": "qwen", "priority": 10}},
                },
            },
        }
    )
    service = ThreadService(
        config=config,
        store=ThreadStore(tmp_path / "threads.db"),
        chat_proxy=chat_proxy,
        model_running=lambda node, model: True,
    )
    thread = _thread(service)

    await service.post_message_async(
        thread_id=thread["id"],
        role="user",
        content="First question " + ("alpha " * 80),
        model=None,
        target="auto",
        metadata=None,
    )
    await service.post_message_async(
        thread_id=thread["id"],
        role="user",
        content="Second question " + ("bravo " * 80),
        model=None,
        target="auto",
        metadata=None,
    )
    await service.post_message_async(
        thread_id=thread["id"],
        role="user",
        content="Third question",
        model=None,
        target="auto",
        metadata=None,
    )
    await service.post_message_async(
        thread_id=thread["id"],
        role="user",
        content="Fourth question",
        model=None,
        target="auto",
        metadata=None,
    )

    summary_calls = [call for call in chat_proxy.calls if call["payload"].get("_skip_context_management") is True]
    summary_call = summary_calls[0]
    assert summary_call["payload"]["temperature"] == 0.0
    assert summary_call["payload"]["max_tokens"] == 768
    assert summary_call["payload"]["_skip_context_management"] is True
    assert "Summarize the earlier conversation" in summary_call["payload"]["messages"][0]["content"]

    messages = chat_proxy.calls[-1]["payload"]["messages"]
    assert messages[0]["role"] == "system"
    assert "Earlier conversation summary:" in messages[0]["content"]
    assert len(summary_calls) == 2
    assert "updated durable summary" in messages[0]["content"]
    assert {"role": "user", "content": "Third question"} in messages
    assert {"role": "assistant", "content": "third reply"} in messages
    assert messages[-1] == {"role": "user", "content": "Fourth question"}
    assert not any(message["role"] == "user" and message["content"].startswith("First question") for message in messages[1:])
    internal_events = service.list_events(thread["id"], include_internal=True)
    summary_event = [event for event in internal_events if event["event_type"] == "history_summary"][-1]
    assert summary_event["content"]["model"] == "qwen"
    assert summary_event["content"]["summary"] == "updated durable summary"
    assert summary_event["content"]["covered_event_ids"]
    assert summary_event["content"]["prompt_tokens_before"] > summary_event["content"]["prompt_tokens_after"]


@pytest.mark.asyncio
async def test_compact_thread_async_summarizes_history_on_request_below_auto_threshold(tmp_path):
    chat_proxy = RecordingChatProxy(responses=["first reply", "second reply", "manual summary"])
    config = load_config(
        {
            "mode": "controller",
            "models": {"qwen": {"path": "qwen.gguf", "port": 8080, "ctx": 8192}},
            "context_summarization_trigger_ratio": 0.95,
            "nodes": {
                "linux-2080ti": {
                    "url": "http://linux",
                    "default_model": "qwen",
                    "request_types": {"coding": {"model": "qwen", "priority": 10}},
                },
            },
        }
    )
    service = ThreadService(
        config=config,
        store=ThreadStore(tmp_path / "threads.db"),
        chat_proxy=chat_proxy,
        model_running=lambda node, model: True,
    )
    thread = _thread(service)

    await service.post_message_async(thread["id"], "user", "First question " + ("alpha " * 80), None, "auto", None)
    await service.post_message_async(thread["id"], "user", "Second question " + ("bravo " * 80), None, "auto", None)
    result = await service.compact_thread_async(
        thread_id=thread["id"],
        model=None,
        model_family=None,
        context_profile=None,
        target="auto",
        recent_message_count=2,
    )

    summary_calls = [call for call in chat_proxy.calls if call["payload"].get("_skip_context_management") is True]
    assert len(summary_calls) == 1
    assert result["summarized"] is True
    assert result["summary"] == "manual summary"
    assert result["summary_event_id"]
    assert result["covered_event_count"] == 2
    assert result["prompt_tokens_before"] > result["prompt_tokens_after"]
    events = service.list_events(thread["id"], include_internal=True)
    summary_event = next(event for event in events if event["event_type"] == "history_summary")
    assert summary_event["content"]["summary"] == "manual summary"
    assert summary_event["content"]["source"] == "manual"


@pytest.mark.asyncio
async def test_thread_message_resolves_context_profile_and_records_route(tmp_path):
    chat_proxy = RecordingChatProxy(responses=["profile reply"])
    service = _service(
        tmp_path,
        chat_proxy=chat_proxy,
        model_running=lambda node, model: node == "mac-mini" and model == "gemma:long",
    )
    thread = service.create_thread(
        title="Profile",
        default_model="gemma",
        metadata={"app": "ui", "request_type": "general"},
        created_by="alice",
    )

    response = await service.post_message_async(
        thread_id=thread["id"],
        role="user",
        content="hello",
        model_family="gemma",
        context_profile="long",
        model=None,
        target="node:mac-mini",
        metadata=None,
    )

    assert response["route"]["model"] == "gemma:long"
    assert response["route"]["family"] == "gemma"
    assert response["route"]["profile"] == "long"
    assert chat_proxy.calls[0]["model_name"] == "gemma:long"
    assert chat_proxy.calls[0]["payload"]["model_family"] == "gemma"
    assert chat_proxy.calls[0]["payload"]["context_profile"] == "long"
    internal_events = service.list_events(thread["id"], include_internal=True)
    route_event = next(event for event in internal_events if event["event_type"] == "routing_decision")
    assert route_event["route"]["family"] == "gemma"
    assert route_event["route"]["profile"] == "long"


@pytest.mark.asyncio
async def test_thread_message_auto_target_prefers_selected_context_profile(tmp_path):
    chat_proxy = RecordingChatProxy(responses=["profile reply"])
    config = load_config(
        {
            "mode": "controller",
            "nodes": {
                "mac-mini": {
                    "url": "http://mac",
                    "default_model": "gemma",
                    "request_types": {"general": {"model": "gemma", "priority": 20}},
                },
                "linux-2080ti": {
                    "url": "http://linux",
                    "default_model": "qwen",
                    "request_types": {"general": {"model": "qwen", "priority": 10}},
                },
            },
        }
    )
    service = ThreadService(
        config=config,
        store=ThreadStore(tmp_path / "threads.db"),
        chat_proxy=chat_proxy,
        model_running=lambda node, model: (
            (node == "mac-mini" and model == "gemma:long")
            or (node == "linux-2080ti" and model == "qwen")
        ),
    )
    thread = service.create_thread(
        title="Profile",
        default_model="gemma",
        metadata={"app": "ui", "request_type": "general"},
        created_by="alice",
    )

    response = await service.post_message_async(
        thread_id=thread["id"],
        role="user",
        content="hello",
        model_family="gemma",
        context_profile="long",
        model=None,
        target="auto",
        metadata=None,
    )

    assert response["route"]["node"] == "mac-mini"
    assert response["route"]["model"] == "gemma:long"
    assert chat_proxy.calls[0]["model_name"] == "gemma:long"


@pytest.mark.asyncio
async def test_post_message_async_uses_thread_affinity_on_second_turn_when_previous_route_is_eligible(tmp_path):
    chat_proxy = RecordingChatProxy(responses=["first reply", "second reply"])
    service = _service(
        tmp_path,
        chat_proxy=chat_proxy,
        model_running=lambda node, model: node == "linux-2080ti" and model == "qwen",
    )
    thread = _thread(service)

    await service.post_message_async(thread["id"], "user", "First", None, "auto", None)
    response = await service.post_message_async(thread["id"], "user", "Second", None, "auto", None)

    assert response["route"]["node"] == "linux-2080ti"
    assert response["route"]["reason"] == "thread_affinity"


@pytest.mark.asyncio
async def test_post_message_async_rejects_switching_nodes_on_existing_thread(tmp_path):
    chat_proxy = RecordingChatProxy(responses=["first reply", "second reply"])
    service = _service(
        tmp_path,
        chat_proxy=chat_proxy,
        model_running=lambda node, model: (
            (node == "mac-mini" and model == "gemma:fast")
            or (node == "linux-2080ti" and model == "gemma:long")
        ),
    )
    thread = service.create_thread(
        title="Profile affinity",
        default_model="gemma",
        metadata={"app": "ui", "request_type": "general"},
        created_by="alice",
    )

    await service.post_message_async(
        thread_id=thread["id"],
        role="user",
        content="First",
        model=None,
        target="node:mac-mini",
        metadata=None,
        model_family="gemma",
        context_profile="fast",
    )
    with pytest.raises(ValueError) as exc_info:
        await service.post_message_async(
            thread_id=thread["id"],
            role="user",
            content="Second",
            model=None,
            target="node:linux-2080ti",
            metadata=None,
            model_family="gemma",
            context_profile="long",
        )

    assert str(exc_info.value) == (
        "This thread is already routed to node 'mac-mini'. Start a new thread to use node 'linux-2080ti'."
    )
    public_events = service.list_events(thread["id"], include_internal=False)
    assert public_events[-1]["event_type"] == "error"
    assert public_events[-1]["error_detail"] == str(exc_info.value)


def test_thread_service_persists_route_metadata_on_assistant_events(tmp_path):
    service = _service(tmp_path, chat_proxy=RecordingChatProxy())
    thread = _thread(service)

    response = service.post_message(thread["id"], "user", "Route me", None, "auto", None)

    assistant_events = [
        event
        for event in service.list_events(thread["id"], include_internal=True)
        if event["event_type"] == "assistant_message"
    ]
    assert assistant_events[0]["route"] == response["route"]
    assert assistant_events[0]["agent_node"] == "linux-2080ti"
    assert assistant_events[0]["model"] == "qwen"


@pytest.mark.asyncio
async def test_post_message_async_merges_message_metadata_and_uses_request_type_override_for_routing(tmp_path):
    chat_proxy = RecordingChatProxy()
    service = ThreadService(
        config=_metadata_routing_config(),
        store=ThreadStore(tmp_path / "threads.db"),
        chat_proxy=chat_proxy,
        model_running=lambda node, model: True,
    )
    thread = _general_thread(service)

    response = await service.post_message_async(
        thread_id=thread["id"],
        role="user",
        content="Write code",
        model=None,
        target="auto",
        metadata={"purpose": "implementation", "request_type": "coding"},
    )

    public_events = service.list_events(thread["id"], include_internal=False)
    assert public_events[0]["content"]["metadata"] == {
        "app": "codex",
        "purpose": "implementation",
        "priority": "low",
        "request_type": "coding",
    }
    assert response["route"]["node"] == "linux-2080ti"
    assert response["route"]["model"] == "qwen"
    assert chat_proxy.calls[0]["model_name"] == "qwen"
    assert chat_proxy.calls[0]["payload"]["target"] == "node:linux-2080ti"


@pytest.mark.asyncio
async def test_post_message_async_appends_public_error_event_when_routing_fails(tmp_path):
    service = _service(tmp_path, model_running=lambda node, model: False)
    thread = _thread(service)

    with pytest.raises(ValueError):
        await service.post_message_async(thread["id"], "user", "No route", None, "auto", None)

    public_events = service.list_events(thread["id"], include_internal=False)
    assert [event["event_type"] for event in public_events] == ["user_message", "error"]
    assert public_events[-1]["error_code"] == "ROUTING_ERROR"
    assert "No eligible running model found" in public_events[-1]["error_detail"]


@pytest.mark.asyncio
async def test_post_message_async_appends_public_error_event_when_chat_proxy_fails(tmp_path):
    service = _service(tmp_path, chat_proxy=RecordingChatProxy(error=RuntimeError("proxy down")))
    thread = _thread(service)

    with pytest.raises(RuntimeError):
        await service.post_message_async(thread["id"], "user", "Hello", None, "auto", None)

    public_events = service.list_events(thread["id"], include_internal=False)
    assert [event["event_type"] for event in public_events] == ["user_message", "error"]
    assert public_events[-1]["error_code"] == "CHAT_PROXY_ERROR"
    assert public_events[-1]["error_detail"] == "proxy down"


def test_threads_api_creates_thread_and_posts_message(tmp_path):
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
            }
        )
    )

    async def fake_chat(model_name, payload):
        return {"choices": [{"message": {"content": "hello from linux"}}]}, {"route": "node:linux-2080ti"}

    app.state.chat_proxy.chat_with_meta = fake_chat
    app.state.thread_service.routing_policy.model_running = lambda node, model: True
    client = TestClient(app)

    thread_response = client.post(
        "/lm-api/v1/threads",
        json={
            "title": "Debug",
            "metadata": {"app": "codex", "purpose": "coding", "priority": "medium", "request_type": "coding"},
        },
    )
    assert thread_response.status_code == 201
    thread_id = thread_response.json()["id"]

    message_response = client.post(
        f"/lm-api/v1/threads/{thread_id}/messages",
        json={"role": "user", "content": "hello"},
    )

    assert message_response.status_code == 200
    assert message_response.json()["message"]["content"] == "hello from linux"
    assert message_response.json()["route"]["node"] == "linux-2080ti"

    public_events = client.get(f"/lm-api/v1/threads/{thread_id}/events").json()
    assert [event["event_type"] for event in public_events] == ["user_message", "assistant_message"]


def test_threads_api_compacts_thread_on_request(tmp_path):
    prepare_all_persistence_dbs(tmp_path)
    app = create_app(
        config=load_config(
            {
                "mode": "controller",
                "log_dir": str(tmp_path),
                "models": {"qwen": {"path": "qwen.gguf", "port": 8080, "ctx": 8192}},
                "nodes": {
                    "linux-2080ti": {
                        "url": "http://linux",
                        "default_model": "qwen",
                        "request_types": {"coding": {"model": "qwen", "priority": 10}},
                    }
                },
            }
        )
    )

    responses = ["first reply", "second reply", "manual summary"]

    async def fake_chat(model_name, payload):
        return {"choices": [{"message": {"content": responses.pop(0)}}]}, {"route": payload["target"]}

    app.state.chat_proxy.chat_with_meta = fake_chat
    app.state.thread_service.routing_policy.model_running = lambda node, model: True
    client = TestClient(app)
    thread_id = client.post(
        "/lm-api/v1/threads",
        json={"metadata": {"request_type": "coding"}},
    ).json()["id"]
    client.post(f"/lm-api/v1/threads/{thread_id}/messages", json={"role": "user", "content": "First question"})
    client.post(f"/lm-api/v1/threads/{thread_id}/messages", json={"role": "user", "content": "Second question"})

    response = client.post(f"/lm-api/v1/threads/{thread_id}/compact", json={"recent_message_count": 2})

    assert response.status_code == 200
    body = response.json()
    assert body["summarized"] is True
    assert body["summary"] == "manual summary"
    assert body["summary_event_id"]
    assert body["covered_event_count"] == 2
    internal_events = client.get(f"/lm-api/v1/threads/{thread_id}/events?include_internal=true").json()
    summary_event = next(event for event in internal_events if event["event_type"] == "history_summary")
    assert summary_event["content"]["source"] == "manual"


def test_threads_api_reports_no_eligible_route_contract(tmp_path):
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
            }
        )
    )
    app.state.thread_service.routing_policy.model_running = lambda node, model: False
    client = TestClient(app)

    thread_response = client.post("/lm-api/v1/threads", json={"title": "Debug"})
    assert thread_response.status_code == 201

    message_response = client.post(
        f"/lm-api/v1/threads/{thread_response.json()['id']}/messages",
        json={
            "role": "user",
            "content": "hello",
            "metadata": {"request_type": "coding"},
        },
    )

    assert message_response.status_code == 409
    assert message_response.json()["detail"] == {
        "code": "NO_ELIGIBLE_ROUTE",
        "message": "No eligible running model found",
        "action": "Start an eligible model on a configured node or change the request model, target, or request_type.",
    }


@pytest.mark.asyncio
async def test_thread_routing_records_node_request_failure_in_candidate_metadata(tmp_path):
    prepare_all_persistence_dbs(tmp_path)

    async def fake_controller_request(method, url, api_key, verify_tls, json_body=None):
        assert method == "GET"
        if url == "http://node-a/lm-api/v1/models":
            raise RuntimeError("node-a model list timed out")
        if url == "http://node-b/lm-api/v1/models":
            return [{"name": "qwen", "running": True}]
        raise AssertionError(f"unexpected node request: {url}")

    app = create_app(
        config=load_config(
            {
                "mode": "controller",
                "log_dir": str(tmp_path),
                "nodes": {
                    "node-a": {
                        "url": "http://node-a",
                        "request_types": {"coding": {"model": "qwen", "priority": 10}},
                    },
                    "node-b": {
                        "url": "http://node-b",
                        "request_types": {"coding": {"model": "qwen", "priority": 20}},
                    },
                },
            }
        ),
        controller_request=fake_controller_request,
    )

    async def fake_chat(model_name, payload):
        return {"choices": [{"message": {"content": "hello from node-b"}}]}, {"route": "node:node-b"}

    app.state.chat_proxy.chat_with_meta = fake_chat
    service = app.state.thread_service
    thread = service.create_thread(
        title=None,
        default_model=None,
        metadata={"request_type": "coding"},
        created_by=None,
    )

    await service.post_message_async(thread["id"], "user", "hello", None, "auto", None)

    events = service.list_events(thread["id"], include_internal=True)
    routing_event = next(event for event in events if event["event_type"] == "routing_decision")
    candidates = {candidate["node"]: candidate for candidate in routing_event["content"]["candidates"]}
    assert candidates["node-a"]["route_check_errors"] == [
        {
            "check": "model_running",
            "error_type": "RuntimeError",
            "message": "Node node-a model status request failed for model qwen: node-a model list timed out",
        }
    ]
    assert routing_event["content"]["node"] == "node-b"


def test_threads_api_posts_message_with_context_profile_fields(tmp_path):
    prepare_all_persistence_dbs(tmp_path)
    app = create_app(
        config=load_config(
            {
                "mode": "controller",
                "log_dir": str(tmp_path),
                "nodes": {
                    "mac-mini": {
                        "url": "http://mac",
                        "default_model": "gemma",
                    }
                },
            }
        )
    )

    async def fake_chat(model_name, payload):
        assert model_name == "gemma:long"
        assert payload["model_family"] == "gemma"
        assert payload["context_profile"] == "long"
        return {"choices": [{"message": {"content": "hello from profile"}}]}, {"route": payload["target"]}

    app.state.chat_proxy.chat_with_meta = fake_chat
    app.state.thread_service.routing_policy.model_running = (
        lambda node, model: node == "mac-mini" and model == "gemma:long"
    )
    client = TestClient(app)
    thread_id = client.post("/lm-api/v1/threads", json={"metadata": {"request_type": "general"}}).json()["id"]

    response = client.post(
        f"/lm-api/v1/threads/{thread_id}/messages",
        json={
            "role": "user",
            "content": "hello",
            "model_family": "gemma",
            "context_profile": "long",
            "target": "node:mac-mini",
        },
    )

    assert response.status_code == 200
    assert response.json()["route"]["model"] == "gemma:long"
    assert response.json()["route"]["family"] == "gemma"
    assert response.json()["route"]["profile"] == "long"


def test_threads_api_posts_message_with_agent_tool_runtime_fields(tmp_path):
    prepare_all_persistence_dbs(tmp_path)

    async def fake_controller_request(method, url, api_key=None, verify_tls=True, json_body=None):
        assert method == "GET"
        if url == "http://linux/lm-api/v1/models":
            return [{"name": "qwen", "running": True}]
        raise AssertionError(f"unexpected controller request: {url}")

    calls = []

    async def fake_chat_request(url, payload):
        calls.append({"url": url, "payload": payload})
        return {"choices": [{"message": {"content": "tool answer"}}]}

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
            }
        ),
        controller_request=fake_controller_request,
        chat_request=fake_chat_request,
    )
    project = app.state.project_store.create_project(name="Project 1", root_hint="/repo")
    app.state.project_store.upsert_node_root(
        project_id=str(project["id"]),
        node_name="linux-2080ti",
        root_path="/repo",
        safe_root_status="allowed",
    )
    snapshot = app.state.project_graph_store.create_snapshot(
        project_id=str(project["id"]),
        node_name="linux-2080ti",
        root_path="/repo",
        git_commit=None,
    )
    app.state.project_graph_store.replace_snapshot_graph(
        snapshot_id=str(snapshot["id"]),
        files=[],
        symbols=[],
        imports=[],
        relations=[],
    )
    app.state.project_graph_store.activate_snapshot(str(snapshot["id"]))
    client = TestClient(app)
    thread_id = client.post("/lm-api/v1/threads", json={"metadata": {"request_type": "coding"}}).json()["id"]

    response = client.post(
        f"/lm-api/v1/threads/{thread_id}/messages",
        json={
            "role": "user",
            "content": "inspect project graph",
            "model": "qwen",
            "tool_runtime": "agent",
            "tool_choice": "auto",
            "project_id": str(project["id"]),
            "agent_tool_max_iterations": 4,
        },
    )

    assert response.status_code == 200
    assert calls == [
        {
            "url": "http://linux/v1/chat/completions",
            "payload": {
                "messages": [{"role": "user", "content": "inspect project graph"}],
                "temperature": 0.7,
                "max_tokens": 512,
                "stream": False,
                "chat_template_kwargs": {"enable_thinking": False},
                "tool_choice": "auto",
                "tool_runtime": "agent",
                "agent_tool_max_iterations": 4,
                "project_id": str(project["id"]),
                "model": "qwen",
            },
        }
    ]


def test_threads_api_routes_to_node_with_recently_received_gguf_when_model_is_not_running(tmp_path):
    prepare_all_persistence_dbs(tmp_path)

    async def fake_controller_request(method, url, api_key, verify_tls, json_body=None):
        assert method == "GET"
        if url.endswith("/models"):
            return []
        if url == "http://mac/lm-api/v1/library/ggufs":
            return []
        if url == "http://linux/lm-api/v1/library/ggufs":
            return [
                {
                    "name": "qwen",
                    "filename": "qwen.gguf",
                    "recently_received": True,
                    "received_transfer_id": "transfer-1",
                }
            ]
        return {"status": "ok"}

    app = create_app(
        config=load_config(
            {
                "mode": "controller",
                "log_dir": str(tmp_path),
                "nodes": {
                    "mac-mini": {
                        "url": "http://mac",
                        "request_types": {"coding": {"model": "qwen", "priority": 10}},
                    },
                    "linux-2080ti": {
                        "url": "http://linux",
                        "request_types": {"coding": {"model": "qwen", "priority": 20}},
                    },
                },
            }
        ),
        controller_request=fake_controller_request,
    )

    async def fake_chat(model_name, payload):
        return {"choices": [{"message": {"content": "hello from library"}}]}, {"route": payload["target"]}

    app.state.chat_proxy.chat_with_meta = fake_chat
    client = TestClient(app)
    thread_id = client.post(
        "/lm-api/v1/threads",
        json={"metadata": {"request_type": "coding"}},
    ).json()["id"]

    message_response = client.post(
        f"/lm-api/v1/threads/{thread_id}/messages",
        json={"role": "user", "content": "hello", "model": "qwen"},
    )

    assert message_response.status_code == 200
    assert message_response.json()["route"]["node"] == "linux-2080ti"
    internal_events = client.get(f"/lm-api/v1/threads/{thread_id}/events?include_internal=true").json()
    route_event = [event for event in internal_events if event["event_type"] == "routing_decision"][0]
    assert route_event["content"]["reason"] == "request_type_artifact_gguf_present"


def test_threads_api_returns_404_for_unknown_thread_events(tmp_path):
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
                    }
                },
            }
        )
    )
    client = TestClient(app)

    response = client.get("/lm-api/v1/threads/not-a-thread/events")

    assert response.status_code == 404


def test_threads_api_internal_events_require_admin_role(tmp_path):
    prepare_all_persistence_dbs(tmp_path)
    app = create_app(
        config=load_config(
            {
                "mode": "controller",
                "log_dir": str(tmp_path),
                "nodes": {},
            }
        )
    )
    admin_key = app.state.auth_store.create_key("admin", "admin")["key"]
    viewer_key = app.state.auth_store.create_key("viewer", "viewer")["key"]
    admin = FastAPITestClient(app)
    admin.headers.update({"X-Llama-Pack-Key": admin_key})
    viewer = FastAPITestClient(app)
    viewer.headers.update({"X-Llama-Pack-Key": viewer_key})

    thread = admin.post("/lm-api/v1/threads", json={"title": "x"}).json()
    public_response = viewer.get(f"/lm-api/v1/threads/{thread['id']}/events")
    internal_response = viewer.get(f"/lm-api/v1/threads/{thread['id']}/events?include_internal=true")
    admin_internal_response = admin.get(f"/lm-api/v1/threads/{thread['id']}/events?include_internal=true")

    assert public_response.status_code == 200
    assert internal_response.status_code == 403
    assert admin_internal_response.status_code == 200


@pytest.mark.asyncio
async def test_post_message_async_stamps_shared_turn_id_on_all_events(tmp_path):
    service = _service(tmp_path, chat_proxy=RecordingChatProxy())
    thread = _thread(service)

    await service.post_message_async(thread["id"], "user", "Hello", None, "auto", None)

    events = service.list_events(thread["id"], include_internal=True)
    turn_ids = {event["turn_id"] for event in events}
    assert len(turn_ids) == 1, "all events in a turn should share the same turn_id"
    assert None not in turn_ids, "turn_id should not be None"


@pytest.mark.asyncio
async def test_post_message_async_uses_distinct_turn_id_per_turn(tmp_path):
    service = _service(tmp_path, chat_proxy=RecordingChatProxy(responses=["first", "second"]))
    thread = _thread(service)

    await service.post_message_async(thread["id"], "user", "First", None, "auto", None)
    await service.post_message_async(thread["id"], "user", "Second", None, "auto", None)

    all_events = service.list_events(thread["id"], include_internal=True)
    turn_ids = [event["turn_id"] for event in all_events]
    unique_turn_ids = set(turn_ids)
    assert len(unique_turn_ids) == 2, "each user turn should get a distinct turn_id"


@pytest.mark.asyncio
async def test_agent_request_and_agent_response_helpers_record_internal_events_with_turn_id(tmp_path):
    service = _service(tmp_path, chat_proxy=RecordingChatProxy())
    thread = _thread(service)
    turn_id = "turn-manual-test"
    route = {"node": "linux-2080ti", "model": "qwen", "strategy": "deterministic", "reason": "request_type"}

    service._append_agent_request(
        thread["id"], turn_id, node="linux-2080ti", model="qwen",
        messages=[{"role": "user", "content": "q"}],
    )
    service._append_agent_response(
        thread["id"], turn_id, node="linux-2080ti", model="qwen",
        content="agent answer", route=route,
    )

    internal = service.list_events(thread["id"], include_internal=True)
    assert [e["event_type"] for e in internal] == ["agent_request", "agent_response"]
    assert all(e["turn_id"] == turn_id for e in internal)
    assert all(not e["public"] for e in internal)
    assert internal[1]["content"]["text"] == "agent answer"


@pytest.mark.asyncio
async def test_post_message_async_error_event_carries_turn_id(tmp_path):
    service = _service(tmp_path, model_running=lambda node, model: False)
    thread = _thread(service)

    with pytest.raises(ValueError):
        await service.post_message_async(thread["id"], "user", "Fail me", None, "auto", None)

    all_events = service.list_events(thread["id"], include_internal=True)
    error_event = next(e for e in all_events if e["event_type"] == "error")
    user_event = next(e for e in all_events if e["event_type"] == "user_message")
    assert error_event["turn_id"] is not None
    assert error_event["turn_id"] == user_event["turn_id"]


def _fanout_config():
    return load_config(
        {
            "mode": "controller",
            "routing_fanout_enabled": True,
            "routing_fanout_max": 3,
            "nodes": {
                "mac-mini": {
                    "url": "http://mac",
                    "default_model": "gemma",
                    "request_types": {"coding": {"model": "gemma", "priority": 10}},
                },
                "linux-2080ti": {
                    "url": "http://linux",
                    "default_model": "qwen",
                    "request_types": {"coding": {"model": "qwen", "priority": 20}},
                },
            },
        }
    )


def _fanout_service(tmp_path, chat_proxy=None):
    return ThreadService(
        config=_fanout_config(),
        store=ThreadStore(tmp_path / "threads.db"),
        chat_proxy=chat_proxy or RecordingChatProxy(responses=["mac reply", "linux reply"]),
        model_running=lambda node, model: True,
    )


@pytest.mark.asyncio
async def test_fanout_calls_all_agent_targets_and_records_agent_events(tmp_path):
    chat_proxy = RecordingChatProxy(responses=["mac reply", "linux reply"])
    service = _fanout_service(tmp_path, chat_proxy=chat_proxy)
    thread = service.create_thread(title=None, default_model=None, metadata={"request_type": "coding"}, created_by=None)

    response = await service.post_message_async(thread["id"], "user", "hello", None, "auto", None)

    assert response["message"]["role"] == "assistant"
    assert len(chat_proxy.calls) == 2
    internal = service.list_events(thread["id"], include_internal=True)
    event_types = [e["event_type"] for e in internal]
    assert event_types.count("agent_request") == 2
    assert event_types.count("agent_response") == 2


@pytest.mark.asyncio
async def test_fanout_records_aggregation_event_with_all_outputs(tmp_path):
    chat_proxy = RecordingChatProxy(responses=["mac reply", "linux reply"])
    service = _fanout_service(tmp_path, chat_proxy=chat_proxy)
    thread = service.create_thread(title=None, default_model=None, metadata={"request_type": "coding"}, created_by=None)

    await service.post_message_async(thread["id"], "user", "hello", None, "auto", None)

    internal = service.list_events(thread["id"], include_internal=True)
    agg_events = [e for e in internal if e["event_type"] == "aggregation"]
    assert len(agg_events) == 1
    outputs = agg_events[0]["content"]["outputs"]
    assert len(outputs) == 2
    assert {o["content"] for o in outputs} == {"mac reply", "linux reply"}


@pytest.mark.asyncio
async def test_fanout_produces_single_public_assistant_message(tmp_path):
    chat_proxy = RecordingChatProxy(responses=["mac reply", "linux reply"])
    service = _fanout_service(tmp_path, chat_proxy=chat_proxy)
    thread = service.create_thread(title=None, default_model=None, metadata={"request_type": "coding"}, created_by=None)

    await service.post_message_async(thread["id"], "user", "hello", None, "auto", None)

    public_events = service.list_events(thread["id"], include_internal=False)
    assert [e["event_type"] for e in public_events] == ["user_message", "assistant_message"]
    assistant = public_events[-1]
    assert "mac reply" in assistant["content"]["text"]
    assert "linux reply" in assistant["content"]["text"]


@pytest.mark.asyncio
async def test_fanout_partial_failure_still_produces_assistant_message(tmp_path):
    call_count = 0

    class PartialFailProxy:
        async def chat_with_meta(self, model_name, payload):
            nonlocal call_count
            call_count += 1
            if call_count == 2:
                raise RuntimeError("node down")
            return {"choices": [{"message": {"content": "good reply"}}]}, {}

    service = _fanout_service(tmp_path, chat_proxy=PartialFailProxy())
    thread = service.create_thread(title=None, default_model=None, metadata={"request_type": "coding"}, created_by=None)

    response = await service.post_message_async(thread["id"], "user", "hello", None, "auto", None)

    assert response["message"]["content"] == "good reply"
    public_events = service.list_events(thread["id"], include_internal=False)
    assert public_events[-1]["event_type"] == "assistant_message"


@pytest.mark.asyncio
async def test_fanout_off_single_agent_path_unchanged(tmp_path):
    chat_proxy = RecordingChatProxy(responses=["single reply"])
    service = _service(tmp_path, chat_proxy=chat_proxy)
    thread = _thread(service)

    response = await service.post_message_async(thread["id"], "user", "hello", None, "auto", None)

    assert len(chat_proxy.calls) == 1
    assert response["message"]["content"] == "single reply"
    internal = service.list_events(thread["id"], include_internal=True)
    assert "aggregation" not in [e["event_type"] for e in internal]
    assert "agent_request" not in [e["event_type"] for e in internal]


# ---------------------------------------------------------------------------
# stream_message_async tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_stream_message_async_route_event_appears_before_token_events(tmp_path):
    service = _service(tmp_path, chat_proxy=RecordingChatProxy())
    thread = _thread(service)

    stream, route = await service.stream_message_async(thread["id"], "user", "Hello", None, "auto", None)

    collected = b""
    async for chunk in stream:
        collected += chunk

    text = collected.decode()
    lines = [line for line in text.splitlines() if line.startswith("data:")]
    assert lines, "expected at least one SSE data line"
    first_data = lines[0][5:].strip()
    first_event = __import__("json").loads(first_data)
    assert first_event["type"] == "route"
    assert first_event["route"]["node"] == "linux-2080ti"
    assert first_event["route"]["model"] == "qwen"


@pytest.mark.asyncio
async def test_stream_message_async_reasoning_and_content_chunks_present(tmp_path):
    service = _service(tmp_path, chat_proxy=RecordingChatProxy())
    thread = _thread(service)

    stream, _route = await service.stream_message_async(thread["id"], "user", "Hello", None, "auto", None)

    collected = b""
    async for chunk in stream:
        collected += chunk

    text = collected.decode()
    assert "thinking" in text
    assert "answer" in text


@pytest.mark.asyncio
async def test_stream_message_async_persists_assistant_event_with_content_and_reasoning(tmp_path):
    service = _service(tmp_path, chat_proxy=RecordingChatProxy())
    thread = _thread(service)

    stream, _route = await service.stream_message_async(thread["id"], "user", "Hello", None, "auto", None)
    async for _ in stream:
        pass

    public_events = service.list_events(thread["id"], include_internal=False)
    assert [e["event_type"] for e in public_events] == ["user_message", "assistant_message"]
    assistant = public_events[-1]
    assert assistant["content"]["text"] == "answer"
    assert assistant["content"]["reasoning_text"] == "thinking"


@pytest.mark.asyncio
async def test_stream_message_async_upstream_error_appends_error_event_and_emits_sse_error(tmp_path):
    import json as _json

    class FailingStreamProxy:
        async def stream_with_meta(self, model_name, payload):
            async def _stream():
                yield b'data: {"choices":[{"delta":{"content":"partial"}}]}\n\n'
                raise RuntimeError("upstream exploded")

            return _stream(), {}

    service = _service(tmp_path, chat_proxy=FailingStreamProxy())
    thread = _thread(service)

    stream, _route = await service.stream_message_async(thread["id"], "user", "Fail me", None, "auto", None)
    collected = b""
    async for chunk in stream:
        collected += chunk

    text = collected.decode()
    error_lines = [line for line in text.splitlines() if line.startswith("data:") and "error" in line]
    assert error_lines, "expected an SSE error event"
    error_payload = _json.loads(error_lines[0][5:].strip())
    assert error_payload["type"] == "error"
    assert "upstream exploded" in error_payload["error"]
    assert "data: [DONE]" in text

    public_events = service.list_events(thread["id"], include_internal=False)
    error_events = [e for e in public_events if e["event_type"] == "error"]
    assert error_events, "expected a public CHAT_PROXY_ERROR event"
    assert error_events[0]["error_code"] == "CHAT_PROXY_ERROR"


def test_threads_stream_api_returns_text_event_stream_with_route_and_deltas(tmp_path):
    import json as _json

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
            }
        )
    )

    async def fake_stream(model_name, payload):
        async def _stream():
            yield b'data: {"choices":[{"delta":{"reasoning_content":"thinking"}}]}\n\n'
            yield b'data: {"choices":[{"delta":{"content":"the answer"}}]}\n\n'
            yield b"data: [DONE]\n\n"

        return _stream(), {"route": payload["target"]}

    app.state.chat_proxy.stream_with_meta = fake_stream
    app.state.thread_service.routing_policy.model_running = lambda node, model: True
    client = TestClient(app)

    thread_id = client.post(
        "/lm-api/v1/threads",
        json={"metadata": {"request_type": "coding"}},
    ).json()["id"]

    response = client.post(
        f"/lm-api/v1/threads/{thread_id}/messages/stream",
        json={"role": "user", "content": "stream this"},
    )

    assert response.status_code == 200
    assert "text/event-stream" in response.headers["content-type"]
    body = response.text
    data_lines = [line[5:].strip() for line in body.splitlines() if line.startswith("data:") and line[5:].strip() != "[DONE]"]
    parsed = [_json.loads(line) for line in data_lines]

    assert parsed[0]["type"] == "route"
    assert parsed[0]["route"]["node"] == "linux-2080ti"
    reasoning_chunks = [p for p in parsed if p.get("choices", [{}])[0].get("delta", {}).get("reasoning_content")]
    content_chunks = [p for p in parsed if p.get("choices", [{}])[0].get("delta", {}).get("content")]
    assert reasoning_chunks
    assert content_chunks
    assert "[DONE]" in body


def test_threads_stream_api_persists_assistant_and_forwards_generation_params(tmp_path):
    prepare_all_persistence_dbs(tmp_path)
    captured_payloads = []
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
            }
        )
    )

    async def fake_stream(model_name, payload):
        captured_payloads.append({"model_name": model_name, "payload": payload})

        async def _stream():
            yield b'data: {"choices":[{"delta":{"reasoning_content":"thinking "}}]}\n\n'
            yield b'data: {"choices":[{"delta":{"content":"hello"}}]}\n\n'
            yield b"data: [DONE]\n\n"

        return _stream(), {"route": payload["target"]}

    app.state.chat_proxy.stream_with_meta = fake_stream
    app.state.thread_service.routing_policy.model_running = lambda node, model: True
    client = TestClient(app)
    thread_id = client.post(
        "/lm-api/v1/threads",
        json={"metadata": {"request_type": "coding"}},
    ).json()["id"]

    response = client.post(
        f"/lm-api/v1/threads/{thread_id}/messages/stream",
        json={
            "role": "user",
            "content": "Hello",
            "model": "qwen",
            "target": "auto",
            "temperature": 0.2,
            "max_tokens": 64,
            "top_p": 0.8,
            "reasoning": True,
            "metadata": {"request_type": "coding"},
        },
    )

    assert response.status_code == 200
    assert '"type": "route"' in response.text
    assert '"node": "linux-2080ti"' in response.text
    assert "hello" in response.text
    assert captured_payloads[0]["model_name"] == "qwen"
    assert captured_payloads[0]["payload"]["temperature"] == 0.2
    assert captured_payloads[0]["payload"]["max_tokens"] == 64
    assert captured_payloads[0]["payload"]["top_p"] == 0.8
    assert captured_payloads[0]["payload"]["reasoning"] is True
    events = client.get(f"/lm-api/v1/threads/{thread_id}/events").json()
    assert [event["event_type"] for event in events] == ["user_message", "assistant_message"]
    assert events[1]["content"]["text"] == "hello"
    assert events[1]["content"]["reasoning_text"] == "thinking "


def test_threads_stream_api_forwards_agent_tool_runtime_fields(tmp_path):
    prepare_all_persistence_dbs(tmp_path)
    captured_payloads = []
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
            }
        )
    )

    async def fake_stream(model_name, payload):
        captured_payloads.append({"model_name": model_name, "payload": payload})

        async def _stream():
            yield b'data: {"choices":[{"delta":{"content":"tool stream"}}]}\n\n'
            yield b"data: [DONE]\n\n"

        return _stream(), {"route": payload["target"]}

    app.state.chat_proxy.stream_with_meta = fake_stream
    app.state.thread_service.routing_policy.model_running = lambda node, model: True
    client = TestClient(app)
    thread_id = client.post(
        "/lm-api/v1/threads",
        json={"metadata": {"request_type": "coding"}},
    ).json()["id"]

    response = client.post(
        f"/lm-api/v1/threads/{thread_id}/messages/stream",
        json={
            "role": "user",
            "content": "inspect project graph",
            "model": "qwen",
            "tool_runtime": "agent",
            "tool_choice": {"type": "function", "function": {"name": "graph_overview"}},
            "project_id": "project-1",
            "agent_tool_max_iterations": 5,
        },
    )

    assert response.status_code == 200
    assert captured_payloads[0]["model_name"] == "qwen"
    assert captured_payloads[0]["payload"]["tool_runtime"] == "agent"
    assert captured_payloads[0]["payload"]["tool_choice"] == {"type": "function", "function": {"name": "graph_overview"}}
    assert captured_payloads[0]["payload"]["project_id"] == "project-1"
    assert captured_payloads[0]["payload"]["agent_tool_max_iterations"] == 5


# ---------------------------------------------------------------------------
# Ticket 10.2 — Workflow Thread Type
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_workflow_chains_step_outputs_as_user_inputs(tmp_path):
    """Each step receives the previous step's output as its user-role input."""
    received: list[tuple[str, list[dict]]] = []

    class PipelineChatProxy:
        async def chat_with_meta(self, model_name, payload):
            received.append((model_name, payload["messages"]))
            instructions = payload["messages"][0]["content"]
            user_input = payload["messages"][1]["content"]
            return {"choices": [{"message": {"content": f"{instructions}:{user_input}"}}]}, {}

    service = _service(tmp_path, chat_proxy=PipelineChatProxy())
    thread = _thread(service)

    result = await service.run_workflow_async(
        thread_id=thread["id"],
        content="seed",
        steps=[
            WorkflowStep(label="classify", instructions="classify"),
            WorkflowStep(label="generate", instructions="generate"),
            WorkflowStep(label="summarize", instructions="summarize"),
        ],
        model=None,
        target="auto",
        metadata=None,
    )

    # Each step's system message is the step instructions
    assert received[0][1][0] == {"role": "system", "content": "classify"}
    assert received[1][1][0] == {"role": "system", "content": "generate"}
    assert received[2][1][0] == {"role": "system", "content": "summarize"}

    # Each step's user input is the prior step's output
    assert received[0][1][1]["content"] == "seed"
    assert received[1][1][1]["content"] == "classify:seed"
    assert received[2][1][1]["content"] == "generate:classify:seed"

    # Final message is last step's output
    assert result["message"]["content"] == "summarize:generate:classify:seed"
    assert len(result["workflow_steps"]) == 3
    assert [s["label"] for s in result["workflow_steps"]] == ["classify", "generate", "summarize"]


@pytest.mark.asyncio
async def test_workflow_step_events_are_internal_assistant_is_public(tmp_path):
    """workflow_step events are non-public; only user_message + assistant_message are public."""
    service = _service(tmp_path, chat_proxy=RecordingChatProxy(responses=["classified", "final"]))
    thread = _thread(service)

    await service.run_workflow_async(
        thread_id=thread["id"],
        content="input",
        steps=[
            WorkflowStep(label="classify", instructions="classify this"),
            WorkflowStep(label="respond", instructions="respond based on class"),
        ],
        model=None,
        target="auto",
        metadata=None,
    )

    public_events = service.list_events(thread["id"], include_internal=False)
    assert [e["event_type"] for e in public_events] == ["user_message", "assistant_message"]
    assert public_events[-1]["content"]["text"] == "final"

    all_events = service.list_events(thread["id"], include_internal=True)
    step_events = [e for e in all_events if e["event_type"] == "workflow_step"]
    # 2 steps × 2 events each (running + complete) = 4
    assert len(step_events) == 4
    assert all(not e["public"] for e in step_events)
    assert {e["content"]["status"] for e in step_events} == {"running", "complete"}


@pytest.mark.asyncio
async def test_workflow_step_failure_appends_failed_event_and_error_event(tmp_path):
    """When a step's chat proxy raises, a failed workflow_step event and error event are recorded."""
    call_count = 0

    class FailOnSecondProxy:
        async def chat_with_meta(self, model_name, payload):
            nonlocal call_count
            call_count += 1
            if call_count == 2:
                raise RuntimeError("inference failed")
            return {"choices": [{"message": {"content": f"ok-{call_count}"}}]}, {}

    service = _service(tmp_path, chat_proxy=FailOnSecondProxy())
    thread = _thread(service)

    with pytest.raises(RuntimeError, match="inference failed"):
        await service.run_workflow_async(
            thread_id=thread["id"],
            content="start",
            steps=[
                WorkflowStep(label="step-a", instructions="do a"),
                WorkflowStep(label="step-b", instructions="do b"),
                WorkflowStep(label="step-c", instructions="do c"),
            ],
            model=None,
            target="auto",
            metadata=None,
        )

    all_events = service.list_events(thread["id"], include_internal=True)
    step_events = [e for e in all_events if e["event_type"] == "workflow_step"]

    # step-a: running + complete; step-b: running + failed; step-c: never ran
    assert any(e["content"]["label"] == "step-b" and e["content"]["status"] == "failed" for e in step_events)
    assert not any(e["content"]["label"] == "step-c" for e in step_events)

    error_events = [e for e in all_events if e["event_type"] == "error"]
    assert len(error_events) == 1
    assert error_events[0]["error_code"] == "WORKFLOW_STEP_ERROR"


@pytest.mark.asyncio
async def test_workflow_routing_failure_appends_error_event(tmp_path):
    """When routing fails for a step, an error event is recorded and ValueError propagates."""
    service = ThreadService(
        config=load_config({"mode": "controller", "nodes": {}}),
        store=ThreadStore(tmp_path / "threads.db"),
        chat_proxy=RecordingChatProxy(),
        model_running=lambda node, model: True,
    )
    thread = service.create_thread(title="t", default_model=None, metadata={}, created_by=None)

    with pytest.raises(ValueError):
        await service.run_workflow_async(
            thread_id=thread["id"],
            content="start",
            steps=[WorkflowStep(label="classify", instructions="classify this")],
            model=None,
            target="auto",
            metadata=None,
        )

    all_events = service.list_events(thread["id"], include_internal=True)
    error_events = [e for e in all_events if e["event_type"] == "error"]
    assert len(error_events) == 1
    assert error_events[0]["error_code"] == "WORKFLOW_ROUTING_ERROR"


@pytest.mark.asyncio
async def test_workflow_step_uses_per_step_model_override(tmp_path):
    """A step with an explicit model uses that model instead of the workflow default."""
    received: list[str] = []

    class ModelRecordingProxy:
        async def chat_with_meta(self, model_name, payload):
            received.append(model_name)
            return {"choices": [{"message": {"content": f"from-{model_name}"}}]}, {}

    service = _service(tmp_path, chat_proxy=ModelRecordingProxy())
    thread = _thread(service)

    result = await service.run_workflow_async(
        thread_id=thread["id"],
        content="input",
        steps=[
            WorkflowStep(label="classify", instructions="classify", model="qwen"),
            WorkflowStep(label="generate", instructions="generate"),  # inherits default
        ],
        model=None,
        target="auto",
        metadata=None,
    )

    assert received[0] == "qwen"
    # Second step uses the node's default model (qwen in _config)
    assert received[1] == "qwen"
    assert len(result["workflow_steps"]) == 2


def test_workflow_http_endpoint_returns_assistant_message(tmp_path):
    """End-to-end: POST /threads/{id}/workflow returns the final step output."""
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
            }
        )
    )

    call_index = 0

    async def fake_chat(model_name, payload):
        nonlocal call_index
        call_index += 1
        return {"choices": [{"message": {"content": f"step-{call_index}-output"}}]}, {}

    app.state.chat_proxy.chat_with_meta = fake_chat
    app.state.thread_service.routing_policy.model_running = lambda node, model: True

    client = TestClient(app)
    thread_id = client.post(
        "/lm-api/v1/threads",
        json={"title": "wf", "metadata": {"request_type": "coding"}},
    ).json()["id"]

    resp = client.post(
        f"/lm-api/v1/threads/{thread_id}/workflow",
        json={
            "content": "starting input",
            "steps": [
                {"label": "classify", "instructions": "classify this"},
                {"label": "respond", "instructions": "respond to classification"},
            ],
        },
    )

    assert resp.status_code == 200
    body = resp.json()
    assert body["message"]["content"] == "step-2-output"
    assert body["route"]["strategy"] == "workflow"
    assert len(body["workflow_steps"]) == 2
    assert body["workflow_steps"][0]["label"] == "classify"
    assert body["workflow_steps"][1]["label"] == "respond"

    public_events = client.get(f"/lm-api/v1/threads/{thread_id}/events").json()
    assert [e["event_type"] for e in public_events] == ["user_message", "assistant_message"]
