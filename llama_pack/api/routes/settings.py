from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from llama_pack.api.dependencies import get_config
from llama_pack.core.config import AppConfig
from llama_pack.core.model_assets.downloads import DOWNLOAD_DISK_HEADROOM_BYTES
from llama_pack.core.nodes.registry import NodeRegistry
from llama_pack.api.dependencies import get_node_registry

router = APIRouter(prefix="/settings", tags=["settings"])
SCRIPTS_DIR = Path(__file__).resolve().parents[3] / "scripts"
GEN_SCRIPT = SCRIPTS_DIR / "generate_api_key.py"


class KeyGenerateRequest(BaseModel):
    token_bytes: int = Field(default=32, ge=16, le=128)
    prefix: str = Field(default="llm", max_length=32)
    count: int = Field(default=1, ge=1, le=20)


class DiskInfo(BaseModel):
    node_name: str
    path: str
    reachable: bool
    total_bytes: int
    free_bytes: int
    used_bytes: int
    consumed_bytes: int
    available_percent: float
    used_percent: float
    status: str
    warning: str | None = None
    error: str | None = None
    headroom_bytes: int
    required_free_bytes: int


class NodeAuthInfo(BaseModel):
    node_name: str
    effective_url: str
    effective_api_key_source: str
    effective_api_key_present: bool
    configured_api_key_present: bool
    override_api_key_present: bool
    override_present: bool
    verify_tls: bool


@router.post("/api-keys/generate")
def generate_api_keys(payload: KeyGenerateRequest) -> dict[str, object]:
    if not GEN_SCRIPT.exists():
        raise HTTPException(status_code=500, detail="Key generator script not found")

    cmd = [
        sys.executable,
        str(GEN_SCRIPT),
        "--bytes",
        str(payload.token_bytes),
        "--prefix",
        payload.prefix,
        "--count",
        str(payload.count),
    ]
    try:
        result = subprocess.run(cmd, check=True, capture_output=True, text=True, timeout=8)
    except subprocess.CalledProcessError as error:
        raise HTTPException(status_code=500, detail=error.stderr.strip() or "Key generation failed") from error
    except subprocess.TimeoutExpired as error:
        raise HTTPException(status_code=504, detail="Key generation timed out") from error

    keys = [line.strip() for line in result.stdout.splitlines() if line.strip()]
    return {"keys": keys, "count": len(keys), "prefix": payload.prefix, "token_bytes": payload.token_bytes}


@router.get("/disks", response_model=list[DiskInfo])
async def list_model_disks(
    request: Request,
    config: AppConfig = Depends(get_config),
    registry: NodeRegistry = Depends(get_node_registry),
) -> list[DiskInfo]:
    disk_usage = getattr(request.app.state, "settings_disk_usage", shutil.disk_usage)
    disks: list[DiskInfo] = _local_disk_rows(config, disk_usage)
    if config.mode == "controller":
        for node in registry.list_nodes():
            node_name = str(node.get("name") or "").strip()
            if not node_name:
                continue
            try:
                payload = await registry.request_node(node_name, "GET", "/lm-api/v1/settings/disks")
                if isinstance(payload, list):
                    disks.extend(_remote_disk_rows(node_name, payload))
            except Exception as exc:
                disks.append(_error_disk_row(node_name, str(exc)))
    return disks


@router.get("/node-auth", response_model=list[NodeAuthInfo])
def list_node_auth(registry: NodeRegistry = Depends(get_node_registry)) -> list[NodeAuthInfo]:
    return [NodeAuthInfo(**item) for item in registry.node_auth_diagnostics()]


def _local_disk_rows(config: AppConfig, disk_usage) -> list[DiskInfo]:
    return [_disk_info("local", root, disk_usage) for root in config.model_roots]


def _disk_info(node_name: str, root: Path, disk_usage) -> DiskInfo:
    total_bytes, used_bytes, free_bytes = disk_usage(_existing_probe_path(root))
    consumed_bytes = _consumed_bytes(root)
    available_percent = round((free_bytes / total_bytes) * 100, 1) if total_bytes > 0 else 0.0
    used_percent = round((used_bytes / total_bytes) * 100, 1) if total_bytes > 0 else 0.0
    required_free_bytes = DOWNLOAD_DISK_HEADROOM_BYTES
    warning = "Low space: less than 10 GB free headroom for model downloads." if free_bytes < required_free_bytes else None
    return DiskInfo(
        node_name=node_name,
        path=str(root),
        reachable=True,
        total_bytes=total_bytes,
        free_bytes=free_bytes,
        used_bytes=used_bytes,
        consumed_bytes=consumed_bytes,
        available_percent=available_percent,
        used_percent=used_percent,
        status="warning" if warning else "ok",
        warning=warning,
        error=None,
        headroom_bytes=DOWNLOAD_DISK_HEADROOM_BYTES,
        required_free_bytes=required_free_bytes,
    )


def _remote_disk_rows(node_name: str, payload: list[object]) -> list[DiskInfo]:
    rows: list[DiskInfo] = []
    for item in payload:
        if not isinstance(item, dict):
            continue
        rows.append(
            DiskInfo(
                node_name=node_name,
                path=str(item.get("path") or ""),
                reachable=bool(item.get("reachable", True)),
                total_bytes=int(item.get("total_bytes") or 0),
                free_bytes=int(item.get("free_bytes") or 0),
                used_bytes=int(item.get("used_bytes") or 0),
                consumed_bytes=int(item.get("consumed_bytes") or 0),
                available_percent=float(item.get("available_percent") or 0.0),
                used_percent=float(item.get("used_percent") or 0.0),
                status=str(item.get("status") or "ok"),
                warning=str(item.get("warning")) if item.get("warning") is not None else None,
                error=str(item.get("error")) if item.get("error") is not None else None,
                headroom_bytes=int(item.get("headroom_bytes") or DOWNLOAD_DISK_HEADROOM_BYTES),
                required_free_bytes=int(item.get("required_free_bytes") or DOWNLOAD_DISK_HEADROOM_BYTES),
            )
        )
    return rows


def _error_disk_row(node_name: str, error: str) -> DiskInfo:
    return DiskInfo(
        node_name=node_name,
        path="",
        reachable=False,
        total_bytes=0,
        free_bytes=0,
        used_bytes=0,
        consumed_bytes=0,
        available_percent=0.0,
        used_percent=0.0,
        status="error",
        warning=None,
        error=error,
        headroom_bytes=DOWNLOAD_DISK_HEADROOM_BYTES,
        required_free_bytes=DOWNLOAD_DISK_HEADROOM_BYTES,
    )


def _existing_probe_path(root: Path) -> Path:
    probe = root
    while not probe.exists():
        if probe.parent == probe:
            break
        probe = probe.parent
    return probe


def _consumed_bytes(root: Path) -> int:
    if not root.exists():
        return 0
    if root.is_file():
        return root.stat().st_size
    total = 0
    for item in root.rglob("*"):
        if item.is_file():
            total += item.stat().st_size
    return total
