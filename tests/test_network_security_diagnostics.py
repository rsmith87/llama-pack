from llama_pack.core.config import load_config
from llama_pack.core.runtime.network_security import network_security_diagnostics


def diagnostic_ids(payload: list[object]) -> set[str]:
    return {item.id for item in payload}


def test_controller_node_http_api_key_reports_plaintext_warning() -> None:
    config = load_config(
        {
            "mode": "controller",
            "nodes": {
                "mac-mini": {
                    "url": "http://mac-mini.local:9137",
                    "api_key": "node-secret",
                },
            },
        }
    )

    diagnostics = network_security_diagnostics(config)

    assert diagnostic_ids(diagnostics) == {"controller_node_plaintext_api_key"}
    assert "node-secret" not in diagnostics[0].to_payload()["evidence"]


def test_https_and_loopback_urls_do_not_report_plaintext_warnings() -> None:
    config = load_config(
        {
            "mode": "controller",
            "nodes": {
                "tls-node": {
                    "url": "https://mac-mini.local",
                    "api_key": "node-secret",
                },
                "local-node": {
                    "url": "http://127.0.0.1:9137",
                    "api_key": "local-secret",
                },
            },
        }
    )

    diagnostics = network_security_diagnostics(config)

    assert diagnostics == []


def test_agent_http_controller_registration_reports_plaintext_warning() -> None:
    config = load_config(
        {
            "mode": "agent",
            "controller_url": "http://pi-controller.local:9137",
            "controller_registration_key_outbound": "registration-secret",
        }
    )

    diagnostics = network_security_diagnostics(config)

    assert diagnostic_ids(diagnostics) == {"agent_plaintext_registration_key"}
    assert "registration-secret" not in diagnostics[0].to_payload()["evidence"]


def test_non_loopback_bind_host_with_auth_reports_exposure_warning(monkeypatch) -> None:
    monkeypatch.setenv("LLAMA_PACK_HOST", "0.0.0.0")
    config = load_config({"mode": "agent", "agent_api_key": "agent-secret"})

    diagnostics = network_security_diagnostics(config)

    assert "plaintext_service_exposed" in diagnostic_ids(diagnostics)
