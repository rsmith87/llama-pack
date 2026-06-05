from __future__ import annotations

import textwrap
from pathlib import Path

import pytest

from llama_manager.core.config import AppConfig, load_config
from llama_manager.core.chat.scheduler import ChatAdmissionError, ChatScheduler
from llama_manager.main import create_app
from tests.helpers import authenticated_client
from tests.persistence_db_setup import prepare_all_persistence_dbs

REPO_ROOT = Path(__file__).resolve().parents[1]


def write_plugin(root: Path, plugin_id: str, *, manifest_extra: str = "", body: str = "") -> Path:
    plugin_dir = root / plugin_id
    package_dir = plugin_dir / plugin_id
    package_dir.mkdir(parents=True)
    static_dir = package_dir / "static"
    static_dir.mkdir()
    (static_dir / "hello-entry.js").write_text("export const hello = true;\n", encoding="utf-8")
    (package_dir / "__init__.py").write_text("", encoding="utf-8")
    extra = textwrap.indent(manifest_extra.strip(), "            ") if manifest_extra.strip() else ""
    (plugin_dir / "plugin.yaml").write_text(
        textwrap.dedent(
            f"""
            id: {plugin_id}
            name: {plugin_id.replace("_", " ").title()}
            version: "1.0"
            requires_core: "1.0"
            backend_api_version: "1.0"
            frontend_api_version: "1.0"
            entrypoint: {plugin_id}.plugin:plugin
            frontend:
              static_dir: {plugin_id}/static
              entry: /plugin-assets/{plugin_id}/hello-entry.js
{extra}
            """
        ),
        encoding="utf-8",
    )
    (package_dir / "plugin.py").write_text(
        textwrap.dedent(
            body
            or """
            from fastapi import APIRouter

            class Plugin:
                id = "sample_plugin"
                name = "Sample Plugin"
                version = "1.0"

                def register(self, context):
                    router = APIRouter()

                    @router.get("/hello")
                    async def hello():
                        return {"message": "hello"}

                    context.add_api_router(router)
                    context.add_navigation_item({"label": "Sample", "path": "/ui/plugins/sample_plugin"})

            plugin = Plugin()
            """
        ),
        encoding="utf-8",
    )
    return plugin_dir


def plugin_config(
    tmp_path: Path,
    *paths: Path,
    enabled: list[str] | None = None,
    plugins: dict | None = None,
    mode: str = "agent",
) -> AppConfig:
    log_dir = tmp_path / "logs"
    prepare_all_persistence_dbs(log_dir)
    return load_config(
        {
            "mode": mode,
            "log_dir": str(log_dir),
            "enabled_plugins": [path.name for path in paths] if enabled is None else enabled,
            "plugins": {
                **{path.name: {"path": str(path), "enabled": True} for path in paths},
                **(plugins or {}),
            },
        }
    )


def test_core_starts_with_no_plugins_configured(tmp_path: Path):
    log_dir = tmp_path / "logs"
    prepare_all_persistence_dbs(log_dir)
    app = create_app(config=load_config({"mode": "agent", "log_dir": str(log_dir)}))
    client = authenticated_client(app)

    assert client.get("/lm-api/v1/plugins/enabled").json() == []
    assert client.get("/lm-api/v1/plugins/status").json() == {"plugins": []}


def test_enabled_plugin_loads_registers_route_and_frontend_metadata(tmp_path: Path):
    plugin_dir = write_plugin(tmp_path, "sample_plugin")
    app = create_app(config=plugin_config(tmp_path, plugin_dir))
    client = authenticated_client(app)

    assert client.get("/lm-api/v1/plugins/sample_plugin/hello").json() == {"message": "hello"}
    metadata = client.get("/lm-api/v1/plugins/enabled").json()[0]
    assert metadata["id"] == "sample_plugin"
    assert metadata["frontend"]["entry"] == "/plugin-assets/sample_plugin/hello-entry.js"
    status = client.get("/lm-api/v1/plugins/status").json()["plugins"][0]
    assert status["status"] == "enabled"
    assert status["warnings"] == []
    assert status["errors"] == []


