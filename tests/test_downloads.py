from pathlib import Path
from datetime import UTC, datetime

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from llama_pack.api.dependencies import get_download_manager
from llama_pack.api.routes.downloads import router as downloads_router
from llama_pack.core.config import load_config
from llama_pack.core.model_assets.downloads import DownloadManager
from llama_pack.core.model_assets.models_db import ModelAssetInventoryService
from llama_pack.core.model_assets.recommendations import recommend_downloads
from llama_pack.core.persistence.model_asset_store_orm import ModelAssetStoreOrm
from llama_pack.core.persistence.model_download_store_orm import ModelDownloadStoreOrm
from llama_pack.core.runtime.network_security import OfflineNetworkBlockedError
from tests.persistence_db_setup import prepare_downloads_db, prepare_models_db


class FakeStore:
    def __init__(self):
        self.created = []
        self.updated = {}

    def list_downloads(self, *, status=None, limit=100):
        return []

    def create_download(self, **kwargs):
        record = {
            "id": "download-1",
            "status": "queued",
            "started_at": None,
            "finished_at": None,
            "bytes_downloaded": None,
            "bytes_total": None,
            "pid": None,
            "returncode": None,
            "error_detail": None,
            **kwargs,
        }
        self.created.append(record)
        return record

    def get_download(self, download_id):
        return {**self.created[-1], **self.updated.get(download_id, {})}

    def update_status(self, download_id, **kwargs):
        status = kwargs.get("status")
        if status == "running" and kwargs.get("started_at") is None:
            kwargs.setdefault("started_at", datetime.now(UTC).isoformat())
        if status in {"succeeded", "failed", "cancelled"} and kwargs.get("finished_at") is None:
            kwargs.setdefault("finished_at", datetime.now(UTC).isoformat())
        self.updated[download_id] = {**self.updated.get(download_id, {}), **kwargs}
        return self.get_download(download_id)

    def delete_download(self, download_id):
        return None


class FakeProcess:
    pid = 1234

    def __init__(self):
        self.returncode = None
        self.terminated = False
        self.killed = False

    def poll(self):
        return self.returncode

    def terminate(self):
        self.terminated = True
        self.returncode = -15

    def wait(self, timeout=None):
        return self.returncode

    def kill(self):
        self.killed = True
        self.returncode = -9


class FakeHfApi:
    def __init__(self, files):
        self.files = files
        self.calls = []

    def list_repo_tree(self, repo_id, path_in_repo=None, *, recursive=False, expand=False, revision=None, repo_type=None, token=None):
        self.calls.append(
            {
                "repo_id": repo_id,
                "path_in_repo": path_in_repo,
                "recursive": recursive,
                "expand": expand,
                "revision": revision,
                "repo_type": repo_type,
            }
        )
        return self.files

    def list_models(self, **kwargs):
        self.calls.append({"list_models": kwargs})
        return []


class FakeRepoFile:
    def __init__(self, path, size):
        self.path = path
        self.size = size


class FakeHfError(Exception):
    def __init__(self, message, response=None):
        super().__init__(message)
        self.response = response


class FakeResponse:
    def __init__(self, status_code):
        self.status_code = status_code


def make_manager(tmp_path, *, files=None, popen=None, hf_api=None, config_overrides=None, disk_usage=None):
    config_payload = {
        "mode": "agent",
        "hf_models_dirs": [str(tmp_path / "models")],
        "log_dir": str(tmp_path / "logs"),
        "python_bin": "python-test",
    }
    if config_overrides:
        config_payload.update(config_overrides)
    config = load_config(
        config_payload
    )
    store = FakeStore()
    api = hf_api or FakeHfApi(files or [])
    manager_kwargs = {
        "popen": popen or (lambda *args, **kwargs: FakeProcess()),
        "hf_api": api,
    }
    if disk_usage is not None:
        manager_kwargs["disk_usage"] = disk_usage
    manager = DownloadManager(config, store, **manager_kwargs)
    return manager, store, api


