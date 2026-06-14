from pathlib import Path

from llama_pack.core.config import load_config
from llama_pack.core.model_assets.catalog_service import ModelCatalogService
from llama_pack.core.model_assets.library import GgufLibrary, compute_file_id
from llama_pack.core.model_assets.models_db import ModelAssetInventoryService
from llama_pack.core.persistence.model_asset_store_orm import ModelAssetStoreOrm
from llama_pack.core.runtime.process_manager import ProcessManager
from llama_pack.core.runtime.profile_catalog import build_profile_catalog
from tests.persistence_db_setup import prepare_models_db


def _make_library(tmp_path, hf_dir=None, config_extras=None):
    """Helper: create a GgufLibrary backed by a fresh test DB."""
    if hf_dir is None:
        hf_dir = tmp_path / "HFModels"
    extras = config_extras or {}
    config = load_config({"hf_models_dir": str(hf_dir), **extras})
    db_path = tmp_path / "models.db"
    prepare_models_db(db_path)
    store = ModelAssetStoreOrm(db_path=db_path)
    inventory = ModelAssetInventoryService(config, store)
    library = GgufLibrary(config, inventory_service=inventory)
    return library, store, config


def test_gguf_library_lists_files_with_stable_ids(tmp_path):
    hf_dir = tmp_path / "HFModels"
    model_dir = hf_dir / "gemma"
    model_dir.mkdir(parents=True)
    gguf_path = model_dir / "model.gguf"
    gguf_path.write_bytes(b"x" * 1536)

    library, store, config = _make_library(tmp_path, hf_dir)
    files = library.list_files()

    assert files[0]["asset_id"]
    assert files == [
        {
            "asset_id": files[0]["asset_id"],
            "id": library.file_id(gguf_path),
            "name": "model",
            "filename": "model.gguf",
            "model_dir": "gemma",
            "path": str(gguf_path),
            "size_bytes": 1536,
            "size_gb": 0.0,
            "registered": False,
            "registered_as": None,
            "running": False,
            "pid": None,
            "recently_received": False,
            "received_from_node": None,
            "received_transfer_id": None,
            "received_at": None,
            "vision": False,
            "mmproj": None,
            "model_supports_mtp": None,
            "model_draft_model_path": None,
            "model_ctx": None,
            "model_gpu_layers": None,
            "model_port": None,
            "model_prompt_template": None,
            "model_reasoning": None,
            "model_reasoning_budget": None,
            "model_line": None,
            "model_catalog": None,
            "model_profiles": [],
            "model_deployments": [],
        }
    ]


def test_gguf_library_preserves_asset_id_across_repeated_scans(tmp_path):
    hf_dir = tmp_path / "HFModels"
    model_dir = hf_dir / "gemma"
    model_dir.mkdir(parents=True)
    gguf_path = model_dir / "model.gguf"
    gguf_path.write_bytes(b"x" * 1536)

    library, store, config = _make_library(tmp_path, hf_dir)
    first_files = library.list_files()
    gguf_path.write_bytes(b"x" * 2048)
    second_files = library.list_files()

    assert first_files[0]["asset_id"] == second_files[0]["asset_id"]
    assert second_files[0]["size_bytes"] == 2048


