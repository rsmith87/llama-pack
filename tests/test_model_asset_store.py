from __future__ import annotations

from pathlib import Path

import pytest

from llama_pack.core.persistence.alembic_config import (
    head_revision_for,
    parse_alembic_target,
    resolve_target_url,
    target_metadata_for,
    version_locations,
)
from llama_pack.core.persistence.db_infra import PersistenceUrls
from llama_pack.core.persistence.model_asset_store_orm import ModelAssetStoreOrm
from tests.persistence_db_setup import prepare_models_db


def test_parse_alembic_target_accepts_models():
    assert parse_alembic_target(["db=models"]) == "models"


def test_resolve_target_url_reads_models_entry():
    urls = PersistenceUrls(
        controller="sqlite+pysqlite:///tmp/controller.db",
        auth="sqlite+pysqlite:///tmp/auth.db",
        audit="sqlite+pysqlite:///tmp/audit.db",
        chat_sessions="sqlite+pysqlite:///tmp/chat.db",
        downloads="sqlite+pysqlite:///tmp/downloads.db",
        benchmarks="sqlite+pysqlite:///tmp/benchmarks.db",
        models="sqlite+pysqlite:///tmp/models.db",
    )

    assert resolve_target_url("models", urls) == "sqlite+pysqlite:///tmp/models.db"


def test_version_locations_include_models_target(tmp_path: Path):
    rendered = [str(path) for path in version_locations(tmp_path)]

    assert str(tmp_path / "migrations" / "versions" / "models") in rendered


def test_target_metadata_for_models_returns_only_models_tables():
    assert set(target_metadata_for("models").tables) == {
        "model_assets",
        "model_deployments",
        "model_profiles",
        "models",
    }


def test_head_revision_for_models_returns_branch_head():
    assert head_revision_for("models") == "models@head"