def test_download_manager_lists_remote_gguf_quants(tmp_path):
    manager, _store, api = make_manager(
        tmp_path,
        files=[
            FakeRepoFile("README.md", 42),
            FakeRepoFile("model-Q4_K_M.gguf", 1024),
            FakeRepoFile("nested/model-Q5_K_M.gguf", 2048),
            FakeRepoFile("mmproj-F16.gguf", 128),
            FakeRepoFile("model.safetensors", 4096),
        ],
    )

    quants = manager.list_remote_quants("owner/model", revision="main")

    assert quants == [
        {
            "filename": "model-Q4_K_M.gguf",
            "path": "model-Q4_K_M.gguf",
            "size_bytes": 1024,
            "quant": "Q4_K_M",
            "mmproj": {"filename": "mmproj-F16.gguf", "path": "mmproj-F16.gguf", "size_bytes": 128, "quant": "F16"},
        },
        {
            "filename": "model-Q5_K_M.gguf",
            "path": "nested/model-Q5_K_M.gguf",
            "size_bytes": 2048,
            "quant": "Q5_K_M",
            "mmproj": {"filename": "mmproj-F16.gguf", "path": "mmproj-F16.gguf", "size_bytes": 128, "quant": "F16"},
        },
    ]
    assert api.calls == [
        {
            "repo_id": "owner/model",
            "path_in_repo": None,
            "recursive": True,
            "expand": True,
            "revision": "main",
            "repo_type": "model",
        }
    ]


class OfflineDownloadManager:
    def list_remote_quants(self, repo_id, revision=None):
        raise OfflineNetworkBlockedError(
            "Blocked outbound request to 'huggingface.co' for list Hugging Face quants: offline_mode is enabled."
        )


def test_download_quants_maps_offline_block_to_409():
    app = FastAPI()
    app.include_router(downloads_router, prefix="/lm-api/v1")
    app.dependency_overrides[get_download_manager] = lambda: OfflineDownloadManager()
    client = TestClient(app)

    response = client.get("/lm-api/v1/downloads/owner/model/quants")

    assert response.status_code == 409
    assert "offline_mode is enabled" in response.json()["detail"]


def test_download_manager_blocks_remote_quants_in_offline_mode(tmp_path):
    manager, _store, api = make_manager(
        tmp_path,
        config_overrides={"offline_mode": True},
        files=[FakeRepoFile("model.Q4_K_M.gguf", 100)],
    )

    with pytest.raises(OfflineNetworkBlockedError):
        manager.list_remote_quants("owner/model")

    assert api.calls == []


def test_download_manager_blocks_start_before_process_spawn_in_offline_mode(tmp_path):
    spawned = False

    def fake_popen(command, **kwargs):
        nonlocal spawned
        spawned = True
        return FakeProcess()

    manager, store, api = make_manager(
        tmp_path,
        config_overrides={"offline_mode": True},
        popen=fake_popen,
    )

    with pytest.raises(OfflineNetworkBlockedError):
        manager.start("owner/model", triggered_by="tester")

    assert spawned is False
    assert store.created == []
    assert api.calls == []


def test_download_manager_recommendations_do_not_call_hf_api_in_offline_mode(tmp_path):
    manager, _store, api = make_manager(tmp_path, config_overrides={"offline_mode": True})

    payload = manager.recommendations({"memory_gb": 64})

    assert payload["offline_mode"] is True
    assert "blocked" in str(payload["message"]).lower()
    assert api.calls == []


