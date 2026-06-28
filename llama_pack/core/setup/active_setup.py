from __future__ import annotations

import os
import shlex
from argparse import Namespace
from datetime import UTC, datetime
from pathlib import Path
from typing import Literal

import yaml
from alembic import command
from alembic.config import Config
from pydantic import BaseModel, Field, model_validator

from llama_pack.core.persistence.alembic_config import DB_TARGETS, head_revision_for, version_locations


SetupMode = Literal["controller", "agent", "standalone"]
_ALLOWED_CONFIG_FILENAMES = {"agent.config.yaml", "config.yaml"}
_ALLOWED_ENV_FILENAMES = {".llama_pack.env"}


class _IndentedSafeDumper(yaml.SafeDumper):
    def increase_indent(self, flow: bool = False, indentless: bool = False) -> object:
        return super().increase_indent(flow, False)


def _setup_root() -> Path:
    return Path.cwd().resolve()


def _normalize_setup_path(path_value: str, allowed_names: set[str], field_name: str) -> Path:
    root = _setup_root()
    requested = Path(path_value)
    candidate = requested if requested.is_absolute() else root / requested
    resolved = candidate.resolve(strict=False)
    try:
        relative_path = resolved.relative_to(root)
    except ValueError as exc:
        raise ValueError(f"{field_name} must stay under setup root {root}: {path_value}") from exc
    if len(relative_path.parts) != 1 or relative_path.name not in allowed_names:
        allowed = ", ".join(sorted(allowed_names))
        raise ValueError(f"{field_name} must be one of: {allowed}")
    return resolved


class ControllerSetupInputs(BaseModel):
    log_dir: str = "./logs"
    controller_registration_key: str = Field(min_length=1)
    node_heartbeat_timeout_seconds: int = Field(default=90, ge=1)
    controller_instance_id: str = "local-controller"


class AgentSetupInputs(BaseModel):
    controller_url: str = ""
    node_name: str = ""
    agent_url: str = ""
    agent_api_key: str = ""
    controller_registration_key_outbound: str = ""
    llama_server_bin: str = "./llama.cpp/build/bin/llama-server"
    llama_cpp_dir: str = "./llama.cpp"
    python_bin: str = "python3"
    hf_models_dir: str = "./models/HFModels"
    log_dir: str = "./logs"


class SetupInputs(BaseModel):
    controller: ControllerSetupInputs | None = None
    agent: AgentSetupInputs | None = None


class ActiveSetupRequest(BaseModel):
    mode: SetupMode
    config_path: str = "config.yaml"
    env_path: str = ".llama_pack.env"
    overwrite_existing: bool = False
    inputs: SetupInputs

    @model_validator(mode="after")
    def validate_setup_paths(self) -> "ActiveSetupRequest":
        _setup_config_path(self)
        _setup_env_path(self)
        return self


class MigrationStepResult(BaseModel):
    target: str
    revision: str
    ok: bool
    error: str


SetupActionKind = Literal[
    "files_written",
    "backups_created",
    "migrations_run",
    "admin_bootstrap",
    "next_command",
]
SetupActionStatus = Literal["completed", "failed", "skipped"]


class SetupActionResult(BaseModel):
    kind: SetupActionKind
    status: SetupActionStatus
    detail: str
    command: str = ""


class ActiveSetupResult(BaseModel):
    ok: bool
    status: Literal["ready", "blocked_existing_files", "applied", "failed"]
    existing_files: list[str] = Field(default_factory=list)
    planned_files: list[str] = Field(default_factory=list)
    backup_files: list[str] = Field(default_factory=list)
    migrations: list[MigrationStepResult] = Field(default_factory=list)
    actions: list[SetupActionResult] = Field(default_factory=list)
    message: str


def _planned_paths(request: ActiveSetupRequest) -> list[Path]:
    return [_setup_config_path(request), _setup_env_path(request)]


def _setup_config_path(request: ActiveSetupRequest) -> Path:
    return _normalize_setup_path(request.config_path, _ALLOWED_CONFIG_FILENAMES, "config_path")


def _setup_env_path(request: ActiveSetupRequest) -> Path:
    return _normalize_setup_path(request.env_path, _ALLOWED_ENV_FILENAMES, "env_path")


def _existing_paths(request: ActiveSetupRequest) -> list[Path]:
    return [path for path in _planned_paths(request) if path.exists()]


def _quote_env(value: str) -> str:
    return shlex.quote(value)


