from __future__ import annotations

import asyncio
import logging
from collections.abc import Awaitable, Callable
from datetime import datetime, timezone
from typing import Any

import httpx

from llama_pack.core.config import AppConfig
from llama_pack.core.network.tls_diagnostics import ssl_diagnostic_message
from llama_pack.core.nodes.worker import NodeCommunicationFailure, _raise_for_status_with_body, _response_detail_from_exception, _status_code_from_exception


RequestFn = Callable[[str, str, dict[str, Any] | None], Awaitable[dict[str, Any]]]
logger = logging.getLogger(__name__)


class AgentHeartbeatClient:
    def __init__(self, config: AppConfig, request: RequestFn | None = None):
        self.config = config
        self._request = request or self._default_request
        self._task: asyncio.Task[None] | None = None
        self._stopped = asyncio.Event()
        self._latest_node_failure: NodeCommunicationFailure | None = None

    def enabled(self) -> bool:
        return (
            self.config.mode == "agent"
            and bool(self.config.controller_url)
            and bool(self.config.node_name)
        )

    async def start(self) -> None:
        if not self.enabled() or self._task is not None:
            return
        self._stopped.clear()
        try:
            await self._register()
        except Exception as exc:
            diagnostic = ssl_diagnostic_message(exc)
            logger.warning(
                "Agent registration failed for %s%s",
                self.config.node_name,
                f": {diagnostic}" if diagnostic else "",
                exc_info=True,
            )
        self._task = asyncio.create_task(self._run_loop())

    async def stop(self) -> None:
        self._stopped.set()
        if self._task is None:
            return
        self._task.cancel()
        try:
            await self._task
        except asyncio.CancelledError:
            pass
        self._task = None

    async def _run_loop(self) -> None:
        interval = max(5, self.config.heartbeat_interval_seconds)
        while not self._stopped.is_set():
            try:
                await self._heartbeat()
            except Exception as exc:
                diagnostic = ssl_diagnostic_message(exc)
                logger.warning(
                    "Agent heartbeat failed for %s%s",
                    self.config.node_name,
                    f": {diagnostic}" if diagnostic else "",
                    exc_info=True,
                )
            try:
                await asyncio.wait_for(self._stopped.wait(), timeout=interval)
            except asyncio.TimeoutError:
                continue

    async def _register(self) -> None:
        url = self.config.controller_url.rstrip("/")
        payload = {
            "name": self.config.node_name,
            "url": self.config.agent_url,
            "api_key": self.config.agent_api_key,
            "registration_key": self.config.controller_registration_key_outbound,
        }
        await self._request("POST", f"{url}/lm-api/v1/nodes/register", payload)

    async def _heartbeat(self) -> None:
        url = self.config.controller_url.rstrip("/")
        method = "POST"
        endpoint = f"{url}/lm-api/v1/nodes/{self.config.node_name}/heartbeat"
        try:
            await self._request(method, endpoint, None)
        except Exception as exc:
            self.record_node_failure_from_exception(method, endpoint, exc)
            raise

    def latest_node_failure(self) -> NodeCommunicationFailure | None:
        if self._latest_node_failure is None:
            return None
        return dict(self._latest_node_failure)

    def record_node_failure(self, method: str, endpoint: str, status_code: int | None, response_detail: str) -> None:
        self._latest_node_failure = {
            "method": method,
            "endpoint": endpoint,
            "status_code": status_code,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "response_detail": response_detail,
        }

    def record_node_failure_from_exception(self, method: str, endpoint: str, exc: Exception) -> None:
        status_code = _status_code_from_exception(exc)
        response_detail = _response_detail_from_exception(exc)
        self.record_node_failure(method, endpoint, status_code, response_detail)

    @staticmethod
    async def _default_request(
        method: str, url: str, payload: dict[str, Any] | None
    ) -> dict[str, Any]:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.request(method, url, json=payload)
            _raise_for_status_with_body(response)
            return response.json()