def test_checked_in_hello_plugin_loads_as_sample_integration(tmp_path: Path):
    plugin_dir = REPO_ROOT / "plugins" / "hello_plugin"
    app = create_app(config=plugin_config(tmp_path, plugin_dir, mode="controller"))
    client = authenticated_client(app)

    assert client.get("/lm-api/v1/plugins/hello_plugin/hello").json() == {"message": "hello from plugin"}
    metadata = client.get("/lm-api/v1/plugins/enabled").json()[0]
    assert metadata["id"] == "hello_plugin"
    assert metadata["navigation"][0]["label"] == "Hello"
    assert metadata["frontend"]["entry"] == "/plugin-assets/hello_plugin/hello-entry.js"
    asset_response = client.get("/plugin-assets/hello_plugin/hello-entry.js")
    assert asset_response.status_code == 200
    assert "export function mount" in asset_response.text
    assert "host.pluginId" in asset_response.text
    migration_status = client.get("/lm-api/v1/plugins/hello_plugin/migrations/status").json()
    target = migration_status["targets"][0]
    assert target["id"] == "main"
    assert target["database_name"] == "main"
    assert target["database_path"].endswith("/logs/plugins/hello_plugin/state/hello_plugin.db")
    assert target["status"] == "current"
    assert target["last_error"] is None


def test_plugin_asset_is_served_from_declared_static_directory(tmp_path: Path):
    plugin_dir = write_plugin(tmp_path, "sample_plugin")
    app = create_app(config=plugin_config(tmp_path, plugin_dir))
    client = authenticated_client(app)

    response = client.get("/plugin-assets/sample_plugin/hello-entry.js")

    assert response.status_code == 200
    assert "export const hello" in response.text
    assert response.headers["cache-control"] == "no-store"


def test_disabled_failed_and_unknown_plugin_assets_are_not_served(tmp_path: Path):
    disabled_dir = write_plugin(tmp_path, "disabled_plugin")
    failed_dir = write_plugin(tmp_path, "failed_plugin", body="raise RuntimeError('boom')\n")
    config = plugin_config(
        tmp_path,
        disabled_dir,
        failed_dir,
        enabled=["failed_plugin"],
        plugins={
            "disabled_plugin": {"path": str(disabled_dir), "enabled": False},
            "failed_plugin": {"path": str(failed_dir), "enabled": True},
        },
    )
    app = create_app(config=config)
    client = authenticated_client(app)

    assert client.get("/plugin-assets/disabled_plugin/hello-entry.js").status_code == 404
    assert client.get("/plugin-assets/failed_plugin/hello-entry.js").status_code == 404
    assert client.get("/plugin-assets/missing_plugin/hello-entry.js").status_code == 404


def test_plugin_asset_path_traversal_is_rejected(tmp_path: Path):
    plugin_dir = write_plugin(tmp_path, "sample_plugin")
    (plugin_dir / "secret.txt").write_text("secret", encoding="utf-8")
    app = create_app(config=plugin_config(tmp_path, plugin_dir))
    client = authenticated_client(app)

    response = client.get("/plugin-assets/sample_plugin/../secret.txt")

    assert response.status_code in {400, 404}


def test_disabled_plugin_is_ignored_and_not_registered(tmp_path: Path):
    plugin_dir = write_plugin(tmp_path, "sample_plugin")
    config = plugin_config(
        tmp_path,
        plugin_dir,
        enabled=[],
        plugins={"sample_plugin": {"path": str(plugin_dir), "enabled": False}},
    )
    app = create_app(config=config)
    client = authenticated_client(app)

    assert client.get("/lm-api/v1/plugins/sample_plugin/hello").status_code == 404
    assert client.get("/lm-api/v1/plugins/enabled").json() == []
    assert client.get("/lm-api/v1/plugins/status").json()["plugins"][0]["status"] == "disabled"


def test_plugin_can_be_activated_at_runtime_from_configured_path(tmp_path: Path):
    plugin_dir = write_plugin(tmp_path, "sample_plugin")
    app = create_app(config=plugin_config(tmp_path, plugin_dir, enabled=[]))
    client = authenticated_client(app)

    assert client.get("/lm-api/v1/plugins/sample_plugin/hello").status_code == 404
    assert client.get("/plugin-assets/sample_plugin/hello-entry.js").status_code == 404

    response = client.post("/lm-api/v1/plugins/sample_plugin/activate")

    assert response.status_code == 200
    assert response.json()["status"] == "enabled"
    assert client.get("/lm-api/v1/plugins/sample_plugin/hello").json() == {"message": "hello"}
    assert client.get("/plugin-assets/sample_plugin/hello-entry.js").status_code == 200
    assert client.get("/lm-api/v1/plugins/enabled").json()[0]["id"] == "sample_plugin"


