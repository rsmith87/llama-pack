from pathlib import Path

import pytest

from llama_pack.core.config import load_config
from llama_pack.core.model_assets.models_db import ModelAssetInventoryService
from llama_pack.core.model_assets.quantizations import QuantizationManager
from llama_pack.core.persistence.model_asset_store_orm import ModelAssetStoreOrm
from tests.persistence_db_setup import prepare_models_db


class FakeProcess:
    def __init__(self, pid=9876):
        self.pid = pid
        self._returncode = None

    def poll(self):
        return self._returncode


class FinishedProcess(FakeProcess):
    def __init__(self, pid=9876, returncode=0):
        super().__init__(pid=pid)
        self._returncode = returncode


def make_quantize_binary(path: Path):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("", encoding="utf-8")
    path.chmod(0o755)


def test_quantization_manager_lists_gguf_sources(tmp_path):
    hf_dir = tmp_path / "HFModels"
    model_dir = hf_dir / "qwen"
    model_dir.mkdir(parents=True)
    source = model_dir / "qwen.gguf"
    source.write_bytes(b"1234")
    make_quantize_binary(tmp_path / "llama.cpp" / "build" / "bin" / "llama-quantize")

    manager = QuantizationManager(
        load_config(
            {
                "hf_models_dir": str(hf_dir),
                "llama_cpp_dir": str(tmp_path / "llama.cpp"),
                "log_dir": str(tmp_path / "logs"),
            }
        )
    )

    files = manager.list_files()

    assert files == [
        {
            "id": manager.file_id(source),
            "name": "qwen",
            "filename": "qwen.gguf",
            "model_dir": "qwen",
            "path": str(source),
            "size_bytes": 4,
            "size_gb": 0.0,
            "type": "Q4_K_M",
            "supported_types": ["Q4_K_M", "Q5_K_M", "Q8_0", "Q6_K", "Q3_K_M", "Q2_K"],
            "output_path": str(model_dir / "qwen-Q4_K_M.gguf"),
            "existing_outputs": [],
            "quantize_bin": str(tmp_path / "llama.cpp" / "build" / "bin" / "llama-quantize"),
            "running": False,
            "pid": None,
            "returncode": None,
            "log_path": str(tmp_path / "logs" / "quantizations" / f"{manager.file_id(source)}.log"),
        }
    ]


def test_quantization_manager_excludes_already_quantized_gguf_files(tmp_path):
    hf_dir = tmp_path / "HFModels"
    model_dir = hf_dir / "qwen"
    model_dir.mkdir(parents=True)
    source = model_dir / "qwen.gguf"
    source.write_bytes(b"1234")
    (model_dir / "qwen-Q4_K_M.gguf").write_bytes(b"1234")
    (model_dir / "qwen.IQ2_XS.gguf").write_bytes(b"1234")
    (model_dir / "qwen.Q8_0.gguf").write_bytes(b"1234")
    make_quantize_binary(tmp_path / "llama.cpp" / "build" / "bin" / "llama-quantize")

    manager = QuantizationManager(
        load_config(
            {
                "hf_models_dir": str(hf_dir),
                "llama_cpp_dir": str(tmp_path / "llama.cpp"),
                "log_dir": str(tmp_path / "logs"),
            }
        )
    )

    files = manager.list_files()

    assert [item["filename"] for item in files] == ["qwen.gguf"]


def test_quantization_manager_starts_quantize_job(tmp_path):
    spawned = []
    hf_dir = tmp_path / "HFModels"
    model_dir = hf_dir / "qwen"
    model_dir.mkdir(parents=True)
    source = model_dir / "qwen.gguf"
    source.write_bytes(b"1234")
    quantize_bin = tmp_path / "llama.cpp" / "build" / "bin" / "llama-quantize"
    make_quantize_binary(quantize_bin)

    def fake_popen(command, stdout, stderr, cwd):
        spawned.append((command, stdout, stderr, cwd))
        return FakeProcess()

    manager = QuantizationManager(
        load_config(
            {
                "hf_models_dir": str(hf_dir),
                "llama_cpp_dir": str(tmp_path / "llama.cpp"),
                "log_dir": str(tmp_path / "logs"),
            }
        ),
        popen=fake_popen,
    )

    status = manager.start(manager.file_id(source), "Q5_K_M")

    assert status["running"] is True
    assert status["pid"] == 9876
    assert status["output_path"] == str(model_dir / "qwen-Q5_K_M.gguf")
    assert spawned[0][0] == [
        str(quantize_bin),
        str(source),
        str(model_dir / "qwen-Q5_K_M.gguf"),
        "Q5_K_M",
    ]


