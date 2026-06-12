import pytest

from llama_pack.core.config import load_config
from llama_pack.core.threads.routing import ClassifierHint, RouteDecision, RoutingPolicy


@pytest.mark.asyncio
async def test_routing_policy_uses_request_type_priority_order():
    config = load_config(
        {
            "mode": "controller",
            "nodes": {
                "mac-mini": {
                    "url": "http://mac",
                    "default_model": "gemma",
                    "request_types": {"coding": {"model": "gemma", "priority": 50}},
                },
                "linux-2080ti": {
                    "url": "http://linux",
                    "default_model": "qwen",
                    "request_types": {"coding": {"model": "qwen", "priority": 10}},
                },
            },
        }
    )
    policy = RoutingPolicy(config, model_running=lambda node, model: node == "linux-2080ti" and model == "qwen")

    decision = await policy.choose(
        request_type="coding",
        requested_model=None,
        explicit_target="auto",
        previous_route=None,
    )

    assert decision.node == "linux-2080ti"
    assert decision.model == "qwen"
    assert decision.strategy == "deterministic"


@pytest.mark.asyncio
async def test_routing_policy_uses_registry_presence_when_request_type_model_is_not_running():
    config = load_config(
        {
            "mode": "controller",
            "nodes": {
                "mac-mini": {
                    "url": "http://mac",
                    "request_types": {"coding": {"model": "qwen", "priority": 10}},
                },
                "linux-2080ti": {
                    "url": "http://linux",
                    "request_types": {"coding": {"model": "qwen", "priority": 20}},
                },
            },
        }
    )
    policy = RoutingPolicy(
        config,
        model_running=lambda node, model: False,
        model_available=lambda node, model: node == "linux-2080ti" and model == "qwen",
    )

    decision = await policy.choose(
        request_type="coding",
        requested_model="qwen",
        explicit_target="auto",
        previous_route=None,
    )

    assert decision.node == "linux-2080ti"
    assert decision.model == "qwen"
    assert decision.reason == "request_type_model_available"
    assert decision.candidates[1]["model_available"] is True


@pytest.mark.asyncio
async def test_routing_policy_keeps_running_model_preferred_over_registry_presence():
    config = load_config(
        {
            "mode": "controller",
            "nodes": {
                "mac-mini": {
                    "url": "http://mac",
                    "request_types": {"coding": {"model": "qwen", "priority": 10}},
                },
                "linux-2080ti": {
                    "url": "http://linux",
                    "request_types": {"coding": {"model": "qwen", "priority": 20}},
                },
            },
        }
    )
    policy = RoutingPolicy(
        config,
        model_running=lambda node, model: node == "mac-mini" and model == "qwen",
        model_available=lambda node, model: node == "linux-2080ti" and model == "qwen",
    )

    decision = await policy.choose(
        request_type="coding",
        requested_model="qwen",
        explicit_target="auto",
        previous_route=None,
    )

    assert decision.node == "mac-mini"
    assert decision.reason == "request_type"


@pytest.mark.asyncio
async def test_routing_policy_preserves_thread_affinity_when_eligible():
    config = load_config(
        {
            "mode": "controller",
            "nodes": {
                "mac-mini": {
                    "url": "http://mac",
                    "request_types": {"coding": {"model": "gemma", "priority": 50}},
                },
                "linux-2080ti": {
                    "url": "http://linux",
                    "request_types": {"coding": {"model": "qwen", "priority": 10}},
                },
            },
        }
    )
    policy = RoutingPolicy(config, model_running=lambda node, model: node == "mac-mini" and model == "gemma")

    decision = await policy.choose(
        request_type="coding",
        requested_model=None,
        explicit_target="auto",
        previous_route={"node": "mac-mini", "model": "gemma"},
    )

    assert decision.node == "mac-mini"
    assert decision.model == "gemma"
    assert decision.reason == "thread_affinity"


@pytest.mark.asyncio
async def test_routing_policy_honors_explicit_node_target():
    config = load_config(
        {
            "mode": "controller",
            "nodes": {
                "mac-mini": {"url": "http://mac", "default_model": "gemma"},
                "linux-2080ti": {"url": "http://linux", "default_model": "qwen"},
            },
        }
    )
    policy = RoutingPolicy(config, model_running=lambda node, model: node == "mac-mini" and model == "gemma")

    decision = await policy.choose(
        request_type="general",
        requested_model="gemma",
        explicit_target="node:mac-mini",
        previous_route=None,
    )

    assert decision.node == "mac-mini"
    assert decision.model == "gemma"
    assert decision.strategy == "explicit"


