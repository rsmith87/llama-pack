from __future__ import annotations

import importlib
import inspect
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from dataclasses import replace as dc_replace
from typing import Any

from llama_pack.core.config.models import AppConfig


ModelRunning = Callable[[str, str], bool | Awaitable[bool]]
ModelAvailable = Callable[[str, str], bool | Awaitable[bool]]
# Returns "registered", "gguf_present", or None (not available).
ModelArtifactPresence = Callable[[str, str], "str | None | Awaitable[str | None]"]
# Returns True if the node may start a new model instance right now.
NodeStartupAllowed = Callable[[str, str], bool | Awaitable[bool]]


@dataclass(frozen=True)
class ClassifierHint:
    request_type: str | None = None
    confidence: float = 1.0
    constraints: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class RouteDecision:
    node: str
    model: str
    strategy: str
    reason: str
    candidates: tuple[dict[str, Any], ...]
    fanout_targets: tuple["RouteDecision", ...] = ()
    classifier_hint: ClassifierHint | None = None
    # 9.1 — startup decision fields
    startup_needed: bool = False
    startup_decision: str | None = None  # "start_now" | "defer"


RoutingPlugin = Callable[
    [str, str | None, str, dict[str, Any] | None, ClassifierHint | None],
    Awaitable[RouteDecision | None],
]


def _load_plugin(path: str) -> RoutingPlugin:
    module_path, _, attr = path.rpartition(".")
    if not module_path:
        raise ValueError(f"routing_plugin_path must be a dotted import path, got: {path!r}")
    module = importlib.import_module(module_path)
    plugin = getattr(module, attr, None)
    if plugin is None:
        raise ValueError(f"No attribute {attr!r} in module {module_path!r}")
    return plugin  # type: ignore[return-value]


