# Architecture Overview

Neuraxis is a secure local/private LLM gateway with an operations console.
The controller owns the gateway surface for apps and operators; agents own local
model host work such as `llama-server` process lifecycle, model utilities, and
future agent-runtime execution.

This repository is intentionally split into three layers so behavior is easier to reason about and review:

- API layer (`llama_manager/api`): HTTP request/response translation and validation.
- Core layer (`llama_manager/core`): domain logic for process management, chat routing, orchestration, and persistence workflows.
- Provider/storage layer (`llama_manager/providers`, `llama_manager/storage`): external command composition and persistence primitives.

API routes live under package-style modules in `llama_manager/api/routes`:

- Single-resource routes use direct modules such as `routes.models`, `routes.library`, and `routes.health`.
- Grouped surfaces use packages such as `routes.auth`, `routes.chat`, and `routes.nodes`.
- Shared request/response helpers stay beside their route group, for example `routes.chat.common` and `routes.nodes.common`.

## Runtime Modes

`AppConfig.mode` controls deployment behavior:

- `agent`: manages local `llama-server` processes, model utilities, and local runtime capabilities.
- `controller`: tracks nodes, serves the private AI gateway, proxies operations, and manages durable job orchestration.

Both modes share the same codebase and routes; mode-specific routes enforce behavior at runtime.

## Operational Scripts

- `scripts/onboard_controller.sh`: creates or validates controller config, writes `.neuraxis.env`, runs migrations, creates the first admin API key, and prints the registration key for agents.
- `scripts/onboard_agent.sh`: creates or validates agent config, writes `.neuraxis.env`, generates the agent API key, and prints the controller `nodes:` entry.
- `scripts/start_agent.sh`, `scripts/start_controller.sh`, and `scripts/stop_server.sh`: source `.neuraxis.env` and manage local uvicorn processes.
- `scripts/regenerate_key.sh`: rotates controller registration or agent API keys and prints the matching update for the other machines.

## Request Flow (High-Level)

1. `llama_manager/main.py` builds app state (config, managers, stores).
2. Dependencies in `llama_manager/api/dependencies.py` inject shared services.
3. Route handlers validate request shape and call core services.
4. Core services own business rules and persistence writes.

## Core Ownership Map

- `core/config`: typed config models plus file/env loading and saving.
- `core/runtime`: local process lifecycle and health payload construction.
- `core/chat`: target resolution, transport building, capability inspection, and chat proxying.
- `core/nodes`: controller node registry plus agent heartbeat and worker loops.
- `core/plugins`: local-path plugin manifest loading, registration, events, policy hooks, route metadata, and plugin static asset ownership.
- `core/model_assets`: GGUF library registration, HF conversion, and quantization workflows.
- `core/orchestration`: durable job queue, attempts, events, contracts, retries, retention, archive export, and controller coordination.
- `core/persistence`: focused SQLite-backed persistence for auth, chat sessions, and audit events.
- `core/threads`: thread creation, append-only event log, routing policy, and multi-agent fanout/aggregation. See [multi-agent-routing.md](multi-agent-routing.md).

## Testing Strategy

- `tests/test_api.py`: broad route contracts, auth boundaries, setup assistant behavior, model/library operations, downloads, quantizations, node proxying, and compatibility routes.
- `tests/test_config.py` and `tests/test_alembic_config.py`: config loading, split config files, environment expansion, defaults, save behavior, and migration target URL resolution.
- `tests/test_process_manager.py`, `tests/test_runtime_overview.py`, and `tests/test_runtime_scripts.py`: local process lifecycle, runtime overview/route preview payloads, and helper script behavior.
- `tests/test_orchestration_store.py`, `tests/test_execution_substrate.py`, `tests/test_orchestration_orm_models.py`, and `tests/test_persistence_dto.py`: durable jobs, attempts, events, worker contracts, DTO mapping, retries, cancellation, and terminal-state behavior.
- `tests/test_thread_store.py`, `tests/test_threads_api.py`, and `tests/test_thread_routing_policy.py`: durable threads, event visibility, workflow execution, route decisions, affinity, startup decisions, and fanout routing.
- `tests/test_agent_tools.py`: configured tool adapters, safe-root enforcement, bounded output, tool-loop behavior, memory tools, and write/query constraints.
- `tests/test_downloads.py`, `tests/test_benchmark_api.py`, `tests/test_benchmark_store_orm.py`, `tests/test_model_transfers.py`, and `tests/test_model_transfer_smoke.py`: model asset downloads, benchmark definitions/runs, transfer manifests, transfer execution, and smoke-script coverage.
- `tests/test_gguf_library.py`, `tests/test_conversions.py`, `tests/test_quantizations.py`, and `tests/test_model_transfers.py`: model library scanning, conversion/quantization workflows, sidecar handling, and model file movement.
- `tests/test_agent_heartbeat.py`, `tests/test_node_registry.py`, `tests/test_linux_agent_smoke.py`, and `tests/test_routed_chat_compat_api.py`: node registration, heartbeat, controller routing, Linux agent smoke behavior, and external chat compatibility.
- Persistence stores have focused ORM tests, including auth, audit, chat sessions, app state, benchmark, and database infrastructure coverage.
- Frontend/static packaging is covered by `tests/test_frontend_tests.py`, `tests/test_ui_static_serving.py`, and `tests/test_package_data.py`, with React/Vite tests invoked through the Python suite.

## Review Heuristics

When reviewing changes, keep responsibilities narrow:

- Route files should not contain domain branching that belongs in `core`.
- Core modules should not perform implicit request parsing.
- Persistence changes should include tests for retries, timeout handling, and terminal-state transitions.

This keeps complexity bounded and allows reviewers to evaluate behavior by layer.

## Pull Request Rubric

Use this checklist before opening or approving a PR:

- Route vs Core boundary:
  - Route modules should do validation, dependency wiring, and HTTP error mapping only.
  - Business decisions, retries, and state transitions belong in `llama_manager/core`.
- Error mapping:
  - Upstream/network failures should be classified (`HTTP status` vs `transport`) and not collapsed into generic strings.
  - Preserve stable response keys for UI and API consumers.
- Status/result payload naming:
  - Use consistent keys for lifecycle states (`status`, `completed_at`, `error_code`, `error_detail`, `result`).
  - Avoid introducing synonymous fields for the same concept.
- Abstraction threshold:
  - Extract a helper when the same branching/payload logic appears in 2+ places.
  - Keep helpers private unless reused across modules.
- Test expectations:
  - Add or update tests for state-transition changes, retry/timeout behavior, and error-shape contracts.
  - Ensure full suite passes before merge.
