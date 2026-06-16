#!/usr/bin/env python3
"""Backfill capacity_ctx for existing registered models.

For each model that has a GGUF file on disk but no capacity_ctx value stored,
this script reads the GGUF metadata header and populates the column.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

# Ensure the repo root is on sys.path so llama_pack is importable.
_REPO_ROOT = Path(__file__).resolve().parent.parent
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Backfill capacity_ctx for registered models.")
    parser.add_argument("--db", default=None, help="Path to models DB file (default: logs/models.db)")
    args = parser.parse_args(argv)

    from llama_pack.core.model_assets.gguf_metadata import read_gguf_context_length
    from llama_pack.core.persistence.model_asset_store_orm import ModelAssetStoreOrm

    db_path = Path(args.db) if args.db else _REPO_ROOT / "logs" / "models.db"
    if not db_path.exists():
        print(f"Database not found: {db_path}", file=sys.stderr)
        return 1

    store = ModelAssetStoreOrm(db_path=db_path)
    models = store.list_models()
    updated = 0
    skipped = 0
    failed = 0

    for model in models:
        name = str(model["model_name"])
        capacity = model.get("capacity_ctx")
        if capacity is not None:
            skipped += 1
            continue

        # Find the GGUF file path via the asset
        asset_id = model.get("asset_id")
        if not asset_id:
            print(f"  {name}: no asset, skipping")
            skipped += 1
            continue

        try:
            asset = store.get_asset(str(asset_id))
        except KeyError:
            print(f"  {name}: asset not found, skipping")
            skipped += 1
            continue

        gguf_path = Path(asset["canonical_path"])
        if not gguf_path.exists():
            print(f"  {name}: file not found ({gguf_path}), skipping")
            skipped += 1
            continue

        ctx_len = read_gguf_context_length(gguf_path)
        if ctx_len is None:
            print(f"  {name}: no context_length in metadata, skipping")
            skipped += 1
            continue

        # Update the model row directly via the store.
        # Re-use upsert_model with capacity_ctx set.
        store.upsert_model(
            model_name=name,
            asset_id=model.get("asset_id"),
            config_source=str(model.get("config_source") or "db"),
            model_line=model.get("model_line"),
            ctx=model.get("ctx"),
            capacity_ctx=ctx_len,
            gpu_layers=model.get("gpu_layers"),
            vision=bool(model.get("vision")),
            mmproj=model.get("mmproj"),
            mmproj_asset_id=model.get("mmproj_asset_id"),
            mtp_draft_asset_id=model.get("mtp_draft_asset_id"),
            mtp_draft_model_id=model.get("mtp_draft_model_id"),
            supports_json_schema=model.get("supports_json_schema"),
            supports_grammar=model.get("supports_grammar"),
            supports_mtp=model.get("supports_mtp"),
            reasoning=model.get("reasoning"),
            reasoning_budget=model.get("reasoning_budget"),
            prompt_template=model.get("prompt_template"),
            favorite=bool(model.get("favorite")),
            strengths=list(model.get("strengths") or []),
            cost_tier=model.get("cost_tier"),
            extra_args=list(model.get("extra_args") or []),
        )
        print(f"  {name}: capacity_ctx={ctx_len}")
        updated += 1

    print(f"\nDone. Updated: {updated}, Skipped: {skipped}, Failed: {failed}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())