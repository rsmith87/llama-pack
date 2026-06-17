from __future__ import annotations

import json
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, ValidationInfo, field_validator

from llama_pack.core.config import AppConfig
from llama_pack.core.persistence.settings_store_orm import SettingsStoreOrm


JsonScalar = str | int | float | bool | None
SettingSource = Literal["database", "config", "default"]


class UnsupportedRuntimeSettingError(ValueError):
    pass


class RuntimeSettings(BaseModel):
    model_config = ConfigDict(extra="forbid")

    controller_retention_days: int = Field(ge=0)
    controller_archive_retention_days: int = Field(ge=1)
    controller_archive_dir: Path
    routing_fanout_enabled: bool
    routing_fanout_max: int = Field(ge=1, le=32)
    agent_worker_enabled: bool
    agent_worker_poll_interval_seconds: int = Field(ge=1, le=3600)
    agent_worker_max_jobs: int = Field(ge=1, le=128)
    agent_worker_labels: dict[str, JsonScalar]
    agent_worker_capacity: dict[str, JsonScalar]
    client_cors_origins: list[str]
    agent_tools_enabled: bool
    agent_tools_max_iterations: int = Field(ge=1, le=16)
    agent_tools_tool_timeout_seconds: float = Field(gt=0)
    agent_tools_safe_roots: list[Path]

    @field_validator("agent_worker_labels", "agent_worker_capacity", mode="before")
    @classmethod
    def validate_json_scalar_map(cls, value: object, info: ValidationInfo) -> object:
        if not isinstance(value, dict):
            return value
        for item in value.values():
            if isinstance(item, dict | list):
                raise ValueError(f"{info.field_name} values must be JSON scalar values")
        return value


class RuntimeSettingsPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    controller_retention_days: int | None = Field(default=None, ge=0)
    controller_archive_retention_days: int | None = Field(default=None, ge=1)
    controller_archive_dir: Path | None = None
    routing_fanout_enabled: bool | None = None
    routing_fanout_max: int | None = Field(default=None, ge=1, le=32)
    agent_worker_enabled: bool | None = None
    agent_worker_poll_interval_seconds: int | None = Field(default=None, ge=1, le=3600)
    agent_worker_max_jobs: int | None = Field(default=None, ge=1, le=128)
    agent_worker_labels: dict[str, JsonScalar] | None = None
    agent_worker_capacity: dict[str, JsonScalar] | None = None
    client_cors_origins: list[str] | None = None
    agent_tools_enabled: bool | None = None
    agent_tools_max_iterations: int | None = Field(default=None, ge=1, le=16)
    agent_tools_tool_timeout_seconds: float | None = Field(default=None, gt=0)
    agent_tools_safe_roots: list[Path] | None = None

    @field_validator("agent_worker_labels", "agent_worker_capacity", mode="before")
    @classmethod
    def validate_json_scalar_map(cls, value: object, info: ValidationInfo) -> object:
        if value is None:
            return None
        if not isinstance(value, dict):
            return value
        for item in value.values():
            if isinstance(item, dict | list):
                raise ValueError(f"{info.field_name} values must be JSON scalar values")
        return value


class RuntimeSettingsDocument(BaseModel):
    model_config = ConfigDict(extra="forbid")

    settings: RuntimeSettings
    sources: dict[str, SettingSource]


RUNTIME_SETTING_FIELDS: tuple[str, ...] = (
    "controller_retention_days",
    "controller_archive_retention_days",
    "controller_archive_dir",
    "routing_fanout_enabled",
    "routing_fanout_max",
    "agent_worker_enabled",
    "agent_worker_poll_interval_seconds",
    "agent_worker_max_jobs",
    "agent_worker_labels",
    "agent_worker_capacity",
    "client_cors_origins",
    "agent_tools_enabled",
    "agent_tools_max_iterations",
    "agent_tools_tool_timeout_seconds",
    "agent_tools_safe_roots",
)


class RuntimeSettingsService:
    def __init__(self, config: AppConfig, store: SettingsStoreOrm) -> None:
        self.config = config
        self.store = store

    def get_document(self) -> RuntimeSettingsDocument:
        raw_entries = self.store.get_entries()
        values = self._config_values()
        sources = self._config_sources()
        for key, value_json in raw_entries.items():
            if key not in RUNTIME_SETTING_FIELDS:
                continue
            values[key] = json.loads(value_json)
            sources[key] = "database"
        return RuntimeSettingsDocument(
            settings=RuntimeSettings.model_validate(values),
            sources=sources,
        )

    def patch(self, patch: RuntimeSettingsPatch, updated_by: str | None) -> RuntimeSettingsDocument:
        values = patch.model_dump(mode="json", exclude_none=True)
        if not values:
            raise UnsupportedRuntimeSettingError("No runtime settings were provided")
        unsupported = sorted(key for key in values if key not in RUNTIME_SETTING_FIELDS)
        if unsupported:
            names = ", ".join(unsupported)
            raise UnsupportedRuntimeSettingError(f"Unsupported runtime settings: {names}")
        RuntimeSettings.model_validate({**self.get_document().settings.model_dump(), **values})
        self.store.upsert_entries(
            {key: json.dumps(value, sort_keys=True, separators=(",", ":")) for key, value in values.items()},
            updated_by,
        )
        return self.get_document()

    def effective_config(self) -> AppConfig:
        document = self.get_document()
        data = document.settings.model_dump()
        agent_tools = self.config.agent_tools.model_copy(
            update={
                "enabled": data.pop("agent_tools_enabled"),
                "max_iterations": data.pop("agent_tools_max_iterations"),
                "tool_timeout_seconds": data.pop("agent_tools_tool_timeout_seconds"),
                "safe_roots": data.pop("agent_tools_safe_roots"),
            }
        )
        return self.config.model_copy(update={**data, "agent_tools": agent_tools})

    def _config_values(self) -> dict[str, object]:
        values = {key: getattr(self.config, key) for key in RUNTIME_SETTING_FIELDS if not key.startswith("agent_tools_")}
        values.update(
            {
                "agent_tools_enabled": self.config.agent_tools.enabled,
                "agent_tools_max_iterations": self.config.agent_tools.max_iterations,
                "agent_tools_tool_timeout_seconds": self.config.agent_tools.tool_timeout_seconds,
                "agent_tools_safe_roots": list(self.config.agent_tools.safe_roots),
            }
        )
        return values

    def _config_sources(self) -> dict[str, SettingSource]:
        defaults = AppConfig()
        sources: dict[str, SettingSource] = {}
        for key in RUNTIME_SETTING_FIELDS:
            if key.startswith("agent_tools_"):
                config_value = self._config_values()[key]
                default_value = {
                    "agent_tools_enabled": defaults.agent_tools.enabled,
                    "agent_tools_max_iterations": defaults.agent_tools.max_iterations,
                    "agent_tools_tool_timeout_seconds": defaults.agent_tools.tool_timeout_seconds,
                    "agent_tools_safe_roots": list(defaults.agent_tools.safe_roots),
                }[key]
                sources[key] = "default" if config_value == default_value else "config"
            else:
                sources[key] = "default" if getattr(self.config, key) == getattr(defaults, key) else "config"
        return sources