@pytest.mark.asyncio
async def test_routing_policy_rejects_invalid_explicit_target():
    config = load_config(
        {
            "mode": "controller",
            "nodes": {
                "mac-mini": {"url": "http://mac", "default_model": "gemma"},
            },
        }
    )
    policy = RoutingPolicy(config, model_running=lambda node, model: True)

    with pytest.raises(ValueError):
        await policy.choose(
            request_type="general",
            requested_model=None,
            explicit_target="mac-mini",
            previous_route=None,
        )


@pytest.mark.asyncio
async def test_routing_policy_supports_async_model_running():
    config = load_config(
        {
            "mode": "controller",
            "nodes": {
                "mac-mini": {"url": "http://mac", "default_model": "gemma"},
            },
        }
    )

    async def model_running(node, model):
        return node == "mac-mini" and model == "gemma"

    policy = RoutingPolicy(config, model_running=model_running)

    decision = await policy.choose(
        request_type="general",
        requested_model=None,
        explicit_target="auto",
        previous_route=None,
    )

    assert decision.node == "mac-mini"
    assert decision.model == "gemma"


@pytest.mark.asyncio
async def test_routing_policy_falls_back_to_first_sorted_running_node():
    config = load_config(
        {
            "mode": "controller",
            "nodes": {
                "z-linux": {"url": "http://z", "default_model": "qwen"},
                "a-mac": {"url": "http://a", "default_model": "gemma"},
                "m-workstation": {"url": "http://m", "default_model": "mistral"},
            },
        }
    )
    policy = RoutingPolicy(config, model_running=lambda node, model: node == "m-workstation" and model == "mistral")

    decision = await policy.choose(
        request_type="coding",
        requested_model=None,
        explicit_target="",
        previous_route=None,
    )

    assert decision.node == "m-workstation"
    assert decision.model == "mistral"
    assert decision.reason == "fallback"


@pytest.mark.asyncio
async def test_routing_policy_raises_when_no_eligible_running_model():
    config = load_config(
        {
            "mode": "controller",
            "nodes": {
                "mac-mini": {"url": "http://mac", "default_model": "gemma"},
                "linux-2080ti": {"url": "http://linux", "default_model": "qwen"},
            },
        }
    )
    policy = RoutingPolicy(config, model_running=lambda node, model: False)

    with pytest.raises(ValueError):
        await policy.choose(
            request_type="general",
            requested_model=None,
            explicit_target="auto",
            previous_route=None,
        )


@pytest.mark.asyncio
async def test_fanout_disabled_returns_empty_fanout_targets():
    config = load_config(
        {
            "mode": "controller",
            "nodes": {
                "mac-mini": {"url": "http://mac", "default_model": "gemma", "request_types": {"coding": {"model": "gemma", "priority": 10}}},
                "linux-2080ti": {"url": "http://linux", "default_model": "qwen", "request_types": {"coding": {"model": "qwen", "priority": 20}}},
            },
        }
    )
    policy = RoutingPolicy(config, model_running=lambda node, model: True)

    decision = await policy.choose(request_type="coding", requested_model=None, explicit_target="auto", previous_route=None)

    assert decision.fanout_targets == ()


@pytest.mark.asyncio
async def test_fanout_enabled_returns_additional_eligible_candidates():
    config = load_config(
        {
            "mode": "controller",
            "routing_fanout_enabled": True,
            "routing_fanout_max": 3,
            "nodes": {
                "mac-mini": {"url": "http://mac", "default_model": "gemma", "request_types": {"coding": {"model": "gemma", "priority": 10}}},
                "linux-2080ti": {"url": "http://linux", "default_model": "qwen", "request_types": {"coding": {"model": "qwen", "priority": 20}}},
                "workstation": {"url": "http://ws", "default_model": "mistral", "request_types": {"coding": {"model": "mistral", "priority": 30}}},
            },
        }
    )
    policy = RoutingPolicy(config, model_running=lambda node, model: True)

    decision = await policy.choose(request_type="coding", requested_model=None, explicit_target="auto", previous_route=None)

    assert decision.node == "mac-mini"
    assert len(decision.fanout_targets) == 2
    fanout_nodes = {t.node for t in decision.fanout_targets}
    assert "linux-2080ti" in fanout_nodes
    assert "workstation" in fanout_nodes
    assert all(t.reason == "fanout" for t in decision.fanout_targets)