def test_download_manager_prefers_quant_directory_over_model_name(tmp_path):
    manager, _store, _api = make_manager(
        tmp_path,
        files=[
            FakeRepoFile("BF16/Qwen3.6-35B-A3B-BF16-00001-of-00002.gguf", 1024),
            FakeRepoFile("Q4_K_M/Qwen3.6-35B-A3B-Q4_K_M.gguf", 2048),
            FakeRepoFile("Qwen3.6-35B-A3B-MXFP4_MOE.gguf", 4096),
            FakeRepoFile("Qwen3.6-35B-A3B-Q8_0.gguf", 8192),
            FakeRepoFile("Qwen3.6-35B-A3B-UD-IQ1_M.gguf", 16384),
        ],
    )

    quants = manager.list_remote_quants("owner/model")

    quant_by_path = {item["path"]: item["quant"] for item in quants}
    assert quant_by_path == {
        "BF16/Qwen3.6-35B-A3B-BF16-00001-of-00002.gguf": "BF16",
        "Q4_K_M/Qwen3.6-35B-A3B-Q4_K_M.gguf": "Q4_K_M",
        "Qwen3.6-35B-A3B-MXFP4_MOE.gguf": "MXFP4_MOE",
        "Qwen3.6-35B-A3B-Q8_0.gguf": "Q8_0",
        "Qwen3.6-35B-A3B-UD-IQ1_M.gguf": "UD-IQ1_M",
    }


def test_download_manager_links_mmproj_files_to_matching_quants(tmp_path):
    manager, _store, _api = make_manager(
        tmp_path,
        files=[
            FakeRepoFile("BF16/Qwen3.6-35B-A3B-BF16-00001-of-00002.gguf", 1024),
            FakeRepoFile("F16/Qwen3.6-35B-A3B-F16.gguf", 2048),
            FakeRepoFile("mmproj-F16.gguf", 128),
        ],
    )

    quants = manager.list_remote_quants("owner/model")

    by_quant = {item["quant"]: item for item in quants}
    assert by_quant["BF16"]["mmproj"] == {
        "filename": "mmproj-F16.gguf",
        "path": "mmproj-F16.gguf",
        "size_bytes": 128,
        "quant": "F16",
    }
    assert by_quant["F16"]["mmproj"]["path"] == "mmproj-F16.gguf"
    assert "mmproj" not in [item["filename"] for item in quants]


def test_download_manager_starts_selected_remote_quant(tmp_path):
    captured = {}

    def fake_popen(command, **kwargs):
        captured["command"] = command
        captured["kwargs"] = kwargs
        return FakeProcess()

    manager, store, _api = make_manager(tmp_path, popen=fake_popen)

    manager.start("owner/model", revision="main", include_file="nested/model-Q5_K_M.gguf", triggered_by="tester")

    assert captured["command"] == [
        "python-test",
        "-m",
        "huggingface_hub.cli.hf",
        "download",
        "owner/model",
        "--local-dir",
        str(tmp_path / "models" / "owner__model"),
        "--revision",
        "main",
        "--include",
        "nested/model-Q5_K_M.gguf",
    ]
    assert store.created[0]["command"].endswith("--include nested/model-Q5_K_M.gguf")


def test_download_manager_starts_selected_vision_quant_with_mmproj(tmp_path):
    captured = {}

    def fake_popen(command, **kwargs):
        captured["command"] = command
        return FakeProcess()

    manager, store, _api = make_manager(tmp_path, popen=fake_popen)

    manager.start(
        "owner/model",
        include_file="nested/model-Q5_K_M.gguf",
        mmproj_file="mmproj-F16.gguf",
        triggered_by="tester",
    )

    assert captured["command"][-4:] == ["--include", "nested/model-Q5_K_M.gguf", "--include", "mmproj-F16.gguf"]
    assert store.created[0]["command"].endswith("--include nested/model-Q5_K_M.gguf --include mmproj-F16.gguf")


def test_download_manager_records_selected_file_total_size(tmp_path):
    manager, store, _api = make_manager(
        tmp_path,
        files=[
            FakeRepoFile("nested/model-Q5_K_M.gguf", 2048),
            FakeRepoFile("nested/model-Q6_K.gguf", 4096),
        ],
    )

    started = manager.start("owner/model", include_file="nested/model-Q5_K_M.gguf", triggered_by="tester")

    assert store.created[0]["bytes_total"] == 2048
    assert started["bytes_total"] == 2048


