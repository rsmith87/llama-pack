from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Awaitable, Callable, Protocol
from urllib.parse import urlsplit

import httpx

from llama_pack.core.config import AppConfig, NodeConfig


ControllerRequest = Callable[[str, str, str | None, bool, dict[str, Any] | None], Awaitable[dict[str, Any]]]


class NodeStateStore(Protocol):
    def load(self) -> dict[str, Any]: ...
    def save(self, data: dict[str, Any]) -> None: ...


class NodeRegistry:
    def __init__(
        self,
        config: AppConfig,
        request: ControllerRequest | None = None,
        store: NodeStateStore | None = None,
    ):
        self.config = config
        self._request = request or self._default_request
        self._uses_default_request = request is None
        self._store = store
        self._dynamic_nodes: dict[str, NodeConfig] = {}
        self._node_overrides: dict[str, NodeConfig] = {}
        self._heartbeats: dict[str, str] = {}
        self._load_state()

    def list_nodes(self) -> list[dict[str, str]]:
        nodes = {**self.config.nodes, **self._node_overrides, **self._dynamic_nodes}
        return [self._node_payload(name, node)
            for name, node in sorted(nodes.items())
        ]

    def _node_payload(self, name: str, node: NodeConfig) -> dict[str, Any]:
        heartbeat = self._heartbeats.get(name)
        return {
            "name": name,
            "url": node.url,
            "verify_tls": node.verify_tls,
            "controller_config_source": self.config.config_source,
            "registration": "dynamic" if name in self._dynamic_nodes else "static",
            "last_heartbeat": heartbeat,
            "heartbeat_age_seconds": self.heartbeat_age_seconds(name),
            "heartbeat_fresh": self.is_heartbeat_fresh(name),
        }

    def heartbeat_age_seconds(self, name: str) -> int | None:
        heartbeat = self._heartbeats.get(name)
        if heartbeat is None:
            return None
        try:
            last = datetime.fromisoformat(heartbeat)
        except ValueError:
            return None
        if last.tzinfo is None:
            last = last.replace(tzinfo=timezone.utc)
        age = (datetime.now(timezone.utc) - last).total_seconds()
        return max(0, int(age))

    def is_heartbeat_fresh(self, name: str) -> bool:
        age = self.heartbeat_age_seconds(name)
        if age is None:
            # Static controller-configured nodes may not implement heartbeat yet.
            # Treat them as reachable candidates and let request failures determine status.
            return name in self.config.nodes
        return age <= self.config.node_heartbeat_timeout_seconds

    async def request_node(
        self,
        node_name: str,
        method: str,
        path: str,
        json_body: dict[str, Any] | None = None,
        *,
        timeout: float | None = 10,
    ) -> dict[str, Any]:
        node = self._get_node(node_name)
        base_url = _validated_base_url(node_name, node.url)
        url = f"{base_url}/{path.lstrip('/')}"
        if self._uses_default_request:
            return await self._default_request(method, url, node.api_key, node.verify_tls, json_body, timeout=timeout)
        if json_body is None:
            return await self._request(method, url, node.api_key, node.verify_tls)
        return await self._request(method, url, node.api_key, node.verify_tls, json_body)

    def register_node(self, name: str, node: NodeConfig) -> None:
        if name in self.config.nodes:
            configured = self.config.nodes[name]
            self._node_overrides[name] = _static_node_override(node, configured)
            self._dynamic_nodes.pop(name, None)
        else:
            self._dynamic_nodes[name] = node
        self.record_heartbeat(name)
        self._save_state()

    def update_node(self, name: str, node: NodeConfig) -> dict[str, Any]:
        self._get_node(name)
        if name in self._dynamic_nodes:
            self._dynamic_nodes[name] = node
        elif name in self.config.nodes:
            node = _static_node_override(node, self.config.nodes[name])
            self._node_overrides[name] = node
        else:
            self._node_overrides[name] = node
        self._save_state()
        return self._node_payload(name, node)

    def record_heartbeat(self, name: str) -> None:
        self._get_node(name)
        self._heartbeats[name] = datetime.now(timezone.utc).isoformat()
        self._save_state()

    def get_node_config(self, name: str) -> NodeConfig:
        return self._get_node(name)

    def _get_node(self, name: str) -> NodeConfig:
        if name in self._node_overrides:
            return self._node_overrides[name]
        if name in self.config.nodes:
            return self.config.nodes[name]
        if name in self._dynamic_nodes:
            return self._dynamic_nodes[name]
        raise KeyError(f"Unknown node: {name}")

    @staticmethod
    async def _default_request(
        method: str,
        url: str,
        api_key: str | None,
        verify_tls: bool,
        json_body: dict[str, Any] | None = None,
        *,
        timeout: float | None = 10,
    ) -> dict[str, Any]:
        headers: dict[str, str] = {}
        if api_key:
            headers["X-Llama-Manager-Key"] = api_key
        async with httpx.AsyncClient(timeout=timeout, verify=verify_tls) as client:
            response = await client.request(method, url, headers=headers, json=json_body)
            response.raise_for_status()
            return response.json()

    def _load_state(self) -> None:
        if self._store is None:
            return
        data = self._store.load()
        raw_nodes = data.get("dynamic_nodes", {})
        if isinstance(raw_nodes, dict):
            loaded: dict[str, NodeConfig] = {}
            for name, value in raw_nodes.items():
                if isinstance(name, str) and isinstance(value, dict):
                    if name in self.config.nodes:
                        configured = self.config.nodes[name]
                        registered = NodeConfig.model_validate(value)
                        self._node_overrides[name] = NodeConfig(
                            url=_inherit_url_scheme(registered.url, configured.url),
                            api_key=registered.api_key if registered.api_key is not None else configured.api_key,
                            verify_tls=configured.verify_tls if registered.verify_tls is True else registered.verify_tls,
                        )
                    else:
                        loaded[name] = NodeConfig.model_validate(value)
            self._dynamic_nodes = loaded
        raw_overrides = data.get("node_overrides", {})
        if isinstance(raw_overrides, dict):
            overrides: dict[str, NodeConfig] = {}
            for name, value in raw_overrides.items():
                if isinstance(name, str) and isinstance(value, dict):
                    override = NodeConfig.model_validate(value)
                    if name in self.config.nodes:
                        configured = self.config.nodes[name]
                        overrides[name] = _static_node_override(override, configured)
                    else:
                        overrides[name] = override
            self._node_overrides = overrides
        raw_heartbeats = data.get("heartbeats", {})
        if isinstance(raw_heartbeats, dict):
            self._heartbeats = {
                str(name): str(timestamp) for name, timestamp in raw_heartbeats.items()
            }

    def _save_state(self) -> None:
        if self._store is None:
            return
        self._store.save(
            {
                "dynamic_nodes": {
                    name: node.model_dump(mode="json")
                    for name, node in self._dynamic_nodes.items()
                },
                "node_overrides": {
                    name: node.model_dump(mode="json")
                    for name, node in self._node_overrides.items()
                },
                "heartbeats": self._heartbeats,
            }
        )


def _inherit_url_scheme(url: str, fallback_url: str) -> str:
    if urlsplit(url).scheme:
        return url
    fallback = urlsplit(fallback_url)
    if not fallback.scheme:
        return url
    return f"{fallback.scheme}://{url.lstrip('/')}"


def _static_node_override(node: NodeConfig, configured: NodeConfig) -> NodeConfig:
    return NodeConfig(
        **node.model_dump(exclude={"url", "api_key", "verify_tls"}),
        url=_inherit_url_scheme(node.url, configured.url),
        api_key=node.api_key if node.api_key is not None else configured.api_key,
        verify_tls=configured.verify_tls if node.verify_tls is True else node.verify_tls,
    )


def _validated_base_url(node_name: str, url: str) -> str:
    scheme = urlsplit(url).scheme
    if scheme not in {"http", "https"}:
        raise ValueError(
            f"nodes.{node_name}.url must start with http:// or https:// "
            f"(resolved value: {url!r})"
        )
    return url.rstrip("/")