def test_plugin_can_be_deactivated_at_runtime(tmp_path: Path):
    plugin_dir = write_plugin(tmp_path, "sample_plugin")
    app = create_app(config=plugin_config(tmp_path, plugin_dir))
    client = authenticated_client(app)

    assert client.get("/lm-api/v1/plugins/sample_plugin/hello").status_code == 200

    response = client.post("/lm-api/v1/plugins/sample_plugin/deactivate")

    assert response.status_code == 200
    assert response.json()["status"] == "disabled"
    assert client.get("/lm-api/v1/plugins/sample_plugin/hello").status_code == 404
    assert client.get("/plugin-assets/sample_plugin/hello-entry.js").status_code == 404
    assert client.get("/lm-api/v1/plugins/enabled").json() == []
    assert client.get("/lm-api/v1/plugins/status").json()["plugins"][0]["status"] == "disabled"


@pytest.mark.asyncio
async def test_runtime_deactivation_removes_plugin_hooks_and_events(tmp_path: Path):
    plugin_dir = write_plugin(
        tmp_path,
        "runtime_plugin",
        body="""
        events = []
        class Plugin:
            id = "runtime_plugin"
            name = "Runtime Plugin"
            version = "1.0"
            def register(self, context):
                async def record(event):
                    events.append(event.type)
                async def reject(payload):
                    return {"allowed": False, "message": "blocked"}
                context.subscribe("test.runtime", record)
                context.add_policy_hook("neuraxis.chat_admission", reject)
        plugin = Plugin()
        """,
    )
    app = create_app(config=plugin_config(tmp_path, plugin_dir))
    client = authenticated_client(app)

    assert client.post("/lm-api/v1/plugins/runtime_plugin/deactivate").status_code == 200
    await app.state.plugin_registry.events.emit("test.runtime")
    await app.state.plugin_registry.hooks.run_policy_hooks("neuraxis.chat_admission", {})

    import runtime_plugin.plugin as module

    assert module.events == []


def test_invalid_plugin_id_is_rejected_by_config():
    with pytest.raises(ValueError):
        load_config({"enabled_plugins": ["../bad"], "plugins": {"../bad": {"path": "/tmp/bad"}}})


def test_incompatible_plugin_is_disabled_with_warning(tmp_path: Path):
    plugin_dir = write_plugin(tmp_path, "future_plugin", manifest_extra='requires_core: "2.0"')
    app = create_app(config=plugin_config(tmp_path, plugin_dir))
    client = authenticated_client(app)

    status = client.get("/lm-api/v1/plugins/status").json()["plugins"][0]
    assert status["status"] == "incompatible"
    assert "requires core 2.0" in status["warnings"][0]
    assert client.get("/lm-api/v1/plugins/enabled").json() == []


def test_controller_only_plugin_is_disabled_in_agent_mode(tmp_path: Path):
    plugin_dir = write_plugin(
        tmp_path,
        "controller_plugin",
        manifest_extra="modes:\n  - controller",
    )
    app = create_app(config=plugin_config(tmp_path, plugin_dir, mode="agent"))
    client = authenticated_client(app)

    assert client.get("/lm-api/v1/plugins/controller_plugin/hello").status_code == 404
    assert client.get("/lm-api/v1/plugins/enabled").json() == []
    status = client.get("/lm-api/v1/plugins/status").json()["plugins"][0]
    assert status["status"] == "incompatible"
    assert "requires mode controller" in status["warnings"][0]


def test_controller_only_plugin_loads_in_controller_mode(tmp_path: Path):
    plugin_dir = write_plugin(
        tmp_path,
        "controller_plugin",
        manifest_extra="modes:\n  - controller",
    )
    app = create_app(config=plugin_config(tmp_path, plugin_dir, mode="controller"))
    client = authenticated_client(app)

    assert client.get("/lm-api/v1/plugins/controller_plugin/hello").status_code == 200
    assert client.get("/lm-api/v1/plugins/enabled").json()[0]["id"] == "controller_plugin"