def test_download_manager_records_provenance_for_selected_include_files(tmp_path):
    manager, store, _api = make_manager(
        tmp_path,
        files=[
            FakeRepoFile("nested/model-Q5_K_M.gguf", 2048),
        ],
    )

    manager.start(
        "owner/model",
        revision="main",
        include_file="nested/model-Q5_K_M.gguf",
        mmproj_file="mmproj-F16.gguf",
        triggered_by="tester",
    )

    assert store.created[0]["repo_id"] == "owner/model"
    assert store.created[0]["revision"] == "main"
    assert store.created[0]["local_path"] == str(tmp_path / "models" / "owner__model")
    assert "--include nested/model-Q5_K_M.gguf" in store.created[0]["command"]
    assert "--include mmproj-F16.gguf" in store.created[0]["command"]


def test_download_manager_uses_next_model_root_when_first_disk_is_full(tmp_path):
    first_root = tmp_path / "models-a"
    second_root = tmp_path / "models-b"
    first_root.mkdir()
    second_root.mkdir()
    GiB = 1024**3
    captured = {}

    def fake_popen(command, **kwargs):
        captured["command"] = command
        return FakeProcess()

    def fake_disk_usage(path: Path):
        if path == first_root:
            return (100 * GiB, 95 * GiB, 5 * GiB)
        if path == second_root:
            return (100 * GiB, 50 * GiB, 50 * GiB)
        raise AssertionError(f"Unexpected disk usage path: {path}")

    manager, store, _api = make_manager(
        tmp_path,
        files=[FakeRepoFile("nested/model-Q5_K_M.gguf", 8 * GiB)],
        popen=fake_popen,
        config_overrides={"hf_models_dirs": [str(first_root), str(second_root)]},
        disk_usage=fake_disk_usage,
    )

    manager.start("owner/model", include_file="nested/model-Q5_K_M.gguf", triggered_by="tester")

    assert store.created[0]["local_path"] == str(second_root / "owner__model")
    assert captured["command"][6] == str(second_root / "owner__model")


def test_download_manager_returns_no_space_when_no_model_root_qualifies(tmp_path):
    first_root = tmp_path / "models-a"
    second_root = tmp_path / "models-b"
    first_root.mkdir()
    second_root.mkdir()
    GiB = 1024**3

    def fake_disk_usage(path: Path):
        if path in {first_root, second_root}:
            return (100 * GiB, 95 * GiB, 5 * GiB)
        raise AssertionError(f"Unexpected disk usage path: {path}")

    manager, store, _api = make_manager(
        tmp_path,
        files=[FakeRepoFile("nested/model-Q5_K_M.gguf", 8 * GiB)],
        config_overrides={"hf_models_dirs": [str(first_root), str(second_root)]},
        disk_usage=fake_disk_usage,
    )

    with pytest.raises(ValueError, match="no space"):
        manager.start("owner/model", include_file="nested/model-Q5_K_M.gguf", triggered_by="tester")

    assert store.created == []


def test_download_manager_reports_running_progress_from_selected_quant_file(tmp_path):
    process = FakeProcess()
    manager, _store, _api = make_manager(
        tmp_path,
        files=[FakeRepoFile("nested/model-Q5_K_M.gguf", 2048)],
        popen=lambda *args, **kwargs: process,
    )
    started = manager.start("owner/model", include_file="nested/model-Q5_K_M.gguf", triggered_by="tester")
    destination = Path(str(started["local_path"]))
    (destination / "nested").mkdir(parents=True)
    (destination / "model-Q8_0.gguf").write_bytes(b"x" * 13_312)
    (destination / "nested" / "model-Q5_K_M.gguf").write_bytes(b"x" * 512)

    status = manager.status(str(started["id"]))

    assert status["bytes_downloaded"] == 512
    assert status["bytes_total"] == 2048
    assert status["progress_percent"] == 25


