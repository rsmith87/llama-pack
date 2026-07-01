from __future__ import annotations

import pytest

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
    assert ("mac-mini", "GET", "/lm-api/v1/models") in registry.calls


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
