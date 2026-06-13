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
