from __future__ import annotations

from pathlib import Path

import pytest
from sqlalchemy import create_engine, inspect

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
        "model_asset_provenance",
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


def test_upsert_model_persists_mmproj_and_mtp_links(tmp_path: Path):
    db_path = tmp_path / "models.db"
    prepare_models_db(db_path)
    store = ModelAssetStoreOrm(db_path=db_path)

    base = store.upsert_asset(
        canonical_path="/models/base.gguf",
        filename="base.gguf",
        display_name="Base",
        size_bytes=10,
        asset_kind="gguf",
        source_type="manual",
    )
    mmproj = store.upsert_asset(
        canonical_path="/models/base-mmproj.gguf",
        filename="base-mmproj.gguf",
        display_name="Base mmproj",
        size_bytes=5,
        asset_kind="mmproj",
        source_type="download",
    )
    draft_asset = store.upsert_asset(
        canonical_path="/models/base-draft.gguf",
        filename="base-draft.gguf",
        display_name="Base Draft",
        size_bytes=8,
        asset_kind="gguf",
        source_type="manual",
    )
    draft_model = store.upsert_model(
        model_name="base-draft",
        asset_id=draft_asset["asset_id"],
        config_source="db",
        supports_mtp=False,
    )

    model = store.upsert_model(
        model_name="base",
        asset_id=base["asset_id"],
        config_source="db",
        mmproj_asset_id=mmproj["asset_id"],
        mtp_draft_asset_id=draft_asset["asset_id"],
        mtp_draft_model_id=draft_model["model_id"],
        supports_mtp=True,
    )

    assert model["mmproj_asset_id"] == mmproj["asset_id"]
    assert model["mtp_draft_asset_id"] == draft_asset["asset_id"]
    assert model["mtp_draft_model_id"] == draft_model["model_id"]

    linked = store.get_model_companion_links(model["model_id"])
    assert linked == {
        "model_id": model["model_id"],
        "mmproj_asset_id": mmproj["asset_id"],
        "mtp_draft_asset_id": draft_asset["asset_id"],
        "mtp_draft_model_id": draft_model["model_id"],
    }


def test_record_asset_provenance_persists_and_lists_rows(tmp_path: Path):
    db_path = tmp_path / "models.db"
    prepare_models_db(db_path)
    store = ModelAssetStoreOrm(db_path=db_path)

    source = store.upsert_asset(
        canonical_path="/models/source.gguf",
        filename="source.gguf",
        display_name="Source",
        size_bytes=12,
        asset_kind="gguf",
        source_type="manual",
    )
    output = store.upsert_asset(
        canonical_path="/models/output-q4.gguf",
        filename="output-q4.gguf",
        display_name="Output Q4",
        size_bytes=9,
        asset_kind="gguf",
        source_type="quantization",
    )
    source_model = store.upsert_model(
        model_name="source-model",
        asset_id=source["asset_id"],
        config_source="db",
    )

    recorded = store.record_asset_provenance(
        output_asset_id=output["asset_id"],
        source_asset_id=source["asset_id"],
        source_model_id=source_model["model_id"],
        job_kind="quantization",
        job_ref="job-123",
        detail={"preset": "q4_k_m"},
    )

    assert recorded["output_asset_id"] == output["asset_id"]
    assert recorded["source_asset_id"] == source["asset_id"]
    assert recorded["source_model_id"] == source_model["model_id"]
    assert recorded["job_kind"] == "quantization"
    assert recorded["job_ref"] == "job-123"
    assert recorded["detail"] == {"preset": "q4_k_m"}

    rows = store.list_asset_provenance(output["asset_id"])
    assert rows == [recorded]


def test_update_model_companion_links_is_patch_safe(tmp_path: Path):
    db_path = tmp_path / "models.db"
    prepare_models_db(db_path)
    store = ModelAssetStoreOrm(db_path=db_path)

    base = store.upsert_asset(
        canonical_path="/models/base.gguf",
        filename="base.gguf",
        display_name="Base",
        size_bytes=10,
        asset_kind="gguf",
        source_type="manual",
    )
    mmproj = store.upsert_asset(
        canonical_path="/models/base-mmproj.gguf",
        filename="base-mmproj.gguf",
        display_name="Base mmproj",
        size_bytes=5,
        asset_kind="mmproj",
        source_type="download",
    )
    draft_asset = store.upsert_asset(
        canonical_path="/models/base-draft.gguf",
        filename="base-draft.gguf",
        display_name="Base Draft",
        size_bytes=8,
        asset_kind="gguf",
        source_type="manual",
    )
    model = store.upsert_model(
        model_name="base",
        asset_id=base["asset_id"],
        config_source="db",
        mmproj_asset_id=mmproj["asset_id"],
    )

    updated = store.update_model_companion_links(
        model["model_id"],
        mtp_draft_asset_id=draft_asset["asset_id"],
    )

    assert updated["mmproj_asset_id"] == mmproj["asset_id"]
    assert updated["mtp_draft_asset_id"] == draft_asset["asset_id"]


def test_companion_and_provenance_links_reject_unknown_ids(tmp_path: Path):
    db_path = tmp_path / "models.db"
    prepare_models_db(db_path)
    store = ModelAssetStoreOrm(db_path=db_path)

    base = store.upsert_asset(
        canonical_path="/models/base.gguf",
        filename="base.gguf",
        display_name="Base",
        size_bytes=10,
        asset_kind="gguf",
        source_type="manual",
    )
    model = store.upsert_model(
        model_name="base",
        asset_id=base["asset_id"],
        config_source="db",
    )

    with pytest.raises(KeyError, match="Unknown asset id for mmproj_asset_id"):
        store.update_model_companion_links(model["model_id"], mmproj_asset_id="missing-asset")

    with pytest.raises(KeyError, match="Unknown asset id for output_asset_id"):
        store.record_asset_provenance(
            output_asset_id="missing-output",
            source_asset_id=None,
            source_model_id=None,
            job_kind="download",
            job_ref="job-1",
            detail={},
        )


def test_models_alembic_upgrade_creates_catalog_expansion_schema(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    from argparse import Namespace
    from alembic import command
    from alembic.config import Config

    config_path = tmp_path / "config.yaml"
    db_path = tmp_path / "models.db"
    config_path.write_text(
        "\n".join(
            [
                f"log_dir: {tmp_path / 'logs'}",
                f"models_db_url: sqlite+pysqlite:///{db_path}",
            ]
        ),
        encoding="utf-8",
    )
    monkeypatch.setenv("LLAMA_PACK_CONFIG", str(config_path))

    alembic_cfg = Config("alembic.ini")
    alembic_cfg.cmd_opts = Namespace(x=["db=models"])
    command.upgrade(alembic_cfg, "models@head")

    engine = create_engine(f"sqlite+pysqlite:///{db_path}")
    inspector = inspect(engine)
    try:
        assert "model_asset_provenance" in inspector.get_table_names()
        model_columns = {column["name"] for column in inspector.get_columns("models")}
        assert {"mmproj_asset_id", "mtp_draft_asset_id", "mtp_draft_model_id"} <= model_columns
    finally:
        engine.dispose()