def test_gguf_library_adds_file_as_runtime_model(tmp_path):
    hf_dir = tmp_path / "HFModels"
    model_dir = hf_dir / "gemma"
    model_dir.mkdir(parents=True)
    gguf_path = model_dir / "model.gguf"
    gguf_path.write_text("", encoding="utf-8")

    library, store, config = _make_library(tmp_path, hf_dir)

    model = library.add_model(
        library.file_id(gguf_path),
        name="gemma-local",
        port=8088,
        ctx=8192,
        gpu_layers=999,
        host="0.0.0.0",
        reasoning="auto",
        reasoning_budget=2048,
        prompt_template="gemma",
        favorite=False,
    )

    assert model == {
        "name": "gemma-local",
        "path": str(gguf_path),
        "port": 8088,
        "ctx": 8192,
        "gpu_layers": 999,
        "host": "0.0.0.0",
        "reasoning": "auto",
        "reasoning_budget": 2048,
        "prompt_template": "gemma",
        "favorite": False,
        "vision": False,
        "mmproj": None,
        "supports_mtp": None,
        "speculative": None,
        "profiles": {
            "default": {
                "label": "Default",
                "order": 0,
                "kind": "default",
            }
        },
    }

    # Verify DB is the source of truth (not config.models)
    db_model = store.get_model_by_name("gemma-local")
    assert db_model is not None
    assert db_model["ctx"] == 8192
    assert db_model["gpu_layers"] == 999
    assert db_model["reasoning"] == "auto"
    assert db_model["reasoning_budget"] == 2048
    assert db_model["prompt_template"] == "gemma"
    assert db_model["supports_mtp"] is None
    assert db_model["favorite"] is False
    assert db_model["config_source"] == "db"


def test_gguf_library_add_model_persists_model_asset_link(tmp_path):
    hf_dir = tmp_path / "HFModels"
    model_dir = hf_dir / "gemma"
    model_dir.mkdir(parents=True)
    gguf_path = model_dir / "model.gguf"
    gguf_path.write_text("", encoding="utf-8")

    library, store, config = _make_library(tmp_path, hf_dir)
    files = library.list_files()
    asset_id = files[0]["asset_id"]

    library.add_model(
        library.file_id(gguf_path),
        name="gemma-local",
        port=8088,
        ctx=8192,
        gpu_layers=999,
        host="0.0.0.0",
    )

    models = store.list_models()
    assert len(models) == 1
    assert models[0]["model_name"] == "gemma-local"
    assert models[0]["asset_id"] == asset_id
    assert models[0]["ctx"] == 8192
    assert models[0]["gpu_layers"] == 999
    assert models[0]["config_source"] == "db"

    profiles = store.list_model_profiles(models[0]["model_id"])
    assert len(profiles) == 1
    assert profiles[0]["profile_key"] == "default"
    assert profiles[0]["label"] == "Default"
    assert profiles[0]["order"] == 0
    assert profiles[0]["kind"] == "default"

    deployments = store.list_model_deployments(models[0]["model_id"])
    assert len(deployments) == 1
    assert deployments[0]["deployment_name"] == "default"
    assert deployments[0]["host"] == "0.0.0.0"
    assert deployments[0]["port"] == 8088
    assert deployments[0]["profile_key"] == "default"
    assert deployments[0]["enabled"] is True


def test_gguf_library_remove_and_delete_clear_model_asset_links(tmp_path):
    hf_dir = tmp_path / "HFModels"
    model_dir = hf_dir / "gemma"
    model_dir.mkdir(parents=True)
    gguf_path = model_dir / "model.gguf"
    gguf_path.write_text("", encoding="utf-8")

    library, store, config = _make_library(tmp_path, hf_dir)
    library.list_files()
    library.add_model(
        library.file_id(gguf_path),
        name="gemma-local",
        port=8088,
        ctx=8192,
        gpu_layers=999,
        host="0.0.0.0",
    )
    assert len(store.list_models()) == 1

    library.remove_model("gemma-local")
    assert store.list_models() == []

    library.add_model(
        library.file_id(gguf_path),
        name="gemma-local",
        port=8088,
        ctx=8192,
        gpu_layers=999,
        host="0.0.0.0",
    )
    assert len(store.list_models()) == 1

    library.delete_file(library.file_id(gguf_path))
    assert store.list_models() == []


