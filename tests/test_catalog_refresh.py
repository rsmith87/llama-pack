from __future__ import annotations

import json
from pathlib import Path

from llama_pack.core.model_assets import catalog_refresh
from llama_pack.core.model_assets import recommendations


class FakeRepoFile:
    def __init__(self, path: str, size: int):
        self.path = path
        self.size = size


class FakeHfModel:
    def __init__(self, model_id: str):
        self.id = model_id


class FakeHfApi:
    def __init__(self, models: list[FakeHfModel], trees: dict[str, list[FakeRepoFile]]):
        self._models = models
        self._trees = trees

    def list_models(self, **kwargs):
        return list(self._models)

    def list_repo_tree(self, repo_id, *, recursive=False, expand=False, revision=None, repo_type=None):
        return list(self._trees.get(repo_id, []))


def test_load_curated_catalog_reads_json_and_normalizes_entries(monkeypatch):
    raw = json.dumps(
        [
            {
                "repo_id": "owner/model-GGUF",
                "title": "Model",
                "include_file": "model-UD-Q4_K_M.gguf",
                "quant": "UD_Q4_K_M",
                "min_ram_gb": 12,
                "min_vram_gb": 6,
                "estimated_size_gb": 4.5,
                "fit_label": "Balanced",
                "use_case": "Test",
                "vision": True,
                "mmproj_file": "mmproj-F16.gguf",
            }
        ]
    )

    monkeypatch.setattr(recommendations, "_read_curated_catalog_text", lambda: raw)
    recommendations._load_curated_catalog.cache_clear()

    catalog = recommendations._load_curated_catalog()

    assert len(catalog) == 1
    assert catalog[0].repo_id == "owner/model-GGUF"
    assert catalog[0].quant == "UD-Q4_K_M"
    assert catalog[0].vision is True
    assert catalog[0].mmproj_file == "mmproj-F16.gguf"


def test_load_curated_catalog_falls_back_when_json_is_invalid(monkeypatch):
    monkeypatch.setattr(recommendations, "_read_curated_catalog_text", lambda: "{bad json")
    recommendations._load_curated_catalog.cache_clear()

    catalog = recommendations._load_curated_catalog()

    assert catalog
    assert any(item.repo_id == "unsloth/gemma-4-E2B-it-GGUF" for item in catalog)


def test_refresh_catalog_builds_proposal_and_reports_new_candidates():
    current_catalog = [
        recommendations.RecommendationCatalogItem(
            repo_id="unsloth/gemma-4-E2B-it-GGUF",
            title="Gemma 4 E2B IT",
            include_file="stale-Q4.gguf",
            quant="Q4_K_M",
            min_ram_gb=8,
            min_vram_gb=4,
            estimated_size_gb=2.9,
            fit_label="Compact multimodal",
            use_case="Current entry",
            vision=True,
            mmproj_file="old-mmproj.gguf",
        )
    ]
    hf_api = FakeHfApi(
        models=[
            FakeHfModel("unsloth/gemma-4-E2B-it-GGUF"),
            FakeHfModel("unsloth/gemma-4-12b-it-GGUF"),
            FakeHfModel("random/uncurated-model-GGUF"),
        ],
        trees={
            "unsloth/gemma-4-E2B-it-GGUF": [
                FakeRepoFile("gemma-4-E2B-it-Q4_K_M.gguf", 3_100_000_000),
                FakeRepoFile("mmproj-F16.gguf", 985_000_000),
            ],
            "unsloth/gemma-4-12b-it-GGUF": [
                FakeRepoFile("gemma-4-12b-it-Q4_K_M.gguf", 7_100_000_000),
                FakeRepoFile("mmproj-F16.gguf", 175_000_000),
            ],
            "random/uncurated-model-GGUF": [
                FakeRepoFile("uncurated-Q4_K_M.gguf", 2_000_000_000),
            ],
        },
    )

    result = catalog_refresh.refresh_catalog(current_catalog, hf_api=hf_api)

    assert len(result.proposed_catalog) == 1
    assert result.proposed_catalog[0].include_file == "gemma-4-E2B-it-Q4_K_M.gguf"
    assert result.proposed_catalog[0].mmproj_file == "mmproj-F16.gguf"
    assert result.updated_repo_ids == ["unsloth/gemma-4-E2B-it-GGUF"]
    assert [item.repo_id for item in result.candidate_additions] == ["unsloth/gemma-4-12b-it-GGUF"]


def test_catalog_refresh_main_writes_proposal_and_report(tmp_path: Path):
    catalog_path = tmp_path / "curated_catalog.json"
    proposal_path = tmp_path / "curated_catalog.proposed.json"
    report_path = tmp_path / "curated_catalog.report.md"
    catalog_path.write_text(
        json.dumps(
            [
                {
                    "repo_id": "unsloth/gemma-4-E2B-it-GGUF",
                    "title": "Gemma 4 E2B IT",
                    "include_file": "stale-Q4.gguf",
                    "quant": "Q4_K_M",
                    "min_ram_gb": 8,
                    "min_vram_gb": 4,
                    "estimated_size_gb": 2.9,
                    "fit_label": "Compact multimodal",
                    "use_case": "Current entry",
                    "vision": True,
                    "mmproj_file": "old-mmproj.gguf",
                }
            ]
        ),
        encoding="utf-8",
    )
    hf_api = FakeHfApi(
        models=[FakeHfModel("unsloth/gemma-4-E2B-it-GGUF")],
        trees={
            "unsloth/gemma-4-E2B-it-GGUF": [
                FakeRepoFile("gemma-4-E2B-it-Q4_K_M.gguf", 3_100_000_000),
                FakeRepoFile("mmproj-F16.gguf", 985_000_000),
            ]
        },
    )

    exit_code = catalog_refresh.main(
        [
            "--catalog-path",
            str(catalog_path),
            "--proposal-path",
            str(proposal_path),
            "--report-path",
            str(report_path),
        ],
        hf_api=hf_api,
    )

    assert exit_code == 0
    assert json.loads(catalog_path.read_text(encoding="utf-8"))[0]["include_file"] == "stale-Q4.gguf"
    assert json.loads(proposal_path.read_text(encoding="utf-8"))[0]["include_file"] == "gemma-4-E2B-it-Q4_K_M.gguf"
    report_text = report_path.read_text(encoding="utf-8")
    assert "Catalog refresh proposal" in report_text
    assert "unsloth/gemma-4-E2B-it-GGUF" in report_text
