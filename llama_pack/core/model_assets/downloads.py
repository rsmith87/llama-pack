from __future__ import annotations

import re
import signal
import shlex
import subprocess
import time
from importlib import import_module
from pathlib import Path
from typing import Any, Callable, IO

from llama_pack.core.config import AppConfig
from llama_pack.core.persistence.model_download_store_orm import ModelDownloadStoreOrm
from llama_pack.core.model_assets.recommendations import _quant_from_path as recommendation_quant_from_path
from llama_pack.core.model_assets.recommendations import recommend_downloads


PopenFactory = Callable[..., subprocess.Popen]
REPO_PATTERN = re.compile(r"^[A-Za-z0-9._-]+/[A-Za-z0-9._-]+$")
HF_AUTH_REQUIRED_MESSAGE = (
    "This repo requires a Hugging Face login or accepted license before download. "
    "Sign in with `hf auth login` and accept the repo terms on Hugging Face, then try again."
)


class DownloadManager:
    def __init__(
        self,
        config: AppConfig,
        store: ModelDownloadStoreOrm,
        popen: PopenFactory = subprocess.Popen,
        hf_api: Any | None = None,
    ):
        self.config = config
        self.store = store
        self._popen = popen
        self._hf_api = hf_api
        self._processes: dict[str, subprocess.Popen] = {}
        self._log_handles: dict[str, IO[bytes]] = {}
        self._recommendations_cache: tuple[float, dict[str, object]] | None = None
        self._log_dir.mkdir(parents=True, exist_ok=True)

    def list_models(self) -> list[dict[str, object]]:
        recent = self.store.list_downloads(limit=50)
        candidates = {}
        for item in recent:
            repo_id = str(item.get("repo_id") or "").strip()
            if repo_id and repo_id not in candidates:
                candidates[repo_id] = {
                    "repo_id": repo_id,
                    "local_path": item.get("local_path"),
                    "last_download_id": item.get("id"),
                    "last_status": item.get("status"),
                    "updated_at": item.get("updated_at"),
                }
        return sorted(candidates.values(), key=lambda x: str(x["repo_id"]).lower())

    def recommendations(self, system: dict[str, Any] | None) -> dict[str, object]:
        cache_ttl_seconds = 3600
        now = time.monotonic()
        if self._recommendations_cache is not None:
            cached_at, payload = self._recommendations_cache
            if now - cached_at < cache_ttl_seconds:
                return payload
        try:
            hf_api = self._get_hf_api()
        except ValueError:
            hf_api = None
        payload = recommend_downloads(system, hf_api=hf_api)
        self._recommendations_cache = (now, payload)
        return payload

    def list_remote_quants(self, repo_id: str, *, revision: str | None = None) -> list[dict[str, object]]:
        repo_id = self._normalize_repo_id(repo_id)
        files = self._list_repo_tree(repo_id, revision=revision)
        quants = []
        mmprojs = []
        for item in files:
            path = str(getattr(item, "path", ""))
            if not path.lower().endswith(".gguf"):
                continue
            entry = {
                "filename": Path(path).name,
                "path": path,
                "size_bytes": getattr(item, "size", None),
                "quant": self._quant_from_path(path),
            }
            if self._is_mmproj_path(path):
                mmprojs.append(entry)
            else:
                quants.append(entry)
        self._attach_mmprojs(quants, mmprojs)
        return sorted(quants, key=lambda item: str(item["path"]).lower())

    def start(
        self,
        repo_id: str,
        *,
        triggered_by: str = "unknown",
        revision: str | None = None,
        include_file: str | None = None,
        mmproj_file: str | None = None,
    ) -> dict[str, object]:
        repo_id = self._normalize_repo_id(repo_id)
        include_file = self._normalize_include_file(include_file)
        mmproj_file = self._normalize_include_file(mmproj_file)
        revision = revision.strip() if revision else None
        self._ensure_repo_access(repo_id, revision=revision)
        for download_id, process in list(self._processes.items()):
            if process.poll() is not None:
                self._close_log(download_id)
                self._processes.pop(download_id, None)
        for active_id, process in self._processes.items():
            if process.poll() is None:
                active = self.store.get_download(active_id)
                if active["repo_id"] == repo_id:
                    raise ValueError(f"Download already running for {repo_id}")

        local_path = str(self._destination_for_repo(repo_id))
        command = self._command(repo_id, revision=revision, include_files=[item for item in (include_file, mmproj_file) if item])
        log_path = self._log_dir / f"{repo_id.replace('/', '__')}.log"
        bytes_total = self._bytes_total_for_include(repo_id, revision=revision, include_file=include_file)
        record = self.store.create_download(
            repo_id=repo_id,
            revision=revision,
            local_path=local_path,
            command=" ".join(command),
            log_path=str(log_path),
            triggered_by=triggered_by,
            bytes_total=bytes_total,
        )
        download_id = str(record["id"])
        log_handle = log_path.open("ab")
        process = self._popen(command, stdout=log_handle, stderr=log_handle, cwd=None)
        self._processes[download_id] = process
        self._log_handles[download_id] = log_handle
        self.store.update_status(download_id, status="running", pid=process.pid)
        return self.status(download_id)

    def status(self, download_id: str) -> dict[str, object]:
        record = self.store.get_download(download_id)
        process = self._processes.get(download_id)
        record = self._with_progress(record)
        if process is None:
            return record
        returncode = process.poll()
        if returncode is None:
            return record
        self._close_log(download_id)
        self._processes.pop(download_id, None)
        terminal = "succeeded" if returncode == 0 else "failed"
        updated = self.store.update_status(download_id, status=terminal, returncode=returncode, error_detail=None if returncode == 0 else f"Downloader exited with code {returncode}")
        return self._with_progress(updated)

    def tail_logs(self, download_id: str, lines: int = 200) -> str:
        record = self.status(download_id)
        log_path = Path(str(record["log_path"]))
        if not log_path.exists():
            return ""
        requested = max(1, min(lines, 2000))
        with log_path.open("r", encoding="utf-8", errors="replace") as handle:
            return "".join(handle.readlines()[-requested:])

    def log_path(self, download_id: str) -> Path:
        record = self.status(download_id)
        return Path(str(record["log_path"]))

    def history(self, *, status: str | None = None, limit: int = 100) -> list[dict[str, object]]:
        records = self.store.list_downloads(status=status, limit=limit)
        return [self.status(str(item["id"])) for item in records]

    def delete(self, download_id: str) -> None:
        record = self.status(download_id)
        if record["status"] == "running":
            raise ValueError("Cannot delete a running download")
        self._close_log(download_id)
        self._processes.pop(download_id, None)
        self.store.delete_download(download_id)

    def cancel(self, download_id: str) -> dict[str, object]:
        record = self.status(download_id)
        if record["status"] != "running":
            raise ValueError("Only running downloads can be cancelled")
        process = self._processes.get(download_id)
        if process is None:
            raise ValueError("Download is no longer running")
        self._terminate_process(process)
        self._close_log(download_id)
        self._processes.pop(download_id, None)
        return self.store.update_status(
            download_id,
            status="cancelled",
            returncode=self._cancel_returncode(process),
            error_detail="Download cancelled by user",
        )

    def _destination_for_repo(self, repo_id: str) -> Path:
        root = self.config.model_roots[0]
        return root / repo_id.replace("/", "__")

    def _bytes_total_for_include(self, repo_id: str, *, revision: str | None, include_file: str | None) -> int | None:
        if not include_file:
            return None
        for item in self._list_repo_tree(repo_id, revision=revision):
            if str(getattr(item, "path", "")) == include_file:
                size = getattr(item, "size", None)
                return size if isinstance(size, int) and size >= 0 else None
        return None

    def _with_progress(self, record: dict[str, object]) -> dict[str, object]:
        bytes_downloaded = self._downloaded_size(self._progress_path(record))
        bytes_total = record.get("bytes_total")
        enriched = {**record, "bytes_downloaded": bytes_downloaded}
        if isinstance(bytes_total, int) and bytes_total > 0:
            enriched["progress_percent"] = min(100, int(bytes_downloaded * 100 / bytes_total))
        else:
            enriched["progress_percent"] = None
        return enriched

    def _progress_path(self, record: dict[str, object]) -> Path:
        local_path = Path(str(record["local_path"]))
        include_files = self._included_files_from_command(str(record.get("command") or ""))
        if include_files:
            return local_path / include_files[0]
        return local_path

    def _included_files_from_command(self, command: str) -> list[str]:
        try:
            parts = shlex.split(command)
        except ValueError:
            return []
        includes = []
        index = 0
        while index < len(parts):
            if parts[index] == "--include" and index + 1 < len(parts):
                try:
                    include_file = self._normalize_include_file(parts[index + 1])
                except ValueError:
                    include_file = None
                if include_file is not None:
                    includes.append(include_file)
                index += 2
                continue
            index += 1
        return includes

    def _downloaded_size(self, path: Path) -> int:
        if not path.exists():
            return 0
        if path.is_file():
            return path.stat().st_size
        total = 0
        for item in path.rglob("*"):
            if item.is_file():
                total += item.stat().st_size
        return total

    def _command(self, repo_id: str, *, revision: str | None, include_files: list[str] | None = None) -> list[str]:
        target = str(self._destination_for_repo(repo_id))
        cmd = [self.config.python_bin, "-m", "huggingface_hub.cli.hf", "download", repo_id, "--local-dir", target]
        if revision:
            cmd.extend(["--revision", revision])
        for include_file in include_files or []:
            cmd.extend(["--include", include_file])
        return cmd

    def _normalize_repo_id(self, repo_id: str) -> str:
        repo_id = repo_id.strip()
        if not REPO_PATTERN.match(repo_id):
            raise ValueError("repo_id must be in owner/name format")
        return repo_id

    def _normalize_include_file(self, include_file: str | None) -> str | None:
        if not include_file:
            return None
        normalized = include_file.strip()
        if (
            not normalized
            or normalized.startswith("/")
            or "\\" in normalized
            or ".." in Path(normalized).parts
            or not normalized.lower().endswith(".gguf")
        ):
            raise ValueError("include_file must be a relative .gguf path")
        return normalized

    def _quant_from_path(self, path: str) -> str | None:
        return recommendation_quant_from_path(path)

    def _is_mmproj_path(self, path: str) -> bool:
        return "mmproj" in Path(path).name.lower()

    def _attach_mmprojs(self, quants: list[dict[str, object]], mmprojs: list[dict[str, object]]) -> None:
        if not mmprojs:
            return
        by_quant = {str(item.get("quant") or "").upper(): item for item in mmprojs}
        fallback = sorted(mmprojs, key=lambda item: int(item.get("size_bytes") or 0), reverse=True)[0]
        for item in quants:
            quant = str(item.get("quant") or "").upper()
            mmproj = by_quant.get(quant)
            if mmproj is None and quant == "BF16":
                mmproj = by_quant.get("F16")
            item["mmproj"] = mmproj or fallback

    def _get_hf_api(self) -> Any:
        if self._hf_api is None:
            try:
                self._hf_api = import_module("huggingface_hub").HfApi()
            except ImportError as exc:
                raise ValueError("huggingface_hub is not installed in this Python environment") from exc
        return self._hf_api

    @property
    def _log_dir(self) -> Path:
        return self.config.log_dir / "downloads"

    def _close_log(self, download_id: str) -> None:
        handle = self._log_handles.pop(download_id, None)
        if handle is not None and not handle.closed:
            handle.close()

    def _terminate_process(self, process: subprocess.Popen) -> None:
        process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait(timeout=5)

    def _cancel_returncode(self, process: subprocess.Popen) -> int:
        returncode = process.poll()
        if isinstance(returncode, int):
            return returncode
        pid = getattr(process, "pid", 0) or 0
        return -signal.SIGTERM if pid else -1

    def _ensure_repo_access(self, repo_id: str, *, revision: str | None = None) -> None:
        self._list_repo_tree(repo_id, revision=revision)

    def _list_repo_tree(self, repo_id: str, *, revision: str | None = None) -> list[Any]:
        try:
            return self._get_hf_api().list_repo_tree(
                repo_id,
                recursive=True,
                expand=True,
                revision=revision or None,
                repo_type="model",
            )
        except Exception as exc:
            if self._is_hf_auth_or_gated_error(exc):
                raise ValueError(HF_AUTH_REQUIRED_MESSAGE) from exc
            raise

    def _is_hf_auth_or_gated_error(self, exc: Exception) -> bool:
        response = getattr(exc, "response", None)
        status_code = getattr(response, "status_code", None)
        if status_code in {401, 403}:
            return True
        message = str(exc).lower()
        return "gated" in message or "accept" in message and "license" in message