@pytest.mark.asyncio
async def test_fanout_max_limits_number_of_fanout_targets():
    config = load_config(
        {
            "mode": "controller",
            "routing_fanout_enabled": True,
            "routing_fanout_max": 2,
            "nodes": {
                "node-a": {"url": "http://a", "default_model": "m", "request_types": {"coding": {"model": "m", "priority": 10}}},
                "node-b": {"url": "http://b", "default_model": "m", "request_types": {"coding": {"model": "m", "priority": 20}}},
                "node-c": {"url": "http://c", "default_model": "m", "request_types": {"coding": {"model": "m", "priority": 30}}},
                "node-d": {"url": "http://d", "default_model": "m", "request_types": {"coding": {"model": "m", "priority": 40}}},
            },
        }
    )
    policy = RoutingPolicy(config, model_running=lambda node, model: True)

    decision = await policy.choose(request_type="coding", requested_model=None, explicit_target="auto", previous_route=None)

    # primary + 1 fanout = 2 total (routing_fanout_max=2 means primary + 1 extra)
    assert len(decision.fanout_targets) == 1


@pytest.mark.asyncio
async def test_fanout_enabled_but_only_one_eligible_node_returns_empty_fanout_targets():
    config = load_config(
        {
            "mode": "controller",
            "routing_fanout_enabled": True,
            "routing_fanout_max": 3,
            "nodes": {
                "mac-mini": {"url": "http://mac", "default_model": "gemma", "request_types": {"coding": {"model": "gemma", "priority": 10}}},
                "linux-2080ti": {"url": "http://linux", "default_model": "qwen", "request_types": {"coding": {"model": "qwen", "priority": 20}}},
            },
        }
    )
    # Only the primary node is running
    policy = RoutingPolicy(config, model_running=lambda node, model: node == "mac-mini")

    decision = await policy.choose(request_type="coding", requested_model=None, explicit_target="auto", previous_route=None)

    assert decision.node == "mac-mini"
    assert decision.fanout_targets == ()


# ---------------------------------------------------------------------------
# Ticket 8.1 — Typed Classifier Hint Contract
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_classifier_hint_request_type_overrides_caller_request_type():
    config = load_config(
        {
            "mode": "controller",
            "nodes": {
                "mac-mini": {
                    "url": "http://mac",
                    "request_types": {"coding": {"model": "gemma", "priority": 10}},
                },
            },
        }
    )
    policy = RoutingPolicy(config, model_running=lambda node, model: True)
    hint = ClassifierHint(request_type="coding")

    # caller says "general" but there is no general bucket — hint overrides to "coding"
    decision = await policy.choose(
        request_type="general",
        requested_model=None,
        explicit_target="auto",
        previous_route=None,
        hint=hint,
    )

    assert decision.node == "mac-mini"
    assert decision.model == "gemma"
    assert decision.reason == "request_type"


@pytest.mark.asyncio
async def test_classifier_hint_is_logged_on_route_decision():
    config = load_config(
        {
            "mode": "controller",
            "nodes": {"mac-mini": {"url": "http://mac", "default_model": "gemma"}},
        }
    )
    policy = RoutingPolicy(config, model_running=lambda node, model: True)
    hint = ClassifierHint(request_type="general", confidence=0.9, constraints={"max_ctx": 8192})

    decision = await policy.choose(
        request_type="general",
        requested_model=None,
        explicit_target="auto",
        previous_route=None,
        hint=hint,
    )

    assert decision.classifier_hint is hint


@pytest.mark.asyncio
async def test_classifier_hint_none_preserves_current_behavior():
    config = load_config(
        {
            "mode": "controller",
            "nodes": {"mac-mini": {"url": "http://mac", "default_model": "gemma"}},
        }
    )
    policy = RoutingPolicy(config, model_running=lambda node, model: True)

    decision = await policy.choose(
        request_type="general",
        requested_model=None,
        explicit_target="auto",
        previous_route=None,
        hint=None,
    )

    assert decision.node == "mac-mini"
    assert decision.classifier_hint is None


@pytest.mark.asyncio
async def test_classifier_hint_without_request_type_uses_caller_request_type():
    config = load_config(
        {
            "mode": "controller",
            "nodes": {
                "mac-mini": {
                    "url": "http://mac",
                    "request_types": {"coding": {"model": "gemma", "priority": 10}},
                },
            },
        }
    )
    policy = RoutingPolicy(config, model_running=lambda node, model: True)
    hint = ClassifierHint(confidence=0.7, constraints={"note": "partial"})

    decision = await policy.choose(
        request_type="coding",
        requested_model=None,
        explicit_target="auto",
        previous_route=None,
        hint=hint,
    )

    assert decision.node == "mac-mini"
    assert decision.classifier_hint is hint


