from __future__ import annotations

import textwrap
from pathlib import Path

from fastapi.testclient import TestClient

from llama_pack.core.config import load_config
from llama_pack.main import create_app
from tests.persistence_db_setup import prepare_all_persistence_dbs


def test_client_discovery_is_public_without_auth_keys(tmp_path: Path):
    config = discovery_config(tmp_path)
    client = TestClient(create_app(config=config))

    response = client.get("/lm-api/v1/client-discovery")

    assert response.status_code == 200
    payload = response.json()
    assert payload["product"] == "llama-pack"
    assert payload["mode"] == "controller"
    assert payload["capabilities"]["openaiChatCompletions"] is True
    assert payload["capabilities"]["streaming"] is True
    assert payload["capabilities"]["localChatSessions"] is False
    assert payload["capabilities"]["projectContext"] is True
    assert payload["auth"]["sessionHeader"] == "X-UI-Session"
    assert payload["auth"]["apiKeyHeader"] == "X-Llama-Pack-Key"
    assert "llama_pack_api_key" in payload["auth"]["methods"]
    assert "external_api_key" in payload["auth"]["methods"]
    assert payload["endpoints"]["openaiChatCompletions"] == "/v1/chat/completions"
    assert payload["endpoints"]["openaiModels"] == "/v1/models"
    assert payload["endpoints"]["clientSession"] == "/v1/client/session"
    assert payload["endpoints"]["clientChatDiagnostics"] == "/v1/client/diagnostics/chat"
    assert payload["endpoints"]["clientProjectContext"] == "/v1/client/project-context/{action}"
    assert payload["endpoints"]["models"] == "/lm-api/v1/models"
    assert payload["endpoints"]["pluginsStatus"] == "/lm-api/v1/plugins/status"
    assert payload["endpoints"]["docs"] == "/ui/docs"


def test_client_discovery_stays_public_when_auth_is_enabled(tmp_path: Path):
    config = discovery_config(tmp_path, {"agent_api_key": "secret"})
    client = TestClient(create_app(config=config))

    response = client.get("/lm-api/v1/client-discovery")

    assert response.status_code == 200
    assert client.get("/lm-api/v1/models").status_code == 401
    assert client.get("/lm-api/v1/models", headers={"X-Llama-Manager-Key": "secret"}).status_code == 200


def test_configured_client_cors_origin_can_preflight_discovery(tmp_path: Path):
    config = discovery_config(tmp_path, {"client_cors_origins": ["http://localhost:5173"]})
    client = TestClient(create_app(config=config))

    response = client.options(
        "/lm-api/v1/client-discovery",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"


def test_client_discovery_does_not_advertise_missing_business_plugin(tmp_path: Path):
    config = discovery_config(tmp_path)
    client = TestClient(create_app(config=config))

    payload = client.get("/lm-api/v1/client-discovery").json()

    assert payload["capabilities"]["businessPlugin"] is False
    assert "llama_pack_business" not in payload["auth"]["methods"]
    assert "businessAuth" not in payload["endpoints"]


def test_client_discovery_advertises_enabled_business_plugin(tmp_path: Path):
    plugin_dir = write_business_plugin(tmp_path)
    config = discovery_config(
        tmp_path,
        {
            "enabled_plugins": ["llama_pack_business"],
            "plugins": {
                "llama_pack_business": {
                    "path": str(plugin_dir),
                    "enabled": True,
                }
            },
        },
    )
    client = TestClient(create_app(config=config))

    payload = client.get("/lm-api/v1/client-discovery").json()

    assert payload["capabilities"]["businessPlugin"] is True
    assert "llama_pack_business" in payload["auth"]["methods"]
    assert payload["endpoints"]["businessAuth"] == "/lm-api/v1/plugins/llama_pack_business/auth/login"


def test_client_discovery_hides_failed_business_plugin(tmp_path: Path):
    plugin_dir = tmp_path / "llama_pack_business"
    package_dir = plugin_dir / "llama_pack_business"
    package_dir.mkdir(parents=True)
    (plugin_dir / "plugin.yaml").write_text(
        textwrap.dedent(
            """
            id: llama_pack_business
            name: Llama Pack Business
            version: "1.0"
            requires_core: "1.0"
            backend_api_version: "1.0"
            entrypoint: llama_pack_business.plugin:plugin
            """
        ).strip(),
        encoding="utf-8",
    )
    (package_dir / "__init__.py").write_text("", encoding="utf-8")
    (package_dir / "plugin.py").write_text("raise RuntimeError('business plugin failed')\n", encoding="utf-8")
    config = discovery_config(
        tmp_path,
        {
            "enabled_plugins": ["llama_pack_business"],
            "plugins": {
                "llama_pack_business": {
                    "path": str(plugin_dir),
                    "enabled": True,
                }
            },
        },
    )
    client = TestClient(create_app(config=config))

    payload = client.get("/lm-api/v1/client-discovery").json()

    assert payload["capabilities"]["businessPlugin"] is False
    assert "llama_pack_business" not in payload["auth"]["methods"]
    assert "businessAuth" not in payload["endpoints"]


def test_client_discovery_hides_business_plugin_with_health_error(tmp_path: Path):
    plugin_dir = write_business_plugin(
        tmp_path,
        register_body="""
        def health():
            return {"level": "error", "message": "business auth unavailable"}

        context.add_health_check(health)
        """,
    )
    config = discovery_config(
        tmp_path,
        {
            "enabled_plugins": ["llama_pack_business"],
            "plugins": {
                "llama_pack_business": {
                    "path": str(plugin_dir),
                    "enabled": True,
                }
            },
        },
    )
    client = TestClient(create_app(config=config))

    payload = client.get("/lm-api/v1/client-discovery").json()

    assert payload["capabilities"]["businessPlugin"] is False
    assert "llama_pack_business" not in payload["auth"]["methods"]
    assert "businessAuth" not in payload["endpoints"]


def write_business_plugin(root: Path, *, register_body: str = "") -> Path:
    plugin_dir = root / "llama_pack_business"
    package_dir = plugin_dir / "llama_pack_business"
    package_dir.mkdir(parents=True)
    (plugin_dir / "plugin.yaml").write_text(
        textwrap.dedent(
            """
            id: llama_pack_business
            name: Llama Pack Business
            version: "1.0"
            requires_core: "1.0"
            backend_api_version: "1.0"
            entrypoint: llama_pack_business.plugin:plugin
            """
        ).strip(),
        encoding="utf-8",
    )
    (package_dir / "__init__.py").write_text("", encoding="utf-8")
    extra_register_body = textwrap.indent(textwrap.dedent(register_body).strip(), " " * 20) if register_body.strip() else ""
    (package_dir / "plugin.py").write_text(
        textwrap.dedent(
            f"""
            from fastapi import APIRouter


            class Plugin:
                def register(self, context):
                    router = APIRouter()

                    @router.post("/auth/login")
                    async def login():
                        return {{"token": "business-session"}}

                    context.add_api_router(router)
{extra_register_body}


            plugin = Plugin()
            """
        ).strip(),
        encoding="utf-8",
    )
    return plugin_dir


def discovery_config(tmp_path: Path, overrides: dict | None = None):
    log_dir = tmp_path / "logs"
    prepare_all_persistence_dbs(log_dir)
    return load_config(
        {
            "mode": "controller",
            "log_dir": str(log_dir),
            **(overrides or {}),
        }
    )
