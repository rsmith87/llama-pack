from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
import json
from importlib import resources
from pathlib import Path
import re
from typing import Any


BYTES_PER_GB = 1024**3
GGUF_QUANT_PATTERN = re.compile(
    r"(?:^|[-_.])((?:UD[-_.])?(?:MXFP[0-9](?:_[A-Z0-9]+)*|IQ[0-9](?:_[A-Z0-9]+)+|Q[0-9](?:_[A-Z0-9]+)+|F16|BF16|F32))(?:[-_.]|$)",
    re.IGNORECASE,
)
PORTABLE_QUANT_PRIORITY = {
    "Q4_K_M": 0,
    "Q5_K_M": 1,
    "Q4_K_S": 2,
    "IQ4_XS": 3,
    "Q3_K_L": 4,
    "IQ4_NL": 5,
    "Q6_K": 6,
    "Q8_0": 7,
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
    if _is_mtp_artifact(path):
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
    supports_mtp: bool = False
    draft_model_path: str | None = None


FALLBACK_CATALOG: tuple[RecommendationCatalogItem, ...] = (
    RecommendationCatalogItem(
        repo_id="unsloth/gemma-4-E2B-it-GGUF",
        title="Gemma 4 E2B IT",
        include_file="gemma-4-E2B-it-Q4_K_M.gguf",
        quant="Q4_K_M",
        min_ram_gb=8,
        min_vram_gb=4,
        estimated_size_gb=2.9,
        fit_label="Compact multimodal",
        use_case="Small Gemma 4 vision/audio-capable model for laptops and light local assistants.",
        vision=True,
        mmproj_file="mmproj-F16.gguf",
    ),
    RecommendationCatalogItem(
        repo_id="unsloth/Qwen3.5-4B-GGUF",
        title="Qwen3.5 4B",
        include_file="Qwen3.5-4B-Q4_K_M.gguf",
        quant="Q4_K_M",
        min_ram_gb=8,
        min_vram_gb=4,
        estimated_size_gb=2.6,
        fit_label="Portable Qwen pick",
        use_case="Compact multimodal Qwen release with broad GGUF compatibility and low memory cost.",
        vision=True,
        mmproj_file="mmproj-F16.gguf",
    ),
    RecommendationCatalogItem(
        repo_id="unsloth/gemma-4-E4B-it-GGUF",
        title="Gemma 4 E4B IT",
        include_file="gemma-4-E4B-it-Q4_K_M.gguf",
        quant="Q4_K_M",
        min_ram_gb=12,
        min_vram_gb=6,
        estimated_size_gb=4.6,
        fit_label="Balanced multimodal",
        use_case="General-purpose Gemma 4 release with better headroom for image and audio tasks.",
        vision=True,
        mmproj_file="mmproj-F16.gguf",
    ),
    RecommendationCatalogItem(
        repo_id="unsloth/Qwen3.5-9B-GGUF",
        title="Qwen3.5 9B",
        include_file="Qwen3.5-9B-Q4_K_M.gguf",
        quant="Q4_K_M",
        min_ram_gb=16,
        min_vram_gb=8,
        estimated_size_gb=5.3,
        fit_label="Higher-context Qwen",
        use_case="Stronger multimodal Qwen option for desktops that can hold a 9B-class model comfortably.",
        vision=True,
        mmproj_file="mmproj-F16.gguf",
    ),
    RecommendationCatalogItem(
        repo_id="unsloth/gemma-4-12b-it-GGUF",
        title="Gemma 4 12B IT",
        include_file="gemma-4-12b-it-Q4_K_M.gguf",
        quant="Q4_K_M",
        min_ram_gb=24,
        min_vram_gb=10,
        estimated_size_gb=6.6,
        fit_label="Desktop-class Gemma",
        use_case="Larger Gemma 4 multimodal model for workstation-class local inference.",
        vision=True,
        mmproj_file="mmproj-F16.gguf",
    ),
    RecommendationCatalogItem(
        repo_id="unsloth/Qwen3.6-35B-A3B-GGUF",
        title="Qwen3.6 35B A3B",
        include_file="Qwen3.6-35B-A3B-UD-Q4_K_M.gguf",
        quant="UD-Q4_K_M",
        min_ram_gb=48,
        min_vram_gb=24,
        estimated_size_gb=20.6,
        fit_label="Large MoE workstation",
        use_case="Current large Qwen 3.6 MoE release for high-end Apple Silicon or workstation GPUs.",
        vision=True,
        mmproj_file="mmproj-F16.gguf",
    ),
)


def recommend_downloads(system: dict[str, Any] | None, *, hf_api: Any | None = None) -> dict[str, object]:
    machine = _machine_from_system(system)
    ram_gb = float(machine["ram_gb"])
    vram_gb = float(machine["vram_gb"])
    gpu_memory_gb = _gpu_fit_memory_gb(machine)
    unknown_capacity = ram_gb <= 0 and vram_gb <= 0
    catalog = _catalog_with_hugging_face_discoveries(hf_api)

    recommendations: list[dict[str, object]] = []
    excluded: list[dict[str, object]] = []
    for item in catalog:
        conservative_default = unknown_capacity and item.min_ram_gb <= 12
        fits = (
            (item.min_vram_gb is not None and gpu_memory_gb >= item.min_vram_gb)
            or ram_gb >= item.min_ram_gb
            or conservative_default
        )
        payload = _item_payload(
            item,
            score=_score(item, ram_gb, gpu_memory_gb, conservative_default=conservative_default) if fits else 0,
            fit_reason=_fit_reason(item, ram_gb, gpu_memory_gb, machine, fits=fits, conservative_default=conservative_default),
        )
        if fits:
            recommendations.append(payload)
        else:
            excluded.append(payload)

    recommendations.sort(key=lambda entry: (int(entry["score"]), str(entry["title"])), reverse=True)
    return {"machine": machine, "recommendations": recommendations, "excluded": excluded}


def _catalog_with_hugging_face_discoveries(hf_api: Any | None) -> list[RecommendationCatalogItem]:
    catalog = list(_load_curated_catalog())
    discoveries = _hugging_face_catalog_items(hf_api, known_repo_ids={item.repo_id for item in catalog})
    if not discoveries:
        return catalog
    discovered_by_repo = {item.repo_id: item for item in discoveries}
    merged: list[RecommendationCatalogItem] = []
    for item in catalog:
        discovered = discovered_by_repo.pop(item.repo_id, None)
        if discovered is None:
            merged.append(item)
            continue
        merged.append(
            RecommendationCatalogItem(
                repo_id=item.repo_id,
                title=item.title,
                include_file=item.include_file,
                quant=item.quant,
                min_ram_gb=item.min_ram_gb,
                min_vram_gb=item.min_vram_gb,
                estimated_size_gb=item.estimated_size_gb,
                fit_label=item.fit_label,
                use_case=item.use_case,
                source=item.source,
                vision=item.vision or discovered.vision,
                mmproj_file=item.mmproj_file or discovered.mmproj_file,
                supports_mtp=item.supports_mtp or discovered.supports_mtp,
                draft_model_path=item.draft_model_path or discovered.draft_model_path,
            )
        )
    merged.extend(discovered_by_repo.values())
    return merged


def _catalog_item_from_dict(raw: dict[str, Any]) -> RecommendationCatalogItem:
    quant = re.sub(r"^UD[._]", "UD-", str(raw["quant"]).upper())
    min_vram_gb = raw.get("min_vram_gb")
    return RecommendationCatalogItem(
        repo_id=str(raw["repo_id"]),
        title=str(raw["title"]),
        include_file=str(raw["include_file"]),
        quant=quant,
        min_ram_gb=float(raw["min_ram_gb"]),
        min_vram_gb=float(min_vram_gb) if min_vram_gb is not None else None,
        estimated_size_gb=float(raw["estimated_size_gb"]),
        fit_label=str(raw["fit_label"]),
        use_case=str(raw["use_case"]),
        source=str(raw.get("source") or "curated"),
        vision=bool(raw.get("vision", False)),
        mmproj_file=str(raw["mmproj_file"]) if raw.get("mmproj_file") else None,
        supports_mtp=bool(raw.get("supports_mtp", False)),
        draft_model_path=str(raw["draft_model_path"]) if raw.get("draft_model_path") else None,
    )


def _catalog_item_to_dict(item: RecommendationCatalogItem) -> dict[str, object]:
    payload: dict[str, object] = {
        "repo_id": item.repo_id,
        "title": item.title,
        "include_file": item.include_file,
        "quant": item.quant,
        "min_ram_gb": item.min_ram_gb,
        "min_vram_gb": item.min_vram_gb,
        "estimated_size_gb": item.estimated_size_gb,
        "fit_label": item.fit_label,
        "use_case": item.use_case,
        "source": item.source,
        "vision": item.vision,
    }
    if item.mmproj_file:
        payload["mmproj_file"] = item.mmproj_file
    if item.supports_mtp:
        payload["supports_mtp"] = True
    if item.draft_model_path:
        payload["draft_model_path"] = item.draft_model_path
    return payload


def _read_curated_catalog_text() -> str:
    return resources.files("llama_pack.core.model_assets").joinpath("curated_catalog.json").read_text(encoding="utf-8")


@lru_cache(maxsize=1)
def _load_curated_catalog() -> tuple[RecommendationCatalogItem, ...]:
    try:
        payload = json.loads(_read_curated_catalog_text())
        if not isinstance(payload, list) or not payload:
            raise ValueError("catalog payload must be a non-empty list")
        return tuple(_catalog_item_from_dict(item) for item in payload if isinstance(item, dict))
    except Exception:
        return FALLBACK_CATALOG


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
    mtp_file = _best_mtp_file(files)
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
        supports_mtp=mtp_file is not None,
        draft_model_path=str(getattr(mtp_file, "path", "")) if mtp_file else None,
    )


