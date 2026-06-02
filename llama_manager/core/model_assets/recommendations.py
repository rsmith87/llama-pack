from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import re
from typing import Any


BYTES_PER_GB = 1024**3
GGUF_QUANT_PATTERN = re.compile(
    r"(?:^|[-_.])(MXFP[0-9](?:_[A-Z0-9]+)*|IQ[0-9](?:_[A-Z0-9]+)+|Q[0-9](?:_[A-Z0-9]+)+|F16|BF16|F32)(?:[-_.]|$)",
    re.IGNORECASE,
)
QUANT_PRIORITY = {
    "Q4_K_M": 0,
    "Q5_K_M": 1,
    "Q4_K_S": 2,
    "IQ4_XS": 3,
    "Q3_K_L": 4,
}

DISALLOWED_FILE_TOKENS = (
    "mmproj",
    "projector",
)


def _normalized_tokens(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", value.lower()).strip()


def _is_supported_repo_id(repo_id: str) -> bool:
    return bool(_normalized_tokens(repo_id))


def _repo_tree_requires_multimodal_runtime(files: Any) -> bool:
    return False


def _is_supported_gguf_candidate(path: str) -> bool:
    lowered = path.lower()
    if not lowered.endswith(".gguf"):
        return False
    if any(token in Path(path).name.lower() for token in DISALLOWED_FILE_TOKENS):
        return False
    return _quant_from_path(path) is not None


@dataclass(frozen=True)
class RecommendationCatalogItem:
    repo_id: str
    title: str
    include_file: str
    quant: str
    min_ram_gb: float
    min_vram_gb: float | None
    estimated_size_gb: float
    fit_label: str
    use_case: str
    source: str = "curated"
    vision: bool = False
    mmproj_file: str | None = None


CATALOG: tuple[RecommendationCatalogItem, ...] = (
    RecommendationCatalogItem(
        repo_id="bartowski/Qwen3-4B-Instruct-GGUF",
        title="Qwen3 4B Instruct",
        include_file="Qwen3-4B-Instruct-Q4_K_M.gguf",
        quant="Q4_K_M",
        min_ram_gb=8,
        min_vram_gb=None,
        estimated_size_gb=3,
        fit_label="Small machine pick",
        use_case="Fast local chat/coding on lower-memory laptops.",
    ),
    RecommendationCatalogItem(
        repo_id="bartowski/Qwen3-8B-Instruct-GGUF",
        title="Qwen3 8B Instruct",
        include_file="Qwen3-8B-Instruct-Q4_K_M.gguf",
        quant="Q4_K_M",
        min_ram_gb=12,
        min_vram_gb=None,
        estimated_size_gb=5,
        fit_label="Balanced local chat",
        use_case="General local assistant workloads on 16 GB-class machines.",
    ),
    RecommendationCatalogItem(
        repo_id="bartowski/gemma-4-E2B-it-GGUF",
        title="Gemma 4 E2B IT",
        include_file="gemma-4-E2B-it-Q4_K_M.gguf",
        quant="Q4_K_M",
        min_ram_gb=12,
        min_vram_gb=None,
        estimated_size_gb=5,
        fit_label="Instruction-tuned alternative",
        use_case="Useful second opinion for text-only assistant tasks.",
    ),
    RecommendationCatalogItem(
        repo_id="bartowski/Qwen3-14B-Instruct-GGUF",
        title="Qwen3 14B Instruct",
        include_file="Qwen3-14B-Instruct-Q4_K_M.gguf",
        quant="Q4_K_M",
        min_ram_gb=24,
        min_vram_gb=12,
        estimated_size_gb=9,
        fit_label="Larger local model",
        use_case="Higher quality local chat on larger desktops and controllers.",
    ),
)


def recommend_downloads(system: dict[str, Any] | None, *, hf_api: Any | None = None) -> dict[str, object]:
    machine = _machine_from_system(system)
    ram_gb = float(machine["ram_gb"])
    vram_gb = float(machine["vram_gb"])
    unknown_capacity = ram_gb <= 0 and vram_gb <= 0
    catalog = _catalog_with_hugging_face_discoveries(hf_api)

    recommendations: list[dict[str, object]] = []
    excluded: list[dict[str, object]] = []
    for item in catalog:
        conservative_default = unknown_capacity and item.min_ram_gb <= 12
        fits = ram_gb >= item.min_ram_gb or (item.min_vram_gb is not None and vram_gb >= item.min_vram_gb) or conservative_default
        payload = _item_payload(
            item,
            score=_score(item, ram_gb, vram_gb, conservative_default=conservative_default) if fits else 0,
            fit_reason=_fit_reason(item, ram_gb, vram_gb, fits=fits, conservative_default=conservative_default),
        )
        if fits:
            recommendations.append(payload)
        else:
            excluded.append(payload)

    recommendations.sort(key=lambda entry: (int(entry["score"]), str(entry["title"])), reverse=True)
    return {"machine": machine, "recommendations": recommendations, "excluded": excluded}


def _catalog_with_hugging_face_discoveries(hf_api: Any | None) -> list[RecommendationCatalogItem]:
    catalog = list(CATALOG)
    catalog.extend(_hugging_face_catalog_items(hf_api, known_repo_ids={item.repo_id for item in catalog}))
    return catalog


def _hugging_face_catalog_items(hf_api: Any | None, *, known_repo_ids: set[str]) -> list[RecommendationCatalogItem]:
    if hf_api is None:
        return []
    try:
        models = hf_api.list_models(search="GGUF", filter="gguf", sort="downloads", direction=-1, limit=20)
    except Exception:
        return []

    discovered: list[RecommendationCatalogItem] = []
    discovered_repo_ids: set[str] = set()
    for model in models:
        repo_id = _model_id(model)
        if (
            not repo_id
            or not _is_supported_repo_id(repo_id)
            or repo_id in known_repo_ids
            or repo_id in discovered_repo_ids
        ):
            continue
        item = _catalog_item_from_hf_repo(hf_api, repo_id)
        if item is not None:
            discovered.append(item)
            discovered_repo_ids.add(repo_id)
    return discovered


def _catalog_item_from_hf_repo(hf_api: Any, repo_id: str) -> RecommendationCatalogItem | None:
    try:
        files = hf_api.list_repo_tree(repo_id, recursive=True, expand=True, repo_type="model")
    except Exception:
        return None
    quant_file = _best_gguf_file(files)
    if quant_file is None:
        return None
    mmproj_file = _best_mmproj_file(files)
    path = str(getattr(quant_file, "path", ""))
    quant = _quant_from_path(path) or "GGUF"
    size_bytes = getattr(quant_file, "size", None)
    size_gb = _number(size_bytes) / BYTES_PER_GB if size_bytes is not None else 0.0
    estimated_size_gb = round(size_gb, 1) if size_gb > 0 else 5.0
    min_ram_gb = max(6.0, round(estimated_size_gb * 2.2, 1))
    min_vram_gb = round(estimated_size_gb * 1.15, 1) if estimated_size_gb <= 12 else None
    title = _title_from_repo_id(repo_id)
    return RecommendationCatalogItem(
        repo_id=repo_id,
        title=title,
        include_file=path,
        quant=quant,
        min_ram_gb=min_ram_gb,
        min_vram_gb=min_vram_gb,
        estimated_size_gb=estimated_size_gb,
        fit_label="Hugging Face discovery",
        use_case="Vision-language GGUF model discovered from Hugging Face." if mmproj_file else "Popular GGUF model discovered from Hugging Face for this machine.",
        source="huggingface",
        vision=mmproj_file is not None,
        mmproj_file=str(getattr(mmproj_file, "path", "")) if mmproj_file else None,
    )


def _best_gguf_file(files: Any) -> Any | None:
    candidates = []
    for item in files or []:
        path = str(getattr(item, "path", ""))
        if not _is_supported_gguf_candidate(path):
            continue
        quant = _quant_from_path(path)
        priority = QUANT_PRIORITY.get(quant, 100)
        size = _number(getattr(item, "size", None))
        candidates.append((priority, abs(size - 5 * BYTES_PER_GB), item))
    if not candidates:
        return None
    return sorted(candidates, key=lambda candidate: (candidate[0], candidate[1]))[0][2]


def _best_mmproj_file(files: Any) -> Any | None:
    candidates = []
    for item in files or []:
        path = str(getattr(item, "path", ""))
        lowered = Path(path).name.lower()
        if not path.lower().endswith(".gguf") or not any(token in lowered for token in DISALLOWED_FILE_TOKENS):
            continue
        quant = _quant_from_path(path) or ""
        priority = 0 if quant == "F16" else 1 if quant == "BF16" else 2
        candidates.append((priority, -_number(getattr(item, "size", None)), item))
    if not candidates:
        return None
    return sorted(candidates, key=lambda candidate: (candidate[0], candidate[1]))[0][2]


def _quant_from_path(path: str) -> str | None:
    parts = [part for part in Path(path).parts if part]
    candidates = parts[:-1] + [Path(path).stem]
    for candidate in candidates:
        match = GGUF_QUANT_PATTERN.search(candidate)
        if match:
            return match.group(1).upper()
    return None


def _model_id(model: Any) -> str:
    repo_id = str(getattr(model, "id", "") or getattr(model, "modelId", "") or "").strip()
    return repo_id if "/" in repo_id else ""


def _title_from_repo_id(repo_id: str) -> str:
    name = repo_id.rsplit("/", 1)[-1]
    for suffix in ("-GGUF", "_GGUF", " GGUF"):
        if name.endswith(suffix):
            name = name[: -len(suffix)]
    return re.sub(r"[-_]+", " ", name).strip()


def _machine_from_system(system: dict[str, Any] | None) -> dict[str, object]:
    data = system if isinstance(system, dict) else {}
    ram = data.get("ram") if isinstance(data.get("ram"), dict) else {}
    platform = str(data.get("platform") or "unknown")
    return {
        "ram_gb": round(max(_gb_from_bytes(ram.get("total")), _number(data.get("memory_gb")), _number(data.get("ram_gb"))), 1),
        "vram_gb": round(max(_vram_total_gb(data.get("vram")), _number(data.get("vram_gb"))), 1),
        "platform": platform,
    }


def _vram_total_gb(value: Any) -> float:
    if not isinstance(value, list):
        return 0.0
    total_mb = 0.0
    for gpu in value:
        if isinstance(gpu, dict):
            total_mb += _number(gpu.get("memory_total_mb"))
    return total_mb / 1024


def _gb_from_bytes(value: Any) -> float:
    return _number(value) / BYTES_PER_GB


def _number(value: Any) -> float:
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        return 0.0
    return numeric if numeric > 0 else 0.0


def _score(item: RecommendationCatalogItem, ram_gb: float, vram_gb: float, *, conservative_default: bool) -> int:
    if conservative_default:
        return max(10, 70 - int(item.min_ram_gb))
    ram_headroom = max(0.0, ram_gb - item.min_ram_gb)
    vram_headroom = max(0.0, vram_gb - (item.min_vram_gb or item.estimated_size_gb))
    return min(100, int(60 + ram_headroom * 2 + vram_headroom * 3))


def _fit_reason(item: RecommendationCatalogItem, ram_gb: float, vram_gb: float, *, fits: bool, conservative_default: bool) -> str:
    if conservative_default:
        return "Conservative pick shown until hardware capacity is available."
    if fits and ram_gb >= item.min_ram_gb:
        return f"Fits {ram_gb:g} GB RAM with conservative headroom."
    if fits and item.min_vram_gb is not None and vram_gb >= item.min_vram_gb:
        return f"Fits {vram_gb:g} GB VRAM with conservative headroom."
    if item.min_vram_gb is None:
        return f"Needs at least {item.min_ram_gb:g} GB RAM."
    return f"Needs at least {item.min_ram_gb:g} GB RAM or {item.min_vram_gb:g} GB VRAM."


def _item_payload(item: RecommendationCatalogItem, *, score: int, fit_reason: str) -> dict[str, object]:
    return {
        "repo_id": item.repo_id,
        "title": item.title,
        "include_file": item.include_file,
        "quant": item.quant,
        "fit_label": item.fit_label,
        "use_case": item.use_case,
        "fit_reason": fit_reason,
        "score": score,
        "source": item.source,
        "vision": item.vision,
        "mmproj_file": item.mmproj_file,
    }
