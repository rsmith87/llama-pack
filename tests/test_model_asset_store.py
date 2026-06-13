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
    assert set(target_metadata_for("models").tables) == {"model_assets", "models"}


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
    )

    assert model["model_id"]
    assert model["asset_id"] == created["asset_id"]
    assert model["model_name"] == "qwen-coder"

    relinked = store.upsert_model(
        model_name="qwen-coder",
        asset_id=created["asset_id"],
        config_source="mixed",
        model_line="General",
    )

    assert relinked["model_id"] == model["model_id"]
    assert relinked["config_source"] == "mixed"
    assert relinked["model_line"] == "General"

    listed_models = store.list_models()
    assert [entry["model_name"] for entry in listed_models] == ["qwen-coder"]

    marked_missing = store.mark_missing_assets(missing_asset_ids={created["asset_id"]})
    assert marked_missing == 1

    refreshed = store.get_asset(created["asset_id"])
    assert refreshed["missing"] is True


def test_model_asset_store_requires_models_schema(tmp_path: Path):
    with pytest.raises(RuntimeError, match="Run migrations first: alembic -x db=models upgrade models@head"):
        ModelAssetStoreOrm(db_path=tmp_path / "models.db")
