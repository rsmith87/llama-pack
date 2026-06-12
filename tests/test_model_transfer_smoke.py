import importlib.util
from pathlib import Path

import pytest

from llama_pack.core.config import load_config


SCRIPT_PATH = Path(__file__).resolve().parents[1] / "scripts" / "model_transfer_smoke.py"


def load_smoke_module():
    spec = importlib.util.spec_from_file_location("model_transfer_smoke", SCRIPT_PATH)
    assert spec is not None
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def test_validate_transfer_agent_config_accepts_worker_enabled_agent():
    smoke = load_smoke_module()
    config = load_config(
        {
            "mode": "agent",
            "controller_url": "http://controller:9137",
            "node_name": "linux-2080ti",
            "agent_url": "http://linux:9137",
            "agent_api_key": "agent-key",
            "controller_registration_key_outbound": "join-key",
            "agent_worker_enabled": True,
        }
    )

    smoke.validate_transfer_agent_config(config, expected_node="linux-2080ti")


def test_validate_transfer_agent_config_requires_agent_worker():
    smoke = load_smoke_module()
    config = load_config(
        {
            "mode": "agent",
            "controller_url": "http://controller:9137",
            "node_name": "linux-2080ti",
            "agent_url": "http://linux:9137",
            "agent_api_key": "agent-key",
            "controller_registration_key_outbound": "join-key",
            "agent_worker_enabled": False,
        }
    )

    with pytest.raises(SystemExit) as exc:
        smoke.validate_transfer_agent_config(config, expected_node="linux-2080ti")

    assert "agent_worker_enabled must be true" in str(exc.value)


def test_select_source_file_accepts_exact_id_filename_and_path():
    smoke = load_smoke_module()
    files = [
        {
            "id": "abc123",
            "filename": "qwen.gguf",
            "path": "/models/Qwen/qwen.gguf",
        }
    ]

    assert smoke.select_source_file(files, "abc123")["filename"] == "qwen.gguf"
    assert smoke.select_source_file(files, "qwen.gguf")["id"] == "abc123"
    assert smoke.select_source_file(files, "/models/Qwen/qwen.gguf")["id"] == "abc123"


def test_select_source_file_rejects_ambiguous_filename():
    smoke = load_smoke_module()
    files = [
        {"id": "one", "filename": "model.gguf", "path": "/models/A/model.gguf"},
        {"id": "two", "filename": "model.gguf", "path": "/models/B/model.gguf"},
    ]

    with pytest.raises(smoke.SmokeCheckError, match="matches multiple GGUF files"):
        smoke.select_source_file(files, "model.gguf")


def test_verify_transfer_result_requires_selected_file_under_destination_root(tmp_path):
    smoke = load_smoke_module()
    destination_root = tmp_path / "dest"
    transfer = {
        "id": "transfer-123",
        "status": "completed",
        "error_code": None,
        "error_detail": None,
        "copied": [
            {"path": str(destination_root / "Qwen" / "qwen.gguf"), "status": "copied", "bytes": 4},
        ],
        "skipped": [],
    }

    selected = {"filename": "qwen.gguf"}
    copied_item = smoke.verify_transfer_result(
        transfer,
        destination_root=destination_root,
        selected_file=selected,
    )

    assert copied_item["path"] == str(destination_root / "Qwen" / "qwen.gguf")


def test_verify_transfer_result_rejects_selected_file_outside_destination_root(tmp_path):
    smoke = load_smoke_module()
    destination_root = tmp_path / "dest"
    transfer = {
        "id": "transfer-123",
        "status": "completed",
        "error_code": None,
        "error_detail": None,
        "copied": [{"path": str(tmp_path / "elsewhere" / "qwen.gguf"), "status": "copied", "bytes": 4}],
        "skipped": [],
    }

    with pytest.raises(smoke.SmokeCheckError, match="outside destination model root"):
        smoke.verify_transfer_result(
            transfer,
            destination_root=destination_root,
            selected_file={"filename": "qwen.gguf"},
        )
