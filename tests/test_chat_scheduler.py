from __future__ import annotations

import asyncio

import pytest

from llama_pack.core.chat.scheduler import ChatAdmissionError, ChatScheduler


class BlockingProxy:
    def __init__(self) -> None:
        self.started = asyncio.Event()
        self.release = asyncio.Event()
        self.calls: list[tuple[str, dict]] = []

    async def chat_with_meta(self, model_name: str, payload: dict):
        self.calls.append((model_name, payload))
        self.started.set()
        await self.release.wait()
        return {"choices": [{"message": {"content": "ok"}}]}, {"route": "local"}


@pytest.mark.asyncio
async def test_scheduler_rejects_when_target_queue_is_full():
    proxy = BlockingProxy()
    scheduler = ChatScheduler(proxy, max_active_per_target=1, max_queue_per_target=0)

    first = asyncio.create_task(scheduler.chat_with_meta("qwen", {"messages": []}))
    await proxy.started.wait()

    with pytest.raises(ChatAdmissionError) as raised:
        await scheduler.chat_with_meta("qwen", {"messages": []})

    assert raised.value.status_code == 429
    proxy.release.set()
    await first


@pytest.mark.asyncio
async def test_scheduler_limits_public_session_even_across_targets():
    proxy = BlockingProxy()
    scheduler = ChatScheduler(
        proxy,
        max_active_per_target=10,
        max_queue_per_target=10,
        max_active_per_session=1,
        max_queue_per_session=0,
    )

    first = asyncio.create_task(
        scheduler.chat_with_meta("qwen", {"messages": [], "target": "node:a", "_admission_session_id": "browser-1"})
    )
    await proxy.started.wait()

    with pytest.raises(ChatAdmissionError) as raised:
        await scheduler.chat_with_meta(
            "llama",
            {"messages": [], "target": "node:b", "_admission_session_id": "browser-1"},
        )

    assert raised.value.status_code == 429
    proxy.release.set()
    await first
    assert "_admission_session_id" not in proxy.calls[0][1]
