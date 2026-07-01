import asyncio

import httpx
import pytest

from llama_pack.core.nodes.heartbeat import AgentHeartbeatClient
from llama_pack.core.config import load_config


@pytest.mark.asyncio
async def test_agent_heartbeat_registers_and_beats():
    calls = []

    async def fake_request(method, url, payload):
        calls.append((method, url, payload))
        return {"ok": True}

    config = load_config(
        {
            "mode": "agent",
            "controller_url": "http://controller:9100",
            "node_name": "win-1",
            "agent_url": "http://10.0.0.2:9000",
            "agent_api_key": "agent-secret",
            "heartbeat_interval_seconds": 1,
            "controller_registration_key_outbound": "join-key",
        }
    )
    client = AgentHeartbeatClient(config, request=fake_request)
    await client.start()
    await asyncio.sleep(1.2)
    await client.stop()

    assert calls[0][0] == "POST"
    assert calls[0][1] == "http://controller:9100/lm-api/v1/nodes/register"
    assert calls[0][2]["name"] == "win-1"
    assert calls[0][2]["url"] == "http://127.0.0.1:9000" or calls[0][2]["url"] == "http://10.0.0.2:9000"
    assert calls[0][2]["api_key"] == "agent-secret"
    assert any(url.endswith("/nodes/win-1/heartbeat") for _, url, _ in calls[1:])


@pytest.mark.asyncio
async def test_agent_heartbeat_disabled_without_controller_info():
    calls = []

    async def fake_request(method, url, payload):
        calls.append((method, url, payload))
        return {"ok": True}

    config = load_config({"mode": "agent"})
    client = AgentHeartbeatClient(config, request=fake_request)
    await client.start()
    await asyncio.sleep(0.1)
    await client.stop()

    assert calls == []


@pytest.mark.asyncio
async def test_agent_heartbeat_loop_survives_failed_heartbeat_send():
    calls = []

    async def flaky_request(method, url, payload):
        calls.append((method, url, payload))
        if url.endswith("/heartbeat"):
            raise RuntimeError("temporary failure")
        return {"ok": True}

    config = load_config(
        {
            "mode": "agent",
            "controller_url": "http://controller:9100",
            "node_name": "linux-1",
            "agent_url": "http://10.0.0.3:9000",
            "heartbeat_interval_seconds": 1,
            "controller_registration_key_outbound": "join-key",
        }
    )
    client = AgentHeartbeatClient(config, request=flaky_request)
    await client.start()
    await asyncio.sleep(0.2)

    assert client._task is not None
    assert not client._task.done()
    assert any(url.endswith("/nodes/linux-1/heartbeat") for _, url, _ in calls)

    await client.stop()


@pytest.mark.asyncio
async def test_agent_heartbeat_records_latest_heartbeat_failure():
    request = httpx.Request("POST", "https://pi-controller.local/lm-api/v1/nodes/mac-mini/heartbeat")
    response = httpx.Response(502, request=request, text="controller upstream unavailable")

    async def failing_request(method, url, payload):
        raise httpx.HTTPStatusError("heartbeat failed", request=request, response=response)

    config = load_config(
        {
            "mode": "agent",
            "controller_url": "https://pi-controller.local",
            "node_name": "mac-mini",
        }
    )
    client = AgentHeartbeatClient(config, request=failing_request)

    with pytest.raises(httpx.HTTPStatusError):
        await client._heartbeat()

    failure = client.latest_node_failure()
    assert failure is not None
    assert failure["method"] == "POST"
    assert failure["endpoint"] == "https://pi-controller.local/lm-api/v1/nodes/mac-mini/heartbeat"
    assert failure["status_code"] == 502
    assert failure["response_detail"] == "controller upstream unavailable"
    assert failure["timestamp"]


@pytest.mark.asyncio
async def test_agent_heartbeat_loop_starts_after_failed_registration():
    calls = []

    async def flaky_request(method, url, payload):
        calls.append((method, url, payload))
        if url.endswith("/nodes/register"):
            raise RuntimeError("registration failed")
        return {"ok": True}

    config = load_config(
        {
            "mode": "agent",
            "controller_url": "http://controller:9100",
            "node_name": "linux-1",
            "agent_url": "http://10.0.0.3:9000",
            "heartbeat_interval_seconds": 1,
            "controller_registration_key_outbound": "join-key",
        }
    )
    client = AgentHeartbeatClient(config, request=flaky_request)
    await client.start()
    await asyncio.sleep(0.2)

    assert client._task is not None
    assert not client._task.done()
    assert any(url.endswith("/nodes/linux-1/heartbeat") for _, url, _ in calls)

    await client.stop()