def test_gguf_library_added_model_appears_in_profile_catalog(tmp_path):
    hf_dir = tmp_path / "HFModels"
    model_dir = hf_dir / "gemma"
    model_dir.mkdir(parents=True)
    gguf_path = model_dir / "model.gguf"
    gguf_path.write_text("", encoding="utf-8")

    library, store, config = _make_library(tmp_path, hf_dir)
    library.add_model(
        library.file_id(gguf_path),
        name="gemma-local",
        port=8088,
        ctx=8192,
        gpu_layers=999,
        host="0.0.0.0",
    )

    statuses = ProcessManager(config, catalog_service=ModelCatalogService(store)).list_statuses()
    catalog = build_profile_catalog(statuses)

    assert statuses[0]["name"] == "gemma-local:default"
    assert catalog["families"][0]["family"] == "gemma-local"
    profile = catalog["families"][0]["profiles"][0]
    assert profile["profile"] == "default"
    assert profile["label"] == "Default"
    assert profile["identity"] == "gemma-local:default"
    assert profile["ctx"] == 8192
    assert profile["port"] == 8088
    assert profile["route"] == "local"
    assert profile["order"] == 0
    assert profile["kind"] == "default"


def test_gguf_library_lists_files_from_multiple_roots(tmp_path):
    first_root = tmp_path / "HFModelsA"
    second_root = tmp_path / "HFModelsB"
    first_model = first_root / "gemma"
    second_model = second_root / "qwen"
    first_model.mkdir(parents=True)
    second_model.mkdir(parents=True)
    first_path = first_model / "gemma.gguf"
    second_path = second_model / "qwen.gguf"
    first_path.write_text("", encoding="utf-8")
    second_path.write_text("", encoding="utf-8")

    library, store, config = _make_library(
        tmp_path, first_root, config_extras={"hf_models_dirs": [str(first_root), str(second_root)]}
    )

    assert [file["path"] for file in library.list_files()] == [
        str(first_path),
        str(second_path),
    ]


def test_gguf_library_lists_nested_ggufs_recursively(tmp_path):
    hf_dir = tmp_path / "HFModels"
    shallow_dir = hf_dir / "gemma"
    nested_dir = hf_dir / "Qwen" / "quants" / "Q4_K_M"
    shallow_dir.mkdir(parents=True)
    nested_dir.mkdir(parents=True)
    shallow_path = shallow_dir / "gemma.gguf"
    nested_path = nested_dir / "qwen-Q4_K_M.gguf"
    shallow_path.write_text("", encoding="utf-8")
    nested_path.write_text("", encoding="utf-8")

    library, store, config = _make_library(tmp_path, hf_dir)

    files = library.list_files()

    assert [file["path"] for file in files] == [
        str(shallow_path),
        str(nested_path),
    ]
    assert files[0]["id"] == library.file_id(shallow_path)
    assert files[1]["id"] == library.file_id(nested_path)


def test_gguf_library_prefills_unregistered_vision_model_sidecar(tmp_path):
    hf_dir = tmp_path / "HFModels"
    model_dir = hf_dir / "Qwen2.5-VL"
    model_dir.mkdir(parents=True)
    model_path = model_dir / "Qwen2.5-VL-7B-Instruct-Q4_K_M.gguf"
    mmproj_path = model_dir / "mmproj-F16.gguf"
    model_path.write_bytes(b"model")
    mmproj_path.write_bytes(b"mmproj")

    library, store, config = _make_library(tmp_path, hf_dir)
    files = library.list_files()

    model = next(file for file in files if file["path"] == str(model_path))
    sidecar = next(file for file in files if file["path"] == str(mmproj_path))
    assert model["vision"] is True
    assert model["mmproj"] == str(mmproj_path)
    assert sidecar["vision"] is False
    assert sidecar["mmproj"] is None


def test_gguf_library_marks_nested_transferred_copy_as_recent(tmp_path):
    hf_dir = tmp_path / "HFModels"
    nested_path = hf_dir / "Qwen" / "imports" / "Q5_K_M" / "qwen-Q5_K_M.gguf"
    nested_path.parent.mkdir(parents=True)
    nested_path.write_bytes(b"copied")

    library, store, config = _make_library(tmp_path, hf_dir)
    files = library.list_files(
        recent_transfers=[
            {
                "id": "transfer-123",
                "source_node": "node-b",
                "completed_at": "2026-05-19T12:00:00Z",
                "copied": [{"path": str(nested_path)}],
            }
        ]
    )

    assert len(files) == 1
    f = files[0]
    assert f["id"] == library.file_id(nested_path)
    assert f["name"] == "qwen-Q5_K_M"
    assert f["filename"] == "qwen-Q5_K_M.gguf"
    assert f["recently_received"] is True
    assert f["received_from_node"] == "node-b"
    assert f["received_transfer_id"] == "transfer-123"
    assert f["received_at"] == "2026-05-19T12:00:00Z"
    assert f["registered"] is False
    assert f["running"] is False
    assert f["model_catalog"] is None
    assert f["model_profiles"] == []
    assert f["model_deployments"] == []