def test_failed_plugin_import_is_disabled_with_warning(tmp_path: Path):
    plugin_dir = write_plugin(tmp_path, "broken_plugin", body="raise RuntimeError('boom')\n")
    app = create_app(config=plugin_config(tmp_path, plugin_dir))
    client = authenticated_client(app)

    status = client.get("/lm-api/v1/plugins/status").json()["plugins"][0]
    assert status["status"] == "failed"
    assert "boom" in status["errors"][0]
    assert client.get("/lm-api/v1/plugins/broken_plugin/hello").status_code == 404


def test_invalid_plugin_config_disables_plugin_with_warning(tmp_path: Path):
    plugin_dir = write_plugin(
        tmp_path,
        "configured_plugin",
        manifest_extra="""
        config_schema:
          properties:
            api_key:
              type: string
          required:
            - api_key
        """,
    )
    app = create_app(
        config=plugin_config(
            tmp_path,
            plugin_dir,
            plugins={"configured_plugin": {"path": str(plugin_dir), "enabled": True, "config": {}}},
        )
    )
    client = authenticated_client(app)

    assert client.get("/lm-api/v1/plugins/configured_plugin/hello").status_code == 404
    status = client.get("/lm-api/v1/plugins/status").json()["plugins"][0]
    assert status["status"] == "disabled"
    assert "Invalid plugin config" in status["warnings"][0]
    assert "api_key is required" in status["warnings"][0]


def test_secret_plugin_config_is_redacted_from_status_but_available_to_plugin(tmp_path: Path):
    plugin_dir = write_plugin(
        tmp_path,
        "secret_plugin",
        manifest_extra="""
        config_schema:
          properties:
            api_key:
              type: string
              secret: true
            max_items:
              type: integer
          required:
            - api_key
        """,
        body="""
        from fastapi import APIRouter

        class Plugin:
            def register(self, context):
                router = APIRouter()

                @router.get("/config")
                async def config():
                    plugin_config = context.get_plugin_config()
                    return {
                        "api_key": plugin_config["api_key"],
                        "max_items": plugin_config["max_items"],
                    }

                context.add_api_router(router)

        plugin = Plugin()
        """,
    )
    app = create_app(
        config=plugin_config(
            tmp_path,
            plugin_dir,
            plugins={
                "secret_plugin": {
                    "path": str(plugin_dir),
                    "enabled": True,
                    "config": {"api_key": "super-secret", "max_items": 4},
                }
            },
        )
    )
    client = authenticated_client(app)

    assert client.get("/lm-api/v1/plugins/secret_plugin/config").json() == {
        "api_key": "super-secret",
        "max_items": 4,
    }
    status = client.get("/lm-api/v1/plugins/status").json()["plugins"][0]
    assert status["config"] == {"api_key": "<redacted>", "max_items": 4}
    assert "super-secret" not in str(status)


def test_plugin_health_check_results_appear_in_status(tmp_path: Path):
    plugin_dir = write_plugin(
        tmp_path,
        "health_plugin",
        body="""
        class Plugin:
            def register(self, context):
                async def health():
                    return {"level": "warning", "message": "degraded"}

                context.add_health_check(health)

        plugin = Plugin()
        """,
    )
    app = create_app(config=plugin_config(tmp_path, plugin_dir))
    client = authenticated_client(app)

    status = client.get("/lm-api/v1/plugins/status").json()["plugins"][0]

    assert status["status"] == "enabled"
    assert {"level": "warning", "message": "degraded"} in status["health"]
    assert "degraded" in status["warnings"]


def test_plugin_health_check_failure_is_reported_without_crashing_status(tmp_path: Path):
    plugin_dir = write_plugin(
        tmp_path,
        "broken_health_plugin",
        body="""
        class Plugin:
            def register(self, context):
                async def health():
                    raise RuntimeError("health boom")

                context.add_health_check(health)

        plugin = Plugin()
        """,
    )
    app = create_app(config=plugin_config(tmp_path, plugin_dir))
    client = authenticated_client(app)

    response = client.get("/lm-api/v1/plugins/status")
    status = response.json()["plugins"][0]

    assert response.status_code == 200
    assert status["status"] == "enabled"
    assert {"level": "error", "message": "health boom"} in status["health"]
    assert "health boom" in status["errors"]


