from __future__ import annotations

import hashlib
import re
import shutil
import subprocess
from datetime import UTC, datetime
from pathlib import Path
from typing import Callable, IO

from llama_pack.core.config import AppConfig
from llama_pack.core.model_assets.models_db import ModelAssetInventoryService


PopenFactory = Callable[..., subprocess.Popen]


QUANTIZED_GGUF_SUFFIX_RE = re.compile(
    r"(?:^|[-._])(?:Q[2-8](?:_[0-9A-Z]+)*|IQ[1-4](?:_[0-9A-Z]+)*|TQ[1-2](?:_[0-9A-Z]+)*)\.gguf$",
    re.IGNORECASE,
)


def is_quantized_gguf_filename(filename: str) -> bool:
    return QUANTIZED_GGUF_SUFFIX_RE.search(filename) is not None


def is_mmproj_gguf_filename(filename: str) -> bool:
    return "mmproj" in filename.lower() and filename.lower().endswith(".gguf")


class QuantizationManager:
    supported_types = ["Q4_K_M", "Q5_K_M", "Q8_0", "Q6_K", "Q3_K_M", "Q2_K"]

    def __init__(
        self,
        config: AppConfig,
        inventory_service: ModelAssetInventoryService | None = None,
        popen: PopenFactory = subprocess.Popen,
    ):
        self.config = config
        self.inventory_service = inventory_service
        self._popen = popen
        self._processes: dict[str, subprocess.Popen] = {}
        self._log_handles: dict[str, IO[bytes]] = {}
        self._job_types: dict[str, str] = {}
        self._log_dir.mkdir(parents=True, exist_ok=True)

    def list_files(self) -> list[dict[str, object]]:
        return [self._status_for_path(path, "Q4_K_M") for path in self._gguf_paths()]

    def status(self, file_id: str) -> dict[str, object]:
        path = self._path_for_id(file_id)
        return self._status_for_path(path, self._job_types.get(file_id, "Q4_K_M"))

    def start(self, file_id: str, quant_type: str) -> dict[str, object]:
        path = self._path_for_id(file_id)
        normalized_type = self._normalize_type(quant_type)
        self._job_types[file_id] = normalized_type
        current = self._status_for_path(path, normalized_type)
        if current["running"]:
            return current
        if current["quantize_bin"] is None:
            raise ValueError("llama-quantize binary was not found")

        log_path = self._log_path(file_id)
        log_path.parent.mkdir(parents=True, exist_ok=True)
        log_handle = log_path.open("ab")
        process = self._popen(
            [
                str(current["quantize_bin"]),
                str(path),
                str(self._output_path(path, normalized_type)),
                normalized_type,
            ],
            stdout=log_handle,
            stderr=log_handle,
            cwd=None,
        )
        self._processes[file_id] = process
        self._log_handles[file_id] = log_handle
        return self._status_for_path(path, normalized_type)

    def tail_logs(self, file_id: str, lines: int = 200) -> str:
        self.status(file_id)
        log_path = self._log_path(file_id)
        if not log_path.exists():
            return ""
        requested = max(1, min(lines, 2000))
        with log_path.open("r", encoding="utf-8", errors="replace") as handle:
            return "".join(handle.readlines()[-requested:])

    def log_path(self, file_id: str) -> Path:
        self.status(file_id)
        return self._log_path(file_id)

    def file_id(self, path: Path) -> str:
        return hashlib.sha256(str(path).encode("utf-8")).hexdigest()[:16]

    def _status_for_path(self, path: Path, quant_type: str) -> dict[str, object]:
        file_id = self.file_id(path)
        process = self._processes.get(file_id)
        returncode = process.poll() if process is not None else None
        running = process is not None and returncode is None
        if process is not None and not running:
            self._close_log(file_id)
            if returncode == 0:
                self._register_quantized_output(path, quant_type, file_id)

        size_bytes = path.stat().st_size
        return {
            "id": file_id,
            "name": path.stem,
            "filename": path.name,
            "model_dir": path.parent.name,
            "path": str(path),
            "size_bytes": size_bytes,
            "size_gb": round(size_bytes / (1024**3), 2),
            "type": quant_type,
            "supported_types": self.supported_types,
            "output_path": str(self._output_path(path, quant_type)),
            "existing_outputs": [str(item) for item in self._existing_outputs(path)],
            "quantize_bin": str(self._quantize_bin) if self._quantize_bin is not None else None,
            "running": running,
            "pid": process.pid if running else None,
            "returncode": returncode,
            "log_path": str(self._log_path(file_id)),
        }

    def _path_for_id(self, file_id: str) -> Path:
        for path in self._gguf_paths():
            if self.file_id(path) == file_id:
                return path
        raise KeyError(f"Unknown GGUF file id: {file_id}")

    def _gguf_paths(self) -> list[Path]:
        paths = []
        for root in self.config.model_roots:
            if root.exists():
                paths.extend(
                    path
                    for path in root.glob("*/*.gguf")
                    if not is_quantized_gguf_filename(path.name) and not is_mmproj_gguf_filename(path.name)
                )
        return sorted(paths, key=lambda item: str(item).lower())

    def _output_path(self, path: Path, quant_type: str) -> Path:
        return path.with_name(f"{path.stem}-{quant_type}.gguf")

    def _existing_outputs(self, path: Path) -> list[Path]:
        prefix = f"{path.stem}-"
        return sorted(
            [
                item
                for item in path.parent.glob(f"{path.stem}-*.gguf")
                if item.name.startswith(prefix) and item != path
            ],
            key=lambda item: item.name.lower(),
        )

    def _normalize_type(self, quant_type: str) -> str:
        normalized = quant_type.strip().upper()
        if normalized not in self.supported_types:
            raise ValueError(f"Unsupported quantization type: {quant_type}")
        return normalized

    @property
    def _quantize_bin(self) -> Path | None:
        candidates = [
            self.config.llama_cpp_dir / "build" / "bin" / "llama-quantize",
            self.config.llama_cpp_dir / "build" / "bin" / "Release" / "llama-quantize.exe",
            self.config.llama_cpp_dir / "build" / "bin" / "Debug" / "llama-quantize.exe",
            self.config.llama_cpp_dir / "build" / "bin" / "llama-quantize.exe",
            self.config.llama_cpp_dir / "llama-quantize",
            self.config.llama_cpp_dir / "llama-quantize.exe",
            self.config.llama_cpp_dir / "bin" / "llama-quantize",
            self.config.llama_cpp_dir / "bin" / "llama-quantize.exe",
        ]
        for candidate in candidates:
            if candidate.exists():
                return candidate
        path_cli = shutil.which("llama-quantize")
        if path_cli is not None:
            return Path(path_cli)
        return None

    @property
    def _log_dir(self) -> Path:
        return self.config.log_dir / "quantizations"

    def _log_path(self, file_id: str) -> Path:
        return self._log_dir / f"{file_id}.log"

    def _close_log(self, file_id: str) -> None:
        handle = self._log_handles.pop(file_id, None)
        if handle is not None and not handle.closed:
            handle.close()

    def _register_quantized_output(self, source_path: Path, quant_type: str, file_id: str) -> None:
        if self.inventory_service is None:
            return
        output_path = self._output_path(source_path, quant_type)
        if not output_path.exists():
            return
        store = self.inventory_service.store
        source_asset = store.get_asset_by_path(str(source_path.resolve()))
        if source_asset is None:
            reconciled = self.inventory_service.reconcile_scan([source_path])
            source_asset = reconciled[0] if reconciled else None
        if source_asset is None:
            return
        existing_output = store.get_asset_by_path(str(output_path.resolve()))
        stat = output_path.stat()
        output_asset = store.upsert_asset(
            canonical_path=str(output_path.resolve()),
            filename=output_path.name,
            display_name=output_path.stem,
            size_bytes=stat.st_size,
            asset_kind="gguf",
            source_type="quantization",
        )
        if existing_output is None and not store.list_asset_provenance(output_asset["asset_id"]):
            store.record_asset_provenance(
                output_asset_id=output_asset["asset_id"],
                source_asset_id=source_asset["asset_id"],
                source_model_id=None,
                job_kind="quantization",
                job_ref=file_id,
                detail={
                    "quant_type": quant_type,
                    "source_path": str(source_path),
                    "output_path": str(output_path),
                    "recorded_at": datetime.now(UTC).isoformat(),
                },
            )