# ---------------------------------------------------------------------------
# Ticket 8.2 — Policy Plugin Interface
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_plugin_return_value_is_used_as_decision():
    config = load_config(
        {
            "mode": "controller",
            "nodes": {"mac-mini": {"url": "http://mac", "default_model": "gemma"}},
        }
    )
    expected = RouteDecision(
        node="mac-mini",
        model="gemma",
        strategy="plugin",
        reason="plugin_chose",
        candidates=({"node": "mac-mini", "model": "gemma"},),
    )

    async def my_plugin(request_type, requested_model, explicit_target, previous_route, hint):
        return expected

    policy = RoutingPolicy(config, model_running=lambda node, model: True, plugin=my_plugin)
    decision = await policy.choose(
        request_type="general", requested_model=None, explicit_target="auto", previous_route=None
    )

    assert decision is expected


@pytest.mark.asyncio
async def test_plugin_returning_none_falls_back_to_deterministic():
    config = load_config(
        {
            "mode": "controller",
            "nodes": {"mac-mini": {"url": "http://mac", "default_model": "gemma"}},
        }
    )

    async def my_plugin(request_type, requested_model, explicit_target, previous_route, hint):
        return None

    policy = RoutingPolicy(config, model_running=lambda node, model: True, plugin=my_plugin)
    decision = await policy.choose(
        request_type="general", requested_model=None, explicit_target="auto", previous_route=None
    )

    assert decision.node == "mac-mini"
    assert "plugin_returned_none" in decision.reason


@pytest.mark.asyncio
async def test_plugin_exception_falls_back_to_deterministic_with_reason():
    config = load_config(
        {
            "mode": "controller",
            "nodes": {"mac-mini": {"url": "http://mac", "default_model": "gemma"}},
        }
    )

    async def bad_plugin(request_type, requested_model, explicit_target, previous_route, hint):
        raise RuntimeError("oops")

    policy = RoutingPolicy(config, model_running=lambda node, model: True, plugin=bad_plugin)
    decision = await policy.choose(
        request_type="general", requested_model=None, explicit_target="auto", previous_route=None
    )

    assert decision.node == "mac-mini"
    assert "plugin_error:RuntimeError" in decision.reason


@pytest.mark.asyncio
async def test_no_plugin_configured_behavior_unchanged():
    config = load_config(
        {
            "mode": "controller",
            "nodes": {"mac-mini": {"url": "http://mac", "default_model": "gemma"}},
        }
    )
    policy = RoutingPolicy(config, model_running=lambda node, model: True)
    decision = await policy.choose(
        request_type="general", requested_model=None, explicit_target="auto", previous_route=None
    )

    assert decision.node == "mac-mini"
    assert "plugin" not in decision.reason
    assert decision.classifier_hint is None


@pytest.mark.asyncio
async def test_routing_plugin_path_in_config_auto_loads_plugin():
    import sys
    import types

    async def _auto_plugin(request_type, requested_model, explicit_target, previous_route, hint):
        return None  # return None so deterministic fallback runs

    mod = types.ModuleType("_test_routing_plugin_auto")
    mod.plugin_fn = _auto_plugin  # type: ignore[attr-defined]
    sys.modules["_test_routing_plugin_auto"] = mod

    try:
        config = load_config(
            {
                "mode": "controller",
                "routing_plugin_path": "_test_routing_plugin_auto.plugin_fn",
                "nodes": {"mac-mini": {"url": "http://mac", "default_model": "gemma"}},
            }
        )
        policy = RoutingPolicy(config, model_running=lambda node, model: True)
        decision = await policy.choose(
            request_type="general", requested_model=None, explicit_target="auto", previous_route=None
        )
        assert "plugin_returned_none" in decision.reason
    finally:
        del sys.modules["_test_routing_plugin_auto"]

# ---------------------------------------------------------------------------
# Ticket 9.1 — Model Startup Decision Engine
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_startup_needed_true_when_model_available_not_running():
    config = load_config(
        {
            "mode": "controller",
            "nodes": {
                "mac-mini": {"url": "http://mac", "default_model": "gemma"},
            },
        }
    )
    policy = RoutingPolicy(
        config,
        model_running=lambda node, model: False,
        model_available=lambda node, model: True,
    )

    decision = await policy.choose(
        request_type="general",
        requested_model=None,
        explicit_target="auto",
        previous_route=None,
    )

    assert decision.startup_needed is True
    assert decision.startup_decision == "start_now"


