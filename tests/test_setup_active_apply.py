from pathlib import Path

import pytest
from fastapi.testclient import TestClient as RawTestClient

from llama_pack.core.config import load_config
from llama_pack.core.setup.active_setup import (
    ActiveSetupRequest,
    ControllerSetupInputs,
    SetupInputs,
    apply_active_setup,
    preflight_active_setup,
)
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
    assert "registration-secret" not in result.model_dump_json()


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
    assert "registration-secret" not in str(events)