def test_plugin_context_provides_isolated_database_handle(tmp_path: Path):
    plugin_dir = write_plugin(
        tmp_path,
        "database_plugin",
        body="""
        from fastapi import APIRouter

        class Plugin:
            def register(self, context):
                database = context.get_database("main")
                router = APIRouter()

                @router.get("/db")
                async def db():
                    return {
                        "name": database.name,
                        "path": str(database.path),
                        "url": database.url,
                        "exists": database.path.exists(),
                    }

                context.add_api_router(router)

        plugin = Plugin()
        """,
    )
    app = create_app(config=plugin_config(tmp_path, plugin_dir))
    client = authenticated_client(app)

    payload = client.get("/lm-api/v1/plugins/database_plugin/db").json()

    assert payload["name"] == "main"
    assert payload["path"].endswith("/logs/plugins/database_plugin/state/database_plugin.db")
    assert payload["url"].startswith("sqlite+pysqlite:///")
    assert payload["url"].endswith("/logs/plugins/database_plugin/state/database_plugin.db")
    assert payload["exists"] is False


def test_plugin_context_rejects_unsafe_database_names(tmp_path: Path):
    plugin_dir = write_plugin(
        tmp_path,
        "bad_database_plugin",
        body="""
        class Plugin:
            def register(self, context):
                context.get_database("../core")

        plugin = Plugin()
        """,
    )
    app = create_app(config=plugin_config(tmp_path, plugin_dir))
    client = authenticated_client(app)

    status = client.get("/lm-api/v1/plugins/status").json()["plugins"][0]

    assert status["status"] == "failed"
    assert "Invalid plugin database name" in status["errors"][0]


def test_plugin_migration_target_status_endpoint_reports_registered_target(tmp_path: Path):
    plugin_dir = write_plugin(
        tmp_path,
        "migration_plugin",
        body="""
        class Plugin:
            def register(self, context):
                context.add_migration_target(
                    "migration_plugin",
                    directory="migrations",
                    database_url="sqlite:///plugin.db",
                    current_revision="001_initial",
                    head_revision="001_initial",
                )

        plugin = Plugin()
        """,
    )
    app = create_app(config=plugin_config(tmp_path, plugin_dir))
    client = authenticated_client(app)

    response = client.get("/lm-api/v1/plugins/migration_plugin/migrations/status")

    assert response.status_code == 200
    payload = response.json()
    assert payload == {
        "plugin_id": "migration_plugin",
        "targets": [
            {
                "id": "migration_plugin",
                "directory": "migrations",
                "database_name": None,
                "database_path": None,
                "database_url": "sqlite:///plugin.db",
                "current_revision": "001_initial",
                "head_revision": "001_initial",
                "status": "current",
                "pending": False,
                "last_error": payload["targets"][0]["last_error"],
            }
        ],
    }
    assert payload["targets"][0]["last_error"]


def test_plugin_migration_target_accepts_plugin_database_handle(tmp_path: Path):
    plugin_dir = write_plugin(
        tmp_path,
        "database_migration_plugin",
        body="""
        class Plugin:
            def register(self, context):
                database = context.get_database("analytics")
                context.add_migration_target(
                    "analytics",
                    directory="migrations/analytics",
                    database=database,
                    current_revision="001_initial",
                    head_revision="001_initial",
                )

        plugin = Plugin()
        """,
    )
    app = create_app(config=plugin_config(tmp_path, plugin_dir))
    client = authenticated_client(app)

    target = client.get("/lm-api/v1/plugins/database_migration_plugin/migrations/status").json()["targets"][0]

    assert target["id"] == "analytics"
    assert target["database_name"] == "analytics"
    assert target["database_path"].endswith("/logs/plugins/database_migration_plugin/state/analytics.db")
    assert target["database_url"].endswith("/logs/plugins/database_migration_plugin/state/analytics.db")
    assert target["status"] == "current"


def test_plugin_migration_status_refreshes_from_alembic_database(tmp_path: Path):
    plugin_dir = write_plugin(
        tmp_path,
        "refresh_migration_plugin",
        body="""
        class Plugin:
            def register(self, context):
                database = context.get_database("main")
                context.add_migration_target(
                    "main",
                    directory="migrations/main",
                    database=database,
                )

        plugin = Plugin()
        """,
    )
    migrations_dir = plugin_dir / "migrations" / "main"
    migrations_dir.mkdir(parents=True)
    (migrations_dir / "abc123_initial.py").write_text(
        '''
revision = "abc123"
down_revision = None
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa

def upgrade():
    op.create_table("sample_rows", sa.Column("id", sa.Integer(), primary_key=True))

def downgrade():
    op.drop_table("sample_rows")
''',
        encoding="utf-8",
    )
    app = create_app(config=plugin_config(tmp_path, plugin_dir))
    client = authenticated_client(app)

    target = client.get("/lm-api/v1/plugins/refresh_migration_plugin/migrations/status").json()["targets"][0]

    assert target["current_revision"] is None
    assert target["head_revision"] == "abc123"
    assert target["status"] == "missing"


