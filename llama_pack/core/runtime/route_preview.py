from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field

from llama_pack.core.config.models import AppConfig


class RoutePreviewRequirements(BaseModel):
    min_context: int | None = Field(default=None, ge=1)
    needs_json: bool = False
    needs_tools: bool = False
    latency: str | None = None


class RoutePreviewRequest(BaseModel):
    task: str = ""
    request_type: str = "general"
    model: str | None = None
    target: str = "auto"
    requirements: RoutePreviewRequirements = Field(default_factory=RoutePreviewRequirements)


class RoutePreviewService:
    def __init__(self, config: AppConfig, node_registry: Any) -> None:
        self.config = config
        self.node_registry = node_registry

    async def preview(self, request: RoutePreviewRequest) -> dict[str, Any]:
        candidates = []
        configured_candidates = self._configured_candidates(request)
        configured_or_discovered = configured_candidates or await self._discovered_candidates(request)
        for candidate in configured_or_discovered:
            enriched = await self._enrich_candidate(candidate, request.requirements)
            candidates.append(enriched)

        eligible = [candidate for candidate in candidates if candidate["eligible"]]
        selected = max(eligible, key=lambda item: item["score"]) if eligible else None
        return {
            "selected": _selected_payload(selected),
            "candidates": candidates,
            "explanation": _explanation(selected, candidates),
        }

    def _configured_candidates(self, request: RoutePreviewRequest) -> list[dict[str, Any]]:
        if self.config.mode != "controller" or self.node_registry is None:
            return []

        explicit_node = request.target.removeprefix("node:") if request.target.startswith("node:") else None
        candidates: list[dict[str, Any]] = []
        for node_name, node in sorted(self.config.nodes.items()):
            if explicit_node and node_name != explicit_node:
                continue
            route = node.request_types.get(request.request_type)
            model = request.model or (route.model if route else node.default_model)
            if model is None:
                continue
            priority = route.priority if route else 1000
            candidates.append(
                {
                    "node": node_name,
                    "model": model,
                    "request_type": request.request_type,
                    "priority": priority,
                    "source": "request_type" if route else "default_model",
                    "request_type_match": route is not None,
                    "reachable": False,
                }
            )
        return sorted(candidates, key=lambda item: (item["priority"], item["node"]))

    async def _discovered_candidates(self, request: RoutePreviewRequest) -> list[dict[str, Any]]:
        if self.config.mode != "controller" or self.node_registry is None:
            return []

        explicit_node = request.target.removeprefix("node:") if request.target.startswith("node:") else None
        candidates: list[dict[str, Any]] = []
        for node in self.node_registry.list_nodes():
            node_name = node.get("name")
            if not node_name or (explicit_node and node_name != explicit_node):
                continue
            for index, model in enumerate(await self._node_models(str(node_name))):
                name = model.get("name")
                if not name or (request.model and name != request.model):
                    continue
                candidates.append(
                    {
                        "node": str(node_name),
                        "model": str(name),
                        "request_type": request.request_type,
                        "priority": 1000 + index,
                        "source": "runtime_model",
                        "request_type_match": False,
                        "reachable": True,
                    }
                )
        return candidates

    async def _enrich_candidate(self, candidate: dict[str, Any], requirements: RoutePreviewRequirements) -> dict[str, Any]:
        models = await self._node_models(candidate["node"])
        model_info = next((item for item in models if item.get("name") == candidate["model"]), None)
        metadata = self._model_metadata(candidate["model"], model_info)
        rejections: list[str] = []
        running = bool(model_info.get("running")) if model_info else False
        available = model_info is not None
        startup_needed = available and not running
        startup_decision = self._startup_decision(candidate["node"], models) if startup_needed else None
        ctx = _first_int(model_info, "ctx", "intended_ctx") if model_info else metadata.get("ctx")
        supports_json = _supports_json_schema(model_info, metadata)
        strengths = metadata["strengths"]
        cost_tier = metadata["cost_tier"]
        strength_match = candidate.get("request_type") in strengths

        if not available:
            rejections.append("model_unavailable")
        if requirements.min_context and (ctx is None or ctx < requirements.min_context):
            rejections.append("context_too_small")
        if requirements.needs_json and not supports_json:
            rejections.append("json_schema_unsupported")
        if requirements.needs_tools:
            rejections.append("tool_requirement_not_routable_yet")

        score = 0
        if running:
            score += 100
        if candidate["request_type_match"]:
            score += 50
        if strength_match:
            score += 100
        score += _latency_score(requirements.latency, cost_tier)
        score += max(0, 1000 - int(candidate["priority"]))
        if ctx is not None:
            score += min(ctx, 32768) // 1024

        return {
            **candidate,
            "running": running,
            "available": available,
            "startup_needed": startup_needed,
            "startup_decision": startup_decision,
            "ctx": ctx,
            "supports_json_schema": supports_json,
            "strengths": strengths,
            "cost_tier": cost_tier,
            "strength_match": strength_match,
            "eligible": not rejections,
            "rejections": rejections,
            "score": score if not rejections else 0,
        }

    def _startup_decision(self, node: str, models: list[dict[str, Any]]) -> str:
        try:
            node_config = self.node_registry.get_node_config(node)
        except Exception:
            return "start_now"

        max_running = getattr(node_config, "max_running_models", None)
        if max_running is None:
            return "start_now"

        running_count = sum(1 for item in models if item.get("running") is True)
        return "start_now" if running_count < max_running else "defer"

    def _model_metadata(self, model_name: str, model_info: dict[str, Any] | None) -> dict[str, Any]:
        base_name, _, profile_name = model_name.partition(":")
        model_cfg = self.config.models.get(base_name) or self.config.models.get(model_name)
        profile_cfg = model_cfg.profiles.get(profile_name) if model_cfg is not None and profile_name else None

        strengths = list(model_cfg.strengths) if model_cfg is not None else []
        cost_tier = model_cfg.cost_tier if model_cfg is not None else None
        ctx = model_cfg.ctx if model_cfg is not None else None
        supports_json_schema = model_cfg.supports_json_schema if model_cfg is not None else None

        if profile_cfg is not None:
            if profile_cfg.strengths:
                strengths = list(profile_cfg.strengths)
            if profile_cfg.cost_tier is not None:
                cost_tier = profile_cfg.cost_tier
            if profile_cfg.ctx is not None:
                ctx = profile_cfg.ctx

        if model_info is not None:
            if isinstance(model_info.get("strengths"), list):
                strengths = [str(item) for item in model_info["strengths"]]
            if isinstance(model_info.get("cost_tier"), str):
                cost_tier = str(model_info["cost_tier"])

        return {
            "strengths": [_normalize_strength(strength) for strength in strengths],
            "cost_tier": cost_tier,
            "ctx": ctx,
            "supports_json_schema": supports_json_schema,
        }

    async def _node_models(self, node: str) -> list[dict[str, Any]]:
        try:
            models = await self.node_registry.request_node(node, "GET", "/lm-api/v1/models")
        except Exception:
            return []
        if not isinstance(models, list):
            return []
        return [item for item in models if isinstance(item, dict)]


