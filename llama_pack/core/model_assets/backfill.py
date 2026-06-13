from __future__ import annotations

import argparse
import json
from dataclasses import asdict, dataclass
from pathlib import Path

from llama_pack.core.config import load_config
from llama_pack.core.model_assets.library import GgufLibrary
from llama_pack.core.model_assets.models_db import ModelAssetInventoryService
from llama_pack.core.persistence.db_infra import resolve_persistence_urls
from llama_pack.core.persistence.model_asset_store_orm import ModelAssetStoreOrm
from llama_pack.core.persistence.model_download_store_orm import ModelDownloadStoreOrm


@dataclass(frozen=True)
class ModelsBackfillResult:
    scanned_files: int
    asset_rows: int
    model_rows: int
    profile_rows: int
    deployment_rows: int
    missing_asset_rows: int


def backfill_models_db(config_path: str | Path | None = None) -> ModelsBackfillResult:
    config = load_config(config_path)
    urls = resolve_persistence_urls(config)
    download_store = ModelDownloadStoreOrm(db_url=urls.downloads)
    model_store = ModelAssetStoreOrm(db_url=urls.models)
    inventory = ModelAssetInventoryService(config, model_store, download_store=download_store)
    library = GgufLibrary(config, inventory_service=inventory)

    files = library.list_files()
    assets = model_store.list_assets()
    models = model_store.list_models()
    profiles = []
    deployments = []
    for model in models:
        model_id = str(model["model_id"])
        profiles.extend(model_store.list_model_profiles(model_id))
        deployments.extend(model_store.list_model_deployments(model_id))

    return ModelsBackfillResult(
        scanned_files=len(files),
        asset_rows=len(assets),
        model_rows=len(models),
        profile_rows=len(profiles),
        deployment_rows=len(deployments),
        missing_asset_rows=sum(1 for asset in assets if bool(asset["missing"])),
    )


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Backfill the models DB from discovered GGUF files and YAML model config.")
    parser.add_argument("--config", default=None, help="Path to llama-pack config YAML")
    parser.add_argument("--json", action="store_true", help="Print the result as JSON")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    result = backfill_models_db(args.config)
    if args.json:
        print(json.dumps(asdict(result), indent=2))
    else:
        print("Models DB backfill complete")
        print(f"Scanned files      : {result.scanned_files}")
        print(f"Asset rows         : {result.asset_rows}")
        print(f"Model rows         : {result.model_rows}")
        print(f"Profile rows       : {result.profile_rows}")
        print(f"Deployment rows    : {result.deployment_rows}")
        print(f"Missing asset rows : {result.missing_asset_rows}")
    return 0
