from __future__ import annotations

import asyncio
import socket
import ssl
import tempfile
from datetime import datetime, timezone
from urllib.parse import urlparse


async def probe_cert_expiry_seconds(url: str, timeout: float = 5.0) -> int | None:
    """Return seconds until the TLS cert at *url* expires, or None if the probe fails.

    Uses CERT_NONE so the check works even when the cert is already expired or
    the CA is not trusted by the current process — the goal is to read the dates,
    not to verify the chain.  Non-HTTPS URLs return None immediately.
    """
    parsed = urlparse(url)
    if parsed.scheme != "https":
        return None
    host = parsed.hostname
    port = parsed.port or 443
    if not host:
        return None
    return await asyncio.to_thread(_blocking_probe, host, port, timeout)


def _blocking_probe(host: str, port: int, timeout: float) -> int | None:
    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    try:
        with socket.create_connection((host, port), timeout=timeout) as raw:
            with ctx.wrap_socket(raw, server_hostname=host) as tls:
                cert = _decode_der_cert(tls.getpeercert(binary_form=True))
    except OSError:
        return None
    if not cert:
        return None
    not_after = cert.get("notAfter")
    if not not_after:
        return None
    try:
        expiry = datetime.strptime(not_after, "%b %d %H:%M:%S %Y %Z").replace(tzinfo=timezone.utc)
        return int((expiry - datetime.now(timezone.utc)).total_seconds())
    except ValueError:
        return None


def _decode_der_cert(cert_bytes: bytes | None) -> dict[str, object] | None:
    if cert_bytes is None:
        return None
    pem = ssl.DER_cert_to_PEM_cert(cert_bytes)
    with tempfile.NamedTemporaryFile("w", encoding="ascii", suffix=".pem") as cert_file:
        cert_file.write(pem)
        cert_file.flush()
        return ssl._ssl._test_decode_cert(cert_file.name)