def _selected_payload(candidate: dict[str, Any] | None) -> dict[str, Any] | None:
    if candidate is None:
        return None
    return {
        "node": candidate["node"],
        "model": candidate["model"],
        "reason": "highest_score",
        "score": candidate["score"],
        "startup_needed": candidate.get("startup_needed", False),
        "startup_decision": candidate.get("startup_decision"),
    }


def _explanation(selected: dict[str, Any] | None, candidates: list[dict[str, Any]]) -> str:
    if selected is not None:
        return f"Selected {selected['model']} on {selected['node']} from {len(candidates)} candidate(s)."
    return f"No candidate satisfied the requested requirements from {len(candidates)} candidate(s)."


def _first_int(payload: dict[str, Any] | None, *keys: str) -> int | None:
    if payload is None:
        return None
    for key in keys:
        value = payload.get(key)
        if isinstance(value, int):
            return value
    return None


def _supports_json_schema(payload: dict[str, Any] | None, metadata: dict[str, Any]) -> bool:
    value = payload.get("supports_json_schema") if payload is not None else None
    if value is not None:
        return bool(value)
    if metadata.get("supports_json_schema") is not None:
        return bool(metadata["supports_json_schema"])
    extra_args = payload.get("extra_args") if payload is not None else []
    extra_args = extra_args or []
    return any("json-schema" in str(item).lower() for item in extra_args)


def _normalize_strength(value: str) -> str:
    return value.strip().lower().replace(" ", "_")


def _latency_score(latency: str | None, cost_tier: str | None) -> int:
    if latency not in {"fast", "economy"}:
        return 0
    if cost_tier == "low":
        return 30
    if cost_tier == "medium":
        return 10
    if cost_tier == "high":
        return -10
    return 0
