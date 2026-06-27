import pytest

from llama_pack.core.config import load_config
from llama_pack.core.runtime.network_security import NetworkPolicy, OfflineNetworkBlockedError


def policy_from_config(payload):
    return NetworkPolicy(load_config(payload))


def test_policy_allows_public_url_when_offline_mode_disabled():
    policy = policy_from_config({"offline_mode": False})

    policy.assert_url_allowed("https://huggingface.co/owner/model", "test")


def test_policy_blocks_public_url_when_offline_mode_enabled():
    policy = policy_from_config({"offline_mode": True})

    with pytest.raises(OfflineNetworkBlockedError) as exc_info:
        policy.assert_url_allowed("https://huggingface.co/owner/model", "download")

    message = str(exc_info.value)
    assert "offline_mode is enabled" in message
    assert "huggingface.co" in message
    assert "offline_allowed_hosts" in message


@pytest.mark.parametrize(
    "url",
    [
        "http://127.0.0.1:9000/lm-api/v1/models",
        "http://localhost:9000/lm-api/v1/models",
        "http://10.0.0.12:9000/lm-api/v1/models",
        "http://172.16.4.20:9000/lm-api/v1/models",
        "http://192.168.1.50:9000/lm-api/v1/models",
        "http://169.254.2.3:9000/lm-api/v1/models",
        "http://[::1]:9000/lm-api/v1/models",
        "http://[fc00::1]:9000/lm-api/v1/models",
        "http://[fe80::1]:9000/lm-api/v1/models",
    ],
)
def test_policy_allows_local_and_lan_urls_when_offline_mode_enabled(url):
    policy = policy_from_config({"offline_mode": True})

    policy.assert_url_allowed(url, "node request")


def test_policy_allows_configured_controller_and_node_hosts():
    policy = policy_from_config(
        {
            "offline_mode": True,
            "controller_url": "https://controller.example.internal:9443",
            "nodes": {
                "gpu-a": {
                    "url": "https://gpu-a.example.internal:9000",
                    "api_key": "secret",
                }
            },
        }
    )

    policy.assert_url_allowed("https://controller.example.internal:9443/lm-api/v1/node-work", "heartbeat")
    policy.assert_url_allowed("https://gpu-a.example.internal:9000/lm-api/v1/models", "node request")


def test_policy_allows_explicit_host_and_cidr_allowlists():
    policy = policy_from_config(
        {
            "offline_mode": True,
            "offline_allowed_hosts": ["mirror.example.internal"],
            "offline_allowed_cidrs": ["203.0.113.0/24"],
        }
    )

    policy.assert_url_allowed("https://mirror.example.internal/models", "mirror")
    policy.assert_url_allowed("http://203.0.113.22:9000/lm-api/v1/models", "test cidr")


def test_policy_rejects_missing_hostname_url():
    policy = policy_from_config({"offline_mode": True})

    with pytest.raises(OfflineNetworkBlockedError) as exc_info:
        policy.assert_url_allowed("https:///missing-host", "test")

    assert "missing hostname" in str(exc_info.value)
