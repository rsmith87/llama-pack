from __future__ import annotations

from pathlib import Path

from llama_pack.core.config import AppConfig
from llama_pack.core.persistence.model_asset_store_orm import ModelAssetStoreOrm


class ModelAssetInventoryService:
    def __init__(self, config: AppConfig, store: ModelAssetStoreOrm):
        self.config = config
        self.store = store

    def reconcile_scan(self, paths: list[Path]) -> list[dict[str, object]]:
        assets: list[dict[str, object]] = []
        seen_paths: set[str] = set()

        for path in paths:
            resolved = path.resolve()
            seen_paths.add(str(resolved))
            stat = resolved.stat()
            assets.append(
                self.store.upsert_asset(
                    canonical_path=str(resolved),
                    filename=resolved.name,
                    display_name=resolved.stem,
                    size_bytes=stat.st_size,
                    asset_kind="gguf",
                    source_type="scanned",
                )
            )

        missing_asset_ids = {
            asset["asset_id"]
            for asset in self.store.list_assets()
            if asset["canonical_path"] not in seen_paths
        }
        self.store.mark_missing_assets(missing_asset_ids=missing_asset_ids)
        return assets
