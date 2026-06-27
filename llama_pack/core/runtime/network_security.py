from __future__ import annotations

import ipaddress
from dataclasses import dataclass
import os
from urllib.parse import urlparse

from llama_pack.core.config import AppConfig, NodeConfig


IPNetwork = ipaddress.IPv4Network | ipaddress.IPv6Network


DEFAULT_ALLOWED_NETWORKS: tuple[IPNetwork, ...] = tuple(
    ipaddress.ip_network(value)
    for value in (
        "127.0.0.0/8",
        "10.0.0.0/8",
        "172.16.0.0/12",
        "192.168.0.0/16",
        "169.254.0.0/16",
        "::1/128",
        "fc00::/7",
        "fe80::/10",
    )
)
LOCALHOST_NAMES = frozenset({"localhost"})


class OfflineNetworkBlockedError(PermissionError):
    pass


@dataclass(frozen=True)
class RuntimeDiagnostic:
    id: str
    severity: str
    message: str
    evidence: str
    action: str

    def to_payload(self) -> dict[str, str]:
        return {
            "id": self.id,
            "severity": self.severity,
            "message": self.message,
            "evidence": self.evidence,
            "action": self.action,
        }


@dataclass(frozen=True)
class NetworkPolicy:
    offline_mode: bool
    allowed_hosts: frozenset[str]
    allowed_networks: tuple[IPNetwork, ...]

    def __init__(self, config: AppConfig):
        object.__setattr__(self, "offline_mode", config.offline_mode)
        object.__setattr__(self, "allowed_hosts", frozenset(_allowed_hosts(config)))
        configured_networks = tuple(ipaddress.ip_network(cidr, strict=False) for cidr in config.offline_allowed_cidrs)
        object.__setattr__(self, "allowed_networks", (*DEFAULT_ALLOWED_NETWORKS, *configured_networks))

    def is_url_allowed(self, url: str) -> bool:
        if not self.offline_mode:
            return True
        parsed = urlparse(url)
        hostname = parsed.hostname
        if hostname is None:
            return False
        normalized = hostname.lower().strip("[]")
        if normalized in LOCALHOST_NAMES or normalized in self.allowed_hosts:
            return True
        try:
            address = ipaddress.ip_address(normalized)
        except ValueError:
            return False
        return any(address in network for network in self.allowed_networks)

    def assert_url_allowed(self, url: str, purpose: str) -> None:
        if self.is_url_allowed(url):
            return
        parsed = urlparse(url)
        host = parsed.hostname or "missing hostname"
        raise OfflineNetworkBlockedError(
            f"Blocked outbound request to {host!r} for {purpose}: offline_mode is enabled. "
            "Use offline_allowed_hosts or offline_allowed_cidrs only if this destination is intentionally reachable without public internet."
        )


def _allowed_hosts(config: AppConfig) -> set[str]:
    hosts = {host.lower().strip() for host in config.offline_allowed_hosts}
    for url in [config.controller_url, config.agent_url, *(node.url for node in config.nodes.values())]:
        if not url:
            continue
        parsed = urlparse(url)
        if parsed.hostname:
            hosts.add(parsed.hostname.lower().strip("[]"))
    return hosts


def network_security_diagnostics(config: AppConfig) -> list[RuntimeDiagnostic]:
    diagnostics: list[RuntimeDiagnostic] = []
    diagnostics.extend(_controller_node_http_diagnostics(config.nodes))
    diagnostics.extend(_agent_http_diagnostics(config))
    bind_host = os.environ.get("LLAMA_PACK_HOST")
    if bind_host is not None:
        diagnostics.extend(_bind_host_diagnostics(config, bind_host))
    return diagnostics


def _controller_node_http_diagnostics(nodes: dict[str, NodeConfig]) -> list[RuntimeDiagnostic]:
    diagnostics: list[RuntimeDiagnostic] = []
    for name, node in nodes.items():
        if not node.api_key or not _is_plaintext_lan_url(node.url):
            continue
        diagnostics.append(
            RuntimeDiagnostic(
                id="controller_node_plaintext_api_key",
                severity="warning",
                message=f"Controller sends the API key for node {name} over plaintext HTTP.",
                evidence=f"nodes.{name}.url is {node.url!r} and nodes.{name}.api_key is configured.",
                action="Use Caddy/local TLS with an https:// node URL, or keep direct HTTP limited to a trusted isolated LAN.",
            )
        )
    return diagnostics


def _agent_http_diagnostics(config: AppConfig) -> list[RuntimeDiagnostic]:
    diagnostics: list[RuntimeDiagnostic] = []
    if config.agent_api_key and _is_plaintext_lan_url(config.agent_url):
        diagnostics.append(
            RuntimeDiagnostic(
                id="agent_plaintext_api_key",
                severity="warning",
                message="This agent is configured with an API key on a plaintext HTTP agent URL.",
                evidence=f"agent_url is {config.agent_url!r} and agent_api_key is configured.",
                action="Use Caddy/local TLS with an https:// agent URL, or only expose this agent on a trusted isolated LAN.",
            )
        )
    if config.controller_registration_key_outbound and config.controller_url and _is_plaintext_lan_url(config.controller_url):
        diagnostics.append(
            RuntimeDiagnostic(
                id="agent_plaintext_registration_key",
                severity="warning",
                message="This agent sends its controller registration key over plaintext HTTP.",
                evidence="controller_url is plaintext HTTP and controller_registration_key_outbound is configured.",
                action="Use an https:// controller URL for registration, or rotate the registration key after moving to TLS.",
            )
        )
    return diagnostics


def _bind_host_diagnostics(config: AppConfig, bind_host: str) -> list[RuntimeDiagnostic]:
    if _is_loopback_host(bind_host):
        return []
    auth_configured = bool(config.agent_api_key or any(node.api_key for node in config.nodes.values()))
    if not auth_configured:
        return []
    return [
        RuntimeDiagnostic(
            id="plaintext_service_exposed",
            severity="warning",
            message="Llama Pack is bound to a non-loopback interface while API-key authentication is configured.",
            evidence=f"LLAMA_PACK_HOST is {bind_host!r}; uvicorn serves HTTP unless it is behind a TLS proxy.",
            action="For Caddy/local TLS, bind Llama Pack to 127.0.0.1 and expose only the HTTPS proxy.",
        )
    ]


def _is_plaintext_lan_url(url: str) -> bool:
    parsed = urlparse(url)
    if parsed.scheme.lower() != "http":
        return False
    host = parsed.hostname
    if host is None:
        return False
    return not _is_loopback_host(host)


def _is_loopback_host(host: str) -> bool:
    normalized = host.strip().lower()
    if normalized in {"localhost", "localhost.localdomain"}:
        return True
    try:
        address = ipaddress.ip_address(normalized)
    except ValueError:
        return False
    return address.is_loopback
