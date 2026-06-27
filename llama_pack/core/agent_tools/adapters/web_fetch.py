from __future__ import annotations

import ipaddress
import re
from urllib.parse import urlparse

import httpx
from bs4 import BeautifulSoup, NavigableString, Tag

from llama_pack.core.agent_tools.common import MAX_RESULT_CHARS, truncate
from llama_pack.core.config.models import AgentToolDefinitionConfig, AppConfig
from llama_pack.core.runtime.network_security import NetworkPolicy, OfflineNetworkBlockedError

_SSRF_BLOCKED_HOSTS = {"localhost", "127.0.0.1", "::1"}
_PRIVATE_NETWORKS = [
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("169.254.0.0/16"),
    ipaddress.ip_network("::1/128"),
    ipaddress.ip_network("fc00::/7"),
    ipaddress.ip_network("fe80::/10"),
]


def _check_ssrf(hostname: str) -> str | None:
    """Return an error string if the hostname is an SSRF risk, else None."""
    if hostname.lower() in _SSRF_BLOCKED_HOSTS:
        return f"blocked host: {hostname}"
    try:
        addr = ipaddress.ip_address(hostname)
        if any(addr in net for net in _PRIVATE_NETWORKS):
            return f"blocked private address: {hostname}"
    except ValueError:
        pass  # hostname is a DNS name, not an IP literal — allow it
    return None


def _domain_allowed(hostname: str, allowed_domains: list[str]) -> bool:
    hostname = hostname.lower()
    return any(
        hostname == d.lower() or hostname.endswith("." + d.lower())
        for d in allowed_domains
    )


def _extract_text(html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "nav", "footer", "header", "aside", "noscript"]):
        tag.decompose()

    _BLOCK_TAGS = {"p", "div", "section", "article", "blockquote", "pre", "table", "tr", "td", "th"}
    _LIST_TAGS = {"li"}
    _HEADING_TAGS = {"h1", "h2", "h3", "h4", "h5", "h6"}

    lines: list[str] = []

    def walk(node: object) -> None:
        if isinstance(node, NavigableString):
            text = str(node)
            stripped = text.strip()
            if stripped:
                lines.append(stripped)
            elif text and lines and not lines[-1].endswith("\n"):
                lines.append(" ")
            return
        if not isinstance(node, Tag):
            return
        name = node.name.lower() if node.name else ""
        if name in _HEADING_TAGS:
            level = int(name[1])
            text = node.get_text(" ", strip=True)
            if text:
                lines.append(f"\n{'#' * level} {text}\n")
            return
        if name in _LIST_TAGS:
            text = node.get_text(" ", strip=True)
            if text:
                lines.append(f"- {text}")
            return
        if name == "a":
            text = node.get_text(" ", strip=True)
            if text:
                lines.append(text)
            return
        if name in _BLOCK_TAGS:
            lines.append("\n")
            for child in node.children:
                walk(child)
            lines.append("\n")
            return
        if name == "br":
            lines.append("\n")
            return
        for child in node.children:
            walk(child)

    walk(soup)

    # collapse whitespace while preserving meaningful newlines
    result = "".join(lines)
    result = re.sub(r" {2,}", " ", result)
    result = re.sub(r"\n{3,}", "\n\n", result)
    return result.strip()


class WebFetchToolAdapter:
    def __init__(self, config: AppConfig) -> None:
        self.config = config
        self.network_policy = NetworkPolicy(config)

    async def execute(self, tool: AgentToolDefinitionConfig, arguments: dict[str, object]) -> dict[str, object]:
        url = str(arguments.get("url") or "").strip()
        if not url:
            return {"ok": False, "error": "web_fetch requires a 'url' argument"}

        parsed = urlparse(url)
        if parsed.scheme not in {"http", "https"}:
            return {"ok": False, "error": f"web_fetch only supports http/https, got: {parsed.scheme!r}"}

        try:
            self.network_policy.assert_url_allowed(url, "agent web_fetch tool")
        except OfflineNetworkBlockedError as exc:
            return {"ok": False, "error": str(exc)}

        hostname = parsed.hostname or ""
        ssrf_err = _check_ssrf(hostname)
        if ssrf_err:
            return {"ok": False, "error": ssrf_err}

        if tool.allowed_domains and not _domain_allowed(hostname, tool.allowed_domains):
            return {
                "ok": False,
                "error": f"domain not in allowed_domains: {hostname}",
            }

        timeout = tool.timeout_seconds or self.config.agent_tools.tool_timeout_seconds
        try:
            async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
                response = await client.get(url, headers={"User-Agent": "LlamaManager/1.0"})
        except httpx.RequestError as exc:
            return {"ok": False, "error": f"request failed: {exc}"}

        raw = response.content[: tool.max_response_bytes]
        content_type = response.headers.get("content-type", "")
        if tool.strip_html and "html" in content_type:
            text = _extract_text(raw.decode("utf-8", errors="replace"))
        else:
            text = raw.decode("utf-8", errors="replace")

        return {
            "ok": response.status_code < 400,
            "status_code": response.status_code,
            "url": str(response.url),
            "content": truncate(text, MAX_RESULT_CHARS),
            "truncated": len(response.content) > tool.max_response_bytes,
        }
