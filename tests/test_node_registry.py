import pytest

from llama_pack.core.config import NodeConfig, load_config
from llama_pack.core.nodes.registry import NodeRegistry
from llama_pack.storage.db import InMemoryStore
from llama_pack.api.routes.nodes.common import stream_node_request


def test_dynamic_nodes_and_heartbeats_persist_via_store():
    config = load_config({"mode": "controller", "nodes": {}})
    store = InMemoryStore()

    registry = NodeRegistry(config=config, store=store)
    registry.register_node("win", NodeConfig(url="http://win-agent:9000", api_key="k", verify_tls=False))

    first_nodes = registry.list_nodes()
    assert first_nodes[0]["name"] == "win"
    assert first_nodes[0]["registration"] == "dynamic"
    assert first_nodes[0]["last_heartbeat"] is not None

    restored = NodeRegistry(config=config, store=store)
    restored_nodes = restored.list_nodes()
    assert restored_nodes[0]["name"] == "win"
    assert restored_nodes[0]["registration"] == "dynamic"
    assert restored_nodes[0]["last_heartbeat"] is not None


def test_registering_static_node_preserves_static_credentials_and_registration():
    config = load_config(
        {
            "mode": "controller",
            "nodes": {
                "linux": {
                    "url": "http://old-linux:9137",
                    "api_key": "secret",
                    "verify_tls": False,
                }
            },
        }
    )
    registry = NodeRegistry(config=config)

    registry.register_node("linux", NodeConfig(url="http://new-linux:9137"))

    nodes = registry.list_nodes()
    assert nodes[0]["name"] == "linux"
    assert nodes[0]["url"] == "http://new-linux:9137"
    assert nodes[0]["verify_tls"] is False
    assert nodes[0]["registration"] == "static"
    assert registry.get_node_config("linux").api_key == "secret"
    assert registry.get_node_config("linux").verify_tls is False


def test_registering_static_node_inherits_scheme_when_agent_url_is_scheme_less():
    config = load_config(
        {
            "mode": "controller",
            "nodes": {
                "mac-mini": {
                    "url": "https://mac-mini.local",
                    "api_key": "secret",
                    "verify_tls": True,
                }
            },
        }
    )
    registry = NodeRegistry(config=config)

    registry.register_node("mac-mini", NodeConfig(url="mac-mini.local"))

    assert registry.get_node_config("mac-mini").url == "https://mac-mini.local"
    assert registry.list_nodes()[0]["url"] == "https://mac-mini.local"


def test_persisted_static_node_override_inherits_configured_scheme():
    config = load_config(
        {
            "mode": "controller",
            "nodes": {
                "mac-mini": {
                    "url": "https://mac-mini.local",
                    "api_key": "secret",
                    "verify_tls": False,
                }
            },
        }
    )
    store = InMemoryStore()
    store.save(
        {
            "node_overrides": {
                "mac-mini": {
                    "url": "mac-mini.local",
                    "api_key": None,
                    "verify_tls": True,
                }
            }
        }
    )

    registry = NodeRegistry(config=config, store=store)

    node = registry.get_node_config("mac-mini")
    assert node.url == "https://mac-mini.local"
    assert node.api_key == "secret"
    assert node.verify_tls is False


@pytest.mark.asyncio
async def test_request_node_rejects_node_url_without_http_scheme():
    config = load_config(
        {
            "mode": "controller",
            "nodes": {"mac-mini": {"url": "mac-mini.local"}},
        }
    )
    registry = NodeRegistry(config=config)

    with pytest.raises(ValueError, match=r"nodes\.mac-mini\.url must start with http:// or https://"):
        await registry.request_node("mac-mini", "GET", "/lm-api/v1/models")


