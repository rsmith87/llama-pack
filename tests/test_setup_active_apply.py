from pathlib import Path

import pytest
from fastapi.testclient import TestClient as RawTestClient

from llama_pack.core.config import load_config
from llama_pack.core.setup.active_setup import (
    AgentSetupInputs,
    ActiveSetupRequest,
    ControllerSetupInputs,
    MigrationStepResult,
    SetupInputs,
    apply_active_setup,
    preflight_active_setup,
    run_setup_migrations,
)

REAL_RUN_SETUP_MIGRATIONS = run_setup_migrations
from llama_pack.main import create_app
from tests.helpers import authenticated_client
from tests.persistence_db_setup import prepare_all_persistence_dbs


@pytest.fixture(autouse=True)
def _prepare_migrated_persistence(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.chdir(tmp_path)
    prepare_all_persistence_dbs(tmp_path)
    prepare_all_persistence_dbs(tmp_path / "logs")


def controller_request(tmp_path: Path, *, overwrite: bool = False) -> ActiveSetupRequest:
    return ActiveSetupRequest(
        mode="controller",
        config_path=str(tmp_path / "config.yaml"),
        env_path=str(tmp_path / ".llama_pack.env"),
        overwrite_existing=overwrite,
        inputs=SetupInputs(
            controller=ControllerSetupInputs(
                log_dir="./logs",
                controller_registration_key="registration-secret",
                node_heartbeat_timeout_seconds=90,
                controller_instance_id="local-controller",
            )
        ),
    )


def agent_request(tmp_path: Path, *, overwrite: bool = False) -> ActiveSetupRequest:
    return ActiveSetupRequest(
        mode="agent",
        config_path=str(tmp_path / "agent.config.yaml"),
        env_path=str(tmp_path / ".llama_pack.env"),
        overwrite_existing=overwrite,
        inputs=SetupInputs(
            agent=AgentSetupInputs(
                controller_url="http://controller.local:9137",
                node_name="mac-mini",
                agent_url="http://mac-mini.local:9137",
                agent_api_key="agent-secret",
                controller_registration_key_outbound="registration-secret",
                llama_server_bin="./llama.cpp/build/bin/llama-server",
                llama_cpp_dir="./llama.cpp",
                python_bin="python3",
                hf_models_dir="./models/HFModels",
                log_dir="./logs",
            )
        ),
    )


def standalone_request(tmp_path: Path, *, overwrite: bool = False) -> ActiveSetupRequest:
    request = agent_request(tmp_path, overwrite=overwrite)
    return ActiveSetupRequest(
        mode="standalone",
        config_path=str(tmp_path / "config.yaml"),
        env_path=request.env_path,
        overwrite_existing=request.overwrite_existing,
        inputs=request.inputs,
    )


def migration_success(target: str) -> MigrationStepResult:
    return MigrationStepResult(target=target, revision=f"{target}@head", ok=True, error="")


@pytest.fixture(autouse=True)
def _fast_setup_migrations(monkeypatch: pytest.MonkeyPatch) -> None:
    def fake_run_migrations(config_path: Path) -> list[MigrationStepResult]:
        if not config_path.exists():
            raise AssertionError(f"Config path does not exist: {config_path}")
        return [migration_success("controller"), migration_success("auth")]

    monkeypatch.setattr("llama_pack.core.setup.active_setup.run_setup_migrations", fake_run_migrations)


def test_preflight_blocks_existing_files_without_overwrite(tmp_path: Path) -> None:
    (tmp_path / "config.yaml").write_text("mode: controller\n", encoding="utf-8")
    (tmp_path / ".llama_pack.env").write_text("export OLD=1\n", encoding="utf-8")

    result = preflight_active_setup(controller_request(tmp_path, overwrite=False))

    assert result.ok is False
    assert result.status == "blocked_existing_files"
    assert result.existing_files == [
        str(tmp_path / "config.yaml"),
        str(tmp_path / ".llama_pack.env"),
    ]
    assert result.planned_files == [
        str(tmp_path / "config.yaml"),
        str(tmp_path / ".llama_pack.env"),
    ]
    assert result.backup_files == []


def test_preflight_allows_existing_files_with_overwrite(tmp_path: Path) -> None:
    (tmp_path / "config.yaml").write_text("mode: controller\n", encoding="utf-8")

    result = preflight_active_setup(controller_request(tmp_path, overwrite=True))

    assert result.ok is True
    assert result.status == "ready"
    assert result.existing_files == [str(tmp_path / "config.yaml")]


def test_apply_writes_controller_config_and_env(tmp_path: Path) -> None:
    result = apply_active_setup(controller_request(tmp_path, overwrite=False))

    assert result.ok is True
    assert result.status == "applied"
    assert (tmp_path / "config.yaml").read_text(encoding="utf-8") == (
        "mode: controller\n"
        "log_dir: ./logs\n"
        "controller_registration_key: ${LLAMA_PACK_CONTROLLER_REGISTRATION_KEY}\n"
        "node_heartbeat_timeout_seconds: 90\n"
        "controller_instance_id: local-controller\n"
        "nodes: {}\n"
    )
    env_text = (tmp_path / ".llama_pack.env").read_text(encoding="utf-8")
    assert "export LLAMA_PACK_CONFIG=" in env_text
    assert "export LLAMA_PACK_CONTROLLER_REGISTRATION_KEY=registration-secret" in env_text
    assert [step.target for step in result.migrations] == ["controller", "auth"]
    assert [action.kind for action in result.actions] == [
        "files_written",
        "backups_created",
        "migrations_run",
        "next_command",
    ]
    assert result.actions[0].status == "completed"
    assert result.actions[0].detail == "Wrote 2 setup files."
    assert result.actions[1].status == "skipped"
    assert result.actions[2].detail == "2 migrations completed."
    assert result.actions[3].command == "scripts/start_controller.sh"
    assert "registration-secret" not in result.model_dump_json()


def test_apply_writes_agent_config_and_env(tmp_path: Path) -> None:
    result = apply_active_setup(agent_request(tmp_path, overwrite=False))

    assert result.ok is True
    assert result.status == "applied"
    assert (tmp_path / "agent.config.yaml").read_text(encoding="utf-8") == (
        "mode: agent\n"
        "controller_url: ${LLAMA_PACK_CONTROLLER_URL}\n"
        "node_name: mac-mini\n"
        "agent_url: ${LLAMA_PACK_AGENT_URL}\n"
        "agent_api_key: ${LLAMA_PACK_AGENT_API_KEY}\n"
        "controller_registration_key_outbound: ${LLAMA_PACK_CONTROLLER_REGISTRATION_KEY_OUTBOUND}\n"
        "llama_server_bin: ./llama.cpp/build/bin/llama-server\n"
        "llama_cpp_dir: ./llama.cpp\n"
        "python_bin: python3\n"
        "hf_models_dirs:\n"
        "  - ./models/HFModels\n"
        "log_dir: ./logs\n"
    )
    env_text = (tmp_path / ".llama_pack.env").read_text(encoding="utf-8")
    assert "export LLAMA_PACK_CONFIG=" in env_text
    assert "export LLAMA_PACK_CONTROLLER_URL=http://controller.local:9137" in env_text
    assert "export LLAMA_PACK_AGENT_URL=http://mac-mini.local:9137" in env_text
    assert "export LLAMA_PACK_AGENT_API_KEY=agent-secret" in env_text
    assert "export LLAMA_PACK_CONTROLLER_REGISTRATION_KEY_OUTBOUND=registration-secret" in env_text
    assert "agent-secret" not in (tmp_path / "agent.config.yaml").read_text(encoding="utf-8")
    assert "registration-secret" not in result.model_dump_json()


def test_apply_writes_standalone_config_as_local_agent(tmp_path: Path) -> None:
    result = apply_active_setup(standalone_request(tmp_path, overwrite=False))

    assert result.ok is True
    assert result.status == "applied"
    config_text = (tmp_path / "config.yaml").read_text(encoding="utf-8")
    assert config_text.startswith("mode: agent\n")
    assert "controller_url:" not in config_text
    assert "agent_url:" not in config_text
    assert "agent_api_key:" not in config_text
    assert "controller_registration_key_outbound:" not in config_text


def test_apply_reports_failed_migration(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    def fake_run_migrations(config_path: Path) -> list[MigrationStepResult]:
        if not config_path.exists():
            raise AssertionError(f"Config path does not exist: {config_path}")
        return [
            migration_success("controller"),
            MigrationStepResult(
                target="auth",
                revision="auth@head",
                ok=False,
                error="auth migration failed",
            ),
        ]

    monkeypatch.setattr("llama_pack.core.setup.active_setup.run_setup_migrations", fake_run_migrations)

    result = apply_active_setup(controller_request(tmp_path, overwrite=False))

    assert result.ok is False
    assert result.status == "failed"
    assert result.migrations[1].target == "auth"
    assert result.migrations[1].error == "auth migration failed"
    assert result.actions[-1].kind == "migrations_run"
    assert result.actions[-1].status == "failed"
    assert result.actions[-1].detail == "1 migration failed."


def test_apply_creates_backups_when_overwriting(tmp_path: Path) -> None:
    (tmp_path / "config.yaml").write_text("old config\n", encoding="utf-8")
    (tmp_path / ".llama_pack.env").write_text("old env\n", encoding="utf-8")

    result = apply_active_setup(controller_request(tmp_path, overwrite=True))

    assert result.ok is True
    assert result.status == "applied"
    assert len(result.backup_files) == 2
    backup_text = [Path(path).read_text(encoding="utf-8") for path in result.backup_files]
    assert "old config\n" in backup_text
    assert "old env\n" in backup_text


def test_setup_apply_route_blocks_existing_files_and_audits(tmp_path: Path) -> None:
    (tmp_path / "config.yaml").write_text("old\n", encoding="utf-8")
    app = create_app(config=load_config({"mode": "controller", "log_dir": str(tmp_path)}))

    with authenticated_client(app) as client:
        response = client.post(
            "/lm-api/v1/setup/apply",
            json=controller_request(tmp_path, overwrite=False).model_dump(),
        )

    assert response.status_code == 409
    assert response.json()["status"] == "blocked_existing_files"
    events = app.state.audit_store.list_events(limit=10)
    assert any(event["event_type"] == "setup_apply_blocked_existing_files" for event in events)


def test_setup_apply_route_writes_files_and_audits_success(tmp_path: Path) -> None:
    app = create_app(config=load_config({"mode": "controller", "log_dir": str(tmp_path)}))

    with authenticated_client(app) as client:
        response = client.post(
            "/lm-api/v1/setup/apply",
            json=controller_request(tmp_path, overwrite=False).model_dump(),
        )

    assert response.status_code == 200
    assert response.json()["status"] == "applied"
    events = app.state.audit_store.list_events(limit=10)
    assert any(event["event_type"] == "setup_apply_completed" for event in events)
    completed = next(event for event in events if event["event_type"] == "setup_apply_completed")
    assert completed["payload"]["migrations"] == [
        {"target": "controller", "revision": "controller@head", "ok": True, "error": ""},
        {"target": "auth", "revision": "auth@head", "ok": True, "error": ""},
    ]
    assert response.json()["actions"][-1] == {
        "kind": "admin_bootstrap",
        "status": "skipped",
        "detail": "Admin key already configured.",
        "command": "",
    }
    assert completed["payload"]["actions"][-1] == {
        "kind": "admin_bootstrap",
        "status": "skipped",
        "detail": "Admin key already configured.",
        "command": "",
    }
    assert "registration-secret" not in str(events)


def test_setup_apply_route_audits_failed_migrations_without_secrets(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def fake_run_migrations(config_path: Path) -> list[MigrationStepResult]:
        if not config_path.exists():
            raise AssertionError(f"Config path does not exist: {config_path}")
        return [
            migration_success("controller"),
            MigrationStepResult(
                target="auth",
                revision="auth@head",
                ok=False,
                error="auth migration failed",
            ),
        ]

    monkeypatch.setattr("llama_pack.core.setup.active_setup.run_setup_migrations", fake_run_migrations)
    app = create_app(config=load_config({"mode": "controller", "log_dir": str(tmp_path)}))

    with authenticated_client(app) as client:
        response = client.post(
            "/lm-api/v1/setup/apply",
            json=controller_request(tmp_path, overwrite=False).model_dump(),
        )

    assert response.status_code == 500
    events = app.state.audit_store.list_events(limit=10)
    failed = next(event for event in events if event["event_type"] == "setup_apply_failed")
    assert failed["payload"]["migrations"] == [
        {"target": "controller", "revision": "controller@head", "ok": True, "error": ""},
        {"target": "auth", "revision": "auth@head", "ok": False, "error": "auth migration failed"},
    ]
    assert failed["payload"]["actions"][-1] == {
        "kind": "migrations_run",
        "status": "failed",
        "detail": "1 migration failed.",
        "command": "",
    }
    assert "registration-secret" not in str(events)


def test_setup_apply_route_bootstraps_first_admin_key_without_auditing_secret(tmp_path: Path) -> None:
    app = create_app(config=load_config({"mode": "controller", "log_dir": str(tmp_path)}))
    client = RawTestClient(app)

    response = client.post(
        "/lm-api/v1/setup/apply",
        json=controller_request(tmp_path, overwrite=False).model_dump(),
    )

    assert response.status_code == 200
    payload = response.json()
    bootstrap = payload["admin_bootstrap"]
    assert bootstrap["created"] is True
    assert bootstrap["username"] == "admin"
    assert bootstrap["role"] == "admin"
    assert bootstrap["token"]
    assert bootstrap["key"].startswith("lm_")
    assert bootstrap["key_hint"]

    me = client.get("/lm-api/v1/auth/me", headers={"X-UI-Session": bootstrap["token"]})
    assert me.status_code == 200
    assert me.json()["username"] == "admin"

    events = app.state.audit_store.list_events(limit=10)
    assert any(event["event_type"] == "auth_bootstrap_admin_create" for event in events)
    completed = next(event for event in events if event["event_type"] == "setup_apply_completed")
    assert completed["payload"]["admin_bootstrap"] == {
        "created": True,
        "username": "admin",
        "role": "admin",
        "key_id": bootstrap["key_id"],
    }
    assert "token" not in completed["payload"]["admin_bootstrap"]
    assert "key" not in completed["payload"]["admin_bootstrap"]
    assert "key_hint" not in completed["payload"]["admin_bootstrap"]
    assert payload["actions"][-1] == {
        "kind": "admin_bootstrap",
        "status": "completed",
        "detail": "Created admin key for admin.",
        "command": "",
    }
    assert completed["payload"]["actions"][-1] == {
        "kind": "admin_bootstrap",
        "status": "completed",
        "detail": "Created admin key for admin.",
        "command": "",
    }
    assert bootstrap["key"] not in str(events)
    assert bootstrap["token"] not in str(events)
    assert bootstrap["key_hint"] not in str(events)


def test_run_setup_migrations_creates_all_persistence_schemas(
    tmp_path: Path,
) -> None:
    config_path = tmp_path / "config.yaml"
    config_path.write_text(
        "\n".join(
            [
                "mode: controller",
                f"log_dir: {tmp_path / 'fresh-logs'}",
                "controller_registration_key: registration-secret",
            ]
        ),
        encoding="utf-8",
    )

    result = REAL_RUN_SETUP_MIGRATIONS(config_path)

    assert [step.target for step in result] == [
        "controller",
        "auth",
        "audit",
        "chat_sessions",
        "downloads",
        "benchmarks",
        "models",
        "settings",
    ]
    assert all(step.ok for step in result), [step.model_dump() for step in result]
    assert (tmp_path / "fresh-logs" / "state" / "controller_state.db").exists()
    assert (tmp_path / "fresh-logs" / "state" / "models.db").exists()
    assert (tmp_path / "fresh-logs" / "state" / "settings.db").exists()
