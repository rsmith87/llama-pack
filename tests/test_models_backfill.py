from __future__ import annotations

import json
from pathlib import Path

from llama_pack.core.model_assets import backfill
from tests.persistence_db_setup import prepare_all_persistence_dbs


def test_backfill_models_db_populates_assets_models_profiles_and_deployments(tmp_path: Path):
    hf_dir = tmp_path / "HFModels"
    gguf_path = hf_dir / "Qwen" / "qwen.gguf"
    gguf_path.parent.mkdir(parents=True)
    gguf_path.write_bytes(b"hello")
    config_path = tmp_path / "config.yaml"
    config_path.write_text(
        f"""
mode: agent
log_dir: {tmp_path / "logs"}
hf_models_dir: {hf_dir}
models:
  qwen-local:
    path: {gguf_path}
    port: 8088
    ctx: 32768
    gpu_layers: 48
    host: 127.0.0.1
    profiles:
      default:
        label: Default
        order: 0
        kind: default
""",
        encoding="utf-8",
    )
    prepare_all_persistence_dbs(tmp_path)

    result = backfill.backfill_models_db(config_path)

    assert result.scanned_files == 1
    assert result.asset_rows == 1
    assert result.model_rows == 1
    assert result.profile_rows == 1
    assert result.deployment_rows == 1
    assert result.missing_asset_rows == 0


def test_backfill_main_prints_json_summary(tmp_path: Path, capsys):
    hf_dir = tmp_path / "HFModels"
    gguf_path = hf_dir / "Gemma" / "gemma.gguf"
    gguf_path.parent.mkdir(parents=True)
    gguf_path.write_bytes(b"hello")
    config_path = tmp_path / "config.yaml"
    config_path.write_text(
        f"""
mode: agent
log_dir: {tmp_path / "logs"}
hf_models_dir: {hf_dir}
""",
        encoding="utf-8",
    )
    prepare_all_persistence_dbs(tmp_path)

    exit_code = backfill.main(["--config", str(config_path), "--json"])

    assert exit_code == 0
    payload = json.loads(capsys.readouterr().out)
    assert payload["scanned_files"] == 1
    assert payload["asset_rows"] == 1
    assert payload["model_rows"] == 0