def test_download_manager_rejects_gated_repo_during_quant_discovery(tmp_path):
    manager, _store, api = make_manager(tmp_path)

    def raise_gated(*args, **kwargs):
        raise FakeHfError("gated", response=FakeResponse(401))

    api.list_repo_tree = raise_gated

    with pytest.raises(ValueError, match="requires a Hugging Face login or accepted license"):
        manager.list_remote_quants("owner/model")


def test_download_manager_rejects_gated_repo_before_start(tmp_path):
    manager, store, api = make_manager(tmp_path)

    def raise_gated(*args, **kwargs):
        raise FakeHfError("gated", response=FakeResponse(403))

    api.list_repo_tree = raise_gated

    with pytest.raises(ValueError, match="requires a Hugging Face login or accepted license"):
        manager.start("owner/model", include_file="nested/model-Q5_K_M.gguf")

    assert store.created == []


def test_download_manager_cancels_running_download(tmp_path):
    process = FakeProcess()
    manager, _store, _api = make_manager(tmp_path, popen=lambda *args, **kwargs: process)

    started = manager.start("owner/model", triggered_by="tester")
    cancelled = manager.cancel(str(started["id"]))

    assert process.terminated is True
    assert cancelled["status"] == "cancelled"
    assert cancelled["returncode"] == -15
    assert cancelled["error_detail"] == "Download cancelled by user"
    assert cancelled["finished_at"] is not None


def test_download_manager_registers_assets_on_successful_completion(tmp_path):
    config = load_config(
        {
            "mode": "agent",
            "hf_models_dirs": [str(tmp_path / "models")],
            "log_dir": str(tmp_path / "logs"),
            "python_bin": "python-test",
        }
    )
    downloads_db = tmp_path / "downloads.db"
    models_db = tmp_path / "models.db"
    prepare_downloads_db(downloads_db)
    prepare_models_db(models_db)
    download_store = ModelDownloadStoreOrm(db_path=downloads_db)
    asset_store = ModelAssetStoreOrm(db_path=models_db)
    inventory = ModelAssetInventoryService(config, asset_store, download_store=download_store)

    process = FakeProcess()
    manager = DownloadManager(
        config,
        download_store,
        popen=lambda *args, **kwargs: process,
        hf_api=FakeHfApi([FakeRepoFile("nested/model-Q5_K_M.gguf", 2048), FakeRepoFile("mmproj-F16.gguf", 128)]),
        inventory_service=inventory,
    )

    started = manager.start(
        "owner/model",
        revision="main",
        include_file="nested/model-Q5_K_M.gguf",
        mmproj_file="mmproj-F16.gguf",
        triggered_by="tester",
    )
    destination = Path(str(started["local_path"]))
    (destination / "nested").mkdir(parents=True)
    downloaded_model = destination / "nested" / "model-Q5_K_M.gguf"
    downloaded_mmproj = destination / "mmproj-F16.gguf"
    downloaded_model.write_bytes(b"x" * 2048)
    downloaded_mmproj.write_bytes(b"x" * 128)
    process.returncode = 0

    completed = manager.status(str(started["id"]))

    assert completed["status"] == "succeeded"
    model_asset = asset_store.get_asset_by_path(str(downloaded_model.resolve()))
    mmproj_asset = asset_store.get_asset_by_path(str(downloaded_mmproj.resolve()))
    assert model_asset is not None
    assert mmproj_asset is not None
    assert model_asset["download_id"] == str(started["id"])
    assert model_asset["source_repo_id"] == "owner/model"
    assert mmproj_asset["download_id"] == str(started["id"])


def test_download_manager_rejects_cancel_for_non_running_download(tmp_path):
    manager, _store, _api = make_manager(tmp_path)

    started = manager.start("owner/model", triggered_by="tester")
    manager.cancel(str(started["id"]))

    with pytest.raises(ValueError, match="Only running downloads can be cancelled"):
        manager.cancel(str(started["id"]))


