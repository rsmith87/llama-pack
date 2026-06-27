# Configuration

Set `LLAMA_PACK_CONFIG` to a YAML file path. Set `LLAMA_PACK_MODE` to override
the mode without editing the file. Valid backend modes are `agent` and
`controller`. The setup UI's Standalone option writes an `agent` config for a
single-machine install; it is not a `mode:` value.

## Network Exposure

Llama Pack can run in either direct HTTP mode or behind Caddy:

| Mode | Uvicorn bind | URLs | Notes |
| --- | --- | --- | --- |
| Direct LAN HTTP | `LLAMA_PACK_HOST=0.0.0.0` | `http://<host>:9137` | Simple setup, but controller/agent traffic is plaintext. |
| Caddy/local TLS | `LLAMA_PACK_HOST=127.0.0.1` | `https://<host>.local` | Recommended for encrypted inter-machine traffic. Caddy listens on `443` and proxies to local uvicorn. |

The `models.*.host` fields below control `llama-server` bind addresses, not the
Llama Pack FastAPI/uvicorn bind address. Prefer `127.0.0.1` for model hosts when
Llama Pack proxies model access.

```yaml
mode: agent
llama_server_bin: llama-server
llama_cpp_dir: ./llama.cpp
python_bin: ./.venv/bin/python
hf_models_dirs:
  - ./models/HFModels
  - ./models/OtherModels
log_dir: ./logs

models:
  qwen-coder:
    path: ./models/qwen-coder.gguf
    port: 8081
    ctx: 16384
    gpu_layers: 999
    host: 127.0.0.1
    profiles:
      fast:
        ctx: 8192
        gpu_layers: 999
        order: 10
        kind: interactive
        kv_cache_policy: gpu-preferred
        resource_tier: low
      long:
        ctx: 131072
        gpu_layers: 20
        order: 30
        kind: long-context
        kv_cache_policy: cpu-ok
        resource_tier: high
        extra_args:
          - "--cache-type-k"
          - "q4_0"
          - "--cache-type-v"
          - "q4_0"

nodes:
  mac-mini:
    url: http://127.0.0.1:9000
  windows-2080ti:
    url: ${LLAMA_PACK_WINDOWS_2080TI_AGENT_URL}
```

## Offline Mode

`offline_mode` blocks Llama Pack public outbound network calls while preserving
loopback, private LAN ranges, configured controller/agent URLs, configured node
URLs, and explicit allowlist entries.

```yaml
offline_mode: true
offline_allowed_hosts:
  - mirror.example.internal
offline_allowed_cidrs:
  - 100.64.0.0/10
```

Use this after required model artifacts have been downloaded and distributed to
the nodes that need them. Hugging Face downloads and remote lookup helpers
require `offline_mode: false`. This is app-level enforcement, not an operating
system firewall.

## Split Config Files

For small installs, a single `config.yaml` is still fine. For controllers,
multi-node agents, or configs with many models and tool definitions, the root
config file can also act as a manifest that links to files in a config
directory.

```yaml
mode: agent
files:
  runtime: config/runtime.yaml
  models: config/models.yaml
  agent_tools: config/agent_tools.yaml
  auth: config/auth.yaml
  persistence: config/persistence.yaml
  routing: config/routing.yaml
  nodes: config/nodes.yaml
  memory: config/memory.yaml
```

Linked paths are resolved relative to the root config file. Linked file values
are loaded first, then inline values in the root config override linked values.
Environment placeholders such as `${LLAMA_PACK_AGENT_URL}` are expanded
after the files are merged.

`models`, `nodes`, `agent_tools`, and `memory` are direct section files. Their
linked YAML content is the value of that top-level config field:

```yaml
# config/models.yaml
qwen-coder:
  path: /models/qwen-coder.gguf
  port: 8081
  ctx: 16384
  gpu_layers: 999
```

`runtime`, `auth`, `persistence`, and `routing` are grouped files. They contain
only the top-level fields that belong to that group:

```yaml
# config/runtime.yaml
llama_server_bin: /home/USER/Apps/llama.cpp/build/bin/llama-server
llama_cpp_dir: /home/USER/Apps/llama.cpp
python_bin: /home/USER/Apps/llama.cpp/.venv/bin/python
hf_models_dirs:
  - /Volumes/4TB/HFModels
log_dir: ./logs
controller_url: ${LLAMA_PACK_CONTROLLER_URL}
node_name: mac-mini
agent_url: ${LLAMA_PACK_AGENT_URL}
heartbeat_interval_seconds: 30
```