@pytest.mark.asyncio
async def test_startup_needed_false_when_model_already_running():
    config = load_config(
        {
            "mode": "controller",
            "nodes": {
                "mac-mini": {"url": "http://mac", "default_model": "gemma"},
            },
        }
    )
    policy = RoutingPolicy(
        config,
        model_running=lambda node, model: True,
    )

    decision = await policy.choose(
        request_type="general",
        requested_model=None,
        explicit_target="auto",
        previous_route=None,
    )

    assert decision.startup_needed is False
    assert decision.startup_decision is None


@pytest.mark.asyncio
async def test_startup_decision_defers_when_node_at_capacity():
    config = load_config(
        {
            "mode": "controller",
            "nodes": {
                "mac-mini": {"url": "http://mac", "default_model": "gemma"},
            },
        }
    )
    policy = RoutingPolicy(
        config,
        model_running=lambda node, model: False,
        model_available=lambda node, model: True,
        node_startup_allowed=lambda node, model: False,
    )

    decision = await policy.choose(
        request_type="general",
        requested_model=None,
        explicit_target="auto",
        previous_route=None,
    )

    assert decision.startup_needed is True
    assert decision.startup_decision == "defer"


@pytest.mark.asyncio
async def test_startup_decision_start_now_when_node_has_capacity():
    config = load_config(
        {
            "mode": "controller",
            "nodes": {
                "mac-mini": {"url": "http://mac", "default_model": "gemma"},
            },
        }
    )
    policy = RoutingPolicy(
        config,
        model_running=lambda node, model: False,
        model_available=lambda node, model: True,
        node_startup_allowed=lambda node, model: True,
    )

    decision = await policy.choose(
        request_type="general",
        requested_model=None,
        explicit_target="auto",
        previous_route=None,
    )

    assert decision.startup_needed is True
    assert decision.startup_decision == "start_now"


@pytest.mark.asyncio
async def test_startup_decision_start_now_by_default_when_no_startup_allowed_callable():
    """When node_startup_allowed is not provided, default to start_now."""
    config = load_config(
        {
            "mode": "controller",
            "nodes": {
                "mac-mini": {"url": "http://mac", "default_model": "gemma"},
            },
        }
    )
    policy = RoutingPolicy(
        config,
        model_running=lambda node, model: False,
        model_available=lambda node, model: True,
        # node_startup_allowed intentionally omitted
    )

    decision = await policy.choose(
        request_type="general",
        requested_model=None,
        explicit_target="auto",
        previous_route=None,
    )

    assert decision.startup_decision == "start_now"


@pytest.mark.asyncio
async def test_startup_decision_via_request_type_path():
    """Startup decision is also applied when routing via request_type bucket."""
    config = load_config(
        {
            "mode": "controller",
            "nodes": {
                "mac-mini": {
                    "url": "http://mac",
                    "request_types": {"coding": {"model": "gemma", "priority": 10}},
                },
            },
        }
    )
    policy = RoutingPolicy(
        config,
        model_running=lambda node, model: False,
        model_available=lambda node, model: True,
        node_startup_allowed=lambda node, model: False,
    )

    decision = await policy.choose(
        request_type="coding",
        requested_model=None,
        explicit_target="auto",
        previous_route=None,
    )

    assert decision.startup_needed is True
    assert decision.startup_decision == "defer"
    assert decision.reason == "request_type_model_available"


# ---------------------------------------------------------------------------
# Ticket 9.2 — Registry-Aware Placement (artifact-scored routing)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_artifact_presence_registered_preferred_over_gguf_present():
    """Registered candidate wins over gguf_present candidate even with lower priority."""
    config = load_config(
        {
            "mode": "controller",
            "nodes": {
                "node-a": {
                    "url": "http://a",
                    "request_types": {"general": {"model": "gemma", "priority": 10}},
                },
                "node-b": {
                    "url": "http://b",
                    "request_types": {"general": {"model": "gemma", "priority": 20}},
                },
            },
        }
    )

    def presence(node: str, model: str) -> str | None:
        if node == "node-a":
            return "gguf_present"
        if node == "node-b":
            return "registered"
        return None

    policy = RoutingPolicy(
        config,
        model_running=lambda node, model: False,
        model_artifact_presence=presence,
    )

    decision = await policy.choose(
        request_type="general",
        requested_model=None,
        explicit_target="auto",
        previous_route=None,
    )

    assert decision.node == "node-b"
    assert decision.reason == "request_type_artifact_registered"
    assert decision.startup_needed is True


