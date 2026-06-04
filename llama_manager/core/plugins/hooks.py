from __future__ import annotations

import asyncio
import inspect
from collections import defaultdict
from collections.abc import Callable
from typing import Any


class PolicyHookRejected(RuntimeError):
    pass


class HookRegistry:
    def __init__(self, *, timeout_seconds: float = 2.0) -> None:
        self.timeout_seconds = timeout_seconds
        self._hooks: dict[str, list[tuple[str, Callable[[dict[str, Any]], Any]]]] = defaultdict(list)
        self._health_recorder: Callable[[str, str, str], None] | None = None

    def set_health_recorder(self, recorder: Callable[[str, str, str], None]) -> None:
        self._health_recorder = recorder

    def add_policy_hook(self, plugin_id: str, hook_name: str, handler: Callable[[dict[str, Any]], Any]) -> None:
        self._hooks[hook_name].append((plugin_id, handler))

    async def run_policy_hooks(self, hook_name: str, payload: dict[str, Any]) -> None:
        for plugin_id, handler in list(self._hooks.get(hook_name, [])):
            try:
                result = handler(payload)
                if inspect.isawaitable(result):
                    result = await asyncio.wait_for(result, timeout=self.timeout_seconds)
            except Exception as exc:
                self._record(plugin_id, "error", str(exc))
                raise PolicyHookRejected(str(exc)) from exc
            if isinstance(result, dict) and result.get("allowed") is False:
                message = str(result.get("message") or result.get("reason") or "Rejected by policy hook")
                self._record(plugin_id, "warning", message)
                raise PolicyHookRejected(message)

    def _record(self, plugin_id: str, level: str, message: str) -> None:
        if self._health_recorder is not None:
            self._health_recorder(plugin_id, level, message)