def test_plugin_migration_refresh_error_appears_in_health_status(tmp_path: Path):
    plugin_dir = write_plugin(
        tmp_path,
        "broken_migration_status_plugin",
        body="""
        class Plugin:
            def register(self, context):
                database = context.get_database("main")
                context.add_migration_target("main", directory="missing/migrations", database=database)

        plugin = Plugin()
        """,
    )
    app = create_app(config=plugin_config(tmp_path, plugin_dir))
    client = authenticated_client(app)

    migration_status = client.get("/lm-api/v1/plugins/broken_migration_status_plugin/migrations/status").json()
    plugin_status = client.get("/lm-api/v1/plugins/status").json()["plugins"][0]

    assert migration_status["targets"][0]["last_error"]
    assert any(
        item["level"] == "error" and "Plugin migration target main refresh failed" in item["message"]
        for item in plugin_status["health"]
    )
    assert any("Plugin migration target main refresh failed" in message for message in plugin_status["errors"])


def test_plugin_migration_upgrade_endpoint_runs_selected_target(tmp_path: Path):
    plugin_dir = write_plugin(
        tmp_path,
        "upgrade_migration_plugin",
        body="""
        class Plugin:
            def register(self, context):
                database = context.get_database("main")
                context.add_migration_target("main", directory="migrations/main", database=database)

        plugin = Plugin()
        """,
    )
    migrations_dir = plugin_dir / "migrations" / "main"
    migrations_dir.mkdir(parents=True)
    (migrations_dir / "001_initial.py").write_text(
        '''
revision = "001"
down_revision = None
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa

def upgrade():
    op.create_table("sample_rows", sa.Column("id", sa.Integer(), primary_key=True))

def downgrade():
    op.drop_table("sample_rows")
''',
        encoding="utf-8",
    )
    app = create_app(config=plugin_config(tmp_path, plugin_dir))
    client = authenticated_client(app)

    response = client.post("/lm-api/v1/plugins/upgrade_migration_plugin/migrations/main/upgrade")

    assert response.status_code == 200
    target = response.json()["target"]
    assert target["current_revision"] == "001"
    assert target["head_revision"] == "001"
    assert target["status"] == "current"
    assert target["pending"] is False
    assert target["last_error"] is None


def test_plugin_migration_upgrade_endpoint_returns_500_and_records_last_error(tmp_path: Path):
    plugin_dir = write_plugin(
        tmp_path,
        "failed_upgrade_migration_plugin",
        body="""
        class Plugin:
            def register(self, context):
                database = context.get_database("main")
                context.add_migration_target("main", directory="migrations/main", database=database)

        plugin = Plugin()
        """,
    )
    migrations_dir = plugin_dir / "migrations" / "main"
    migrations_dir.mkdir(parents=True)
    (migrations_dir / "001_initial.py").write_text(
        '''
revision = "001"
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    raise RuntimeError("migration boom")

def downgrade():
    pass
''',
        encoding="utf-8",
    )
    app = create_app(config=plugin_config(tmp_path, plugin_dir))
    client = authenticated_client(app)

    response = client.post("/lm-api/v1/plugins/failed_upgrade_migration_plugin/migrations/main/upgrade")

    assert response.status_code == 500
    assert "migration boom" in response.json()["detail"]
    target = client.get("/lm-api/v1/plugins/failed_upgrade_migration_plugin/migrations/status").json()["targets"][0]
    plugin_status = client.get("/lm-api/v1/plugins/status").json()["plugins"][0]
    assert "migration boom" in target["last_error"]
    assert any(
        item["level"] == "error" and "Plugin migration target main upgrade failed" in item["message"]
        for item in plugin_status["health"]
    )


