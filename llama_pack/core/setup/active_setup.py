from __future__ import annotations

import os
import shlex
from datetime import UTC, datetime
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, Field


SetupMode = Literal["controller", "agent", "standalone"]


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


class ActiveSetupResult(BaseModel):
    ok: bool
    status: Literal["ready", "blocked_existing_files", "applied", "failed"]
    existing_files: list[str] = Field(default_factory=list)
    planned_files: list[str] = Field(default_factory=list)
    backup_files: list[str] = Field(default_factory=list)
    message: str


def _planned_paths(request: ActiveSetupRequest) -> list[Path]:
    return [Path(request.config_path), Path(request.env_path)]


def _existing_paths(request: ActiveSetupRequest) -> list[Path]:
    return [path for path in _planned_paths(request) if path.exists()]


def _quote_env(value: str) -> str:
    return shlex.quote(value)


def _controller_config(inputs: ControllerSetupInputs) -> str:
    return (
        "mode: controller\n"
        f"log_dir: {inputs.log_dir}\n"
        "controller_registration_key: ${LLAMA_PACK_CONTROLLER_REGISTRATION_KEY}\n"
        f"node_heartbeat_timeout_seconds: {inputs.node_heartbeat_timeout_seconds}\n"
        f"controller_instance_id: {inputs.controller_instance_id}\n"
        "nodes: {}\n"
    )


def _controller_env(request: ActiveSetupRequest, inputs: ControllerSetupInputs) -> str:
    return (
        f"export LLAMA_PACK_CONFIG={_quote_env(str(Path(request.config_path)))}\n"
        f"export LLAMA_PACK_CONTROLLER_REGISTRATION_KEY={_quote_env(inputs.controller_registration_key)}\n"
    )


def _render_files(request: ActiveSetupRequest) -> dict[Path, str]:
    if request.mode != "controller":
        raise ValueError("Only controller active setup is implemented in this slice")
    if request.inputs.controller is None:
        raise ValueError("Controller setup inputs are required")
    return {
        Path(request.config_path): _controller_config(request.inputs.controller),
        Path(request.env_path): _controller_env(request, request.inputs.controller),
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

    return ActiveSetupResult(
        ok=True,
        status="applied",
        existing_files=preflight.existing_files,
        planned_files=[str(path) for path in rendered],
        backup_files=backups,
        message="Setup files written.",
    )