def test_model_asset_store_crud_and_model_linking(tmp_path: Path):
    db_path = tmp_path / "models.db"
    prepare_models_db(db_path)
    store = ModelAssetStoreOrm(db_path=db_path)

    created = store.upsert_asset(
        canonical_path="/models/qwen.gguf",
        filename="qwen.gguf",
        display_name="Qwen",
        size_bytes=1234,
        asset_kind="gguf",
        source_type="scanned",
        model_line="Qwen",
        download_id="download-1",
    )

    assert created["asset_id"]
    assert created["canonical_path"] == "/models/qwen.gguf"
    assert created["model_line"] == "Qwen"
    assert created["download_id"] == "download-1"
    assert created["missing"] is False

    updated = store.upsert_asset(
        canonical_path="/models/qwen.gguf",
        filename="qwen-renamed.gguf",
        display_name="Qwen 2",
        size_bytes=4321,
        asset_kind="gguf",
        source_type="downloaded",
        model_line="Coding",
    )

    assert updated["asset_id"] == created["asset_id"]
    assert updated["filename"] == "qwen-renamed.gguf"
    assert updated["display_name"] == "Qwen 2"
    assert updated["size_bytes"] == 4321
    assert updated["source_type"] == "downloaded"
    assert updated["model_line"] == "Coding"

    listed_assets = store.list_assets()
    assert [asset["asset_id"] for asset in listed_assets] == [created["asset_id"]]

    model = store.upsert_model(
        model_name="qwen-coder",
        asset_id=created["asset_id"],
        config_source="yaml",
        model_line="Coding",
        ctx=32768,
        gpu_layers=48,
        vision=False,
        mmproj=None,
        supports_json_schema=True,
        supports_grammar=True,
        supports_mtp=False,
        reasoning="auto",
        reasoning_budget=4096,
        prompt_template="chatml",
        favorite=True,
        strengths=["coding", "tool-use"],
        cost_tier="medium",
        extra_args=["--flash-attn"],
    )

    assert model["model_id"]
    assert model["asset_id"] == created["asset_id"]
    assert model["model_name"] == "qwen-coder"
    assert model["ctx"] == 32768
    assert model["gpu_layers"] == 48
    assert model["supports_json_schema"] is True
    assert model["prompt_template"] == "chatml"
    assert model["favorite"] is True
    assert model["strengths"] == ["coding", "tool-use"]
    assert model["extra_args"] == ["--flash-attn"]

    relinked = store.upsert_model(
        model_name="qwen-coder",
        asset_id=created["asset_id"],
        config_source="mixed",
        model_line="General",
        ctx=65536,
        gpu_layers=60,
        vision=True,
        mmproj="/models/mmproj.gguf",
        supports_json_schema=True,
        supports_grammar=False,
        supports_mtp=True,
        reasoning="on",
        reasoning_budget=8192,
        prompt_template="llama3",
        favorite=False,
        strengths=["reasoning"],
        cost_tier="high",
        extra_args=["--cont-batching"],
    )

    assert relinked["model_id"] == model["model_id"]
    assert relinked["config_source"] == "mixed"
    assert relinked["model_line"] == "General"
    assert relinked["ctx"] == 65536
    assert relinked["gpu_layers"] == 60
    assert relinked["vision"] is True
    assert relinked["mmproj"] == "/models/mmproj.gguf"
    assert relinked["supports_grammar"] is False
    assert relinked["supports_mtp"] is True
    assert relinked["reasoning"] == "on"
    assert relinked["reasoning_budget"] == 8192
    assert relinked["prompt_template"] == "llama3"
    assert relinked["favorite"] is False
    assert relinked["strengths"] == ["reasoning"]
    assert relinked["cost_tier"] == "high"
    assert relinked["extra_args"] == ["--cont-batching"]

    profile = store.upsert_model_profile(
        model_id=model["model_id"],
        profile_key="chat",
        label="Chat",
        order=10,
        kind="interactive",
        ctx=32768,
        gpu_layers=48,
        host="127.0.0.1",
        extra_args=["--flash-attn"],
        intended_ctx=24576,
        kv_cache_policy="dynamic",
        resource_tier="workstation",
        strengths=["coding"],
        cost_tier="medium",
    )

    assert profile["profile_id"]
    assert profile["model_id"] == model["model_id"]
    assert profile["profile_key"] == "chat"
    assert profile["host"] == "127.0.0.1"
    assert profile["strengths"] == ["coding"]

    deployment = store.upsert_model_deployment(
        model_id=model["model_id"],
        deployment_name="local-default",
        node_name="mac-studio",
        host="127.0.0.1",
        port=8080,
        ctx_override=40960,
        gpu_layers_override=50,
        mmproj_override="/models/mmproj.gguf",
        extra_args_override=["--threads", "12"],
        profile_key="chat",
        enabled=True,
    )

    assert deployment["deployment_id"]
    assert deployment["deployment_name"] == "local-default"
    assert deployment["node_name"] == "mac-studio"
    assert deployment["port"] == 8080
    assert deployment["profile_key"] == "chat"
    assert deployment["enabled"] is True

    listed_models = store.list_models()
    assert [entry["model_name"] for entry in listed_models] == ["qwen-coder"]
    listed_profiles = store.list_model_profiles(model["model_id"])
    assert [entry["profile_key"] for entry in listed_profiles] == ["chat"]
    listed_deployments = store.list_model_deployments(model["model_id"])
    assert [entry["deployment_name"] for entry in listed_deployments] == ["local-default"]

    marked_missing = store.mark_missing_assets(missing_asset_ids={created["asset_id"]})
    assert marked_missing == 1

    refreshed = store.get_asset(created["asset_id"])
    assert refreshed["missing"] is True


def test_model_asset_store_requires_models_schema(tmp_path: Path):
    with pytest.raises(RuntimeError, match="Run migrations first: alembic -x db=models upgrade models@head"):
        ModelAssetStoreOrm(db_path=tmp_path / "models.db")
