from __future__ import annotations

from pathlib import Path

import pytest

from llama_pack.core.config import load_config
from llama_pack.core.persistence.alembic_config import Base
from llama_pack.core.persistence.db_infra import create_persistence_engine
from llama_pack.core.persistence.settings_store_orm import SettingsStoreOrm
from llama_pack.core.settings.runtime import (
    AgentToolCatalogPatch,
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
    config = load_config({"log_dir": str(tmp_path / "logs"), "routing_fanout_max": 2, "display_timezone": "UTC"})
    store = _store(tmp_path)
    service = RuntimeSettingsService(config=config, store=store)

    updated = service.patch(
        RuntimeSettingsPatch(routing_fanout_max=4, agent_worker_labels={"gpu": "metal"}, display_timezone="America/Chicago"),
        updated_by="admin",
    )
    reloaded = RuntimeSettingsService(config=config, store=store).get_document()

    assert updated.settings.routing_fanout_max == 4
    assert updated.sources["routing_fanout_max"] == "database"
    assert updated.settings.display_timezone == "America/Chicago"
    assert updated.sources["display_timezone"] == "database"
    assert reloaded.settings.routing_fanout_max == 4
    assert reloaded.settings.agent_worker_labels == {"gpu": "metal"}
    assert reloaded.settings.display_timezone == "America/Chicago"


def test_runtime_settings_patch_rejects_invalid_display_timezone(tmp_path: Path):
    config = load_config({"log_dir": str(tmp_path / "logs")})
    service = RuntimeSettingsService(config=config, store=_store(tmp_path))

    with pytest.raises(ValueError, match="display_timezone must be a valid IANA timezone"):
        RuntimeSettingsPatch(display_timezone="Central")

    with pytest.raises(ValueError, match="display_timezone must be a valid IANA timezone"):
        service.patch(RuntimeSettingsPatch(display_timezone="America/NotAZone"), updated_by="admin")


def test_runtime_settings_patch_persists_model_roots(tmp_path: Path):
    config_root = tmp_path / "config-models"
    database_root = tmp_path / "database-models"
    config = load_config({"log_dir": str(tmp_path / "logs"), "hf_models_dirs": [str(config_root)]})
    store = _store(tmp_path)
    service = RuntimeSettingsService(config=config, store=store)

    updated = service.patch(RuntimeSettingsPatch(hf_models_dirs=[database_root]), updated_by="admin")
    reloaded = RuntimeSettingsService(config=config, store=store).get_document()
    effective = RuntimeSettingsService(config=config, store=store).effective_config()

    assert updated.settings.hf_models_dirs == [database_root]
    assert updated.sources["hf_models_dirs"] == "database"
    assert reloaded.settings.hf_models_dirs == [database_root]
    assert effective.model_roots == [database_root]
    assert config.model_roots == [config_root]


def test_runtime_settings_patch_persists_agent_tool_controls(tmp_path: Path):
    config = load_config(
        {
            "log_dir": str(tmp_path / "logs"),
            "agent_tools": {
                "enabled": False,
                "max_iterations": 4,
                "tool_timeout_seconds": 10.0,
                "answer_verification_mode": "warn",
                "answer_verification_max_retries": 1,
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
            agent_tools_answer_verification_mode="strict",
            agent_tools_answer_verification_max_retries=2,
            agent_tools_safe_roots=[tmp_path / "workspace"],
        ),
        updated_by="admin",
    )
    effective = RuntimeSettingsService(config=config, store=store).effective_config()

    assert updated.settings.agent_tools_enabled is True
    assert updated.settings.agent_tools_max_iterations == 8
    assert updated.settings.agent_tools_tool_timeout_seconds == 12.5
    assert updated.settings.agent_tools_answer_verification_mode == "strict"
    assert updated.settings.agent_tools_answer_verification_max_retries == 2
    assert updated.settings.agent_tools_safe_roots == [tmp_path / "workspace"]
    assert effective.agent_tools.enabled is True
    assert effective.agent_tools.max_iterations == 8
    assert effective.agent_tools.tool_timeout_seconds == 12.5
    assert effective.agent_tools.answer_verification_mode == "strict"
    assert effective.agent_tools.answer_verification_max_retries == 2
    assert effective.agent_tools.safe_roots == [tmp_path / "workspace"]
    assert config.agent_tools.enabled is False
    assert config.agent_tools.answer_verification_mode == "warn"


def test_runtime_settings_patch_persists_context_and_thread_compaction(tmp_path: Path):
    config = load_config(
        {
            "log_dir": str(tmp_path / "logs"),
            "context_summarization_trigger_ratio": 0.75,
            "thread_history_min_prompt_tokens": 6000,
        }
    )
    store = _store(tmp_path)
    service = RuntimeSettingsService(config=config, store=store)

    updated = service.patch(
        RuntimeSettingsPatch(
            context_summarization_enabled=False,
            context_summarization_trigger_ratio=0.80,
            context_summarization_target_ratio=0.60,
            context_summarization_recent_messages=6,
            context_summarization_max_tokens=1024,
            thread_history_compaction_enabled=False,
            thread_history_context_ratio=0.45,
            thread_history_min_prompt_tokens=5000,
            thread_history_recent_messages=8,
            thread_history_summary_max_chars=3000,
            thread_history_summary_item_max_chars=280,
        ),
        updated_by="admin",
    )
    effective = RuntimeSettingsService(config=config, store=store).effective_config()

    assert updated.settings.context_summarization_enabled is False
    assert updated.settings.context_summarization_trigger_ratio == 0.80
    assert updated.settings.context_summarization_target_ratio == 0.60
    assert updated.settings.context_summarization_recent_messages == 6
    assert updated.settings.context_summarization_max_tokens == 1024
    assert updated.settings.thread_history_compaction_enabled is False
    assert updated.settings.thread_history_context_ratio == 0.45
    assert updated.settings.thread_history_min_prompt_tokens == 5000
    assert updated.settings.thread_history_recent_messages == 8
    assert updated.settings.thread_history_summary_max_chars == 3000
    assert updated.settings.thread_history_summary_item_max_chars == 280
    assert effective.context_summarization_enabled is False
    assert effective.context_summarization_trigger_ratio == 0.80
    assert effective.thread_history_min_prompt_tokens == 5000
    assert config.context_summarization_trigger_ratio == 0.75


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


def test_agent_tool_catalog_patch_persists_project_profile_and_effective_config(tmp_path: Path):
    workspace = tmp_path / "workspace"
    workspace.mkdir()
    config = load_config(
        {
            "log_dir": str(tmp_path / "logs"),
            "agent_tools": {
                "enabled": True,
                "safe_roots": [str(tmp_path)],
                "tools": {
                    "config_status": {
                        "type": "shell",
                        "description": "Config status.",
                        "command": ["printf", "ok"],
                    }
                },
            },
        }
    )
    store = _store(tmp_path)
    service = RuntimeSettingsService(config=config, store=store)

    document = service.patch_agent_tool_catalog(
        AgentToolCatalogPatch(
            tools={
                "read_project_file": {
                    "type": "file_read_dynamic",
                    "description": "Read project file.",
                    "path": str(workspace),
                }
            },
            profiles={
                "llama_pack": {
                    "description": "Llama Pack workspace.",
                    "safe_roots": [str(workspace)],
                    "tools": ["read_project_file"],
                }
            },
            active_profile="llama_pack",
        ),
        updated_by="admin",
    )
    effective = RuntimeSettingsService(config=config, store=store).effective_config()

    assert document.active_profile == "llama_pack"
    assert set(document.tools) == {"config_status", "read_project_file"}
    assert document.sources["read_project_file"] == "database"
    assert set(effective.agent_tools.tools) == {"read_project_file"}
    assert effective.agent_tools.safe_roots == [workspace]
    assert config.agent_tools.safe_roots == [tmp_path]


def test_agent_tool_catalog_patch_rejects_unknown_profile_tool(tmp_path: Path):
    config = load_config({"log_dir": str(tmp_path / "logs")})
    service = RuntimeSettingsService(config=config, store=_store(tmp_path))

    with pytest.raises(UnsupportedRuntimeSettingError, match="Unknown tools in profile llama_pack: missing_tool"):
        service.patch_agent_tool_catalog(
            AgentToolCatalogPatch(
                profiles={
                    "llama_pack": {
                        "description": "Broken profile.",
                        "safe_roots": [str(tmp_path)],
                        "tools": ["missing_tool"],
                    }
                },
                active_profile="llama_pack",
            ),
            updated_by="admin",
        )


def test_agent_tool_catalog_effective_config_validates_profile_safe_roots(tmp_path: Path):
    workspace = tmp_path / "workspace"
    outside = tmp_path / "outside"
    workspace.mkdir()
    outside.mkdir()
    config = load_config({"log_dir": str(tmp_path / "logs"), "agent_tools": {"enabled": True}})
    store = _store(tmp_path)
    service = RuntimeSettingsService(config=config, store=store)

    service.patch_agent_tool_catalog(
        AgentToolCatalogPatch(
            tools={
                "read_outside": {
                    "type": "file_read_dynamic",
                    "description": "Read outside file.",
                    "path": str(outside),
                }
            },
            profiles={
                "llama_pack": {
                    "description": "Llama Pack workspace.",
                    "safe_roots": [str(workspace)],
                    "tools": ["read_outside"],
                }
            },
            active_profile="llama_pack",
        ),
        updated_by="admin",
    )

    with pytest.raises(ValueError, match="safe_roots"):
        service.effective_config()