`hf_models_dirs` is the bootstrap/default list of local model roots. Admins can
change the active roots for a running node from **System Settings -> Storage**;
those UI changes are stored in the settings database and override this YAML
field until updated again.

```yaml
# config/auth.yaml
agent_api_key: ${LLAMA_PACK_AGENT_API_KEY}
controller_registration_key_outbound: ${LLAMA_PACK_CONTROLLER_REGISTRATION_KEY}
```

```yaml
# config/persistence.yaml
controller_db_url: sqlite+pysqlite:///./logs/controller_state.db
auth_db_url: sqlite+pysqlite:///./logs/auth_store.db
audit_db_url: sqlite+pysqlite:///./logs/audit_events.db
chat_sessions_db_url: sqlite+pysqlite:///./logs/chat_sessions.db
downloads_db_url: sqlite+pysqlite:///./logs/downloads.db
benchmarks_db_url: sqlite+pysqlite:///./logs/benchmarks.db
models_db_url: sqlite+pysqlite:///./logs/models.db
settings_db_url: sqlite+pysqlite:///./logs/settings.db
controller_retention_days: 30
controller_archive_retention_days: 90
controller_archive_dir: ./logs/archive
```

```yaml
# config/routing.yaml
routing_fanout_enabled: true
routing_fanout_max: 3
agent_worker_enabled: true
agent_worker_poll_interval_seconds: 2
agent_worker_max_jobs: 1
agent_worker_labels:
  gpu: metal
agent_worker_capacity:
  llm.generate: 1
```

Unknown file keys are rejected. Grouped files are also validated so fields from
the wrong group fail fast; for example, `models:` is not allowed inside
`config/persistence.yaml`.

When runtime code calls `save_config()` for a split config, linked sections are
written back to their linked files and the root manifest keeps only root-owned
fields plus the `files:` mapping. This keeps generated model, node, and tool
updates out of the root file when those sections are split.

Model persistence note:
When `models_db_url` is configured and the models DB is migrated, the database
is the authoritative source of truth for registered models, profiles,
deployments, and companion links. YAML `models:` entries are only used for
one-time bootstrap/backfill into the DB when present; runtime model changes do
not persist back into YAML.

## Plugin Config

Plugins are discovered only from configured local paths. Enable a plugin by
listing its id in `enabled_plugins` and providing a matching entry in
`plugins`:

```yaml
enabled_plugins:
  - hello_plugin

plugins:
  hello_plugin:
    path: ./plugins/hello_plugin
    enabled: true
    config:
      reject_chat: false
```

Plugin manifests can declare a `config_schema` with `string`, `integer`,
`number`, and `boolean` fields. Required values are validated before plugin
registration. Fields marked `secret: true` are passed to the plugin at runtime
but redacted as `<redacted>` in plugin status metadata.

```yaml
config_schema:
  properties:
    api_key:
      type: string
      secret: true
    max_items:
      type: integer
  required:
    - api_key
```

Plugins can also register migration metadata during `register()`:

```python
database = context.get_database("main")
context.add_migration_target(
    "main",
    directory="hello_plugin/migrations",
    database=database,
)
```

Core reports those targets through:

```text
GET  /lm-api/v1/plugins/{plugin_id}/migrations/status
POST /lm-api/v1/plugins/{plugin_id}/migrations/{target_id}/upgrade
```

Pending or missing plugin migrations appear as warnings in
`/lm-api/v1/plugins/status`. Core does not run plugin migrations during startup;
migration execution is explicit through the plugin migration API.

For the full manifest and extension API reference, see
[Plugin Author Guide](plugins.md).

## Agent Config

Use `mode: agent` on each machine that actually runs `llama-server` processes. Agent mode owns:

- local model definitions under `models`
- `llama_server_bin` startup for each configured model
- local log files and model process lifecycle
- optional local conversion/library workflows (`hf_models_dirs`, `llama_cpp_dir`, `python_bin`)

Example:

