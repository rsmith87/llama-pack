from __future__ import annotations

import re
from pathlib import Path
from typing import Any, Literal

import yaml
from pydantic import BaseModel, Field, field_validator

PLUGIN_ID_PATTERN = re.compile(r"^[a-z][a-z0-9_]*$")
PluginMode = Literal["agent", "controller"]


class PluginFrontend(BaseModel):
    entry: str | None = None
    style: str | None = None
    static_dir: str | None = None


ConfigFieldType = Literal["string", "integer", "number", "boolean"]


class PluginConfigField(BaseModel):
    type: ConfigFieldType = "string"
    secret: bool = False


class PluginConfigSchema(BaseModel):
    properties: dict[str, PluginConfigField] = Field(default_factory=dict)
    required: list[str] = Field(default_factory=list)

    def validation_errors(self, config: dict[str, Any]) -> list[str]:
        errors: list[str] = []
        for key in self.required:
            if key not in config or config[key] is None:
                errors.append(f"{key} is required")
        for key, value in config.items():
            field = self.properties.get(key)
            if field is None or value is None:
                continue
            if not _matches_config_type(value, field.type):
                errors.append(f"{key} must be {field.type}")
        return errors

    def redact(self, config: dict[str, Any]) -> dict[str, Any]:
        redacted: dict[str, Any] = {}
        for key, value in config.items():
            field = self.properties.get(key)
            redacted[key] = "<redacted>" if field and field.secret and value is not None else value
        return redacted


class PluginManifest(BaseModel):
    id: str
    name: str
    version: str
    requires_core: str = "1.0"
    backend_api_version: str = "1.0"
    frontend_api_version: str = "1.0"
    entrypoint: str
    description: str | None = None
    modes: list[PluginMode] = Field(default_factory=lambda: ["agent", "controller"])
    config_schema: PluginConfigSchema | None = None
    frontend: PluginFrontend | None = None
    navigation: list[dict[str, Any]] = Field(default_factory=list)
    secondary_navigation: list[dict[str, Any]] = Field(default_factory=list)
    ui_routes: list[dict[str, Any]] = Field(default_factory=list)

    @field_validator("id")
    @classmethod
    def validate_id(cls, value: str) -> str:
        if not PLUGIN_ID_PATTERN.fullmatch(value):
            raise ValueError(f"Invalid plugin id {value!r}")
        return value

    @field_validator("modes")
    @classmethod
    def validate_modes(cls, value: list[PluginMode]) -> list[PluginMode]:
        if not value:
            raise ValueError("Plugin modes must include at least one runtime mode")
        return list(dict.fromkeys(value))


def load_manifest(path: Path) -> PluginManifest:
    manifest_path = path / "plugin.yaml"
    with manifest_path.open("r", encoding="utf-8") as handle:
        raw = yaml.safe_load(handle) or {}
    if not isinstance(raw, dict):
        raise ValueError(f"Plugin manifest must be a YAML mapping: {manifest_path}")
    return PluginManifest.model_validate(raw)


def _matches_config_type(value: Any, field_type: ConfigFieldType) -> bool:
    if field_type == "string":
        return isinstance(value, str)
    if field_type == "integer":
        return isinstance(value, int) and not isinstance(value, bool)
    if field_type == "number":
        return (isinstance(value, int | float)) and not isinstance(value, bool)
    if field_type == "boolean":
        return isinstance(value, bool)
    return False
