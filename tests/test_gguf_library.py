from pathlib import Path

from llama_pack.core.config import load_config
from llama_pack.core.model_assets.library import GgufLibrary
from llama_pack.core.model_assets.models_db import ModelAssetInventoryService
from llama_pack.core.persistence.model_asset_store_orm import ModelAssetStoreOrm
from llama_pack.core.runtime.process_manager import ProcessManager
from llama_pack.core.runtime.profile_catalog import build_profile_catalog
from tests.persistence_db_setup import prepare_models_db


def test_gguf_library_lists_files_with_stable_ids(tmp_path):
    hf_dir = tmp_path / "HFModels"
    model_dir = hf_dir / "gemma"
    model_dir.mkdir(parents=True)
    gguf_path = model_dir / "model.gguf"
    gguf_path.write_bytes(b"x" * 1536)

    db_path = tmp_path / "models.db"
    prepare_models_db(db_path)
    config = load_config({"hf_models_dir": str(hf_dir)})
    inventory = ModelAssetInventoryService(config, ModelAssetStoreOrm(db_path=db_path))
    library = GgufLibrary(config, inventory_service=inventory)

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
        }
    ]


def test_gguf_library_preserves_asset_id_across_repeated_scans(tmp_path):
    hf_dir = tmp_path / "HFModels"
    model_dir = hf_dir / "gemma"
    model_dir.mkdir(parents=True)
    gguf_path = model_dir / "model.gguf"
    gguf_path.write_bytes(b"x" * 1536)

    db_path = tmp_path / "models.db"
    prepare_models_db(db_path)
    config = load_config({"hf_models_dir": str(hf_dir)})
    inventory = ModelAssetInventoryService(config, ModelAssetStoreOrm(db_path=db_path))
    library = GgufLibrary(config, inventory_service=inventory)

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
    config = load_config({"hf_models_dir": str(hf_dir)})
    library = GgufLibrary(config)

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
        supports_mtp=True,
        draft_model_path="/models/mtp-gemma-local.gguf",
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
        "supports_mtp": True,
        "speculative": {
            "mode": "mtp",
            "draft_model_path": "/models/mtp-gemma-local.gguf",
            "draft_max": None,
            "draft_min": None,
        },
        "profiles": {
            "default": {
                "label": "Default",
                "order": 0,
                "kind": "default",
            }
        },
    }
    assert config.models["gemma-local"].path == str(gguf_path)
    assert config.models["gemma-local"].reasoning == "auto"
    assert config.models["gemma-local"].reasoning_budget == 2048
    assert config.models["gemma-local"].prompt_template == "gemma"
    assert config.models["gemma-local"].supports_mtp is True
    assert config.models["gemma-local"].speculative is not None
    assert config.models["gemma-local"].speculative.draft_model_path == "/models/mtp-gemma-local.gguf"
    assert config.models["gemma-local"].profiles["default"].label == "Default"
    assert config.effective_model_config("gemma-local:default").port == 8088
    assert config.effective_model_config("gemma-local:default").ctx == 8192