```yaml
mode: agent
llama_server_bin: /home/USER/Apps/llama.cpp/build/bin/llama-server
llama_cpp_dir: /home/USER/Apps/llama.cpp
python_bin: /home/USER/Apps/llama.cpp/.venv/bin/python
hf_models_dirs:
  - /Volumes/4TB/HFModels
log_dir: ./logs

models:
  qwen-coder:
    path: /home/USER/models/qwen-coder.gguf
    port: 8081
    ctx: 16384
    gpu_layers: 999
    host: 127.0.0.1
    reasoning: auto
    reasoning_budget: 2048
    extra_args: []
    supports_json_schema: false
    supports_grammar: false
    supports_mtp: true
    speculative:
      mode: mtp
      draft_model_path: ./models/mtp-qwen-coder.gguf
      draft_max: 3
      draft_min: 0
    vision: false
    mmproj: null
    strengths:
      - coding
      - structured
    cost_tier: medium
    profiles:
      fast:
        ctx: 8192
        gpu_layers: 999
        order: 10
        kind: interactive
        kv_cache_policy: gpu-preferred
        resource_tier: low
        cost_tier: low
      long:
        ctx: 131072
        gpu_layers: 20
        order: 30
        kind: long-context
        kv_cache_policy: cpu-ok
        resource_tier: high
        strengths:
          - coding
          - long_context
        cost_tier: high
        extra_args:
          - "--cache-type-k"
          - "q4_0"
          - "--cache-type-v"
          - "q4_0"
```

Nested `profiles` are optional. When present, the model key is the logical
family and each profile is a concrete runtime instance such as
`qwen-coder:fast` or `qwen-coder:long`. Profile values override the base model
for startup; if a profile omits `port`, Llama Pack derives one from the base
port plus the profile `order`.

Optional `strengths` and `cost_tier` metadata help the route preview explain
which model should handle an explicit request type. `strengths` are lowercase
task labels such as `coding`, `summarization`, `structured`, `vision`, and
`long_context`. `cost_tier` can be `low`, `medium`, or `high`. Profile values
override the base model for preview scoring.

For scripted setup, install llama.cpp before or during agent onboarding:

```bash
scripts/install_llama_cpp.sh --backend auto
scripts/onboard_agent.sh \
  --controller-url "$LLAMA_PACK_CONTROLLER_URL" \
  --agent-url "$LLAMA_PACK_AGENT_URL" \
  --install-llama-cpp \
  --llama-cpp-backend auto
```

The `auto` backend is GPU-first: Apple Silicon selects Metal, hosts with
`nvcc` select CUDA, and other machines fall back to CPU. Force a backend with
`--backend cuda`, `--backend metal`, or `--backend cpu` when hardware detection
is not the right choice. Onboarding writes the generated agent config to the
same checkout paths used by the installer.

## Controller Config

Use `mode: controller` on a central machine that coordinates agents. Controller mode owns:

- the `nodes` list (agent base URLs)
- node health/status aggregation
- proxying model start/stop/restart/log calls to each node

Example:

```yaml
mode: controller
log_dir: ./logs

nodes:
  mac-mini:
    url: http://127.0.0.1:9000
  windows-2080ti:
    url: ${LLAMA_PACK_WINDOWS_2080TI_AGENT_URL}
    api_key: your-agent-api-key-if-enabled
    verify_tls: true
    max_running_models: 1   # optional — limits concurrent model instances on this node
```

### Node capacity (optional)

Set `max_running_models` on any node to cap how many model instances it may run simultaneously. The routing policy uses this when deciding whether to start a model on a node:

- If the node is already at capacity, the route is still selected but `startup_decision` is recorded as `"defer"` in the internal routing event.
- If the node has room, `startup_decision` is `"start_now"`.
- If `max_running_models` is omitted, the policy always records `"start_now"`.

```yaml
nodes:
  mac-mini:
    url: http://mac-mini:9000
    max_running_models: 2   # can run up to 2 models concurrently
  rpi-worker:
    url: http://rpi:9000
    max_running_models: 1   # RAM-constrained — only one at a time
```

### Registry-aware placement (optional)

When a requested model is not currently running on any node, the routing policy checks each candidate node for **model artifact presence** before giving up:

| Presence tier | Meaning |
|---|---|
| `registered` | Model is in the node's config (known to the agent) |
| `gguf_present` | GGUF file exists on the node's library disk but is not yet registered |