def _dump_setup_yaml(data: dict[str, object]) -> str:
    return yaml.dump(data, Dumper=_IndentedSafeDumper, sort_keys=False)


def _controller_config(inputs: ControllerSetupInputs) -> str:
    return _dump_setup_yaml(
        {
            "mode": "controller",
            "log_dir": inputs.log_dir,
            "controller_registration_key": "${LLAMA_PACK_CONTROLLER_REGISTRATION_KEY}",
            "node_heartbeat_timeout_seconds": inputs.node_heartbeat_timeout_seconds,
            "controller_instance_id": inputs.controller_instance_id,
            "nodes": {},
        }
    )


def _controller_env(request: ActiveSetupRequest, inputs: ControllerSetupInputs) -> str:
    return (
        f"export LLAMA_PACK_CONFIG={_quote_env(str(_setup_config_path(request)))}\n"
        f"export LLAMA_PACK_CONTROLLER_REGISTRATION_KEY={_quote_env(inputs.controller_registration_key)}\n"
    )


def _agent_config(inputs: AgentSetupInputs, *, include_controller_connection: bool) -> str:
    data: dict[str, object] = {"mode": "agent"}
    if include_controller_connection:
        data.update(
            {
                "controller_url": "${LLAMA_PACK_CONTROLLER_URL}",
                "node_name": inputs.node_name,
                "agent_url": "${LLAMA_PACK_AGENT_URL}",
                "agent_api_key": "${LLAMA_PACK_AGENT_API_KEY}",
                "controller_registration_key_outbound": "${LLAMA_PACK_CONTROLLER_REGISTRATION_KEY_OUTBOUND}",
            }
        )
    data.update(
        {
            "llama_server_bin": inputs.llama_server_bin,
            "llama_cpp_dir": inputs.llama_cpp_dir,
            "python_bin": inputs.python_bin,
            "hf_models_dirs": [inputs.hf_models_dir],
            "log_dir": inputs.log_dir,
        }
    )
    return _dump_setup_yaml(data)


def _agent_env(request: ActiveSetupRequest, inputs: AgentSetupInputs, *, include_controller_connection: bool) -> str:
    lines = [
        f"export LLAMA_PACK_CONFIG={_quote_env(str(_setup_config_path(request)))}",
    ]
    if include_controller_connection:
        lines.extend(
            [
                f"export LLAMA_PACK_CONTROLLER_URL={_quote_env(inputs.controller_url)}",
                f"export LLAMA_PACK_AGENT_URL={_quote_env(inputs.agent_url)}",
                f"export LLAMA_PACK_AGENT_API_KEY={_quote_env(inputs.agent_api_key)}",
                "export LLAMA_PACK_CONTROLLER_REGISTRATION_KEY_OUTBOUND="
                f"{_quote_env(inputs.controller_registration_key_outbound)}",
            ]
        )
    return "\n".join(lines) + "\n"


def _render_files(request: ActiveSetupRequest) -> dict[Path, str]:
    if request.mode == "controller":
        if request.inputs.controller is None:
            raise ValueError("Controller setup inputs are required")
        return {
            _setup_config_path(request): _controller_config(request.inputs.controller),
            _setup_env_path(request): _controller_env(request, request.inputs.controller),
        }
    if request.inputs.agent is None:
        raise ValueError("Agent setup inputs are required")
    include_controller_connection = request.mode == "agent"
    return {
        _setup_config_path(request): _agent_config(
            request.inputs.agent,
            include_controller_connection=include_controller_connection,
        ),
        _setup_env_path(request): _agent_env(
            request,
            request.inputs.agent,
            include_controller_connection=include_controller_connection,
        ),
    }


def preflight_active_setup(request: ActiveSetupRequest) -> ActiveSetupResult:
    planned = [str(path) for path in _planned_paths(request)]
    existing = [str(path) for path in _existing_paths(request)]
    if existing and not request.overwrite_existing:
        return ActiveSetupResult(
            ok=False,
            status="blocked_existing_files",
            existing_files=existing,
            planned_files=planned,
            message="Existing setup files require overwrite confirmation.",
        )
    return ActiveSetupResult(
        ok=True,
        status="ready",
        existing_files=existing,
        planned_files=planned,
        message="Setup can be applied.",
    )


def _backup(path: Path, stamp: str) -> Path:
    backup_path = path.with_name(f"{path.name}.{stamp}.bak")
    backup_path.write_bytes(path.read_bytes())
    return backup_path


