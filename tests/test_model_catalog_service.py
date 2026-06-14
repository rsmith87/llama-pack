from pathlib import Path

from llama_pack.core.model_assets.catalog_service import ModelCatalogService
from llama_pack.core.persistence.model_asset_store_orm import ModelAssetStoreOrm
from tests.persistence_db_setup import prepare_models_db


def test_catalog_service_builds_runtime_model_from_db(tmp_path: Path):
    db_path = tmp_path / "models.db"
    prepare_models_db(db_path)
    store = ModelAssetStoreOrm(db_path=db_path)

    asset = store.upsert_asset(
        canonical_path="/models/llama.gguf",
        filename="llama.gguf",
        display_name="llama",
        size_bytes=10,
        asset_kind="gguf",
        source_type="manual",
    )
    mmproj = store.upsert_asset(
        canonical_path="/models/mmproj.gguf",
        filename="mmproj.gguf",
        display_name="mmproj",
        size_bytes=4,
        asset_kind="mmproj",
        source_type="download",
    )
    row = store.upsert_model(
        model_name="llama",
        asset_id=asset["asset_id"],
        config_source="db",
        ctx=8192,
        gpu_layers=32,
        vision=True,
        mmproj_asset_id=mmproj["asset_id"],
        favorite=False,
        supports_mtp=False,
    )
    store.upsert_model_profile(
        model_id=str(row["model_id"]),
        profile_key="default",
        label="Default",
        order=0,
        kind="default",
        ctx=8192,
        gpu_layers=32,
        host="127.0.0.1",
    )
    store.upsert_model_deployment(
        model_id=str(row["model_id"]),
        deployment_name="default",
        node_name=None,
        host="127.0.0.1",
        port=8080,
        profile_key="default",
    )

    service = ModelCatalogService(store)
    runtime = service.runtime_model("llama")

    assert runtime.path == "/models/llama.gguf"
    assert runtime.port == 8080
    assert runtime.ctx == 8192
    assert runtime.gpu_layers == 32
    assert runtime.mmproj == "/models/mmproj.gguf"
    assert runtime.vision is True
    assert runtime.favorite is False
    assert set(runtime.profiles) == {"default"}
