# Multi-Agent Routing

This document covers the thread event schema, fanout routing policy, and aggregation step introduced in the Multi-Agent Routing V2 feature set.

## Overview

Thread mode routes each user message through the controller, which selects a target node and model, calls the agent, and records the full interaction as a series of typed events. The features described here extend that baseline to support routing a single user turn to **multiple agents in parallel**, recording each agent's output as internal events, and returning one aggregated public response.

All three features are backward compatible. Existing single-node behavior is unchanged when fanout is not configured.

---

## Thread Event Schema (`turn_id`)

Every event appended to a thread now carries a `turn_id` — a UUID generated at the start of each user turn and shared by all events that belong to that turn. This allows downstream tools and queries to group events by logical conversation turn rather than by wall-clock time.

### Event types

| `event_type`       | `public` | Description |
|--------------------|----------|-------------|
| `user_message`     | true     | The user's message and merged request metadata |
| `routing_decision` | false    | Which node/model was chosen and why, with candidates |
| `agent_request`    | false    | Request dispatched to a specific agent node (fanout only) |
| `agent_response`   | false    | Raw response from a specific agent node (fanout only) |
| `aggregation`      | false    | Combined outputs from all fanout agents before the final response |
| `assistant_message`| true     | The final response returned to the caller |
| `error`            | true     | Routing or proxy failure |

`agent_request` and `agent_response` events are only emitted when fanout is active. In single-agent mode the `routing_decision` is followed directly by `assistant_message`.

### Fetching internal events

Internal events (all non-public types) are accessible via the threads API with admin credentials:

```
GET /threads/{thread_id}/events?include_internal=true
```

Non-admin callers receive only public events (`user_message`, `assistant_message`, `error`).

---

## Fanout Routing Policy

### What it does

When fanout is enabled, the routing policy selects a **primary node** using the normal deterministic priority order, then collects up to `routing_fanout_max - 1` additional eligible nodes from the same request-type candidate list. The full set of targets is returned as `fanout_targets` on the `RouteDecision`.

The `service` layer then dispatches to each target concurrently (sequentially in the current implementation), records `agent_request` and `agent_response` events for each, aggregates the outputs, and publishes one `assistant_message`.

### Configuration

Add these two fields to your controller config:

```yaml
mode: controller
routing_fanout_enabled: true   # default: false
routing_fanout_max: 3          # default: 2 (primary + 1 extra)

nodes:
  mac-mini:
    url: http://mac-mini:9000
    request_types:
      coding:
        model: gemma
        priority: 10
  linux-2080ti:
    url: http://linux:9000
    request_types:
      coding:
        model: qwen
        priority: 20
  workstation:
    url: http://workstation:9000
    request_types:
      coding:
        model: mistral
        priority: 30
```

With `routing_fanout_max: 3` and all three nodes running, a `coding` request fans out to all three in priority order (mac-mini first, then linux-2080ti, then workstation).

### Flag-off guarantee

When `routing_fanout_enabled: false` (the default), `fanout_targets` is always an empty tuple and the service takes the original single-agent code path exactly. No internal `agent_request`, `agent_response`, or `aggregation` events are recorded.

### Fanout scope

Fanout only applies to the `request_type` routing path. Thread affinity, explicit `node:` targets, and the fallback path always return a single node regardless of the flag.

---

## Aggregation Step

### How it works

When `fanout_targets` is non-empty, `ThreadService` runs the following sequence for each target in order:

1. Appends an internal `agent_request` event with the node, model, and messages payload
2. Calls `chat_proxy.chat_with_meta` for that node
3. Appends an internal `agent_response` event with the response text (or an error marker if the call failed)

After all targets have been attempted:

4. Appends one internal `aggregation` event containing the full list of outputs
5. Appends one public `assistant_message` with all successful responses joined by `\n\n---\n\n`

### Partial failures

If one or more agents fail, their outputs are recorded as `[error: ...]` in the `aggregation` event and excluded from the public response. As long as at least one agent succeeds, the user receives a valid `assistant_message`. If every agent fails, the public response text is `[no successful agent responses]`.

### Example internal event sequence (2-node fanout)

```
user_message        (public)
routing_decision    (internal)
agent_request       (internal) — node: mac-mini
agent_response      (internal) — node: mac-mini
agent_request       (internal) — node: linux-2080ti
agent_response      (internal) — node: linux-2080ti
aggregation         (internal) — outputs: [{mac-mini: "..."}, {linux-2080ti: "..."}]
assistant_message   (public)   — joined text
```

