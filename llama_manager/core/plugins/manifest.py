from __future__ import annotations

import re
from pathlib import Path
from typing import Any

import yaml
from pydantic import BaseModel, Field, field_validator

PLUGIN_ID_PATTERN = re.compile(r"^[a-z][a-z0-9_]*$")


class PluginFrontend(BaseModel):
    entry: str | None = None
    style: str | None = None
    static_dir: str | None = None


class PluginManifest(BaseModel):
    id: str
    name: str
    version: str
    requires_core: str = "1.0"
    backend_api_version: str = "1.0"
    frontend_api_version: str = "1.0"
    entrypoint: str
    description: str | None = None
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


def load_manifest(path: Path) -> PluginManifest:
    manifest_path = path / "plugin.yaml"
    with manifest_path.open("r", encoding="utf-8") as handle:
        raw = yaml.safe_load(handle) or {}
    if not isinstance(raw, dict):
        raise ValueError(f"Plugin manifest must be a YAML mapping: {manifest_path}")
    return PluginManifest.model_validate(raw)