def test_gguf_library_includes_registered_model_runtime_status(tmp_path):
    hf_dir = tmp_path / "HFModels"
    model_dir = hf_dir / "gemma"
    model_dir.mkdir(parents=True)
    gguf_path = model_dir / "model.gguf"
    gguf_path.write_text("", encoding="utf-8")

    library, store, config = _make_library(tmp_path, hf_dir)
    # Register a model in the DB
    library.add_model(
        library.file_id(gguf_path),
        name="gemma-local",
        port=8088,
        ctx=8192,
        gpu_layers=999,
        host="0.0.0.0",
    )

    files = library.list_files(
        model_statuses=[
            {"name": "gemma-local", "running": True, "pid": 4321},
        ]
    )

    assert files[0]["registered_as"] == "gemma-local"
    assert files[0]["running"] is True
    assert files[0]["pid"] == 4321


def test_gguf_library_keeps_existing_one_level_file_ids_stable(tmp_path):
    hf_dir = tmp_path / "HFModels"
    one_level_path = hf_dir / "gemma" / "model.gguf"
    nested_path = hf_dir / "Qwen" / "quants" / "Q4_K_M" / "model.gguf"
    one_level_path.parent.mkdir(parents=True)
    nested_path.parent.mkdir(parents=True)
    one_level_path.write_text("", encoding="utf-8")
    nested_path.write_text("", encoding="utf-8")

    library, store, config = _make_library(tmp_path, hf_dir)
    expected_id = library.file_id(one_level_path)
    listed = {file["path"]: file["id"] for file in library.list_files()}

    assert listed[str(one_level_path)] == expected_id
    assert listed[str(nested_path)] == library.file_id(nested_path)


def test_gguf_library_add_model_persists_to_db(tmp_path):
    """Previously verified YAML persistence; now verifies DB authority."""
    hf_dir = tmp_path / "HFModels"
    model_dir = hf_dir / "gemma"
    model_dir.mkdir(parents=True)
    gguf_path = model_dir / "model.gguf"
    gguf_path.write_text("", encoding="utf-8")

    library, store, config = _make_library(tmp_path, hf_dir)
    library.add_model(
        library.file_id(gguf_path),
        name="gemma-local",
        port=8088,
        ctx=8192,
        gpu_layers=999,
        host="0.0.0.0",
        reasoning="auto",
        reasoning_budget=2048,
        prompt_template="llama3",
    )

    # Verify model is in the DB
    db_model = store.get_model_by_name("gemma-local")
    assert db_model is not None
    assert db_model["ctx"] == 8192
    assert db_model["reasoning"] == "auto"
    assert db_model["reasoning_budget"] == 2048
    assert db_model["prompt_template"] == "llama3"
    assert db_model["config_source"] == "db"

    # Verify profiles
    profiles = store.list_model_profiles(db_model["model_id"])
    assert len(profiles) == 1
    assert profiles[0]["profile_key"] == "default"
    assert profiles[0]["label"] == "Default"

    # Verify deployment
    deployments = store.list_model_deployments(db_model["model_id"])
    assert len(deployments) == 1
    assert deployments[0]["port"] == 8088


