from __future__ import annotations

import argparse
from dataclasses import dataclass
import json
from pathlib import Path
from typing import Any

from llama_pack.core.model_assets.recommendations import RecommendationCatalogItem
from llama_pack.core.model_assets.recommendations import _catalog_item_from_dict
from llama_pack.core.model_assets.recommendations import _catalog_item_from_hf_repo
from llama_pack.core.model_assets.recommendations import _catalog_item_to_dict


DEFAULT_TRUSTED_OWNERS = ("unsloth",)


@dataclass(frozen=True)
class CatalogRefreshResult:
    proposed_catalog: list[RecommendationCatalogItem]
    updated_repo_ids: list[str]
    candidate_additions: list[RecommendationCatalogItem]


def load_catalog_file(path: Path) -> list[RecommendationCatalogItem]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, list):
        raise ValueError(f"Catalog file must contain a list: {path}")
    return [_catalog_item_from_dict(item) for item in payload if isinstance(item, dict)]


def write_catalog_file(path: Path, catalog: list[RecommendationCatalogItem]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = [_catalog_item_to_dict(item) for item in catalog]
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def refresh_catalog(
    current_catalog: list[RecommendationCatalogItem],
    *,
    hf_api: Any,
    discovery_limit: int = 100,
    trusted_owners: tuple[str, ...] = DEFAULT_TRUSTED_OWNERS,
    max_candidate_additions: int = 10,
) -> CatalogRefreshResult:
    current_repo_ids = {item.repo_id for item in current_catalog}
    proposed_catalog: list[RecommendationCatalogItem] = []
    updated_repo_ids: list[str] = []

    for item in current_catalog:
        refreshed = _catalog_item_from_hf_repo(hf_api, item.repo_id)
        if refreshed is None:
            proposed_catalog.append(item)
            continue
        proposed_catalog.append(
            RecommendationCatalogItem(
                repo_id=refreshed.repo_id,
                title=refreshed.title,
                include_file=refreshed.include_file,
                quant=refreshed.quant,
                min_ram_gb=refreshed.min_ram_gb,
                min_vram_gb=refreshed.min_vram_gb,
                estimated_size_gb=refreshed.estimated_size_gb,
                fit_label=item.fit_label,
                use_case=item.use_case,
                source=item.source,
                vision=refreshed.vision or item.vision,
                mmproj_file=refreshed.mmproj_file or item.mmproj_file,
            )
        )
        if proposed_catalog[-1] != item:
            updated_repo_ids.append(item.repo_id)

    candidate_additions: list[RecommendationCatalogItem] = []
    for model in hf_api.list_models(search="GGUF", filter="gguf", sort="downloads", direction=-1, limit=discovery_limit):
        repo_id = str(getattr(model, "id", "") or getattr(model, "modelId", "") or "").strip()
        owner = repo_id.split("/", 1)[0] if "/" in repo_id else ""
        if repo_id in current_repo_ids or owner not in trusted_owners:
            continue
        candidate = _catalog_item_from_hf_repo(hf_api, repo_id)
        if candidate is None:
            continue
        candidate_additions.append(candidate)
        if len(candidate_additions) >= max_candidate_additions:
            break

    return CatalogRefreshResult(
        proposed_catalog=proposed_catalog,
        updated_repo_ids=sorted(updated_repo_ids),
        candidate_additions=candidate_additions,
    )


def build_report(result: CatalogRefreshResult, *, catalog_path: Path, proposal_path: Path) -> str:
    lines = [
        "# Catalog refresh proposal",
        "",
        f"- Current catalog: `{catalog_path}`",
        f"- Proposed catalog: `{proposal_path}`",
        f"- Updated existing entries: {len(result.updated_repo_ids)}",
        f"- New candidate additions: {len(result.candidate_additions)}",
        "",
    ]
    if result.updated_repo_ids:
        lines.append("## Updated entries")
        lines.append("")
        for repo_id in result.updated_repo_ids:
            lines.append(f"- `{repo_id}`")
        lines.append("")
    if result.candidate_additions:
        lines.append("## Candidate additions")
        lines.append("")
        for item in result.candidate_additions:
            lines.append(f"- `{item.repo_id}` -> `{item.include_file}` ({item.quant})")
        lines.append("")
    else:
        lines.append("## Candidate additions")
        lines.append("")
        lines.append("- None")
        lines.append("")
    return "\n".join(lines)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Refresh the curated GGUF catalog proposal from Hugging Face metadata.")
    parser.add_argument("--catalog-path", type=Path, required=True, help="Checked-in curated catalog JSON to read.")
    parser.add_argument("--proposal-path", type=Path, required=True, help="Where to write the proposed updated catalog JSON.")
    parser.add_argument("--report-path", type=Path, required=True, help="Where to write the markdown refresh report.")
    parser.add_argument("--apply", action="store_true", help="Overwrite the checked-in catalog path with the proposed catalog.")
    parser.add_argument("--discovery-limit", type=int, default=100, help="Maximum Hugging Face model search results to inspect.")
    parser.add_argument(
        "--trusted-owner",
        dest="trusted_owners",
        action="append",
        default=[],
        help="Trusted Hugging Face repo owner to consider for new catalog candidates. Can be repeated.",
    )
    return parser


def main(argv: list[str] | None = None, *, hf_api: Any | None = None) -> int:
    args = build_parser().parse_args(argv)
    current_catalog = load_catalog_file(args.catalog_path)
    if hf_api is None:
        from huggingface_hub import HfApi

        hf_api = HfApi()
    trusted_owners = tuple(args.trusted_owners or DEFAULT_TRUSTED_OWNERS)
    result = refresh_catalog(
        current_catalog,
        hf_api=hf_api,
        discovery_limit=max(1, int(args.discovery_limit)),
        trusted_owners=trusted_owners,
    )
    write_catalog_file(args.proposal_path, result.proposed_catalog)
    if args.apply:
        write_catalog_file(args.catalog_path, result.proposed_catalog)
    report = build_report(result, catalog_path=args.catalog_path, proposal_path=args.proposal_path)
    args.report_path.parent.mkdir(parents=True, exist_ok=True)
    args.report_path.write_text(report + "\n", encoding="utf-8")
    return 0