class RoutingPolicy:
    def __init__(
        self,
        config: AppConfig,
        model_running: ModelRunning,
        model_available: ModelAvailable | None = None,
        model_artifact_presence: ModelArtifactPresence | None = None,
        node_startup_allowed: NodeStartupAllowed | None = None,
        plugin: RoutingPlugin | None = None,
    ) -> None:
        self.config = config
        self.model_running = model_running
        self.model_available = model_available or (lambda node, model: False)
        self.model_artifact_presence = model_artifact_presence
        self.node_startup_allowed = node_startup_allowed
        if plugin is not None:
            self._plugin: RoutingPlugin | None = plugin
        elif config.routing_plugin_path:
            self._plugin = _load_plugin(config.routing_plugin_path)
        else:
            self._plugin = None

    async def choose(
        self,
        request_type: str,
        requested_model: str | None,
        explicit_target: str,
        previous_route: dict[str, Any] | None,
        hint: ClassifierHint | None = None,
    ) -> RouteDecision:
        effective_request_type = hint.request_type if (hint and hint.request_type) else request_type

        plugin_fallback: str | None = None
        if self._plugin is not None:
            try:
                plugin_result = await self._plugin(
                    effective_request_type, requested_model, explicit_target, previous_route, hint
                )
                if plugin_result is not None:
                    return plugin_result
                plugin_fallback = "plugin_returned_none"
            except Exception as exc:
                plugin_fallback = f"plugin_error:{type(exc).__name__}"

        decision = await self._choose_deterministic(
            effective_request_type, requested_model, explicit_target, previous_route
        )
        return self._annotate_decision(decision, hint, plugin_fallback)

    async def _choose_deterministic(
        self,
        request_type: str,
        requested_model: str | None,
        explicit_target: str,
        previous_route: dict[str, Any] | None,
    ) -> RouteDecision:
        if explicit_target.startswith("node:"):
            node_name = explicit_target.removeprefix("node:")
            return await self._choose_explicit_node(node_name, requested_model)
        if explicit_target not in {"", "auto"}:
            raise ValueError(f"Unsupported explicit target: {explicit_target}")

        affinity = await self._choose_thread_affinity(previous_route)
        if affinity is not None:
            return affinity

        if requested_model and ":" in requested_model:
            requested_profile = await self._choose_fallback(requested_model)
            if requested_profile is not None:
                return requested_profile

        request_type_decision = await self._choose_request_type(request_type)
        if request_type_decision is not None:
            if self.config.routing_fanout_enabled:
                fanout = await self._collect_fanout_targets(
                    primary=request_type_decision,
                    request_type=request_type,
                )
                return RouteDecision(
                    node=request_type_decision.node,
                    model=request_type_decision.model,
                    strategy=request_type_decision.strategy,
                    reason=request_type_decision.reason,
                    candidates=request_type_decision.candidates,
                    fanout_targets=fanout,
                )
            return request_type_decision

        fallback = await self._choose_fallback(requested_model)
        if fallback is not None:
            return fallback

        raise ValueError("No eligible running model found")

    def _annotate_decision(
        self,
        decision: RouteDecision,
        hint: ClassifierHint | None,
        plugin_fallback: str | None,
    ) -> RouteDecision:
        if hint is None and plugin_fallback is None:
            return decision
        reason = f"{decision.reason} ({plugin_fallback})" if plugin_fallback else decision.reason
        return dc_replace(decision, reason=reason, classifier_hint=hint)

    async def _choose_explicit_node(self, node_name: str, requested_model: str | None) -> RouteDecision:
        node = self.config.nodes.get(node_name)
        if node is None:
            raise ValueError(f"Unknown node target: {node_name}")
        model = requested_model or node.default_model
        if model is None:
            raise ValueError(f"No model specified for node target: {node_name}")
        candidates = ({"node": node_name, "model": model, "source": "explicit"},)
        if await self._candidate_model_running(candidates[0]):
            return RouteDecision(
                node=node_name,
                model=model,
                strategy="explicit",
                reason="explicit_target",
                candidates=candidates,
            )
        raise ValueError(f"No eligible running model found for node target: {node_name}")

    async def _choose_thread_affinity(self, previous_route: dict[str, Any] | None) -> RouteDecision | None:
        if not previous_route:
            return None
        node = previous_route.get("node")
        model = previous_route.get("model")
        if not isinstance(node, str) or not isinstance(model, str):
            return None
        candidates = ({"node": node, "model": model, "source": "previous_route"},)
        if node in self.config.nodes and await self._candidate_model_running(candidates[0]):
            return RouteDecision(
                node=node,
                model=model,
                strategy="deterministic",
                reason="thread_affinity",
                candidates=candidates,
            )
        return None

    async def _choose_request_type(self, request_type: str) -> RouteDecision | None:
        candidates = self._request_type_candidates(request_type)
        for candidate in candidates:
            if await self._candidate_model_running(candidate):
                candidate["model_running"] = True
                return RouteDecision(
                    node=candidate["node"],
                    model=candidate["model"],
                    strategy="deterministic",
                    reason="request_type",
                    candidates=tuple(candidates),
                )
            candidate["model_running"] = False
        return await self._choose_available_candidate(candidates, reason_prefix="request_type")

    async def _choose_fallback(self, requested_model: str | None) -> RouteDecision | None:
        candidates: list[dict[str, Any]] = []
        for node_name in sorted(self.config.nodes):
            node = self.config.nodes[node_name]
            model = requested_model or node.default_model
            if model is None:
                continue
            candidate = {"node": node_name, "model": model, "source": "fallback"}
            candidates.append(candidate)
            if await self._candidate_model_running(candidate):
                candidate["model_running"] = True
                return RouteDecision(
                    node=node_name,
                    model=model,
                    strategy="deterministic",
                    reason="fallback",
                    candidates=tuple(candidates),
                )
            candidate["model_running"] = False
        return await self._choose_available_candidate(candidates, reason_prefix="fallback")

    async def _collect_fanout_targets(
        self,
        primary: RouteDecision,
        request_type: str,
    ) -> tuple["RouteDecision", ...]:
        remaining_slots = self.config.routing_fanout_max - 1
        if remaining_slots <= 0:
            return ()
        candidates = self._request_type_candidates(request_type)
        targets: list[RouteDecision] = []
        for candidate in candidates:
            if len(targets) >= remaining_slots:
                break
            if candidate["node"] == primary.node:
                continue
            if await self._candidate_model_running(candidate):
                targets.append(
                    RouteDecision(
                        node=candidate["node"],
                        model=candidate["model"],
                        strategy="deterministic",
                        reason="fanout",
                        candidates=(candidate,),
                    )
                )
        return tuple(targets)

    def _request_type_candidates(self, request_type: str) -> list[dict[str, Any]]:
        candidates = []
        for node_name, node in self.config.nodes.items():
            route = node.request_types.get(request_type)
            if route is None:
                continue
            candidates.append(
                {
                    "node": node_name,
                    "model": route.model,
                    "priority": route.priority,
                    "source": "request_type",
                }
            )
        return sorted(candidates, key=lambda candidate: (candidate["priority"], candidate["node"]))

    async def _model_running(self, node: str, model: str) -> bool:
        result = self.model_running(node, model)
        if inspect.isawaitable(result):
            result = await result
        return bool(result)

    async def _candidate_model_running(self, candidate: dict[str, Any]) -> bool:
        try:
            return await self._model_running(str(candidate["node"]), str(candidate["model"]))
        except Exception as exc:
            self._record_candidate_error(candidate, "model_running", exc)
            return False

    async def _model_available(self, node: str, model: str) -> bool:
        result = self.model_available(node, model)
        if inspect.isawaitable(result):
            result = await result
        return bool(result)

    async def _candidate_model_available(self, candidate: dict[str, Any]) -> bool:
        try:
            return await self._model_available(str(candidate["node"]), str(candidate["model"]))
        except Exception as exc:
            self._record_candidate_error(candidate, "model_available", exc)
            return False

    async def _get_artifact_presence(self, node: str, model: str) -> str | None:
        """9.2 — returns "registered", "gguf_present", or None."""
        if self.model_artifact_presence is None:
            return None
        result = self.model_artifact_presence(node, model)
        if inspect.isawaitable(result):
            result = await result
        return result  # type: ignore[return-value]

    async def _candidate_artifact_presence(self, candidate: dict[str, Any]) -> str | None:
        try:
            return await self._get_artifact_presence(str(candidate["node"]), str(candidate["model"]))
        except Exception as exc:
            self._record_candidate_error(candidate, "artifact_presence", exc)
            return None

    async def _is_startup_allowed(self, node: str, model: str) -> bool:
        """9.1 — returns True if the node may start a new model instance."""
        if self.node_startup_allowed is None:
            return True
        result = self.node_startup_allowed(node, model)
        if inspect.isawaitable(result):
            result = await result
        return bool(result)

    async def _candidate_startup_allowed(self, candidate: dict[str, Any]) -> bool:
        try:
            return await self._is_startup_allowed(str(candidate["node"]), str(candidate["model"]))
        except Exception as exc:
            self._record_candidate_error(candidate, "startup_allowed", exc)
            return True

    def _record_candidate_error(self, candidate: dict[str, Any], check: str, exc: Exception) -> None:
        errors = candidate.setdefault("route_check_errors", [])
        if not isinstance(errors, list):
            errors = []
            candidate["route_check_errors"] = errors
        errors.append(
            {
                "check": check,
                "error_type": type(exc).__name__,
                "message": str(exc),
            }
        )

    async def _choose_available_candidate(
        self,
        candidates: list[dict[str, Any]],
        reason_prefix: str,
    ) -> RouteDecision | None:
        """Availability pass shared by _choose_request_type and _choose_fallback.

        When model_artifact_presence is wired (9.2), candidates are scored:
        "registered" is preferred over "gguf_present".  Within each tier the
        existing priority order from the caller is preserved.

        When only the legacy model_available callable is available, the original
        single-pass behaviour is retained for backward compatibility.
        """
        if self.model_artifact_presence is not None:
            best_registered: dict[str, Any] | None = None
            best_gguf: dict[str, Any] | None = None
            for candidate in candidates:
                presence = await self._candidate_artifact_presence(candidate)
                candidate["artifact_state"] = presence
                if presence == "registered" and best_registered is None:
                    best_registered = candidate
                elif presence == "gguf_present" and best_gguf is None:
                    best_gguf = candidate

            chosen = best_registered or best_gguf
            if chosen is None:
                return None

            startup_allowed = await self._candidate_startup_allowed(chosen)
            startup_decision = "start_now" if startup_allowed else "defer"
            reason = f"{reason_prefix}_artifact_{chosen['artifact_state']}"
            return RouteDecision(
                node=chosen["node"],
                model=chosen["model"],
                strategy="deterministic",
                reason=reason,
                candidates=tuple(candidates),
                startup_needed=True,
                startup_decision=startup_decision,
            )

        # Legacy path — model_available only
        for candidate in candidates:
            if await self._candidate_model_available(candidate):
                candidate["model_available"] = True
                startup_allowed = await self._candidate_startup_allowed(candidate)
                startup_decision = "start_now" if startup_allowed else "defer"
                return RouteDecision(
                    node=candidate["node"],
                    model=candidate["model"],
                    strategy="deterministic",
                    reason=f"{reason_prefix}_model_available",
                    candidates=tuple(candidates),
                    startup_needed=True,
                    startup_decision=startup_decision,
                )
            candidate["model_available"] = False
        return None
