from __future__ import annotations

from pathlib import Path

from llama_pack.core.config import load_config
from llama_pack.core.model_assets.library import GgufLibrary
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


def test_yaml_model_sync_populates_model_catalog_profiles_and_default_deployment(tmp_path: Path):
    models_root = tmp_path / "HFModels"
    gguf_path = models_root / "Qwen" / "qwen.gguf"
    gguf_path.parent.mkdir(parents=True)
    gguf_path.write_bytes(b"hello")

    db_path = tmp_path / "models.db"
    prepare_models_db(db_path)
    config = load_config(
        {
            "hf_models_dir": str(models_root),
            "models": {
                "qwen-coder": {
                    "path": str(gguf_path),
                    "port": 8091,
                    "ctx": 32768,
                    "gpu_layers": 55,
                    "host": "127.0.0.1",
                    "vision": True,
                    "mmproj": "/models/mmproj.gguf",
                    "supports_json_schema": True,
                    "supports_grammar": True,
                    "supports_mtp": True,
                    "reasoning": "auto",
                    "reasoning_budget": 2048,
                    "prompt_template": "llama3",
                    "favorite": True,
                    "model_line": "Coding",
                    "strengths": ["coding", "tool-use"],
                    "cost_tier": "high",
                    "extra_args": ["--flash-attn"],
                    "profiles": {
                        "default": {
                            "label": "Default",
                            "order": 0,
                            "kind": "default",
                        },
                        "chat": {
                            "label": "Chat",
                            "order": 10,
                            "kind": "interactive",
                            "ctx": 24576,
                            "gpu_layers": 48,
                            "host": "0.0.0.0",
                            "extra_args": ["--cont-batching"],
                            "intended_ctx": 16384,
                            "kv_cache_policy": "dynamic",
                            "resource_tier": "workstation",
                            "strengths": ["chat"],
                            "cost_tier": "medium",
                        },
                    },
                }
            },
        }
    )
    store = ModelAssetStoreOrm(db_path=db_path)
    inventory = ModelAssetInventoryService(config, store)
    library = GgufLibrary(config, inventory_service=inventory)

    library.list_files()

    models = store.list_models()
    assert len(models) == 1
    model = models[0]
    assert model["model_name"] == "qwen-coder"
    assert model["ctx"] == 32768
    assert model["gpu_layers"] == 55
    assert model["vision"] is True
    assert model["mmproj"] == "/models/mmproj.gguf"
    assert model["supports_json_schema"] is True
    assert model["supports_grammar"] is True
    assert model["supports_mtp"] is True
    assert model["reasoning"] == "auto"
    assert model["reasoning_budget"] == 2048
    assert model["prompt_template"] == "llama3"
    assert model["favorite"] is True
    assert model["model_line"] == "Coding"
    assert model["strengths"] == ["coding", "tool-use"]
    assert model["cost_tier"] == "high"
    assert model["extra_args"] == ["--flash-attn"]

    profiles = store.list_model_profiles(model["model_id"])
    assert [profile["profile_key"] for profile in profiles] == ["default", "chat"]
    chat_profile = next(profile for profile in profiles if profile["profile_key"] == "chat")
    assert chat_profile["label"] == "Chat"
    assert chat_profile["ctx"] == 24576
    assert chat_profile["gpu_layers"] == 48
    assert chat_profile["host"] == "0.0.0.0"
    assert chat_profile["extra_args"] == ["--cont-batching"]
    assert chat_profile["intended_ctx"] == 16384
    assert chat_profile["kv_cache_policy"] == "dynamic"
    assert chat_profile["resource_tier"] == "workstation"
    assert chat_profile["strengths"] == ["chat"]
    assert chat_profile["cost_tier"] == "medium"

    deployments = store.list_model_deployments(model["model_id"])
    assert deployments == [
        {
            "deployment_id": deployments[0]["deployment_id"],
            "model_id": model["model_id"],
            "deployment_name": "default",
            "node_name": None,
            "host": "127.0.0.1",
            "port": 8091,
            "ctx_override": None,
            "gpu_layers_override": None,
            "mmproj_override": None,
            "extra_args_override": [],
            "profile_key": "default",
            "enabled": True,
            "created_at": deployments[0]["created_at"],
            "updated_at": deployments[0]["updated_at"],
        }
    ]