def test_gguf_library_deletes_file_and_unregisters_model(tmp_path):
    hf_dir = tmp_path / "HFModels"
    model_dir = hf_dir / "gemma"
    model_dir.mkdir(parents=True)
    gguf_path = model_dir / "model.gguf"
    gguf_path.write_text("", encoding="utf-8")

    library, store, config = _make_library(tmp_path, hf_dir)
    library.add_model(
        library.file_id(gguf_path),
        name="gemma-local",
        port=8088,
        ctx=8192,
        gpu_layers=999,
        host="0.0.0.0",
    )

    deleted = library.delete_file(library.file_id(gguf_path))

    assert deleted == {
        "deleted": True,
        "id": library.file_id(gguf_path),
        "filename": "model.gguf",
        "path": str(gguf_path),
        "unregistered_models": ["gemma-local"],
    }
    assert not gguf_path.exists()
    assert store.get_model_by_name("gemma-local") is None


def test_gguf_library_update_model_writes_to_db(tmp_path):
    """Verify update_model writes changes to DB, not config.models."""
    hf_dir = tmp_path / "HFModels"
    model_dir = hf_dir / "gemma"
    model_dir.mkdir(parents=True)
    gguf_path = model_dir / "model.gguf"
    gguf_path.write_text("", encoding="utf-8")

    library, store, config = _make_library(tmp_path, hf_dir)
    library.add_model(
        library.file_id(gguf_path),
        name="gemma-local",
        port=8088,
        ctx=8192,
        gpu_layers=999,
        host="0.0.0.0",
    )

    result = library.update_model("gemma-local", vision=True, prompt_template="gemma2")
    assert result["vision"] is True
    assert result["prompt_template"] == "gemma2"

    db_model = store.get_model_by_name("gemma-local")
    assert db_model["vision"] is True
    assert db_model["prompt_template"] == "gemma2"


def test_gguf_library_update_model_port_writes_to_deployment(tmp_path):
    hf_dir = tmp_path / "HFModels"
    model_dir = hf_dir / "gemma"
    model_dir.mkdir(parents=True)
    gguf_path = model_dir / "model.gguf"
    gguf_path.write_text("", encoding="utf-8")

    library, store, config = _make_library(tmp_path, hf_dir)
    library.add_model(
        library.file_id(gguf_path),
        name="gemma-local",
        port=8088,
        ctx=8192,
        gpu_layers=999,
        host="0.0.0.0",
    )

    result = library.update_model("gemma-local", port=9090)
    assert result["port"] == 9090

    db_model = store.get_model_by_name("gemma-local")
    deployments = store.list_model_deployments(db_model["model_id"])
    assert deployments[0]["port"] == 9090


def test_gguf_library_compute_file_id_standalone():
    """Verify the standalone compute_file_id function matches the class method."""
    path = Path("/some/path/model.gguf")
    assert compute_file_id(path) == GgufLibrary.__new__(GgufLibrary).file_id(path)


def test_gguf_library_duplicate_model_raises(tmp_path):
    hf_dir = tmp_path / "HFModels"
    model_dir = hf_dir / "gemma"
    model_dir.mkdir(parents=True)
    gguf_path = model_dir / "model.gguf"
    gguf_path.write_text("", encoding="utf-8")

    library, store, config = _make_library(tmp_path, hf_dir)
    library.add_model(
        library.file_id(gguf_path),
        name="gemma-local",
        port=8088,
        ctx=8192,
        gpu_layers=999,
        host="0.0.0.0",
    )

    try:
        library.add_model(
            library.file_id(gguf_path),
            name="gemma-local",
            port=8089,
            ctx=4096,
            gpu_layers=0,
            host="0.0.0.0",
        )
        assert False, "Should have raised ValueError"
    except ValueError as exc:
        assert "already exists" in str(exc)


def test_gguf_library_remove_nonexistent_raises(tmp_path):
    library, store, config = _make_library(tmp_path)
    try:
        library.remove_model("nonexistent")
        assert False, "Should have raised KeyError"
    except KeyError:
        pass


def test_gguf_library_update_nonexistent_raises(tmp_path):
    library, store, config = _make_library(tmp_path)
    try:
        library.update_model("nonexistent", vision=True)
        assert False, "Should have raised KeyError"
    except KeyError:
        pass