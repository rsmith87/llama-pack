from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator
from dataclasses import dataclass
from typing import Any


class ChatAdmissionError(RuntimeError):
    def __init__(self, message: str, *, status_code: int = 503) -> None:
        super().__init__(message)
        self.status_code = status_code


@dataclass
class _Limiter:
    semaphore: asyncio.Semaphore
    queued: int = 0


class ChatScheduler:
    """Admission control for expensive chat generations.

    The scheduler limits active work per model/target and, when a session id is
    provided, limits each public chat session to one active generation at a time.
    """

    def __init__(
        self,
        proxy: Any,
        *,
        max_active_per_target: int = 1,
        max_queue_per_target: int = 32,
        max_active_per_session: int = 1,
        max_queue_per_session: int = 4,
        admission_timeout_seconds: float = 120.0,
    ) -> None:
        self.proxy = proxy
        self.max_active_per_target = max(1, max_active_per_target)
        self.max_queue_per_target = max(0, max_queue_per_target)
        self.max_active_per_session = max(1, max_active_per_session)
        self.max_queue_per_session = max(0, max_queue_per_session)
        self.admission_timeout_seconds = max(0.1, admission_timeout_seconds)
        self._limiters: dict[str, _Limiter] = {}
        self._lock = asyncio.Lock()

    async def chat_with_meta(self, model_name: str, payload: dict[str, Any]) -> tuple[dict[str, Any], dict[str, str]]:
        clean_payload, session_id = self._clean_payload(payload)
        acquired = await self._acquire(model_name, clean_payload, session_id)
        try:
            return await self.proxy.chat_with_meta(model_name, clean_payload)
        finally:
            self._release(acquired)

    async def stream_with_meta(self, model_name: str, payload: dict[str, Any]) -> tuple[AsyncIterator[bytes], dict[str, str]]:
        clean_payload, session_id = self._clean_payload(payload)
        acquired = await self._acquire(model_name, clean_payload, session_id)
        try:
            stream, meta = await self.proxy.stream_with_meta(model_name, clean_payload)
        except Exception:
            self._release(acquired)
            raise

        async def _release_after_stream() -> AsyncIterator[bytes]:
            try:
                async for chunk in stream:
                    yield chunk
            finally:
                self._release(acquired)

        return _release_after_stream(), meta

    async def _acquire(self, model_name: str, payload: dict[str, Any], session_id: str | None) -> list[_Limiter]:
        keys = [self._target_key(model_name, payload)]
        if session_id:
            keys.append(f"session:{session_id}")

        acquired: list[_Limiter] = []
        try:
            for key in keys:
                limiter = await self._reserve(key)
                try:
                    await asyncio.wait_for(limiter.semaphore.acquire(), timeout=self.admission_timeout_seconds)
                except TimeoutError as exc:
                    raise ChatAdmissionError("Chat request timed out waiting for capacity") from exc
                finally:
                    async with self._lock:
                        limiter.queued = max(0, limiter.queued - 1)
                acquired.append(limiter)
        except Exception:
            self._release(acquired)
            raise
        return acquired

    async def _reserve(self, key: str) -> _Limiter:
        async with self._lock:
            capacity = self.max_active_per_session if key.startswith("session:") else self.max_active_per_target
            queue_limit = self.max_queue_per_session if key.startswith("session:") else self.max_queue_per_target
            limiter = self._limiters.get(key)
            if limiter is None:
                limiter = _Limiter(asyncio.Semaphore(capacity))
                self._limiters[key] = limiter
            if limiter.semaphore.locked() and limiter.queued >= queue_limit:
                raise ChatAdmissionError("Chat request queue is full", status_code=429)
            limiter.queued += 1
            return limiter

    def _release(self, acquired: list[_Limiter]) -> None:
        for limiter in reversed(acquired):
            limiter.semaphore.release()

    def _target_key(self, model_name: str, payload: dict[str, Any]) -> str:
        target = str(payload.get("target", "auto")).strip().lower() or "auto"
        return f"target:{target}:model:{model_name}"

    def _clean_payload(self, payload: dict[str, Any]) -> tuple[dict[str, Any], str | None]:
        clean = dict(payload)
        session_id = clean.pop("_admission_session_id", None)
        return clean, str(session_id) if session_id else None