def _best_gguf_file(files: Any) -> Any | None:
    candidates = []
    for item in files or []:
        path = str(getattr(item, "path", ""))
        if not _is_supported_gguf_candidate(path):
            continue
        quant = _quant_from_path(path) or ""
        priority = _quant_priority(quant, path)
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


def _best_mtp_file(files: Any) -> Any | None:
    candidates = []
    for item in files or []:
        path = str(getattr(item, "path", ""))
        if not path.lower().endswith(".gguf") or not _is_mtp_artifact(path):
            continue
        quant = _quant_from_path(path) or ""
        priority = _quant_priority(quant, path)
        size = _number(getattr(item, "size", None))
        candidates.append((priority, -size, item))
    if not candidates:
        return None
    return sorted(candidates, key=lambda candidate: (candidate[0], candidate[1]))[0][2]


def _quant_from_path(path: str) -> str | None:
    parts = [part for part in Path(path).parts if part]
    candidates = parts[:-1] + [Path(path).stem]
    for candidate in candidates:
        match = GGUF_QUANT_PATTERN.search(candidate)
        if match:
            quant = match.group(1).upper()
            return re.sub(r"^UD[._]", "UD-", quant)
    return None


def _is_mtp_artifact(path: str) -> bool:
    parts = [part.lower() for part in Path(path).parts]
    name = Path(path).name.lower()
    stem = Path(path).stem.lower()
    return "mtp" in parts or name.endswith("-mtp.gguf") or stem.startswith("mtp-")