def test_download_recommendations_fit_16gb_ram_and_8gb_vram():
    payload = recommend_downloads(
        {
            "platform": "Darwin",
            "architecture": "arm64",
            "ram": {"total": 16 * 1024**3, "available": 12 * 1024**3},
            "vram": [{"memory_total_mb": 8192, "memory_free_mb": 6144}],
        }
    )

    titles = [item["title"] for item in payload["recommendations"]]
    assert "Qwen3.5 4B" in titles
    assert "Gemma 4 E2B IT" in titles
    assert "Gemma 4 E4B IT" in titles
    assert "Qwen3.5 9B" in titles
    assert [item["title"] for item in payload["excluded"]] == [
        "Gemma 4 12B IT",
        "Qwen3.6 35B A3B",
    ]
    assert payload["machine"] == {"ram_gb": 16.0, "vram_gb": 8.0, "platform": "Darwin", "architecture": "arm64"}


def test_download_recommendations_include_14b_for_large_machine():
    payload = recommend_downloads(
        {
            "platform": "Linux",
            "architecture": "x86_64",
            "ram": {"total": 32 * 1024**3, "available": 28 * 1024**3},
            "vram": [{"memory_total_mb": 12288, "memory_free_mb": 10240}],
        }
    )

    assert "Qwen3.5 9B" in [item["title"] for item in payload["recommendations"]]
    assert [item["title"] for item in payload["excluded"]] == ["Qwen3.6 35B A3B"]


def test_download_recommendations_prefer_vram_fit_reason_when_gpu_memory_is_detected():
    payload = recommend_downloads(
        {
            "platform": "Linux",
            "architecture": "x86_64",
            "ram": {"total": 64 * 1024**3},
            "vram": [{"memory_total_mb": 24 * 1024}],
        }
    )

    qwen = next(item for item in payload["recommendations"] if item["title"] == "Qwen3.6 35B A3B")
    assert qwen["fit_reason"] == "Fits 24 GB VRAM with conservative GPU headroom."


def test_download_recommendations_report_apple_unified_memory_for_gpu_offload():
    payload = recommend_downloads(
        {
            "platform": "Darwin",
            "architecture": "arm64",
            "ram": {"total": 64 * 1024**3},
            "vram": None,
        }
    )

    qwen = next(item for item in payload["recommendations"] if item["title"] == "Qwen3.6 35B A3B")
    assert qwen["fit_reason"] == "Fits 64 GB Apple unified memory for GPU offload."


def test_download_recommendations_do_not_treat_intel_macos_ram_as_gpu_memory():
    payload = recommend_downloads(
        {
            "platform": "Darwin",
            "architecture": "x86_64",
            "ram": {"total": 64 * 1024**3},
            "vram": None,
        }
    )

    qwen = next(item for item in payload["recommendations"] if item["title"] == "Qwen3.6 35B A3B")
    assert qwen["fit_reason"] == "Fits 64 GB RAM, but GPU memory was not detected."


def test_download_recommendations_demote_large_models_without_gpu_memory():
    payload = recommend_downloads(
        {
            "platform": "Linux",
            "architecture": "x86_64",
            "ram": {"total": 64 * 1024**3},
            "vram": None,
        }
    )

    titles = [item["title"] for item in payload["recommendations"]]
    assert titles.index("Gemma 4 E2B IT") < titles.index("Qwen3.6 35B A3B")
    qwen = next(item for item in payload["recommendations"] if item["title"] == "Qwen3.6 35B A3B")
    assert qwen["fit_reason"] == "Fits 64 GB RAM, but GPU memory was not detected."


def test_download_recommendations_use_conservative_defaults_without_metrics():
    payload = recommend_downloads({"platform": "Unknown", "ram": None, "vram": None})

    assert [item["title"] for item in payload["recommendations"]] == [
        "Qwen3.5 4B",
        "Gemma 4 E2B IT",
        "Gemma 4 E4B IT",
    ]
    assert payload["machine"] == {"ram_gb": 0.0, "vram_gb": 0.0, "platform": "Unknown", "architecture": "unknown"}