Candidates with `registered` presence are always preferred over `gguf_present`. Within each tier, the existing `priority` order is preserved. The chosen presence tier is recorded as part of the `startup_decision` metadata in the internal routing event (e.g. `request_type_artifact_registered`).

This means the controller can route to a node that **could** run a model, not just nodes where one is already running, and the caller or an orchestration layer can act on the `startup_decision` field to trigger the actual model start.

See [multi-agent-routing.md](multi-agent-routing.md) for the full routing decision flow.

### Fanout routing (optional)

Add these fields to a controller config to enable multi-agent fanout:

```yaml
routing_fanout_enabled: true   # default: false
routing_fanout_max: 3          # default: 2 (primary + up to N-1 additional nodes)
```

See [multi-agent-routing.md](multi-agent-routing.md) for full details.

## Raspberry Pi Controller Config

If the Raspberry Pi is the always-on coordinator, run it in `controller` mode and point all agent machines at the Pi's URL. Use `raspberry-pi-controller.config.example.yaml` as a starting point:

```bash
scripts/onboard_controller.sh \
  --config raspberry-pi-controller.config.yaml \
  --template raspberry-pi-controller.config.example.yaml
scripts/start_controller.sh
```

```yaml
mode: controller
log_dir: /home/{user_name}/llama-pack/logs

controller_registration_key: ${LLAMA_PACK_CONTROLLER_REGISTRATION_KEY}
node_heartbeat_timeout_seconds: 90

controller_db_url: sqlite+pysqlite:////home/{user_name}/llama-pack/logs/controller_state.db
auth_db_url: sqlite+pysqlite:////home/{user_name}/llama-pack/logs/auth_store.db
audit_db_url: sqlite+pysqlite:////home/{user_name}/llama-pack/logs/audit_events.db
chat_sessions_db_url: sqlite+pysqlite:////home/{user_name}/llama-pack/logs/chat_sessions.db

nodes:
  mac-mini:
    url: ${LLAMA_PACK_MAC_MINI_AGENT_URL}
    api_key: ${LLAMA_PACK_MAC_MINI_AGENT_API_KEY}
    verify_tls: true
  linux-2080ti:
    url: ${LLAMA_PACK_LINUX_2080TI_AGENT_URL}
    api_key: ${LLAMA_PACK_LINUX_2080TI_AGENT_API_KEY}
    verify_tls: true
```

Manual startup is also available:

```bash
LLAMA_PACK_CONFIG=raspberry-pi-controller.config.yaml uvicorn llama_pack.main:app --host 127.0.0.1 --port 9137
```

Agents should run `scripts/onboard_agent.sh --controller-url "$LLAMA_PACK_CONTROLLER_URL" --agent-url "$LLAMA_PACK_AGENT_URL"`, or manually keep `controller_url` as `${LLAMA_PACK_CONTROLLER_URL}`, keep `agent_url` as `${LLAMA_PACK_AGENT_URL}`, and send the same registration key through `controller_registration_key_outbound`.

For the current Raspberry Pi controller topology and smoke checks, see
[Raspberry Pi Controller Topology](pi-controller-topology.md).

## Optional Security And Registration Fields

- Agent-side auth: `agent_api_key` requires clients to send `X-Llama-Pack-Key`.
- Controller-to-agent auth per node: `nodes.<name>.api_key`.
- Auto-registration auth: `controller_registration_key` on controller, `controller_registration_key_outbound` on agent.
- Agent heartbeat/registration fields: `controller_url`, `node_name`, `agent_url`, `heartbeat_interval_seconds`.
- Stale node timeout on controller: `node_heartbeat_timeout_seconds`.
- Browser external client origins: `client_cors_origins` enables CORS for
  explicitly listed origins such as `http://localhost:5173`. Leave it empty for
  same-origin UI, CLI clients, server-to-server clients, and Electron apps that
  do not need browser CORS.

## Optional Controller Persistence And Retention Fields