def _is_sharded_gguf(path: str) -> bool:
    name = Path(path).name
    return bool(re.search(r"-\d{5}-of-\d{5}\.gguf$", name, re.IGNORECASE))


def _quant_priority(quant: str, path: str) -> int:
    normalized = quant.upper()
    is_ud = normalized.startswith("UD-")
    base_quant = normalized[3:] if is_ud else normalized
    portable = PORTABLE_QUANT_PRIORITY.get(base_quant)
    if portable is not None:
        return portable + (20 if is_ud else 0)
    if normalized.startswith("MXFP"):
        return 60
    if base_quant == "BF16":
        return 80 if not _is_sharded_gguf(path) else 90
    if base_quant == "F16":
        return 81 if not _is_sharded_gguf(path) else 91
    if base_quant == "F32":
        return 92
    return 100


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
    architecture = str(data.get("architecture") or data.get("machine") or "unknown")
    return {
        "ram_gb": round(max(_gb_from_bytes(ram.get("total")), _number(data.get("memory_gb")), _number(data.get("ram_gb"))), 1),
        "vram_gb": round(max(_vram_total_gb(data.get("vram")), _number(data.get("vram_gb"))), 1),
        "platform": platform,
        "architecture": architecture,
    }


def _gpu_fit_memory_gb(machine: dict[str, object]) -> float:
    vram_gb = float(machine["vram_gb"])
    if vram_gb > 0:
        return vram_gb
    if _has_unified_gpu_memory(machine):
        # Apple Silicon reports unified memory instead of discrete VRAM.
        return float(machine["ram_gb"])
    return 0.0