def test_plugin_migration_upgrade_endpoint_returns_404_for_unknown_target(tmp_path: Path):
    plugin_dir = write_plugin(
        tmp_path,
        "unknown_target_plugin",
        body="""
        class Plugin:
            def register(self, context):
                database = context.get_database("main")
                context.add_migration_target("main", directory="migrations/main", database=database)

        plugin = Plugin()
        """,
    )
    app = create_app(config=plugin_config(tmp_path, plugin_dir))
    client = authenticated_client(app)

    response = client.post("/lm-api/v1/plugins/unknown_target_plugin/migrations/missing/upgrade")

    assert response.status_code == 404


def test_pending_plugin_migration_target_produces_status_health_warning(tmp_path: Path):
    plugin_dir = write_plugin(
        tmp_path,
        "pending_migration_plugin",
        body="""
        class Plugin:
            def register(self, context):
                context.add_migration_target(
                    "usage",
                    directory="migrations/usage",
                    database_url="sqlite:///usage.db",
                    current_revision="001_initial",
                    head_revision="002_usage",
                )

        plugin = Plugin()
        """,
    )
    app = create_app(config=plugin_config(tmp_path, plugin_dir))
    client = authenticated_client(app)

    migration_status = client.get("/lm-api/v1/plugins/pending_migration_plugin/migrations/status").json()
    plugin_status = client.get("/lm-api/v1/plugins/status").json()["plugins"][0]

    assert migration_status["targets"][0]["status"] == "pending"
    assert migration_status["targets"][0]["pending"] is True
    assert {
        "level": "warning",
        "message": "Plugin migration target usage is pending: current 001_initial, head 002_usage",
    } in plugin_status["health"]
    assert "Plugin migration target usage is pending" in plugin_status["warnings"][0]


def test_plugin_migration_status_endpoint_returns_404_for_unknown_or_disabled_plugin(tmp_path: Path):
    disabled_dir = write_plugin(
        tmp_path,
        "disabled_migration_plugin",
        body="""
        class Plugin:
            def register(self, context):
                context.add_migration_target("target", directory="migrations")

        plugin = Plugin()
        """,
    )
    app = create_app(
        config=plugin_config(
            tmp_path,
            disabled_dir,
            enabled=[],
            plugins={"disabled_migration_plugin": {"path": str(disabled_dir), "enabled": False}},
        )
    )
    client = authenticated_client(app)

    assert client.get("/lm-api/v1/plugins/missing_plugin/migrations/status").status_code == 404
    assert client.get("/lm-api/v1/plugins/disabled_migration_plugin/migrations/status").status_code == 404


def test_plugin_migration_registration_does_not_auto_run_migrations(tmp_path: Path):
    plugin_dir = write_plugin(
        tmp_path,
        "manual_migration_plugin",
        body="""
        migrations_run = False

        def run_migrations():
            global migrations_run
            migrations_run = True

        class Plugin:
            def register(self, context):
                context.add_migration_target(
                    "manual",
                    directory="migrations",
                    current_revision=None,
                    head_revision="001_initial",
                    runner=run_migrations,
                )

        plugin = Plugin()
        """,
    )
    app = create_app(config=plugin_config(tmp_path, plugin_dir))
    client = authenticated_client(app)

    assert client.get("/lm-api/v1/plugins/manual_migration_plugin/migrations/status").status_code == 200
    import manual_migration_plugin.plugin as module

    assert module.migrations_run is False


def test_plugin_route_outside_namespace_and_collision_are_rejected(tmp_path: Path):
    bad_dir = write_plugin(
        tmp_path,
        "bad_route_plugin",
        body="""
        from fastapi import APIRouter
        class Plugin:
            id = "bad_route_plugin"
            name = "Bad Route Plugin"
            version = "1.0"
            def register(self, context):
                context.add_api_router(APIRouter(), prefix="/outside")
        plugin = Plugin()
        """,
    )
    one_dir = write_plugin(tmp_path, "one_plugin")
    two_dir = write_plugin(
        tmp_path,
        "two_plugin",
        body="""
        from fastapi import APIRouter
        class Plugin:
            id = "two_plugin"
            name = "Two Plugin"
            version = "1.0"
            def register(self, context):
                context.add_api_router(APIRouter())
                context.add_api_router(APIRouter())
        plugin = Plugin()
        """,
    )
    app = create_app(config=plugin_config(tmp_path, bad_dir, one_dir, two_dir))
    client = authenticated_client(app)
    statuses = {item["id"]: item for item in client.get("/lm-api/v1/plugins/status").json()["plugins"]}

    assert statuses["bad_route_plugin"]["status"] == "failed"
    assert "outside" in statuses["bad_route_plugin"]["errors"][0]
    assert statuses["two_plugin"]["status"] == "failed"
    assert "collision" in statuses["two_plugin"]["errors"][0].lower()


