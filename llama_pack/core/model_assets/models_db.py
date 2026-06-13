from __future__ import annotations

import shlex
from pathlib import Path
from typing import Any

from llama_pack.core.config import AppConfig
from llama_pack.core.persistence.model_asset_store_orm import ModelAssetStoreOrm


class ModelAssetInventoryService:
    def __init__(self, config: AppConfig, store: ModelAssetStoreOrm, download_store: Any | None = None):
        self.config = config
        self.store = store
        self.download_store = download_store

    def reconcile_scan(self, paths: list[Path]) -> list[dict[str, object]]:
        assets: list[dict[str, object]] = []
        seen_paths: set[str] = set()
        downloads = self._download_records()

        for path in paths:
            resolved = path.resolve()
            seen_paths.add(str(resolved))
            stat = resolved.stat()
            provenance = self._match_download_provenance(resolved, downloads)
            assets.append(
                self.store.upsert_asset(
                    canonical_path=str(resolved),
                    filename=resolved.name,
                    display_name=resolved.stem,
                    size_bytes=stat.st_size,
                    asset_kind="gguf",
                    source_type="scanned",
                    download_id=provenance.get("download_id"),
                    source_repo_id=provenance.get("source_repo_id"),
                    source_revision=provenance.get("source_revision"),
                    source_filename=provenance.get("source_filename"),
                )
            )

        missing_asset_ids = {
            asset["asset_id"]
            for asset in self.store.list_assets()
            if asset["canonical_path"] not in seen_paths
        }
        self.store.mark_missing_assets(missing_asset_ids=missing_asset_ids)
        return assets

    def _download_records(self) -> list[dict[str, object]]:
        if self.download_store is None:
            return []
        return self.download_store.list_downloads(limit=500)

    def _match_download_provenance(
        self,
        path: Path,
        downloads: list[dict[str, object]],
    ) -> dict[str, str | None]:
        for item in downloads:
            local_path = item.get("local_path")
            if not isinstance(local_path, str) or not local_path:
                continue
            root = Path(local_path).resolve()
            try:
                relative = path.relative_to(root)
            except ValueError:
                continue
            include_files = self._included_files_from_command(str(item.get("command") or ""))
            relative_str = relative.as_posix()
            if include_files and relative_str not in include_files:
                continue
            return {
                "download_id": str(item.get("id") or ""),
                "source_repo_id": str(item.get("repo_id") or "") or None,
                "source_revision": str(item.get("revision") or "") or None,
                "source_filename": relative_str if include_files else (include_files[0] if include_files else relative_str),
            }
        return {
            "download_id": None,
            "source_repo_id": None,
            "source_revision": None,
            "source_filename": None,
        }

    def _included_files_from_command(self, command: str) -> list[str]:
        try:
            parts = shlex.split(command)
        except ValueError:
            return []
        includes: list[str] = []
        index = 0
        while index < len(parts):
            if parts[index] == "--include" and index + 1 < len(parts):
                includes.append(parts[index + 1])
                index += 2
                continue
            index += 1
        return includes