- `controller_db_url`: optional SQLite URL/path override for controller orchestration state.
- `models_db_url`: optional SQLite URL/path override for model asset and model catalog state.
- `settings_db_url`: optional SQLite URL/path override for durable runtime settings and the tool catalog.
- `controller_instance_id`: identifier used for controller leader leases.
- `controller_leader_lease_seconds`: lease duration for the controller sweeper.
- `controller_retention_days`: active job/event retention window.
- `controller_archive_retention_days`: exported archive retention window.
- `controller_archive_dir`: archive export directory.

## Optional Agent Worker Fields

- `agent_worker_enabled`: opt in to background work claiming from `controller_url`.
- `agent_worker_poll_interval_seconds`: polling interval when enabled.

## Optional Runtime Settings Fields

The Settings UI and `/lm-api/v1/settings/runtime` can persist selected runtime
settings in the `settings` database target. This lets operators adjust
supported settings without hand-editing YAML. Unsupported keys are rejected
rather than silently ignored.

The agent tool catalog is exposed separately at
`/lm-api/v1/settings/tool-catalog`. Patches require an admin session and update
the effective in-process config after they are written.

## Controller Memory Subsystem

Controllers can maintain a persistent semantic memory store backed by ChromaDB
and a local embedding model. Memory is **controller-only** — agent nodes never
load ChromaDB or `sentence-transformers` directly.

The memory store is disabled by default. To enable it:

```bash
scripts/onboard_controller.sh --enable-memory
```

The onboarding script installs the optional `controller-memory` extras,
downloads the default embedding model, writes the `memory:` block, validates
the controller config, and stores `LLAMA_PACK_MEMORY_MODEL_PATH` in
`.llama_pack.env`. Override paths when needed:

```bash
scripts/onboard_controller.sh \
  --enable-memory \
  --memory-model-path ./models/embedding/all-MiniLM-L6-v2 \
  --memory-store-path ./logs/agent_memory
```

The resulting config includes:

```yaml
memory:
  enabled: true
  path: ./logs/agent_memory          # ChromaDB persistence directory
  embedding_model_path: ./models/embedding/all-MiniLM-L6-v2
  auto_inject: true                  # prepend top-K memories to every chat request
  top_k: 3                           # memories retrieved per request
  soft_cap: 500                      # max entries before eviction runs
  ephemeral_ttl_days: 7              # TTL for ephemeral-tier entries
  durable_ttl_days: 90               # TTL for durable-tier entries
```

If extras or model installation fails, rerun the printed recovery command:

```bash
uv pip install -e '.[controller-memory]'
scripts/install_embedding_model.sh ./models/embedding/all-MiniLM-L6-v2
```

For offline hosts where the extras and model are already present, use
`--skip-memory-install --memory-model-path PATH`; onboarding will still fail
clearly if the embedding model directory does not exist.

If `enabled: false` or the embedding model path does not exist at startup, the
store self-disables with a warning and all memory operations become silent
no-ops — the controller continues to operate normally.

### Memory tiers

| Tier | Written by | TTL | Eviction priority |
|---|---|---|---|
| `permanent` | Explicit instruction | Never | Never evicted |
| `durable` | Model inference (high-value fact) | `durable_ttl_days` from last access | Low |
| `ephemeral` | Model inference (task note) | `ephemeral_ttl_days` from last access | First evicted |

TTL is access-based — each retrieval resets the clock. When the collection
exceeds `soft_cap`, the lowest-scoring ephemeral entries are pruned first.
Duplicate detection uses cosine similarity (threshold 0.92); near-identical
entries are updated in place rather than duplicated.

### Auto-injection

When `auto_inject: true`, the controller fetches the top-`top_k` most relevant
memories for every incoming chat request and prepends them as a `[Memory]`
block in the system message before routing to the selected agent. This is
transparent to the agent — it sees a normal chat request with enriched context.
- `agent_worker_max_jobs`: maximum jobs to claim per poll.
- `agent_worker_labels`: labels advertised to the controller claim matcher.
- `agent_worker_capacity`: numeric/string capacity advertised to the controller claim matcher.

Agent workers must be registered/configured on the controller under `nodes.<name>` with an `api_key`. The agent sends its `agent_api_key` as `X-Llama-Pack-Key` when claiming or updating work; unknown nodes and nodes without an API key are rejected.

The first typed worker contract is `llm.generate`. It is intentionally narrow and reuses the existing chat payload shape (`model`, `messages`, sampling fields, structured-output fields, `reasoning`, and optional `target`/`requirements`). Future typed contracts are tracked in `superpowers/plans/2026-05-12-execution-substrate.md`.