def test_gguf_library_add_model_persists_model_asset_link(tmp_path):
    hf_dir = tmp_path / "HFModels"
    model_dir = hf_dir / "gemma"
    model_dir.mkdir(parents=True)
    gguf_path = model_dir / "model.gguf"
    gguf_path.write_text("", encoding="utf-8")
    db_path = tmp_path / "models.db"
    prepare_models_db(db_path)
    config = load_config({"hf_models_dir": str(hf_dir)})
    store = ModelAssetStoreOrm(db_path=db_path)
    inventory = ModelAssetInventoryService(config, store)
    library = GgufLibrary(config, inventory_service=inventory)

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
    assert models == [
        {
            "model_id": models[0]["model_id"],
            "model_name": "gemma-local",
            "asset_id": asset_id,
            "config_source": "yaml",
            "model_line": None,
            "ctx": 8192,
            "gpu_layers": 999,
            "vision": False,
            "mmproj": None,
            "supports_json_schema": None,
            "supports_grammar": None,
            "supports_mtp": None,
            "reasoning": None,
            "reasoning_budget": None,
            "prompt_template": None,
            "favorite": False,
            "strengths": [],
            "cost_tier": None,
            "extra_args": [],
            "created_at": models[0]["created_at"],
            "updated_at": models[0]["updated_at"],
        }
    ]

    profiles = store.list_model_profiles(models[0]["model_id"])
    assert profiles == [
        {
            "profile_id": profiles[0]["profile_id"],
            "model_id": models[0]["model_id"],
            "profile_key": "default",
            "label": "Default",
            "order": 0,
            "kind": "default",
            "ctx": None,
            "gpu_layers": None,
            "host": None,
            "extra_args": [],
            "intended_ctx": None,
            "kv_cache_policy": None,
            "resource_tier": None,
            "strengths": [],
            "cost_tier": None,
            "created_at": profiles[0]["created_at"],
            "updated_at": profiles[0]["updated_at"],
        }
    ]

    deployments = store.list_model_deployments(models[0]["model_id"])
    assert deployments == [
        {
            "deployment_id": deployments[0]["deployment_id"],
            "model_id": models[0]["model_id"],
            "deployment_name": "default",
            "node_name": None,
            "host": "0.0.0.0",
            "port": 8088,
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


def test_gguf_library_remove_and_delete_clear_model_asset_links(tmp_path):
    hf_dir = tmp_path / "HFModels"
    model_dir = hf_dir / "gemma"
    model_dir.mkdir(parents=True)
    gguf_path = model_dir / "model.gguf"
    gguf_path.write_text("", encoding="utf-8")
    db_path = tmp_path / "models.db"
    prepare_models_db(db_path)
    config = load_config({"hf_models_dir": str(hf_dir)})
    store = ModelAssetStoreOrm(db_path=db_path)
    inventory = ModelAssetInventoryService(config, store)
    library = GgufLibrary(config, inventory_service=inventory)

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
    config = load_config({"hf_models_dir": str(hf_dir), "log_dir": str(tmp_path / "logs")})
    library = GgufLibrary(config)

    library.add_model(
        library.file_id(gguf_path),
        name="gemma-local",
        port=8088,
        ctx=8192,
        gpu_layers=999,
        host="0.0.0.0",
    )

    statuses = ProcessManager(config).list_statuses()
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

    library = GgufLibrary(
        load_config({"hf_models_dirs": [str(first_root), str(second_root)]})
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

    library = GgufLibrary(load_config({"hf_models_dir": str(hf_dir)}))

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
    library = GgufLibrary(load_config({"hf_models_dir": str(hf_dir)}))

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
    library = GgufLibrary(load_config({"hf_models_dir": str(hf_dir)}))

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

    assert files == [
        {
            "id": library.file_id(nested_path),
            "name": "qwen-Q5_K_M",
            "filename": "qwen-Q5_K_M.gguf",
            "model_dir": "Q5_K_M",
            "path": str(nested_path),
            "size_bytes": 6,
            "size_gb": 0.0,
            "registered": False,
            "registered_as": None,
            "running": False,
            "pid": None,
            "recently_received": True,
            "received_from_node": "node-b",
            "received_transfer_id": "transfer-123",
            "received_at": "2026-05-19T12:00:00Z",
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
        }
    ]


def test_gguf_library_includes_registered_model_runtime_status(tmp_path):
    hf_dir = tmp_path / "HFModels"
    model_dir = hf_dir / "gemma"
    model_dir.mkdir(parents=True)
    gguf_path = model_dir / "model.gguf"
    gguf_path.write_text("", encoding="utf-8")
    config = load_config(
        {
            "hf_models_dir": str(hf_dir),
            "models": {"gemma-local": {"path": str(gguf_path), "port": 8088}},
        }
    )
    library = GgufLibrary(config)

    files = library.list_files(
        model_statuses=[
            {"name": "gemma-local", "running": True, "pid": 4321},
            {"name": "other-model", "running": True, "pid": 9876},
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
    library = GgufLibrary(load_config({"hf_models_dir": str(hf_dir)}))

    expected_id = library.file_id(one_level_path)

    listed = {file["path"]: file["id"] for file in library.list_files()}

    assert listed[str(one_level_path)] == expected_id
    assert listed[str(nested_path)] == library.file_id(nested_path)


def test_gguf_library_add_model_persists_to_file_backed_config(tmp_path):
    hf_dir = tmp_path / "HFModels"
    model_dir = hf_dir / "gemma"
    model_dir.mkdir(parents=True)
    gguf_path = model_dir / "model.gguf"
    gguf_path.write_text("", encoding="utf-8")
    config_path = tmp_path / "config.yaml"
    config_path.write_text(
        f"""
hf_models_dir: {hf_dir}
models: {{}}
""".strip()
        + "\n",
        encoding="utf-8",
    )
    config = load_config(config_path)
    library = GgufLibrary(config)

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

    reloaded = load_config(config_path)
    assert "gemma-local" in reloaded.models
    assert reloaded.models["gemma-local"].path == str(gguf_path)
    assert reloaded.models["gemma-local"].reasoning == "auto"
    assert reloaded.models["gemma-local"].reasoning_budget == 2048
    assert reloaded.models["gemma-local"].prompt_template == "llama3"
    assert reloaded.models["gemma-local"].profiles["default"].label == "Default"
    assert reloaded.effective_model_config("gemma-local:default").port == 8088


def test_gguf_library_deletes_file_and_unregisters_model(tmp_path):
    hf_dir = tmp_path / "HFModels"
    model_dir = hf_dir / "gemma"
    model_dir.mkdir(parents=True)
    gguf_path = model_dir / "model.gguf"
    gguf_path.write_text("", encoding="utf-8")
    config = load_config(
        {
            "hf_models_dir": str(hf_dir),
            "models": {"gemma-local": {"path": str(gguf_path), "port": 8088}},
        }
    )
    library = GgufLibrary(config)

    deleted = library.delete_file(library.file_id(gguf_path))

    assert deleted == {
        "deleted": True,
        "id": library.file_id(gguf_path),
        "filename": "model.gguf",
        "path": str(gguf_path),
        "unregistered_models": ["gemma-local"],
    }
    assert not gguf_path.exists()
    assert "gemma-local" not in config.models