@pytest.mark.asyncio
async def test_event_bus_delivers_events_and_isolates_subscriber_failures(tmp_path: Path):
    plugin_dir = write_plugin(
        tmp_path,
        "event_plugin",
        body="""
        events = []
        class Plugin:
            id = "event_plugin"
            name = "Event Plugin"
            version = "1.0"
            def register(self, context):
                async def record(event):
                    events.append(event.type)
                async def fail(event):
                    raise RuntimeError("subscriber boom")
                context.subscribe("test.event", fail)
                context.subscribe("test.event", record)
        plugin = Plugin()
        """,
    )
    app = create_app(config=plugin_config(tmp_path, plugin_dir))

    await app.state.plugin_registry.events.emit("test.event", payload={"ok": True})

    import event_plugin.plugin as module

    assert module.events == ["test.event"]
    status = app.state.plugin_registry.status_payload()["plugins"][0]
    assert "subscriber boom" in status["errors"][0]


@pytest.mark.asyncio
async def test_event_envelope_metadata_and_subscriber_timeout_health(tmp_path: Path):
    plugin_dir = write_plugin(
        tmp_path,
        "slow_plugin",
        body="""
        import asyncio
        class Plugin:
            id = "slow_plugin"
            name = "Slow Plugin"
            version = "1.0"
            def register(self, context):
                async def slow(event):
                    await asyncio.sleep(1)
                context.subscribe("test.slow", slow)
        plugin = Plugin()
        """,
    )
    app = create_app(config=plugin_config(tmp_path, plugin_dir))
    app.state.plugin_registry.events.timeout_seconds = 0.01

    event = await app.state.plugin_registry.events.emit("test.slow", correlation_id="abc-123")

    assert event.id
    assert event.version == "1.0"
    assert event.correlation_id == "abc-123"
    status = app.state.plugin_registry.status_payload()["plugins"][0]
    assert status["errors"]


@pytest.mark.asyncio
async def test_chat_admission_hook_rejects_before_capacity_is_consumed(tmp_path: Path):
    class Proxy:
        calls = 0

        async def chat_with_meta(self, model_name, payload):
            self.calls += 1
            return {"ok": True}, {}

    plugin_dir = write_plugin(
        tmp_path,
        "policy_plugin",
        body="""
        class Plugin:
            id = "policy_plugin"
            name = "Policy Plugin"
            version = "1.0"
            def register(self, context):
                async def reject(payload):
                    return {"allowed": False, "message": "quota exceeded"}
                context.add_policy_hook("neuraxis.chat_admission", reject)
        plugin = Plugin()
        """,
    )
    app = create_app(config=plugin_config(tmp_path, plugin_dir))
    proxy = Proxy()
    scheduler = ChatScheduler(proxy, hooks=app.state.plugin_registry.hooks, max_active_per_target=1)

    with pytest.raises(ChatAdmissionError, match="quota exceeded"):
        await scheduler.chat_with_meta("qwen", {"messages": []})

    assert proxy.calls == 0


@pytest.mark.asyncio
async def test_policy_hooks_run_in_registration_order(tmp_path: Path):
    plugin_dir = write_plugin(
        tmp_path,
        "ordered_plugin",
        body="""
        calls = []
        class Plugin:
            id = "ordered_plugin"
            name = "Ordered Plugin"
            version = "1.0"
            def register(self, context):
                async def first(payload):
                    calls.append("first")
                async def second(payload):
                    calls.append("second")
                context.add_policy_hook("neuraxis.chat_admission", first)
                context.add_policy_hook("neuraxis.chat_admission", second)
        plugin = Plugin()
        """,
    )
    app = create_app(config=plugin_config(tmp_path, plugin_dir))

    await app.state.plugin_registry.hooks.run_policy_hooks("neuraxis.chat_admission", {})

    import ordered_plugin.plugin as module

    assert module.calls == ["first", "second"]
