from __future__ import annotations

import os
import signal
import subprocess
import time
from contextlib import contextmanager
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Callable, IO, Iterator
from urllib.parse import quote

from llama_pack.core.config import AppConfig, ModelConfig
from llama_pack.core.model_assets.catalog_service import ModelCatalogService
from llama_pack.core.model_assets.library import compute_file_id
from llama_pack.providers.llama_cpp import build_llama_server_command


PopenFactory = Callable[..., subprocess.Popen]


class _AdoptedProcess:
    """Wraps an existing (pre-restart) PID so it behaves like a subprocess.Popen."""

    def __init__(self, pid: int) -> None:
        self.pid = pid

    def poll(self) -> int | None:
        try:
            os.kill(self.pid, 0)
            return None  # still running
        except ProcessLookupError:
            return -1
        except PermissionError:
            return None  # alive but owned by another user

    def terminate(self) -> None:
        try:
            os.kill(self.pid, signal.SIGTERM)
        except ProcessLookupError:
            pass

    def kill(self) -> None:
        try:
            os.kill(self.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass

    def wait(self, timeout: float | None = None) -> int:
        deadline = time.monotonic() + timeout if timeout is not None else None
        while True:
            ret = self.poll()
            if ret is not None:
                return ret
            if deadline is not None and time.monotonic() >= deadline:
                raise subprocess.TimeoutExpired(str(self.pid), timeout)
            time.sleep(0.05)


@dataclass
class ModelStatus:
    name: str
    running: bool
    pid: int | None
    port: int
    model_path: str
    log_path: str
    ctx: int
    gpu_layers: int
    family: str
    profile: str | None
    profile_label: str | None
    profile_order: int | None
    profile_kind: str | None
    kv_cache_policy: str | None
    resource_tier: str | None
    favorite: bool = False
    file_id: str | None = None
    vision: bool = False
    mmproj: str | None = None
    strengths: list[str] | None = None
    cost_tier: str | None = None
    model_catalog: dict[str, object] | None = None
    model_profiles: list[dict[str, object]] | None = None
    model_deployments: list[dict[str, object]] | None = None

    def to_dict(self) -> dict[str, object]:
        return asdict(self)


@dataclass(frozen=True)
class _ProfileMetadata:
    family: str
    profile: str | None
    profile_label: str | None
    profile_order: int | None
    profile_kind: str | None
    kv_cache_policy: str | None
    resource_tier: str | None


class ProcessManager:
    def __init__(
        self,
        config: AppConfig,
        catalog_service: ModelCatalogService,
        popen: PopenFactory = subprocess.Popen,
    ):
        self.config = config
        self.catalog_service = catalog_service
        self._popen = popen
        self._processes: dict[str, subprocess.Popen] = {}
        self._log_handles: dict[str, IO[bytes]] = {}
        self._active_requests: dict[str, int] = {}
        self.config.log_dir.mkdir(parents=True, exist_ok=True)

    def list_statuses(self) -> list[dict[str, object]]:
        return [self.status(name).to_dict() for name in self.catalog_service.list_model_identities()]

    def status(self, name: str) -> ModelStatus:
        model = self._get_model(name)
        profile_metadata = self._profile_metadata(name)
        model_catalog, model_profiles, model_deployments = self._catalog_payload(name)
        process = self._processes.get(name)
        running = process is not None and process.poll() is None
        if process is not None and not running:
            self._processes.pop(name, None)
            self._close_log(name)
            process = None
        return ModelStatus(
            name=name,
            running=running,
            pid=process.pid if running and process is not None else None,
            port=model.port,
            model_path=model.path,
            log_path=str(self._log_path(name)),
            ctx=model.ctx,
            gpu_layers=model.gpu_layers,
            family=profile_metadata.family,
            profile=profile_metadata.profile,
            profile_label=profile_metadata.profile_label,
            profile_order=profile_metadata.profile_order,
            profile_kind=profile_metadata.profile_kind,
            kv_cache_policy=profile_metadata.kv_cache_policy,
            resource_tier=profile_metadata.resource_tier,
            favorite=model.favorite,
            file_id=compute_file_id(Path(model.path)),
            vision=model.vision,
            mmproj=model.mmproj,
            strengths=list(model.strengths),
            cost_tier=model.cost_tier,
            model_catalog=model_catalog,
            model_profiles=model_profiles,
            model_deployments=model_deployments,
        )

    def set_favorite(self, name: str, favorite: bool) -> ModelStatus:
        self._get_model(name)
        self.catalog_service.set_favorite(name, favorite)
        return self.status(name)

    def start(self, name: str) -> ModelStatus:
        current = self.status(name)
        if current.running:
            return current

        model = self._get_model(name)

        # Re-use a model server that survived a manager restart rather than
        # spawning a duplicate (or crashing because the port is taken).
        existing_pid = self._find_pid_on_port(model.port)
        if existing_pid is not None:
            self._processes[name] = _AdoptedProcess(existing_pid)  # type: ignore[assignment]
            return self.status(name)

        log_path = self._log_path(name)
        log_path.parent.mkdir(parents=True, exist_ok=True)
        log_handle = log_path.open("ab")
        command = build_llama_server_command(self.config.llama_server_bin, model)
        process = self._popen(command, stdout=log_handle, stderr=log_handle, cwd=None)
        self._processes[name] = process
        self._log_handles[name] = log_handle
        return self.status(name)

    def stop(self, name: str) -> ModelStatus:
        self._get_model(name)
        process = self._processes.get(name)
        if process is not None and process.poll() is None:
            process.terminate()
            try:
                process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait(timeout=5)
        self._processes.pop(name, None)
        self._close_log(name)
        return self.status(name)

    def restart(self, name: str) -> ModelStatus:
        self.stop(name)
        return self.start(name)

    def active_count(self, name: str) -> int:
        return self._active_requests.get(name, 0)

    @contextmanager
    def track_active(self, name: str) -> Iterator[None]:
        self._active_requests[name] = self._active_requests.get(name, 0) + 1
        try:
            yield
        finally:
            next_count = self._active_requests.get(name, 0) - 1
            if next_count <= 0:
                self._active_requests.pop(name, None)
            else:
                self._active_requests[name] = next_count

    def tail_logs(self, name: str, lines: int = 200) -> str:
        self._get_model(name)
        log_path = self._log_path(name)
        if not log_path.exists():
            return ""
        requested = max(1, min(lines, 2000))
        with log_path.open("r", encoding="utf-8", errors="replace") as handle:
            return "".join(handle.readlines()[-requested:])

    def log_path(self, name: str) -> Path:
        self._get_model(name)
        return self._log_path(name)

    def _get_model(self, name: str) -> ModelConfig:
        try:
            return self.catalog_service.runtime_model(name)
        except KeyError as exc:
            raise KeyError(f"Unknown model: {name}") from exc

    def _log_path(self, name: str) -> Path:
        return self.config.log_dir / f"{self._safe_identity(name)}.log"

    def _safe_identity(self, name: str) -> str:
        if ":" not in name:
            return name
        return f"__profile__{quote(name, safe='')}"

    def _profile_metadata(self, name: str) -> _ProfileMetadata:
        if ":" not in name:
            self._get_model(name)
            return _ProfileMetadata(
                family=name,
                profile=None,
                profile_label=None,
                profile_order=None,
                profile_kind=None,
                kv_cache_policy=None,
                resource_tier=None,
            )

        family, profile_key = name.split(":", 1)
        try:
            profile = self.catalog_service.runtime_model(family).profiles[profile_key]
        except KeyError as exc:
            raise KeyError(f"Unknown model: {name}") from exc
        return _ProfileMetadata(
            family=family,
            profile=profile_key,
            profile_label=profile.label_or_default(profile_key),
            profile_order=profile.order,
            profile_kind=profile.kind,
            kv_cache_policy=profile.kv_cache_policy,
            resource_tier=profile.resource_tier,
        )

    def _catalog_payload(self, name: str) -> tuple[dict[str, object], list[dict[str, object]], list[dict[str, object]]]:
        family = name.split(":", 1)[0]
        row = self.catalog_service.get_model(family)
        model_id = str(row["model_id"])
        profiles = self.catalog_service.store.list_model_profiles(model_id)
        deployments = self.catalog_service.store.list_model_deployments(model_id)
        return row, profiles, deployments

    def _close_log(self, name: str) -> None:
        handle = self._log_handles.pop(name, None)
        if handle is not None and not handle.closed:
            handle.close()

    def _find_pid_on_port(self, port: int) -> int | None:
        """Return the PID of a process listening on *port*, or None."""
        try:
            result = subprocess.run(
                ["lsof", "-ti", f":{port}"],
                capture_output=True,
                text=True,
            )
            if result.returncode == 0:
                for token in result.stdout.split():
                    if token.isdigit():
                        return int(token)
        except OSError:
            pass
        return None