All seven events share the same `turn_id`.

### Aggregation strategy

The current strategy is simple concatenation with a `---` separator. The
primary node's response appears first. There is no model-based aggregation
step in the current routing path.

---

---

## Startup Decision Engine

### Overview

When the routing policy selects a candidate node where the model is **not currently running** (via the availability pass), it now also decides whether a new model instance *should* be started immediately.

This decision is recorded on the `RouteDecision` as two new fields:

| Field | Type | Description |
|---|---|---|
| `startup_needed` | `bool` | `True` when the model was not running at route time |
| `startup_decision` | `str \| None` | `"start_now"` or `"defer"` (only set when `startup_needed` is `True`) |

These fields surface in the internal `routing_decision` event content alongside `node`, `model`, `reason`, and `candidates`.

### Capacity check

The policy calls `_thread_node_startup_allowed` in `main.py`, which:

1. Reads `NodeConfig.max_running_models` for the target node.
2. If set, queries `GET /models` on the node and counts how many models are currently `running`.
3. Returns `False` (→ `"defer"`) when `running_count >= max_running_models`.
4. Returns `True` (→ `"start_now"`) when under the limit, or when `max_running_models` is not set.

### Configuration

```yaml
nodes:
  mac-mini:
    url: http://mac-mini:9000
    max_running_models: 2
  rpi-worker:
    url: http://rpi:9000
    max_running_models: 1
```

### What `startup_decision` does today

The current implementation records the decision as metadata. It does **not**
automatically trigger `POST /models/{name}/start`. The benchmark
managed-lifecycle feature (`managed_load`) is an example of a caller that reads
this signal to drive the full lifecycle.

---

## Registry-Aware Placement

### Overview

Previously, the availability pass only called `model_available`, which returned a boolean. Now it queries `model_artifact_presence`, which returns one of three tiers:

| Return value | Meaning |
|---|---|
| `"registered"` | Model entry exists in the agent's config (registered via library) |
| `"gguf_present"` | GGUF file is on disk in the agent's library but not yet registered |
| `None` | Model artifact is not present on this node |

### Candidate scoring

Within the availability pass, candidates are scored as follows:

1. **Running** — model is already loaded. Returned immediately (no startup needed).
2. **Registered** — model is configured on the node but not running. Preferred over `gguf_present`.
3. **GGUF present** — file is on disk. Useful fallback when a model has been received via transfer but not yet registered.
4. **None** — node is excluded from consideration for this request.

Within each tier, the existing `priority` order from the `request_types` config is preserved.

### Route reason strings

The `reason` field on the routing decision reflects the path taken:

| Reason | Meaning |
|---|---|
| `request_type` | Model was running; chosen via request-type priority |
| `request_type_artifact_registered` | Model was registered but not running; chosen via request-type |
| `request_type_artifact_gguf_present` | GGUF file found but unregistered; chosen via request-type |
| `request_type_model_available` | Legacy path (when `model_artifact_presence` is not wired) |
| `fallback` | Model was running; chosen via fallback |
| `fallback_artifact_registered` | Model registered but not running; chosen via fallback |
| `fallback_artifact_gguf_present` | GGUF present but unregistered; chosen via fallback |
| `fallback_model_available` | Legacy fallback path |
| `thread_affinity` | Previous turn's node reused (model still running) |
| `explicit_target` | Explicit `node:` target specified |

### Example: received transfer routes to the right node

Node `linux-2080ti` just received a GGUF via model transfer. It is not registered. Node `mac-mini` has no artifact. A `coding` request arrives:

```
1. Check running:      mac-mini: no    linux-2080ti: no
2. Check artifacts:    mac-mini: None  linux-2080ti: gguf_present
3. Route → linux-2080ti, reason: request_type_artifact_gguf_present, startup_decision: start_now
```

The internal `routing_decision` event records `artifact_state: "gguf_present"` in the candidate metadata.

---

## API reference

These features use the existing threads endpoints — no new routes were added.

```
POST /threads                              Create a thread
POST /threads/{thread_id}/messages         Send a user message (triggers fanout if configured)
GET  /threads/{thread_id}/events           Public events only
GET  /threads/{thread_id}/events?include_internal=true   All events (admin only)
```

See [api.md](api.md) for full request/response shapes.