def _has_unified_gpu_memory(machine: dict[str, object]) -> bool:
    platform_name = str(machine["platform"]).lower()
    architecture = str(machine.get("architecture", "")).lower()
    return platform_name == "darwin" and architecture in {"arm64", "aarch64"}


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


def _score(item: RecommendationCatalogItem, ram_gb: float, gpu_memory_gb: float, *, conservative_default: bool) -> int:
    if conservative_default:
        return max(10, 70 - int(item.min_ram_gb))
    if item.min_vram_gb is not None and gpu_memory_gb < item.min_vram_gb:
        ram_headroom = max(0.0, ram_gb - item.min_ram_gb)
        return max(10, min(45, int(45 - item.min_ram_gb * 0.25 + min(5, ram_headroom * 0.1))))
    ram_headroom = max(0.0, ram_gb - item.min_ram_gb)
    gpu_headroom = max(0.0, gpu_memory_gb - (item.min_vram_gb or item.estimated_size_gb))
    gpu_fit_bonus = 10 if item.min_vram_gb is not None and gpu_memory_gb >= item.min_vram_gb else 0
    quality_bias = item.min_ram_gb * 2
    return min(100, int(40 + quality_bias + gpu_fit_bonus + min(10, gpu_headroom * 0.2) + min(5, ram_headroom * 0.1)))


def _fit_reason(
    item: RecommendationCatalogItem,
    ram_gb: float,
    gpu_memory_gb: float,
    machine: dict[str, object],
    *,
    fits: bool,
    conservative_default: bool,
) -> str:
    if conservative_default:
        return "Conservative pick shown until hardware capacity is available."
    if fits and item.min_vram_gb is not None and gpu_memory_gb >= item.min_vram_gb:
        if float(machine["vram_gb"]) > 0:
            return f"Fits {gpu_memory_gb:g} GB VRAM with conservative GPU headroom."
        if _has_unified_gpu_memory(machine):
            return f"Fits {gpu_memory_gb:g} GB Apple unified memory for GPU offload."
    if fits and ram_gb >= item.min_ram_gb:
        if float(machine["vram_gb"]) > 0 and item.min_vram_gb is not None:
            return f"Fits {ram_gb:g} GB RAM, but only {float(machine['vram_gb']):g} GB GPU memory was detected."
        return f"Fits {ram_gb:g} GB RAM, but GPU memory was not detected."
    if item.min_vram_gb is None:
        return f"Needs at least {item.min_ram_gb:g} GB RAM."
    return f"Needs at least {item.min_vram_gb:g} GB GPU memory or {item.min_ram_gb:g} GB RAM."


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
        "supports_mtp": item.supports_mtp,
        "draft_model_path": item.draft_model_path,
    }