def test_quantization_manager_falls_back_to_path_cli(tmp_path, monkeypatch):
    hf_dir = tmp_path / "HFModels"
    model_dir = hf_dir / "qwen"
    model_dir.mkdir(parents=True)
    source = model_dir / "qwen.gguf"
    source.write_bytes(b"1234")
    cli = tmp_path / "bin" / "llama-quantize"
    make_quantize_binary(cli)
    monkeypatch.setenv("PATH", str(cli.parent))

    manager = QuantizationManager(
        load_config(
            {
                "hf_models_dir": str(hf_dir),
                "llama_cpp_dir": str(tmp_path / "missing-llama.cpp"),
                "log_dir": str(tmp_path / "logs"),
            }
        )
    )

    assert manager.status(manager.file_id(source))["quantize_bin"] == str(cli)


def test_quantization_manager_finds_windows_release_quantize_binary(tmp_path, monkeypatch):
    monkeypatch.setenv("PATH", "")
    hf_dir = tmp_path / "HFModels"
    model_dir = hf_dir / "qwen"
    model_dir.mkdir(parents=True)
    source = model_dir / "qwen.gguf"
    source.write_bytes(b"1234")
    quantize_bin = tmp_path / "llama.cpp" / "build" / "bin" / "Release" / "llama-quantize.exe"
    make_quantize_binary(quantize_bin)

    manager = QuantizationManager(
        load_config(
            {
                "hf_models_dir": str(hf_dir),
                "llama_cpp_dir": str(tmp_path / "llama.cpp"),
                "log_dir": str(tmp_path / "logs"),
            }
        )
    )

    assert manager.status(manager.file_id(source))["quantize_bin"] == str(quantize_bin)


def test_quantization_manager_rejects_missing_binary(tmp_path, monkeypatch):
    monkeypatch.setenv("PATH", "")
    hf_dir = tmp_path / "HFModels"
    model_dir = hf_dir / "qwen"
    model_dir.mkdir(parents=True)
    source = model_dir / "qwen.gguf"
    source.write_bytes(b"1234")
    manager = QuantizationManager(
        load_config(
            {
                "hf_models_dir": str(hf_dir),
                "llama_cpp_dir": str(tmp_path / "llama.cpp"),
                "log_dir": str(tmp_path / "logs"),
            }
        )
    )

    with pytest.raises(ValueError, match="llama-quantize binary was not found"):
        manager.start(manager.file_id(source), "Q4_K_M")


def test_quantization_manager_tails_logs(tmp_path):
    hf_dir = tmp_path / "HFModels"
    model_dir = hf_dir / "qwen"
    model_dir.mkdir(parents=True)
    source = model_dir / "qwen.gguf"
    source.write_bytes(b"1234")
    manager = QuantizationManager(
        load_config(
            {
                "hf_models_dir": str(hf_dir),
                "llama_cpp_dir": str(tmp_path / "llama.cpp"),
                "log_dir": str(tmp_path / "logs"),
            }
        )
    )
    log_path = Path(manager.status(manager.file_id(source))["log_path"])
    log_path.parent.mkdir(parents=True, exist_ok=True)
    log_path.write_text("one\ntwo\nthree\n", encoding="utf-8")

    assert manager.tail_logs(manager.file_id(source), lines=2) == "two\nthree\n"


def test_quantization_manager_registers_output_asset_and_provenance_on_completion(tmp_path):
    hf_dir = tmp_path / "HFModels"
    model_dir = hf_dir / "qwen"
    model_dir.mkdir(parents=True)
    source = model_dir / "qwen.gguf"
    source.write_bytes(b"1234")
    output = model_dir / "qwen-Q5_K_M.gguf"
    output.write_bytes(b"5678")
    quantize_bin = tmp_path / "llama.cpp" / "build" / "bin" / "llama-quantize"
    make_quantize_binary(quantize_bin)

    db_path = tmp_path / "models.db"
    prepare_models_db(db_path)
    config = load_config(
        {
            "hf_models_dir": str(hf_dir),
            "llama_cpp_dir": str(tmp_path / "llama.cpp"),
            "log_dir": str(tmp_path / "logs"),
        }
    )
    store = ModelAssetStoreOrm(db_path=db_path)
    inventory = ModelAssetInventoryService(config, store)
    inventory.reconcile_scan([source])

    manager = QuantizationManager(
        config,
        inventory_service=inventory,
        popen=lambda *args, **kwargs: FinishedProcess(),
    )
    file_id = manager.file_id(source)
    manager._processes[file_id] = FinishedProcess()
    manager._job_types[file_id] = "Q5_K_M"

    status = manager.status(file_id)

    assert status["returncode"] == 0
    output_asset = store.get_asset_by_path(str(output.resolve()))
    assert output_asset is not None
    assert output_asset["source_type"] == "quantization"
    provenance_rows = store.list_asset_provenance(output_asset["asset_id"])
    assert len(provenance_rows) == 1
    assert provenance_rows[0]["job_kind"] == "quantization"
    assert provenance_rows[0]["source_asset_id"] == store.get_asset_by_path(str(source.resolve()))["asset_id"]
