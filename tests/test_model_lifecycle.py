from __future__ import annotations

import pytest
import httpx

from llama_pack.core.model_lifecycle import ManagedModelLifecycle


class LifecycleNodeRegistry:
    def __init__(self) -> None:
        self.running: set[str] = set()
        self.calls: list[tuple[str, str, str]] = []

    async def request_node(self, node_name: str, method: str, path: str):
        self.calls.append((node_name, method, path))
        if method == "GET":
            return [
                {"name": "canonical-model", "running": "canonical-model" in self.running},
            ]
        if path == "/lm-api/v1/models/saved-label/start":
            self.running.add("canonical-model")
            return {"name": "canonical-model", "running": True}
        if path == "/lm-api/v1/models/canonical-model/stop":
            self.running.discard("canonical-model")
            return {"name": "canonical-model", "running": False}
        return {"ok": True}


@pytest.mark.asyncio
async def test_load_exclusive_waits_for_canonical_model_name_from_start_response():
    registry = LifecycleNodeRegistry()
    lifecycle = ManagedModelLifecycle(registry, 0.0)

    await lifecycle.load_exclusive("mac-mini", "saved-label", [])

    assert registry.running == {"canonical-model"}
    assert registry.calls == [("mac-mini", "POST", "/lm-api/v1/models/saved-label/start")]


@pytest.mark.asyncio
async def test_load_exclusive_accepts_running_start_response_without_status_poll():
    class RunningStartRegistry:
        def __init__(self) -> None:
            self.calls: list[tuple[str, str, str]] = []

        async def request_node(self, node_name: str, method: str, path: str):
            self.calls.append((node_name, method, path))
            if method == "GET":
                raise AssertionError("running start response should not require a status poll")
            return {"name": "saved-label", "running": True}

    registry = RunningStartRegistry()
    lifecycle = ManagedModelLifecycle(registry, 0.0)

    await lifecycle.load_exclusive("mac-mini", "saved-label", [])

    assert registry.calls == [("mac-mini", "POST", "/lm-api/v1/models/saved-label/start")]


@pytest.mark.asyncio
async def test_model_start_timeout_reports_observed_model_statuses():
    class TimeoutRegistry:
        async def request_node(self, node_name: str, method: str, path: str):
            if method == "GET":
                return [{"name": "other-model", "running": True}]
            return {"name": "saved-label", "running": False}

    lifecycle = ManagedModelLifecycle(TimeoutRegistry(), 0.0)

    with pytest.raises(RuntimeError) as exc_info:
        await lifecycle.load_exclusive("mac-mini", "saved-label", [])

    message = str(exc_info.value)
    assert "model_start_timeout" in message
    assert "node=mac-mini" in message
    assert "model=saved-label" in message
    assert "other-model" in message


@pytest.mark.asyncio
async def test_load_exclusive_retries_transient_model_status_gateway_errors():
    class TransientGatewayRegistry:
        def __init__(self) -> None:
            self.status_attempts = 0

        async def request_node(self, node_name: str, method: str, path: str):
            if method == "GET":
                self.status_attempts += 1
                if self.status_attempts == 1:
                    request = httpx.Request("GET", "https://mac-mini.local/lm-api/v1/models")
                    response = httpx.Response(502, request=request)
                    raise httpx.HTTPStatusError("502 Bad Gateway", request=request, response=response)
                return [{"name": "saved-label", "running": True}]
            return {"name": "saved-label", "running": False}

    registry = TransientGatewayRegistry()
    lifecycle = ManagedModelLifecycle(registry, 2.0)

    await lifecycle.load_exclusive("mac-mini", "saved-label", [])

    assert registry.status_attempts == 2
