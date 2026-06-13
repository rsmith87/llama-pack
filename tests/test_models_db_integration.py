from __future__ import annotations

from pathlib import Path

from llama_pack.core.config import load_config
from llama_pack.core.model_assets.models_db import ModelAssetInventoryService
from llama_pack.core.persistence.model_asset_store_orm import ModelAssetStoreOrm
from tests.persistence_db_setup import prepare_models_db


def test_model_asset_inventory_service_creates_asset_rows_for_scan(tmp_path: Path):
    models_root = tmp_path / "HFModels"
    gguf_path = models_root / "Qwen" / "qwen.gguf"
    gguf_path.parent.mkdir(parents=True)
    gguf_path.write_bytes(b"hello")

    db_path = tmp_path / "models.db"
    prepare_models_db(db_path)
    store = ModelAssetStoreOrm(db_path=db_path)
    service = ModelAssetInventoryService(load_config({"hf_models_dir": str(models_root)}), store)

    assets = service.reconcile_scan([gguf_path])

    assert len(assets) == 1
    asset = assets[0]
    assert asset["asset_id"]
    assert asset["canonical_path"] == str(gguf_path.resolve())
    assert asset["filename"] == "qwen.gguf"
    assert asset["display_name"] == "qwen"
    assert asset["size_bytes"] == 5
    assert asset["asset_kind"] == "gguf"
    assert asset["source_type"] == "scanned"
    assert asset["missing"] is False


def test_model_asset_inventory_service_reuses_existing_asset_row(tmp_path: Path):
    models_root = tmp_path / "HFModels"
    gguf_path = models_root / "Qwen" / "qwen.gguf"
    gguf_path.parent.mkdir(parents=True)
    gguf_path.write_bytes(b"hello")

    db_path = tmp_path / "models.db"
    prepare_models_db(db_path)
    store = ModelAssetStoreOrm(db_path=db_path)
    service = ModelAssetInventoryService(load_config({"hf_models_dir": str(models_root)}), store)

    first_assets = service.reconcile_scan([gguf_path])
    gguf_path.write_bytes(b"hello world")
    second_assets = service.reconcile_scan([gguf_path])

    assert first_assets[0]["asset_id"] == second_assets[0]["asset_id"]
    assert second_assets[0]["size_bytes"] == 11


def test_model_asset_inventory_service_marks_missing_rows(tmp_path: Path):
    models_root = tmp_path / "HFModels"
    first_path = models_root / "Qwen" / "qwen.gguf"
    second_path = models_root / "Gemma" / "gemma.gguf"
    first_path.parent.mkdir(parents=True)
    second_path.parent.mkdir(parents=True)
    first_path.write_bytes(b"hello")
    second_path.write_bytes(b"world")

    db_path = tmp_path / "models.db"
    prepare_models_db(db_path)
    store = ModelAssetStoreOrm(db_path=db_path)
    service = ModelAssetInventoryService(load_config({"hf_models_dir": str(models_root)}), store)

    service.reconcile_scan([first_path, second_path])
    assets = service.reconcile_scan([first_path])

    persisted = {asset["canonical_path"]: asset for asset in store.list_assets()}
    assert persisted[str(first_path.resolve())]["missing"] is False
    assert persisted[str(second_path.resolve())]["missing"] is True
    assert [asset["canonical_path"] for asset in assets] == [str(first_path.resolve())]


class FakeDownloadStore:
    def __init__(self, records: list[dict[str, object]]):
        self.records = records

    def list_downloads(self, *, status: str | None = None, limit: int = 100) -> list[dict[str, object]]:
        items = self.records
        if status is not None:
            items = [item for item in items if item.get("status") == status]
        return items[:limit]


def test_model_asset_inventory_service_links_scanned_asset_to_download_provenance(tmp_path: Path):
    models_root = tmp_path / "HFModels"
    download_root = models_root / "owner__model"
    gguf_path = download_root / "nested" / "model-Q5_K_M.gguf"
    gguf_path.parent.mkdir(parents=True)
    gguf_path.write_bytes(b"hello")

    db_path = tmp_path / "models.db"
    prepare_models_db(db_path)
    store = ModelAssetStoreOrm(db_path=db_path)
    download_store = FakeDownloadStore(
        [
            {
                "id": "download-1",
                "repo_id": "owner/model",
                "revision": "main",
                "local_path": str(download_root),
                "status": "succeeded",
                "command": "python -m huggingface_hub.cli.hf download owner/model --local-dir "
                f"{download_root} --revision main --include nested/model-Q5_K_M.gguf",
            }
        ]
    )
    service = ModelAssetInventoryService(
        load_config({"hf_models_dir": str(models_root)}),
        store,
        download_store=download_store,
    )

    assets = service.reconcile_scan([gguf_path])

    assert assets[0]["download_id"] == "download-1"
    assert assets[0]["source_repo_id"] == "owner/model"
    assert assets[0]["source_revision"] == "main"
    assert assets[0]["source_filename"] == "nested/model-Q5_K_M.gguf"