def test_download_recommendations_tolerate_malformed_metrics():
    payload = recommend_downloads(
        {
            "platform": "Darwin",
            "architecture": "arm64",
            "ram": {"total": "not-a-number"},
            "vram": [{"memory_total_mb": "bad"}],
        }
    )

    assert payload["recommendations"]
    assert payload["machine"] == {"ram_gb": 0.0, "vram_gb": 0.0, "platform": "Darwin", "architecture": "arm64"}


class FakeHfModel:
    def __init__(self, model_id):
        self.id = model_id


class FakeRecommendationHfApi:
    def __init__(self):
        self.calls = []

    def list_models(self, **kwargs):
        self.calls.append({"list_models": kwargs})
        return [
            FakeHfModel("newco/Fresh-7B-Instruct-GGUF"),
            FakeHfModel("bartowski/Qwen2.5-7B-Instruct-GGUF"),
            FakeHfModel("bad/model-without-good-quant"),
        ]

    def list_repo_tree(self, repo_id, *, recursive=False, expand=False, revision=None, repo_type=None):
        self.calls.append({"repo_id": repo_id, "recursive": recursive, "expand": expand, "revision": revision, "repo_type": repo_type})
        files = {
            "newco/Fresh-7B-Instruct-GGUF": [
                FakeRepoFile("Fresh-7B-Instruct-Q8_0.gguf", 8 * 1024**3),
                FakeRepoFile("Fresh-7B-Instruct-Q4_K_M.gguf", 4_800_000_000),
            ],
            "bad/model-without-good-quant": [FakeRepoFile("README.md", 1)],
        }
        return files.get(repo_id, [])


class FakeMultimodalRecommendationHfApi:
    def __init__(self):
        self.calls = []

    def list_models(self, **kwargs):
        self.calls.append({"list_models": kwargs})
        return [
            FakeHfModel("newco/Fresh-Text-8B-Instruct-GGUF"),
            FakeHfModel("bad/Qwen2.5-VL-7B-Instruct-GGUF"),
            FakeHfModel("bad/llava-1.6-7b-GGUF"),
            FakeHfModel("bartowski/Qwen3-8B-Instruct-GGUF"),
        ]

    def list_repo_tree(self, repo_id, *, recursive=False, expand=False, revision=None, repo_type=None):
        self.calls.append({"repo_id": repo_id, "recursive": recursive, "expand": expand, "revision": revision, "repo_type": repo_type})
        files = {
            "newco/Fresh-Text-8B-Instruct-GGUF": [
                FakeRepoFile("Fresh-Text-8B-Instruct-Q4_K_M.gguf", 5_200_000_000),
            ],
            "bad/Qwen2.5-VL-7B-Instruct-GGUF": [
                FakeRepoFile("Qwen2.5-VL-7B-Instruct-Q4_K_M.gguf", 5_100_000_000),
                FakeRepoFile("mmproj-F16.gguf", 134_217_728),
            ],
            "bad/llava-1.6-7b-GGUF": [
                FakeRepoFile("llava-v1.6-7b-Q4_K_M.gguf", 4_900_000_000),
                FakeRepoFile("projector-f16.gguf", 100_000_000),
            ],
        }
        return files.get(repo_id, [])


def test_download_recommendations_include_hugging_face_discoveries_for_machine():
    api = FakeRecommendationHfApi()

    payload = recommend_downloads(
        {
            "platform": "Darwin",
            "architecture": "arm64",
            "ram": {"total": 16 * 1024**3},
            "vram": None,
        },
        hf_api=api,
    )

    fresh = next(item for item in payload["recommendations"] if item["repo_id"] == "newco/Fresh-7B-Instruct-GGUF")
    assert fresh["title"] == "Fresh 7B Instruct"
    assert fresh["include_file"] == "Fresh-7B-Instruct-Q4_K_M.gguf"
    assert fresh["quant"] == "Q4_K_M"
    assert fresh["source"] == "huggingface"
    assert "Hugging Face" in fresh["fit_label"]
    assert "bartowski/Qwen2.5-7B-Instruct-GGUF" not in [item["repo_id"] for item in payload["recommendations"] if item.get("source") == "huggingface"]
    assert any(call.get("list_models") for call in api.calls)


