from __future__ import annotations

from pathlib import Path

import pytest

from llama_pack.core.config import load_config
from llama_pack.core.persistence.alembic_config import Base
from llama_pack.core.persistence.db_infra import create_persistence_engine
from llama_pack.core.persistence.settings_store_orm import SettingsStoreOrm
from llama_pack.core.settings.runtime import (
    RuntimeSettingsPatch,
    RuntimeSettingsService,
    UnsupportedRuntimeSettingError,
)
from llama_pack.core.persistence.models.settings import SettingsEntryOrm


def _store(tmp_path: Path) -> SettingsStoreOrm:
    db_url = f"sqlite+pysqlite:///{tmp_path / 'settings.db'}"
    engine = create_persistence_engine(db_url)
    Base.metadata.create_all(engine, tables=[SettingsEntryOrm.__table__])
    engine.dispose()
    return SettingsStoreOrm(db_url=db_url)


def test_runtime_settings_defaults_are_derived_from_config(tmp_path: Path):
    config = load_config(
        {
            "log_dir": str(tmp_path / "logs"),
            "controller_retention_days": 14,
            "routing_fanout_enabled": True,
            "routing_fanout_max": 3,
            "client_cors_origins": ["http://localhost:5173"],
        }
    )
    service = RuntimeSettingsService(config=config, store=_store(tmp_path))

    document = service.get_document()

    assert document.settings.controller_retention_days == 14
    assert document.settings.routing_fanout_enabled is True
    assert document.settings.routing_fanout_max == 3
    assert document.settings.client_cors_origins == ["http://localhost:5173"]
    assert document.sources["routing_fanout_max"] == "config"


def test_runtime_settings_patch_persists_database_overrides(tmp_path: Path):
    config = load_config({"log_dir": str(tmp_path / "logs"), "routing_fanout_max": 2})
    store = _store(tmp_path)
    service = RuntimeSettingsService(config=config, store=store)

    updated = service.patch(
        RuntimeSettingsPatch(routing_fanout_max=4, agent_worker_labels={"gpu": "metal"}),
        updated_by="admin",
    )
    reloaded = RuntimeSettingsService(config=config, store=store).get_document()

    assert updated.settings.routing_fanout_max == 4
    assert updated.sources["routing_fanout_max"] == "database"
    assert reloaded.settings.routing_fanout_max == 4
    assert reloaded.settings.agent_worker_labels == {"gpu": "metal"}


def test_runtime_settings_patch_persists_agent_tool_controls(tmp_path: Path):
    config = load_config(
        {
            "log_dir": str(tmp_path / "logs"),
            "agent_tools": {
                "enabled": False,
                "max_iterations": 4,
                "tool_timeout_seconds": 10.0,
                "safe_roots": [str(tmp_path)],
                "tools": {},
            },
        }
    )
    store = _store(tmp_path)
    service = RuntimeSettingsService(config=config, store=store)

    updated = service.patch(
        RuntimeSettingsPatch(
            agent_tools_enabled=True,
            agent_tools_max_iterations=8,
            agent_tools_tool_timeout_seconds=12.5,
            agent_tools_safe_roots=[tmp_path / "workspace"],
        ),
        updated_by="admin",
    )
    effective = RuntimeSettingsService(config=config, store=store).effective_config()

    assert updated.settings.agent_tools_enabled is True
    assert updated.settings.agent_tools_max_iterations == 8
    assert updated.settings.agent_tools_tool_timeout_seconds == 12.5
    assert updated.settings.agent_tools_safe_roots == [tmp_path / "workspace"]
    assert effective.agent_tools.enabled is True
    assert effective.agent_tools.max_iterations == 8
    assert effective.agent_tools.tool_timeout_seconds == 12.5
    assert effective.agent_tools.safe_roots == [tmp_path / "workspace"]
    assert config.agent_tools.enabled is False


def test_runtime_settings_patch_rejects_empty_patch(tmp_path: Path):
    config = load_config({"log_dir": str(tmp_path / "logs")})
    service = RuntimeSettingsService(config=config, store=_store(tmp_path))

    with pytest.raises(UnsupportedRuntimeSettingError, match="No runtime settings were provided"):
        service.patch(RuntimeSettingsPatch(), updated_by="admin")


def test_runtime_settings_patch_validates_json_scalar_maps():
    with pytest.raises(ValueError, match="agent_worker_capacity values must be JSON scalar values"):
        RuntimeSettingsPatch(agent_worker_capacity={"gpu": {"nested": True}})


def test_runtime_settings_effective_config_does_not_mutate_bootstrap_config(tmp_path: Path):
    config = load_config({"log_dir": str(tmp_path / "logs"), "routing_fanout_max": 2})
    service = RuntimeSettingsService(config=config, store=_store(tmp_path))

    service.patch(RuntimeSettingsPatch(routing_fanout_max=5), updated_by="admin")
    effective = service.effective_config()

    assert effective.routing_fanout_max == 5
    assert config.routing_fanout_max == 2