@pytest.mark.asyncio
async def test_request_node_allows_long_running_default_request(monkeypatch):
    config = load_config(
        {
            "mode": "controller",
            "nodes": {
                "mac-mini": {
                    "url": "https://mac-mini.local",
                    "api_key": "secret",
                    "verify_tls": False,
                }
            },
        }
    )
    registry = NodeRegistry(config=config)
    seen = {}

    class FakeResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {"ok": True}

    class FakeClient:
        def __init__(self, timeout=None, verify=True):
            seen["timeout"] = timeout
            seen["verify"] = verify

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

        async def request(self, method, url, headers, json):
            seen["method"] = method
            seen["url"] = url
            seen["headers"] = headers
            seen["json"] = json
            return FakeResponse()

    monkeypatch.setattr("llama_pack.core.nodes.registry.httpx.AsyncClient", FakeClient)

    result = await registry.request_node(
        "mac-mini",
        "POST",
        "/lm-api/v1/runtime/tool-loop-evals/run",
        {"model": "gpt-oss-20b"},
        timeout=None,
    )

    assert result == {"ok": True}
    assert seen == {
        "timeout": None,
        "verify": False,
        "method": "POST",
        "url": "https://mac-mini.local/lm-api/v1/runtime/tool-loop-evals/run",
        "headers": {"X-Llama-Manager-Key": "secret"},
        "json": {"model": "gpt-oss-20b"},
    }


def test_updates_static_node_runtime_config_without_changing_registration():
    config = load_config(
        {
            "mode": "controller",
            "nodes": {"win": {"url": "http://old-win:9000", "api_key": "old", "verify_tls": True}},
        }
    )
    registry = NodeRegistry(config=config)

    updated = registry.update_node(
        "win",
        NodeConfig(url="http://new-win:9000", api_key="new", verify_tls=False),
    )

    assert updated["name"] == "win"
    assert updated["url"] == "http://new-win:9000"
    assert updated["verify_tls"] is False
    assert updated["registration"] == "static"
    assert registry.get_node_config("win").api_key == "new"
    assert registry.get_node_config("win").verify_tls is False


def test_updates_static_node_inherits_scheme_when_url_is_scheme_less():
    config = load_config(
        {
            "mode": "controller",
            "nodes": {"mac-mini": {"url": "https://mac-mini.local", "api_key": "old"}},
        }
    )
    registry = NodeRegistry(config=config)

    updated = registry.update_node("mac-mini", NodeConfig(url="mac-mini.local"))

    assert updated["url"] == "https://mac-mini.local"
    assert registry.get_node_config("mac-mini").url == "https://mac-mini.local"
    assert registry.get_node_config("mac-mini").api_key == "old"


@pytest.mark.asyncio
async def test_stream_node_request_relays_upstream_chunks(monkeypatch):
    config = load_config(
        {
            "mode": "controller",
            "nodes": {"win": {"url": "http://win-agent:9000", "api_key": "secret", "verify_tls": False}},
        }
    )
    registry = NodeRegistry(config=config)
    seen = {}

    class FakeStream:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

        def raise_for_status(self):
            return None

        async def aiter_bytes(self):
            yield b"event: chunk\n"
            yield b'data: {"text":"loaded"}\n\n'

    class FakeClient:
        def __init__(self, timeout=None, verify=True):
            seen["timeout"] = timeout
            seen["verify"] = verify

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

        def stream(self, method, url, headers):
            seen["method"] = method
            seen["url"] = url
            seen["headers"] = headers
            return FakeStream()

    monkeypatch.setattr("llama_pack.api.routes.nodes.common.httpx.AsyncClient", FakeClient)

    response = await stream_node_request(registry, "win", "/logs/qwen/stream?lines=200")
    body = b""
    async for chunk in response.body_iterator:
        body += chunk

    assert seen == {
        "timeout": None,
        "verify": False,
        "method": "GET",
        "url": "http://win-agent:9000/logs/qwen/stream?lines=200",
        "headers": {"X-Llama-Manager-Key": "secret"},
    }
    assert body == b'event: chunk\ndata: {"text":"loaded"}\n\n'
