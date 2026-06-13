from __future__ import annotations

import os
from pathlib import Path
from typing import Any

import yaml

from llama_pack.core.config.models import AppConfig

# ---------------------------------------------------------------------------
# File-key constants
# ---------------------------------------------------------------------------

KNOWN_FILE_KEYS: frozenset[str] = frozenset(
    {"runtime", "models", "agent_tools", "auth", "persistence", "routing", "nodes", "memory"}
)

# Direct keys: the linked file's content IS the value of the named AppConfig field.
DIRECT_FILE_KEYS: frozenset[str] = frozenset({"models", "nodes", "agent_tools", "memory"})

# Grouped keys: the linked file contains multiple top-level AppConfig fields.
GROUPED_FILE_FIELDS: dict[str, frozenset[str]] = {
    "runtime": frozenset(
        {
            "llama_server_bin",
            "llama_cpp_dir",
            "python_bin",
            "hf_models_dir",
            "hf_models_dirs",
            "log_dir",
            "controller_url",
            "node_name",
            "agent_url",
            "heartbeat_interval_seconds",
            "node_heartbeat_timeout_seconds",
        }
    ),
    "auth": frozenset(
        {
            "agent_api_key",
            "test_chat_api_key",
            "controller_registration_key",
            "controller_registration_key_outbound",
        }
    ),
    "persistence": frozenset(
        {
            "auth_db_url",
            "audit_db_url",
            "chat_sessions_db_url",
            "controller_db_url",
            "downloads_db_url",
            "benchmarks_db_url",
            "models_db_url",
            "controller_retention_days",
            "controller_archive_retention_days",
            "controller_archive_dir",
            "controller_instance_id",
            "controller_leader_lease_seconds",
        }
    ),
    "routing": frozenset(
        {
            "routing_fanout_enabled",
            "routing_fanout_max",
            "routing_plugin_path",
            "agent_worker_enabled",
            "agent_worker_poll_interval_seconds",
            "agent_worker_max_jobs",
            "agent_worker_labels",
            "agent_worker_capacity",
        }
    ),
}

EXAMPLE_SECRET_PLACEHOLDERS: dict[str, str] = {
    "agent_api_key": "${LLAMA_PACK_AGENT_API_KEY}",
    "test_chat_api_key": "${LLAMA_PACK_TEST_CHAT_API_KEY}",
    "controller_registration_key": "${LLAMA_PACK_CONTROLLER_REGISTRATION_KEY}",
    "controller_registration_key_outbound": "${LLAMA_PACK_CONTROLLER_REGISTRATION_KEY_OUTBOUND}",
}

# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _expand_env_vars(value: Any) -> Any:
    if isinstance(value, str):
        return os.path.expandvars(value)
    if isinstance(value, list):
        return [_expand_env_vars(item) for item in value]
    if isinstance(value, dict):
        return {key: _expand_env_vars(item) for key, item in value.items()}
    return value


