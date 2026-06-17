from __future__ import annotations

import json
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, ValidationInfo, field_validator

from llama_pack.core.config import AppConfig
from llama_pack.core.config.models import AgentToolDefinitionConfig, AgentToolsConfig
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


class AgentToolProjectProfile(BaseModel):
    model_config = ConfigDict(extra="forbid")

    description: str | None = None
    safe_roots: list[Path]
    tools: list[str]


class AgentToolCatalogPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    tools: dict[str, AgentToolDefinitionConfig] | None = None
    profiles: dict[str, AgentToolProjectProfile] | None = None
    active_profile: str | None = None


class AgentToolCatalogDocument(BaseModel):
    model_config = ConfigDict(extra="forbid")

    tools: dict[str, AgentToolDefinitionConfig]
    sources: dict[str, SettingSource]
    profiles: dict[str, AgentToolProjectProfile]
    active_profile: str | None


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
AGENT_TOOLS_TOOLS_KEY = "agent_tools_tools"
AGENT_TOOLS_PROFILES_KEY = "agent_tools_profiles"
AGENT_TOOLS_ACTIVE_PROFILE_KEY = "agent_tools_active_profile"


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

    def get_agent_tool_catalog_document(self) -> AgentToolCatalogDocument:
        raw_entries = self.store.get_entries()
        tools = dict(self.config.agent_tools.tools)
        sources = {name: self._tool_source(name, tools[name]) for name in tools}
        if AGENT_TOOLS_TOOLS_KEY in raw_entries:
            database_tools = self._database_tools(raw_entries[AGENT_TOOLS_TOOLS_KEY])
            tools.update(database_tools)
            sources.update({name: "database" for name in database_tools})
        profiles = self._database_profiles(raw_entries.get(AGENT_TOOLS_PROFILES_KEY))
        active_profile = self._database_active_profile(raw_entries.get(AGENT_TOOLS_ACTIVE_PROFILE_KEY))
        return AgentToolCatalogDocument(
            tools=tools,
            sources=sources,
            profiles=profiles,
            active_profile=active_profile,
        )

    def patch_agent_tool_catalog(self, patch: AgentToolCatalogPatch, updated_by: str | None) -> AgentToolCatalogDocument:
        if not patch.model_fields_set:
            raise UnsupportedRuntimeSettingError("No agent tool catalog settings were provided")
        current = self.get_agent_tool_catalog_document()
        tools = patch.tools if "tools" in patch.model_fields_set and patch.tools is not None else current.tools
        profiles = patch.profiles if "profiles" in patch.model_fields_set and patch.profiles is not None else current.profiles
        active_profile = patch.active_profile if "active_profile" in patch.model_fields_set else current.active_profile
        self._validate_profile_tools(tools, profiles, active_profile)
        values: dict[str, str] = {}
        if "tools" in patch.model_fields_set and patch.tools is not None:
            values[AGENT_TOOLS_TOOLS_KEY] = json.dumps(
                {name: tool.model_dump(mode="json") for name, tool in patch.tools.items()},
                sort_keys=True,
                separators=(",", ":"),
            )
        if "profiles" in patch.model_fields_set and patch.profiles is not None:
            values[AGENT_TOOLS_PROFILES_KEY] = json.dumps(
                {name: profile.model_dump(mode="json") for name, profile in patch.profiles.items()},
                sort_keys=True,
                separators=(",", ":"),
            )
        if "active_profile" in patch.model_fields_set:
            values[AGENT_TOOLS_ACTIVE_PROFILE_KEY] = json.dumps(active_profile, sort_keys=True, separators=(",", ":"))
        if not values:
            raise UnsupportedRuntimeSettingError("No agent tool catalog settings were provided")
        self.store.upsert_entries(values, updated_by)
        return self.get_agent_tool_catalog_document()

    def effective_config(self) -> AppConfig:
        document = self.get_document()
        data = document.settings.model_dump()
        catalog = self.get_agent_tool_catalog_document()
        agent_tool_values = {
            "enabled": data.pop("agent_tools_enabled"),
            "max_iterations": data.pop("agent_tools_max_iterations"),
            "tool_timeout_seconds": data.pop("agent_tools_tool_timeout_seconds"),
            "safe_roots": data.pop("agent_tools_safe_roots"),
            "tools": catalog.tools,
        }
        if catalog.active_profile is not None:
            profile = catalog.profiles.get(catalog.active_profile)
            if profile is None:
                raise UnsupportedRuntimeSettingError(f"Unknown active agent tool profile: {catalog.active_profile}")
            self._validate_profile_tools(catalog.tools, catalog.profiles, catalog.active_profile)
            agent_tool_values["safe_roots"] = profile.safe_roots
            agent_tool_values["tools"] = {name: catalog.tools[name] for name in profile.tools}
        agent_tools = AgentToolsConfig.model_validate({**self.config.agent_tools.model_dump(), **agent_tool_values})
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

    def _tool_source(self, name: str, tool: AgentToolDefinitionConfig) -> SettingSource:
        defaults = AppConfig()
        if name in defaults.agent_tools.tools and defaults.agent_tools.tools[name] == tool:
            return "default"
        return "config"

    def _database_tools(self, value_json: str) -> dict[str, AgentToolDefinitionConfig]:
        raw = json.loads(value_json)
        if not isinstance(raw, dict):
            raise UnsupportedRuntimeSettingError("agent_tools_tools must be a JSON object")
        return {str(name): AgentToolDefinitionConfig.model_validate(value) for name, value in raw.items()}

    def _database_profiles(self, value_json: str | None) -> dict[str, AgentToolProjectProfile]:
        if value_json is None:
            return {}
        raw = json.loads(value_json)
        if not isinstance(raw, dict):
            raise UnsupportedRuntimeSettingError("agent_tools_profiles must be a JSON object")
        return {str(name): AgentToolProjectProfile.model_validate(value) for name, value in raw.items()}

    def _database_active_profile(self, value_json: str | None) -> str | None:
        if value_json is None:
            return None
        raw = json.loads(value_json)
        if raw is None:
            return None
        return str(raw)

    def _validate_profile_tools(
        self,
        tools: dict[str, AgentToolDefinitionConfig],
        profiles: dict[str, AgentToolProjectProfile],
        active_profile: str | None,
    ) -> None:
        for profile_name, profile in profiles.items():
            missing = [name for name in profile.tools if name not in tools]
            if missing:
                raise UnsupportedRuntimeSettingError(f"Unknown tools in profile {profile_name}: {', '.join(missing)}")
        if active_profile is not None and active_profile not in profiles:
            raise UnsupportedRuntimeSettingError(f"Unknown active agent tool profile: {active_profile}")
