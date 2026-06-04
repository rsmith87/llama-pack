from __future__ import annotations

import asyncio
import time
from collections.abc import AsyncIterator
from dataclasses import dataclass
from typing import Any

from llama_manager.core.plugins.events import EventBus
from llama_manager.core.plugins.hooks import HookRegistry, PolicyHookRejected


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
        hooks: HookRegistry | None = None,
        event_bus: EventBus | None = None,
    ) -> None:
        self.proxy = proxy
        self.max_active_per_target = max(1, max_active_per_target)
        self.max_queue_per_target = max(0, max_queue_per_target)
        self.max_active_per_session = max(1, max_active_per_session)
        self.max_queue_per_session = max(0, max_queue_per_session)
        self.admission_timeout_seconds = max(0.1, admission_timeout_seconds)
        self.hooks = hooks
        self.event_bus = event_bus
        self._limiters: dict[str, _Limiter] = {}
        self._lock = asyncio.Lock()

    async def chat_with_meta(self, model_name: str, payload: dict[str, Any]) -> tuple[dict[str, Any], dict[str, str]]:
        clean_payload, session_id = self._clean_payload(payload)
        try:
            await self._run_chat_admission_hooks(model_name, clean_payload, session_id)
        except ChatAdmissionError as exc:
            await self._emit("neuraxis.chat.rejected", {
                "model": model_name, "session_id": session_id,
                "reason": str(exc), "status_code": exc.status_code,
            })
            raise
        try:
            acquired = await self._acquire(model_name, clean_payload, session_id)
        except ChatAdmissionError as exc:
            await self._emit("neuraxis.chat.rejected", {
                "model": model_name, "session_id": session_id,
                "reason": str(exc), "status_code": exc.status_code,
            })
            raise
        await self._emit("neuraxis.chat.admitted", {"model": model_name, "session_id": session_id})
        start = time.monotonic()
        try:
            response, meta = await self.proxy.chat_with_meta(model_name, clean_payload)
            total_ms = (time.monotonic() - start) * 1000.0
            usage: dict[str, Any] = (response.get("usage") or {}) if isinstance(response, dict) else {}
            timings: dict[str, Any] = (response.get("timings") or {}) if isinstance(response, dict) else {}
            await self._emit("neuraxis.chat.completed", {
                "model": model_name,
                "session_id": session_id,
                "prompt_tokens": int(usage.get("prompt_tokens") or 0),
                "completion_tokens": int(usage.get("completion_tokens") or 0),
                "total_duration_ms": total_ms,
                "ttft_ms": float(timings.get("prompt_ms") or 0.0),
                "tokens_per_second": float(timings.get("predicted_per_second") or 0.0),
                "route": meta.get("route"),
                "streamed": False,
            })
            return response, meta
        except Exception as exc:
            await self._emit("neuraxis.chat.failed", {
                "model": model_name, "session_id": session_id, "error": str(exc),
            })
            raise
        finally:
            self._release(acquired)

    async def stream_with_meta(self, model_name: str, payload: dict[str, Any]) -> tuple[AsyncIterator[bytes], dict[str, str]]:
        clean_payload, session_id = self._clean_payload(payload)
        try:
            await self._run_chat_admission_hooks(model_name, clean_payload, session_id)
        except ChatAdmissionError as exc:
            await self._emit("neuraxis.chat.rejected", {
                "model": model_name, "session_id": session_id,
                "reason": str(exc), "status_code": exc.status_code,
            })
            raise
        try:
            acquired = await self._acquire(model_name, clean_payload, session_id)
        except ChatAdmissionError as exc:
            await self._emit("neuraxis.chat.rejected", {
                "model": model_name, "session_id": session_id,
                "reason": str(exc), "status_code": exc.status_code,
            })
            raise
        await self._emit("neuraxis.chat.admitted", {"model": model_name, "session_id": session_id})
        start = time.monotonic()
        try:
            stream, meta = await self.proxy.stream_with_meta(model_name, clean_payload)
        except Exception as exc:
            await self._emit("neuraxis.chat.failed", {
                "model": model_name, "session_id": session_id, "error": str(exc),
            })
            self._release(acquired)
            raise

        event_bus = self.event_bus

        async def _release_after_stream() -> AsyncIterator[bytes]:
            try:
                async for chunk in stream:
                    yield chunk
                total_ms = (time.monotonic() - start) * 1000.0
                if event_bus is not None:
                    await event_bus.emit("neuraxis.chat.completed", payload={
                        "model": model_name,
                        "session_id": session_id,
                        "prompt_tokens": 0,
                        "completion_tokens": 0,
                        "total_duration_ms": total_ms,
                        "ttft_ms": 0.0,
                        "tokens_per_second": 0.0,
                        "route": meta.get("route"),
                        "streamed": True,
                    })
            except Exception as exc:
                if event_bus is not None:
                    await event_bus.emit("neuraxis.chat.failed", payload={
                        "model": model_name, "session_id": session_id, "error": str(exc),
                    })
                raise
            finally:
                self._release(acquired)

        return _release_after_stream(), meta

    async def _emit(self, event_type: str, payload: dict[str, Any]) -> None:
        if self.event_bus is not None:
            await self.event_bus.emit(event_type, payload=payload)

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

    async def _run_chat_admission_hooks(self, model_name: str, payload: dict[str, Any], session_id: str | None) -> None:
        if self.hooks is None:
            return
        try:
            await self.hooks.run_policy_hooks(
                "neuraxis.chat_admission",
                {"model": model_name, "payload": payload, "session_id": session_id},
            )
        except PolicyHookRejected as exc:
            raise ChatAdmissionError(str(exc), status_code=403) from exc
