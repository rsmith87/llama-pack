import ssl

import httpx
import pytest

from llama_manager.core.config import load_config
from llama_manager.core.network.tls_diagnostics import TLS_RECOVERY_DOC, network_error_text
from llama_manager.core.nodes.heartbeat import AgentHeartbeatClient


def _connect_error(message: str, cause: BaseException) -> httpx.ConnectError:
    try:
        raise cause
    except BaseException as exc:
        try:
            raise httpx.ConnectError(message) from exc
        except httpx.ConnectError as connect_error:
            return connect_error


def test_expired_certificate_diagnostic_points_to_caddy_recovery_docs():
    exc = _connect_error(
        "[SSL: CERTIFICATE_VERIFY_FAILED] certificate verify failed: certificate has expired",
        ssl.SSLCertVerificationError("certificate has expired"),
    )

    text = network_error_text(exc)

    assert "expired" in text
    assert "Re-issue and reinstall the Caddy certificate" in text
    assert TLS_RECOVERY_DOC in text


def test_hostname_mismatch_certificate_diagnostic_is_specific():
    exc = _connect_error(
        "certificate verify failed: Hostname mismatch",
        ssl.SSLCertVerificationError("Hostname mismatch, certificate is not valid for 'pi.local'"),
    )

    text = network_error_text(exc)

    assert "hostname does not match" in text
    assert "certificate SAN" in text


def test_untrusted_ca_certificate_diagnostic_is_specific():
    exc = _connect_error(
        "certificate verify failed: unable to get local issuer certificate",
        ssl.SSLCertVerificationError("unable to get local issuer certificate"),
    )

    text = network_error_text(exc)

    assert "certificate authority is not trusted" in text
    assert "SSL_CERT_FILE" in text


@pytest.mark.asyncio
async def test_agent_registration_log_includes_expired_certificate_recovery(caplog):
    config = load_config(
        {
            "mode": "agent",
            "node_name": "mac-mini",
            "controller_url": "https://pi-controller.local",
            "agent_url": "https://mac-mini.local",
        }
    )

    async def failing_request(_method, _url, _payload):
        raise _connect_error(
            "[SSL: CERTIFICATE_VERIFY_FAILED] certificate verify failed: certificate has expired",
            ssl.SSLCertVerificationError("certificate has expired"),
        )

    client = AgentHeartbeatClient(config, request=failing_request)

    with caplog.at_level("WARNING", logger="llama_manager.core.nodes.heartbeat"):
        await client.start()
        await client.stop()

    assert "Agent registration failed for mac-mini" in caplog.text
    assert TLS_RECOVERY_DOC in caplog.text