def test_download_recommendations_fall_back_when_hugging_face_discovery_fails():
    class FailingHfApi:
        def list_models(self, **kwargs):
            raise RuntimeError("offline")

    payload = recommend_downloads({"platform": "Darwin", "architecture": "arm64", "ram": {"total": 16 * 1024**3}}, hf_api=FailingHfApi())

    assert "Gemma 4 E4B IT" in [item["title"] for item in payload["recommendations"]]

def test_download_recommendations_include_multimodal_hugging_face_repos_with_mmproj():
    api = FakeMultimodalRecommendationHfApi()

    payload = recommend_downloads(
        {
            "platform": "Darwin",
            "architecture": "arm64",
            "ram": {"total": 16 * 1024**3},
            "vram": None,
        },
        hf_api=api,
    )

    repo_ids = [item["repo_id"] for item in payload["recommendations"]]
    assert "newco/Fresh-Text-8B-Instruct-GGUF" in repo_ids
    vision = next(item for item in payload["recommendations"] if item["repo_id"] == "bad/Qwen2.5-VL-7B-Instruct-GGUF")
    assert vision["vision"] is True
    assert vision["mmproj_file"] == "mmproj-F16.gguf"
    assert vision["use_case"] == "Vision-language GGUF model discovered from Hugging Face."
    assert "bad/llava-1.6-7b-GGUF" in repo_ids


def test_download_recommendations_ignore_mtp_and_prefer_ud_bitclass_over_mixed_precision():
    class MixedPrecisionRecommendationHfApi:
        def list_models(self, **kwargs):
            return [FakeHfModel("unsloth/Qwen3.6-35B-A3B-GGUF")]

        def list_repo_tree(self, repo_id, *, recursive=False, expand=False, revision=None, repo_type=None):
            assert repo_id == "unsloth/Qwen3.6-35B-A3B-GGUF"
            return [
                FakeRepoFile("BF16/Qwen3.6-35B-A3B-BF16-00001-of-00002.gguf", 50 * 1024**3),
                FakeRepoFile("MTP/Qwen3.6-35B-A3B-Q8_0-MTP.gguf", 98 * 1024**2),
                FakeRepoFile("Qwen3.6-35B-A3B-MXFP4_MOE.gguf", 21 * 1024**3),
                FakeRepoFile("Qwen3.6-35B-A3B-UD-Q4_K_M.gguf", 22 * 1024**3),
                FakeRepoFile("mmproj-F16.gguf", 900 * 1024**2),
            ]

    payload = recommend_downloads(
        {
            "platform": "Darwin",
            "architecture": "arm64",
            "ram": {"total": 64 * 1024**3},
            "vram": None,
        },
        hf_api=MixedPrecisionRecommendationHfApi(),
    )

    qwen = next(item for item in payload["recommendations"] if item["repo_id"] == "unsloth/Qwen3.6-35B-A3B-GGUF")
    assert qwen["include_file"] == "Qwen3.6-35B-A3B-UD-Q4_K_M.gguf"
    assert qwen["quant"] == "UD-Q4_K_M"
    assert qwen["supports_mtp"] is True
    assert qwen["draft_model_path"] == "MTP/Qwen3.6-35B-A3B-Q8_0-MTP.gguf"

def test_download_manager_caches_hugging_face_recommendations(tmp_path):
    api = FakeRecommendationHfApi()
    manager, _store, _unused_api = make_manager(tmp_path, hf_api=api)
    system = {"platform": "Darwin", "architecture": "arm64", "ram": {"total": 16 * 1024**3}}

    first = manager.recommendations(system)
    second = manager.recommendations(system)

    assert first == second
    assert len([call for call in api.calls if "list_models" in call]) == 1