@pytest.mark.asyncio
async def test_artifact_falls_through_to_gguf_present_when_no_registered():
    config = load_config(
        {
            "mode": "controller",
            "nodes": {
                "mac-mini": {
                    "url": "http://mac",
                    "request_types": {"general": {"model": "gemma", "priority": 10}},
                },
            },
        }
    )

    policy = RoutingPolicy(
        config,
        model_running=lambda node, model: False,
        model_artifact_presence=lambda node, model: "gguf_present",
    )

    decision = await policy.choose(
        request_type="general",
        requested_model=None,
        explicit_target="auto",
        previous_route=None,
    )

    assert decision.node == "mac-mini"
    assert decision.reason == "request_type_artifact_gguf_present"
    assert decision.startup_needed is True


@pytest.mark.asyncio
async def test_artifact_state_recorded_in_candidate_metadata():
    config = load_config(
        {
            "mode": "controller",
            "nodes": {
                "node-a": {
                    "url": "http://a",
                    "request_types": {"general": {"model": "m", "priority": 10}},
                },
                "node-b": {
                    "url": "http://b",
                    "request_types": {"general": {"model": "m", "priority": 20}},
                },
            },
        }
    )

    def presence(node: str, model: str) -> str | None:
        if node == "node-a":
            return "registered"
        return "gguf_present"

    policy = RoutingPolicy(
        config,
        model_running=lambda node, model: False,
        model_artifact_presence=presence,
    )

    decision = await policy.choose(
        request_type="general",
        requested_model=None,
        explicit_target="auto",
        previous_route=None,
    )

    states = {c["node"]: c.get("artifact_state") for c in decision.candidates}
    assert states["node-a"] == "registered"
    assert states["node-b"] == "gguf_present"


@pytest.mark.asyncio
async def test_artifact_none_skips_candidate():
    """Nodes where artifact_presence returns None are excluded."""
    config = load_config(
        {
            "mode": "controller",
            "nodes": {
                "node-a": {
                    "url": "http://a",
                    "request_types": {"general": {"model": "m", "priority": 10}},
                },
                "node-b": {
                    "url": "http://b",
                    "request_types": {"general": {"model": "m", "priority": 20}},
                },
            },
        }
    )

    def presence(node: str, model: str) -> str | None:
        if node == "node-b":
            return "registered"
        return None

    policy = RoutingPolicy(
        config,
        model_running=lambda node, model: False,
        model_artifact_presence=presence,
    )

    decision = await policy.choose(
        request_type="general",
        requested_model=None,
        explicit_target="auto",
        previous_route=None,
    )

    assert decision.node == "node-b"


@pytest.mark.asyncio
async def test_artifact_presence_with_async_callable():
    config = load_config(
        {
            "mode": "controller",
            "nodes": {
                "mac-mini": {"url": "http://mac", "default_model": "gemma"},
            },
        }
    )

    async def presence(node: str, model: str) -> str | None:
        return "registered"

    policy = RoutingPolicy(
        config,
        model_running=lambda node, model: False,
        model_artifact_presence=presence,
    )

    decision = await policy.choose(
        request_type="general",
        requested_model=None,
        explicit_target="auto",
        previous_route=None,
    )

    assert decision.startup_needed is True
    assert decision.reason == "fallback_artifact_registered"


@pytest.mark.asyncio
async def test_running_model_still_preferred_over_artifact_presence():
    """Running model takes priority; artifact_presence pass is never reached."""
    config = load_config(
        {
            "mode": "controller",
            "nodes": {
                "node-a": {
                    "url": "http://a",
                    "request_types": {"general": {"model": "m", "priority": 10}},
                },
                "node-b": {
                    "url": "http://b",
                    "request_types": {"general": {"model": "m", "priority": 20}},
                },
            },
        }
    )

    policy = RoutingPolicy(
        config,
        model_running=lambda node, model: node == "node-a",
        model_artifact_presence=lambda node, model: "registered",
    )

    decision = await policy.choose(
        request_type="general",
        requested_model=None,
        explicit_target="auto",
        previous_route=None,
    )

    assert decision.node == "node-a"
    assert decision.reason == "request_type"
    assert decision.startup_needed is False