from __future__ import annotations

import re
from pathlib import Path
from typing import Any, Literal

import yaml
from pydantic import BaseModel, Field, field_validator, model_validator

PLUGIN_ID_PATTERN = re.compile(r"^[a-z][a-z0-9_]*$")
PluginMode = Literal["agent", "controller"]


class PluginFrontendPage(BaseModel):
    route: str
    template: str
    controller: str | None = None
    title: str

    @field_validator("route")
    @classmethod
    def validate_route(cls, value: str) -> str:
        if not value.startswith("/ui/plugins/"):
            raise ValueError("Plugin page routes must start with /ui/plugins/")
        if ".." in value.split("/"):
            raise ValueError("Plugin page routes must not contain traversal segments")
        return value

    @field_validator("template", "controller")
    @classmethod
    def validate_asset_path(cls, value: str | None) -> str | None:
        if value is None:
            return None
        if ".." in Path(value).parts:
            raise ValueError("Plugin page asset paths must be relative to frontend.static_dir")
        if value.startswith("/") and not value.startswith("/plugin-assets/"):
            raise ValueError("Plugin page asset paths must be relative to frontend.static_dir")
        return value


class PluginFrontend(BaseModel):
    static_dir: str | None = None
    style_entries: list[str] = Field(default_factory=list)
    pages: list[PluginFrontendPage] = Field(default_factory=list)

    @model_validator(mode="before")
    @classmethod
    def reject_legacy_fields(cls, value: Any) -> Any:
        if not isinstance(value, dict):
            return value
        for field in ("entry", "style"):
            if field in value:
                raise ValueError(f"frontend.{field} is no longer supported; use frontend.pages and style_entries")
        return value


class PluginClientAuth(BaseModel):
    method: str
    endpoint: str
    endpoint_key: str

    @field_validator("method")
    @classmethod
    def validate_method(cls, value: str) -> str:
        if not PLUGIN_ID_PATTERN.fullmatch(value):
            raise ValueError(f"Invalid plugin client auth method {value!r}")
        return value

    @field_validator("endpoint")
    @classmethod
    def validate_endpoint(cls, value: str) -> str:
        if not value.startswith("/lm-api/v1/plugins/"):
            raise ValueError("Plugin client auth endpoints must stay under /lm-api/v1/plugins/")
        if ".." in value.split("/"):
            raise ValueError("Plugin client auth endpoints must not contain traversal segments")
        return value

    @field_validator("endpoint_key")
    @classmethod
    def validate_endpoint_key(cls, value: str) -> str:
        if not re.fullmatch(r"^[a-z][A-Za-z0-9]*$", value):
            raise ValueError(f"Invalid plugin client auth endpoint key {value!r}")
        return value


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
    client_auth: PluginClientAuth | None = None
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