def _write_file(path: Path, content: str, mode: int | None = None) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = path.with_name(f".{path.name}.tmp")
    tmp_path.write_text(content, encoding="utf-8")
    if mode is not None:
        tmp_path.chmod(mode)
    os.replace(tmp_path, path)


def _project_root() -> Path:
    return Path(__file__).resolve().parents[3]


def _upgrade_target(config_path: Path, target: str) -> MigrationStepResult:
    revision = head_revision_for(target)
    previous_config = os.environ.get("LLAMA_PACK_CONFIG")
    os.environ["LLAMA_PACK_CONFIG"] = str(config_path)
    try:
        alembic_cfg = Config(str(_project_root() / "alembic.ini"))
        project_root = _project_root()
        alembic_cfg.set_main_option("script_location", str(project_root / "migrations"))
        alembic_cfg.set_main_option(
            "version_locations",
            os.pathsep.join(str(path) for path in version_locations(project_root)),
        )
        alembic_cfg.cmd_opts = Namespace(x=[f"db={target}"])
        command.upgrade(alembic_cfg, revision)
        return MigrationStepResult(target=target, revision=revision, ok=True, error="")
    except Exception as exc:
        return MigrationStepResult(target=target, revision=revision, ok=False, error=str(exc))
    finally:
        if previous_config is None:
            os.environ.pop("LLAMA_PACK_CONFIG", None)
        else:
            os.environ["LLAMA_PACK_CONFIG"] = previous_config


def run_setup_migrations(config_path: Path) -> list[MigrationStepResult]:
    return [_upgrade_target(config_path, target) for target in DB_TARGETS]


def _next_command_for_mode(mode: SetupMode) -> str:
    if mode == "controller":
        return "scripts/start_controller.sh"
    return "scripts/start_agent.sh"


def _base_actions(
    request: ActiveSetupRequest,
    *,
    rendered: dict[Path, str],
    backups: list[str],
    migrations: list[MigrationStepResult],
) -> list[SetupActionResult]:
    failed_migrations = [step for step in migrations if not step.ok]
    actions = [
        SetupActionResult(
            kind="files_written",
            status="completed",
            detail=f"Wrote {len(rendered)} setup files.",
        ),
        SetupActionResult(
            kind="backups_created",
            status="completed" if backups else "skipped",
            detail=f"Created {len(backups)} backup files." if backups else "No existing files required backups.",
        ),
        SetupActionResult(
            kind="migrations_run",
            status="failed" if failed_migrations else "completed",
            detail=(
                f"{len(failed_migrations)} migration failed."
                if len(failed_migrations) == 1
                else f"{len(failed_migrations)} migrations failed."
                if failed_migrations
                else f"{len(migrations)} migrations completed."
            ),
        ),
    ]
    if not failed_migrations:
        actions.append(
            SetupActionResult(
                kind="next_command",
                status="completed",
                detail="Start the configured service.",
                command=_next_command_for_mode(request.mode),
            )
        )
    return actions


def apply_active_setup(request: ActiveSetupRequest) -> ActiveSetupResult:
    preflight = preflight_active_setup(request)
    if not preflight.ok:
        return preflight

    rendered = _render_files(request)
    stamp = datetime.now(UTC).strftime("%Y%m%d-%H%M%S")
    backups: list[str] = []
    for path in rendered:
        if path.exists():
            backups.append(str(_backup(path, stamp)))

    for path, content in rendered.items():
        _write_file(path, content, 0o600 if path.name.endswith(".env") else None)

    migrations = run_setup_migrations(_setup_config_path(request))
    actions = _base_actions(request, rendered=rendered, backups=backups, migrations=migrations)
    failed_migrations = [step for step in migrations if not step.ok]
    if failed_migrations:
        failed_targets = ", ".join(step.target for step in failed_migrations)
        return ActiveSetupResult(
            ok=False,
            status="failed",
            existing_files=preflight.existing_files,
            planned_files=[str(path) for path in rendered],
            backup_files=backups,
            migrations=migrations,
            actions=actions,
            message=f"Setup files written, but migrations failed for: {failed_targets}.",
        )

    return ActiveSetupResult(
        ok=True,
        status="applied",
        existing_files=preflight.existing_files,
        planned_files=[str(path) for path in rendered],
        backup_files=backups,
        migrations=migrations,
        actions=actions,
        message="Setup files written and migrations completed.",
    )