def _load_yaml_mapping(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        loaded = yaml.safe_load(handle) or {}
    if not isinstance(loaded, dict):
        raise ValueError(f"Config file must contain a YAML mapping: {path}")
    return loaded


def _resolve_config_files(root_path: Path, root_data: dict[str, Any]) -> dict[str, Path]:
    """Parse the optional 'files' mapping and return {key: resolved_path}."""
    files_raw = root_data.get("files")
    if files_raw is None:
        return {}
    if not isinstance(files_raw, dict):
        raise ValueError("'files' in config must be a mapping of key to path")
    base_dir = root_path.parent
    result: dict[str, Path] = {}
    for key, rel_path in files_raw.items():
        if key not in KNOWN_FILE_KEYS:
            known = ", ".join(sorted(KNOWN_FILE_KEYS))
            raise ValueError(
                f"Unknown file key {key!r} in config 'files'. Known keys: {known}"
            )
        resolved = (base_dir / rel_path).resolve()
        if not resolved.exists():
            raise FileNotFoundError(
                f"Linked config file not found: {resolved} (files.{key} = {rel_path!r})"
            )
        result[key] = resolved
    return result


def _load_linked_file(key: str, path: Path) -> dict[str, Any]:
    """Load a linked config file and return its contribution to the merged data dict."""
    data = _load_yaml_mapping(path)
    if key in DIRECT_FILE_KEYS:
        # File content is the value of the named field.
        return {key: data}
    # Grouped file: all keys must belong to this group.
    allowed = GROUPED_FILE_FIELDS.get(key, frozenset())
    for field in data:
        if field not in allowed:
            raise ValueError(
                f"Field {field!r} in config file for key {key!r} does not belong to "
                f"the '{key}' group. Allowed fields: {sorted(allowed)}"
            )
    return data


def _merge_linked_configs(
    root_path: Path,
    root_data: dict[str, Any],
    file_links: dict[str, Path],
) -> tuple[dict[str, Any], dict[str, Path]]:
    """Merge linked-file data with root inline values.

    Returns (merged_data, section_sources).
    Root inline values override linked values; the 'files' key is excluded.
    """
    merged: dict[str, Any] = {}
    section_sources: dict[str, Path] = {}

    for key, path in file_links.items():
        contribution = _load_linked_file(key, path)
        merged.update(contribution)
        if key in DIRECT_FILE_KEYS:
            section_sources[key] = path
        else:
            for field in contribution:
                section_sources[field] = path

    # Root inline values win; track root ownership for fields not in any linked file.
    for k, v in root_data.items():
        if k != "files":
            merged[k] = v
            if k not in section_sources:
                section_sources[k] = root_path

    return merged, section_sources


def _is_example_config_path(path: Path) -> bool:
    return ".example." in path.name or path.name.endswith(".example.yaml")


def _sanitize_example_config_data(path: Path, data: dict[str, Any]) -> dict[str, Any]:
    if not _is_example_config_path(path):
        return data

    sanitized = dict(data)
    for field, placeholder in EXAMPLE_SECRET_PLACEHOLDERS.items():
        if field in sanitized:
            sanitized[field] = placeholder
    return sanitized


def _dump_split_config(config: AppConfig) -> None:
    """Write each linked section to its file and the root manifest to config_source."""
    root_config_path = Path(config.config_source)
    full_data = config.model_dump(mode="json")
    full_data.pop("config_source", None)

    linked_fields: set[str] = set()

    for file_key, file_path in config._file_links.items():
        if not file_path.exists():
            raise FileNotFoundError(
                f"Linked config file has been deleted since load: {file_path}. Cannot save."
            )
        if file_key in DIRECT_FILE_KEYS:
            linked_fields.add(file_key)
            file_content = full_data.get(file_key, {})
        else:
            owned = GROUPED_FILE_FIELDS.get(file_key, frozenset())
            linked_fields.update(owned)
            file_content = {field: full_data[field] for field in owned if field in full_data}
            file_content = _sanitize_example_config_data(file_path, file_content)

        with file_path.open("w", encoding="utf-8") as handle:
            yaml.safe_dump(file_content, handle, sort_keys=False)

    # Root manifest: only root-owned fields plus the files mapping.
    root_data: dict[str, Any] = {k: v for k, v in full_data.items() if k not in linked_fields}
    files_mapping: dict[str, str] = {}
    for file_key, file_path in config._file_links.items():
        rel = file_path.relative_to(root_config_path.parent)
        files_mapping[file_key] = str(rel)
    root_data["files"] = files_mapping

    root_config_path.parent.mkdir(parents=True, exist_ok=True)
    with root_config_path.open("w", encoding="utf-8") as handle:
        yaml.safe_dump(root_data, handle, sort_keys=False)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def load_config(source: str | Path | dict[str, Any] | None = None) -> AppConfig:
    if source is None:
        source = os.getenv("LLAMA_PACK_CONFIG")
        if source is None:
            local_config = Path("config.yaml")
            if local_config.exists():
                source = local_config
            else:
                local_example = Path("config.example.yaml")
                if local_example.exists():
                    source = local_example

    data: dict[str, Any]
    config_source = "(defaults)"
    section_sources: dict[str, Path] = {}
    file_links: dict[str, Path] = {}

    if source is None:
        data = {}
    elif isinstance(source, dict):
        data = source
        config_source = "(in-memory)"
    else:
        config_path = Path(source)
        root_data = _load_yaml_mapping(config_path)
        resolved_file_links = _resolve_config_files(config_path, root_data)
        if resolved_file_links:
            data, section_sources = _merge_linked_configs(
                config_path, root_data, resolved_file_links
            )
            file_links = resolved_file_links
        else:
            data = {k: v for k, v in root_data.items() if k != "files"}
        config_source = str(config_path.resolve())

    mode_override = os.getenv("LLAMA_PACK_MODE")
    if mode_override:
        data = {**data, "mode": mode_override}
    test_chat_key = os.getenv("LLAMA_PACK_TEST_CHAT_API_KEY")
    if test_chat_key:
        data = {**data, "test_chat_api_key": test_chat_key}

    data = _expand_env_vars(data)

    config = AppConfig.model_validate({**data, "config_source": config_source})
    config._section_sources = section_sources
    config._file_links = file_links
    return config


def save_config(config: AppConfig) -> None:
    if config.config_source in {"(defaults)", "(in-memory)"}:
        raise ValueError("Cannot persist config without a file-backed config_source")

    if config._file_links:
        _dump_split_config(config)
        return

    config_path = Path(config.config_source)
    config_path.parent.mkdir(parents=True, exist_ok=True)
    data = config.model_dump(mode="json")
    data.pop("config_source", None)
    data = _sanitize_example_config_data(config_path, data)
    with config_path.open("w", encoding="utf-8") as handle:
        yaml.safe_dump(data, handle, sort_keys=False)