## Model Capability Hints

Optional chat capability hint fields per model:

- `supports_json_schema`: override capability introspection for JSON Schema structured output.
- `supports_grammar`: override capability introspection for grammar structured output.
- `supports_mtp`: mark whether the configured model/runtime combination is known to support MTP speculative decoding.
- `speculative`: optional model-level speculative decoding block. The first supported mode is `mtp`.
  `draft_model_path` maps to `--model-draft`. `draft_max` maps to `--spec-draft-n-max` and `draft_min` maps to `--spec-draft-n-min`.
  For `speculative.mode: mtp`, `supports_mtp` must be `true`.
- Advanced speculative controls such as probability thresholds and backend-sampling are intentionally deferred to a future advanced speculative configuration pass.
- A future model source enhancement should allow storing Hugging Face repository metadata such as `hf_repo` so Llama Pack can support repo-aware launch behavior and later check for model updates.
- `extra_args`: capability fallback infers structured output support when args include tokens like `json-schema` or `grammar`.
- `reasoning` and `reasoning_budget`: configure llama.cpp reasoning mode and budget for supported models.
- `vision` and `mmproj`: mark multimodal models and point to the matching projector file.
- `favorite`: mark a model as a UI favorite so it sorts first in model tables.
- `profiles`: optional named runtime profiles grouped under the model family.
  Each profile can override `ctx`, `port`, `gpu_layers`, `host`, and
  `extra_args`, and can include forward-looking metadata such as `kind`,
  `kv_cache_policy`, `resource_tier`, `strengths`, and `cost_tier`.

## Agent-Local Tool Calling

Agent mode can run a managed tool loop for direct local testing. Tools are
disabled by default and must be named explicitly in YAML or enabled through the
runtime settings tool catalog. V1 supports fixed tool adapters only; it does
not expose arbitrary commands, paths, or URLs from model output.

```yaml
mode: agent
log_dir: ./logs

agent_tools:
  enabled: true
  max_iterations: 4
  tool_timeout_seconds: 10
  safe_roots:
    - ./logs
    - /home/USER/Apps/llama-pack
  tools:
    list_runtime_status:
      type: shell
      description: Print a short runtime status line.
      command: ["printf", "agent runtime ok"]
    read_agent_note:
      type: file_read
      description: Read a local agent note.
      path: ./logs/agent-note.txt
    read_project_file:
      type: file_read_dynamic
      description: Read a project or log file by relative path.
      path: /home/USER/Apps/llama-pack
    list_project_files:
      type: directory_list
      description: List top-level and one-level-deep project files.
      path: /home/USER/Apps/llama-pack
      recursive: true
      max_depth: 1
      max_entries: 200
      include_hidden: false
    local_health:
      type: http
      description: Fetch local health.
      method: GET
      url: http://127.0.0.1:9137/health
```

Additional supported adapters include `file_write`, `file_search`,
`text_search`, `git_status`, `git_diff`, `git_log`, `process_status`,
`http_json`, `log_tail`, `web_fetch`, `sqlite_query`, `memory_write`, and
`memory_search`. Tool names must match `^[A-Za-z_][A-Za-z0-9_]{0,63}$`.
Filesystem and git-backed tools must resolve under `agent_tools.safe_roots`.

To test on an agent, tail the trace log and send a non-streaming OpenAI chat
request with `tool_runtime: "agent"`:

```bash
tail -f ./logs/agent_tool_calls.jsonl
```

```bash
curl -s http://127.0.0.1:9137/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "X-Llama-Pack-Key: $LLAMA_PACK_API_KEY" \
  -d '{
    "model": "qwen",
    "messages": [
      {"role": "user", "content": "Use list_runtime_status and summarize the result."}
    ],
    "tool_runtime": "agent",
    "stream": false
  }'
```

Streaming managed-tool requests are rejected in v1. Controllers do not execute
tools yet; future controller delegation should forward tool-capable turns to a
selected agent and let that agent run this same local loop.

Windows paths work in YAML:

```yaml
models:
  gemma4-e2b:
    path: C:\models\gemma4-e2b.gguf
    port: 8080
    ctx: 8192
    gpu_layers: 999
```
