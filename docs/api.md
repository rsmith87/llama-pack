# API

This page lists the main HTTP endpoints and documents the gateway surface for
applications that call Llama Pack as a private AI backend.

## External Chat Compatibility

Use an external app key with the OpenAI-compatible chat endpoint as the primary
integration surface for other apps. External app keys are chat-only credentials:
they can call the consumer completion APIs, but they cannot use admin,
operator, node, model, auth, audit, or settings endpoints.

```bash
curl -X POST http://127.0.0.1:9137/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "X-Llama-Pack-Key: $LLAMA_PACK_API_KEY" \
  -d '{
    "model": "qwen",
    "messages": [
      {"role": "user", "content": "Write a concise status update."}
    ],
    "request_type": "coding",
    "stream": false
  }'
```

On a controller, `request_type` routes the call through
`nodes.<name>.request_types` using the same values as threaded chat, such as
`general`, `coding`, or `research`. Llama Pack creates a durable thread by
default and returns routing metadata in response headers:

```text
X-Llama-Pack-Thread-Id: ...
X-Llama-Pack-Route: node:linux-2080ti
X-Llama-Pack-Node: linux-2080ti
X-Llama-Pack-Model: qwen
```

Send `thread_id` on later calls to append to the same durable record and keep
thread affinity when the previous route is still eligible. The JSON response
body stays OpenAI-compatible.

Older Ollama clients can point at the compatibility route. The same external
app key boundary applies here:

```bash
curl -X POST http://127.0.0.1:9137/api/chat \
  -H "Content-Type: application/json" \
  -H "X-Llama-Pack-Key: $LLAMA_PACK_API_KEY" \
  -d '{
    "model": "qwen",
    "messages": [
      {"role": "user", "content": "Write a concise status update."}
    ],
    "request_type": "coding",
    "stream": false,
    "options": {
      "temperature": 0.2,
      "num_predict": 256
    }
  }'
```

`/api/chat` preserves Ollama-style response bodies and streaming newline JSON,
while still using controller routing and the same metadata headers. Successful
external app calls write safe audit metadata, including key id, endpoint,
request type, routed node, and model. Prompt and response text are not written
to the audit event. The external app key list also stores a latest-use summary
for each key: last used time, endpoint, route, node, model, and request type.

## Client Discovery

Standalone clients should call `GET /lm-api/v1/client-discovery` before
presenting setup or login options. The endpoint is public so a client can detect
Llama Pack before it has credentials.

Example response:

```json
{
  "product": "llama-pack",
  "version": "unknown",
  "mode": "controller",
  "capabilities": {
    "openaiChatCompletions": true,
    "streaming": true,
    "localChatSessions": false,
    "setupDiagnostics": true,
    "pluginAuth": false
  },
  "auth": {
    "methods": ["llama_pack_api_key", "external_api_key"],
    "sessionHeader": "X-UI-Session",
    "apiKeyHeader": "X-Llama-Pack-Key"
  },
  "endpoints": {
    "openaiChatCompletions": "/v1/chat/completions",
    "openaiModels": "/v1/models",
    "clientSession": "/v1/client/session",
    "clientSetupDiagnostics": "/v1/client/diagnostics/setup",
    "clientChatDiagnostics": "/v1/client/diagnostics/chat",
    "models": "/lm-api/v1/models",
    "pluginsStatus": "/lm-api/v1/plugins/status",
    "docs": "/ui/docs"
  },
  "setup": {
    "recommendedApp": "campfire",
    "authMethod": "external_api_key",
    "diagnosticsEndpoint": "/v1/client/diagnostics/setup",
    "modelsEndpoint": "/v1/models",
    "chatEndpoint": "/v1/chat/completions",
    "requiredHeaders": ["X-Llama-Pack-Key"]
  }
}
```

When an enabled plugin declares healthy client auth metadata, discovery adds
that plugin method to `auth.methods` and reports the plugin-owned auth endpoint
under the manifest's configured endpoint key. Clients should treat absent
capability fields as unsupported and should prefer `/v1/chat/completions` for
end-user chat.

External chat-only keys can call:

- `GET /v1/models` to retrieve an end-user-safe model list.
- `GET /v1/client/session` to retrieve the current client's auth method, chat
  capabilities, and usable model list.
- `POST /v1/client/diagnostics/setup` to verify auth, model availability,
  route resolution, and chat in one setup request.
- `POST /v1/client/diagnostics/chat` to verify auth, route resolution, and
  non-streaming or streaming chat for setup flows.
- `POST /v1/client/project-context/{action}` for supported client project
  context actions.

These routes intentionally avoid admin/runtime details from `/lm-api/v1/models`.
For standalone end-user chat apps, prefer external app keys with the
`X-Llama-Pack-Key` header. Use UI sessions for the built-in operator/admin
UI. Plugin-provided auth modes should be discovered through client discovery and
handled by plugin-owned routes.

Example model list response:

```json
{
  "object": "list",
  "data": [
    {
      "id": "qwen",
      "object": "model",
      "owned_by": "llama-pack",
      "metadata": {
        "display_label": "qwen",
        "request_types": ["coding"],
        "default_request_type": "coding",
        "context_identity": "qwen",
        "model_family": "qwen",
        "context_profile": null,
        "capabilities": {
          "streaming": true,
          "json_schema": false,
          "grammar": false,
          "vision": false
        }
      }
    }
  ]
}
```

Example diagnostics request:

```bash
curl -X POST http://127.0.0.1:9137/v1/client/diagnostics/chat \
  -H "Content-Type: application/json" \
  -H "X-Llama-Pack-Key: $LLAMA_PACK_EXTERNAL_APP_KEY" \
  -d '{"model":"qwen","request_type":"coding","stream":false}'
```

Campfire-style setup flows should prefer `/v1/client/diagnostics/setup` with
the same request body. It returns `checks.auth`, `checks.modelAvailable`,
`checks.routeResolved`, `checks.chat`, and `availableModels` so an external app
can validate credentials, model selection, and chat routing in one pass.

## Core Endpoints

- `GET /health`
- `GET /client-discovery`
- `GET /models`
- `GET /models/profiles`
- `POST /models/profiles/activate`
- `POST /models/{name}/start`
- `POST /models/{name}/stop`
- `POST /models/{name}/restart`
- `POST /models/{name}/favorite`
- `GET /logs/{name}?lines=200`
- `GET /logs/{name}/stream?lines=200`
- `POST /chat/{name}`
- `POST /chat/{name}/stream`
- `POST /v1/chat/completions`
- `GET /v1/models`
- `GET /v1/client/session`
- `POST /v1/client/diagnostics/setup`
- `POST /v1/client/diagnostics/chat`
- `POST /api/chat`
- `GET /chat/capabilities/{name}`
- `POST /chat/{name}/inspect`
- `POST /chat/{name}/embeddings`
- `GET /chat/{name}/kv/slots?target=auto`
- `POST /chat/{name}/kv/slots/{slot_id}`
- `GET /chat/{name}/kv/capabilities?target=auto`
- `GET /chat/sessions`
- `GET /chat/sessions/{session_id}`
- `POST /chat/sessions`
- `DELETE /chat/sessions/{session_id}`
- `GET /library/ggufs`
- `POST /library/ggufs/{file_id}/add-model`
- `DELETE /library/ggufs/{file_id}`
- `DELETE /library/models/{name}`
- `GET /conversions/models`
- `POST /conversions/{name}/start`
- `GET /conversions/{name}`
- `GET /conversions/{name}/logs?lines=200`
- `GET /conversions/{name}/logs/stream?lines=200`
- `GET /downloads/models`
- `GET /downloads/history?status=completed&limit=100`
- `GET /downloads/quants?repo_id={repo_id}`
- `GET /downloads/recommendations`
- `GET /downloads/{repo_id}/quants`
- `POST /downloads/{repo_id}/start`
- `GET /downloads/{download_id}`
- `GET /downloads/{download_id}/logs?lines=200`
- `GET /downloads/{download_id}/logs/stream?lines=200`
- `POST /downloads/{download_id}/cancel`
- `DELETE /downloads/{download_id}`
- `GET /quantizations/files`
- `GET /quantizations/{file_id}`
- `POST /quantizations/{file_id}/start`
- `GET /quantizations/{file_id}/logs?lines=200`
- `GET /quantizations/{file_id}/logs/stream?lines=200`
- `GET /runtime/overview`
- `POST /runtime/route-preview`
- `GET /runtime/tool-loop-evals/latest`
- `GET /runtime/tool-loop-evals/presets`
- `GET /runtime/tool-loop-evals/runs`
- `GET /runtime/tool-loop-evals/runs/{run_id}`
- `POST /runtime/tool-loop-evals/run`
- `POST /runtime/tool-loop-evals/run/stream`
- `POST /runtime/tool-loop-evals/node-run`
- `POST /runtime/tool-loop-evals/node-run/stream`
- `POST /runtime/tool-loop-evals/node-chat`
- `GET /setup/status`
- `POST /setup/bootstrap-admin`
- `GET /setup/current-config`
- `GET /settings/disks`
- `GET /settings/node-auth`
- `GET /settings/tool-catalog`
- `PATCH /settings/tool-catalog`
- `GET /settings/runtime`
- `PATCH /settings/runtime`
- `POST /settings/api-keys/generate`
- `GET /audit/events`
- `POST /audit/events`
- `POST /auth/login`
- `GET /auth/me`
- `POST /auth/logout`
- `GET /auth/keys`
- `POST /auth/keys`
- `POST /auth/keys/{key_id}/revoke`
- `GET /external-keys`
- `POST /external-keys`
- `POST /external-keys/{key_id}/revoke`
- `GET /external-keys/{key_id}/analytics`

### Setup assistant endpoints

The setup assistant endpoints live under `/lm-api/v1/setup/*` and support the
UI-first bootstrap flow described in [Setup](setup.md). They are intentionally
narrow: they report whether authentication still needs bootstrapping, create
the first admin key only when no auth exists, and expose a secret-masked config
snapshot for setup review.

**`GET /setup/status`** — Returns mode and bootstrap state:

```json
{
  "mode": "controller",
  "auth_bootstrap_required": true,
  "auth_enabled": false,
  "setup_recommended": true,
  "models_count": 0,
  "has_nodes": false
}
```

`auth_bootstrap_required` is false once either `agent_api_key` is configured or
the auth store has at least one active key.

**`POST /setup/bootstrap-admin`** — Creates the first admin key and an initial
UI session. This endpoint succeeds only when static auth is not configured and
the auth store has no active keys; later calls return `409`.

```bash
curl -X POST http://127.0.0.1:9137/lm-api/v1/setup/bootstrap-admin \
  -H "Content-Type: application/json" \
  -d '{"username":"admin"}'
```

Response:

```json
{
  "token": "<ui-session-token>",
  "username": "admin",
  "expires_at": "2026-05-29T18:00:00+00:00",
  "role": "admin",
  "key": "<raw-admin-api-key>",
  "key_hint": "abcd...wxyz"
}
```

The raw admin API key is returned once. The route also writes an
`auth_bootstrap_admin_create` audit event.

**`GET /setup/current-config`** — Returns a setup-oriented configuration
snapshot with secrets masked as `***`. It includes mode, log/config basics,
memory settings, nodes, agent/controller URLs, worker settings, model library
root, and the first configured model.

See [Model Downloads](downloads.md) for the download workflow, history, logs,
cancellation, and recommendations behavior.

## Controller Node Endpoints

- `GET /nodes`
- `GET /nodes/status`
- `GET /nodes/models`
- `GET /nodes/models/profiles`
- `GET /nodes/ggufs`
- `POST /nodes/register`
- `PUT /nodes/{node}`
- `POST /nodes/{node}/heartbeat`
- `POST /nodes/{node}/models/{name}/start`
- `POST /nodes/{node}/models/{name}/stop`
- `POST /nodes/{node}/models/{name}/restart`
- `GET /nodes/{node}/logs/{name}?lines=200`
- `GET /nodes/{node}/logs/{name}/stream?lines=200`
- `POST /nodes/{source}/transfers`
- `GET /transfers`
- `GET /transfers/{transfer_id}`
- `POST /transfer-source/grants`
- `GET /transfer-source/ggufs/{file_id}/manifest`
- `GET /transfer-source/files/{file_id}/content`

The UI includes a Nodes page for controller mode that shows node reachability,
heartbeat/config metadata, reported models, and remote model
Start/Stop/Restart/Logs actions.

## Controller Orchestration Endpoints

Controller orchestration endpoints are available in controller mode only:

- `POST /jobs`
- `GET /jobs`
- `GET /jobs/{job_id}`
- `POST /jobs/{job_id}/cancel`
- `GET /jobs/{job_id}/events`
- `GET /jobs/{job_id}/events/stream`
- `GET /jobs/{job_id}/artifacts`
- `GET /controller/stats`
- `GET /controller/retention-policy`
- `POST /controller/archive/export`
- `POST /nodes/{node}/work/claim`
- `POST /nodes/{node}/work/{attempt_id}/progress`
- `POST /nodes/{node}/work/{attempt_id}/complete`
- `POST /nodes/{node}/work/{attempt_id}/fail`
- `GET /benchmarks/definitions`
- `POST /benchmarks/definitions`
- `GET /benchmarks/runs`
- `GET /benchmarks/runs/{run_id}`
- `POST /benchmarks/runs`
- `POST /benchmarks/runs/compare`

See [Benchmarks](benchmarks.md) for benchmark definitions, managed runs,
metrics, and comparison behavior.

### Job types

`POST /jobs` accepts a `type` field that determines how the agent worker
processes the job.

**`llm.generate`** — Single chat completion routed to one node.

```json
{
  "type": "llm.generate",
  "payload": {
    "model": "qwen",
    "messages": [{"role": "user", "content": "Explain async/await."}],
    "target": "auto",
    "temperature": 0.7,
    "max_tokens": 512
  }
}
```

**`llm.embed`** — Embed one or more strings via a model's embeddings endpoint.

```json
{
  "type": "llm.embed",
  "payload": {
    "model": "nomic-embed",
    "input": ["sentence one", "sentence two"],
    "target": "auto"
  }
}
```

**`llm.batch`** — Run a suite of prompt cases against a model, collecting
per-case outputs and a summary artifact. Each case can override `model`,
`target`, `temperature`, and `max_tokens`. Accepts 1–200 cases.

```json
{
  "type": "llm.batch",
  "payload": {
    "model": "qwen",
    "target": "auto",
    "temperature": 0.7,
    "max_tokens": 512,
    "cases": [
      {"messages": [{"role": "user", "content": "Summarise X."}]},
      {
        "id": "hard-case",
        "messages": [{"role": "user", "content": "Explain Y in depth."}],
        "model": "llama",
        "max_tokens": 1024
      }
    ]
  }
}
```

The completed job has one `llm.batch.case` artifact per case (with `response`,
`elapsed_ms`, and error if the case failed) and one `llm.batch.summary`
artifact. Cases that fail are recorded but do not abort the remaining cases.

**`model.download`** — Download a GGUF model repo or selected GGUF files from
Hugging Face on the target worker node. The agent uses its configured
`hf_models_dirs` destination and local Hugging Face credentials/environment.

```json
{
  "type": "model.download",
  "target": "node:mac-agent",
  "payload": {
    "repo_id": "bartowski/Qwen2.5-7B-Instruct-GGUF",
    "revision": "main",
    "include_file": "Qwen2.5-7B-Instruct-Q4_K_M.gguf",
    "mmproj_file": null
  }
}
```

`repo_id` must be in `owner/name` format. `include_file` and `mmproj_file` are
optional relative `.gguf` paths. Progress events include `download_id`,
`bytes_downloaded`, `bytes_total`, `progress_percent`, and `local_path`.
Cancelling the orchestration job cancels the local download process
cooperatively.

**`model.install`** — Download, verify, register, and optionally start a GGUF
model on the target worker node. This is the controller-to-agent workflow for
making a Hugging Face model usable on a specific agent.

```json
{
  "type": "model.install",
  "target": "node:mac-agent",
  "payload": {
    "repo_id": "bartowski/Qwen2.5-7B-Instruct-GGUF",
    "revision": "main",
    "include_file": "Qwen2.5-7B-Instruct-Q4_K_M.gguf",
    "mmproj_file": null,
    "model_name": "qwen2.5-7b-q4",
    "port": 8080,
    "ctx": 4096,
    "gpu_layers": 0,
    "start": true
  }
}
```

The worker emits progress stages for download progress, `verified`,
`registered`, and `started` when `start` is true. Registration uses the agent's
local model library configuration and persists config on agents that were
started from a writable config file.

**`model.transfer`** — Transfer a GGUF file from one registered node to another.

Most callers should start transfers through the controller helper endpoint
rather than posting `model.transfer` jobs directly. The helper validates both
nodes, asks the source node to create a one-time transfer grant, creates the
orchestration job, and targets it at the destination node's worker:

```bash
curl -X POST http://127.0.0.1:9137/lm-api/v1/nodes/mac-mini/transfers \
  -H "Content-Type: application/json" \
  -H "X-Llama-Pack-Key: $LLAMA_PACK_API_KEY" \
  -d '{
    "destination_node": "linux-2080ti",
    "source_file_id": "<gguf-file-id>",
    "include": "selected_with_sidecars"
  }'
```

The created job payload has this shape:

```json
{
  "type": "model.transfer",
  "target": "node:linux-2080ti",
  "payload": {
    "source_node": "mac-mini",
    "destination_node": "linux-2080ti",
    "source_file_id": "<gguf-file-id>",
    "include": "selected_with_sidecars",
    "source_url": "http://mac-mini:9137",
    "transfer_token": "<generated-token>"
  }
}
```

`source_node` and `destination_node` must differ. The only supported `include`
mode is `selected_with_sidecars`; the source manifest includes the selected
GGUF plus non-GGUF sidecars in the same model directory and any configured
`mmproj` file under the source model roots.

The destination worker fetches the source manifest, then fetches each file with
`Authorization: Bearer <transfer_token>`. Each destination write verifies file
size and SHA-256 before replacing the temporary file. Existing matching files
are skipped; conflicting existing files fail the job with
`DESTINATION_CONFLICT`.

Transfer helper and status endpoints:

- `POST /nodes/{source}/transfers` — Controller-only public entry point. Creates
  a source grant and a `model.transfer` job targeted at `destination_node`.
- `GET /transfers` — Lists recent `model.transfer` jobs as transfer summaries.
- `GET /transfers/{transfer_id}` — Returns one transfer summary, including
  `files_total`, `files_copied`, `files_skipped`, `bytes_copied`, `copied`,
  and `skipped` when available.

Source-agent transfer endpoints:

- `POST /transfer-source/grants` — Called by the controller on the source node.
  Creates an in-memory token grant for a source GGUF file and destination node.
- `GET /transfer-source/ggufs/{file_id}/manifest` — Called by the destination
  worker with the bearer token. Returns the source file manifest.
- `GET /transfer-source/files/{file_id}/content` — Called by the destination
  worker with the bearer token. Streams one allowed file from the source node.

The source-agent endpoints are not the normal public API for users. They are
protected by the generated transfer token in addition to normal Llama Pack API 
authentication, and grants are held in source-node memory.

## Thread Endpoints

Thread endpoints are available in controller mode. Threads maintain a durable
conversation history; each turn records user, routing, and assistant events.

- `POST /lm-api/v1/threads` — Create a thread.
- `GET /lm-api/v1/threads/{id}/events` — List events. Add `?include_internal=true` (admin only) to include routing decisions and workflow steps.
- `POST /lm-api/v1/threads/{id}/messages` — Post a user message and receive a routed assistant reply.
- `POST /lm-api/v1/threads/{id}/messages/stream` — Same, but streams the reply as SSE. The first event is `{"type":"route","route":{...}}` followed by token delta chunks.
- `POST /lm-api/v1/threads/{id}/workflow` — Run a multi-step workflow on the thread (see below).

### Workflow endpoint

`POST /lm-api/v1/threads/{id}/workflow` runs a linear chain of inference steps
where each step's output becomes the next step's input. Each step is routed
independently through the normal routing policy.

```json
{
  "content": "The user's original input or seed text.",
  "steps": [
    {
      "label": "classify",
      "instructions": "Classify the request type. Reply with a single word.",
      "model": "qwen"
    },
    {
      "label": "generate",
      "instructions": "Generate a detailed response based on the classification.",
      "target": "node:gpu-box"
    },
    {
      "label": "summarize",
      "instructions": "Summarise the response in two sentences."
    }
  ],
  "model": "qwen",
  "target": "auto"
}
```

Each step is an object with:

| Field | Default | Description |
|---|---|---|
| `label` | required | Display name for the step (recorded in events). |
| `instructions` | required | System-role message sent to the model for this step. |
| `model` | workflow `model` | Override the model for this step only. |
| `target` | workflow `target` | Override the routing target for this step only. |

Response:

```json
{
  "thread_id": "...",
  "message": {"role": "assistant", "content": "<final step output>"},
  "route": {"node": "...", "model": "...", "strategy": "workflow", "reason": "workflow_final_step"},
  "workflow_steps": [
    {"label": "classify", "model": "qwen", "node": "linux-2080ti", "output": "..."},
    {"label": "generate", "model": "qwen", "node": "gpu-box", "output": "..."},
    {"label": "summarize", "model": "qwen", "node": "linux-2080ti", "output": "..."}
  ]
}
```

Public thread events show only `user_message` and `assistant_message`. Internal
events include a `workflow_step` event pair (status `running` then `complete`)
for each step, plus a `routing_decision` event per step. If a step fails, a
`workflow_step` `failed` event and a public `error` event are appended and the
endpoint returns an error — steps that have not yet run are skipped.

## Memory Endpoints

Available on controller nodes when the memory subsystem is enabled
(`memory.enabled: true` in config). Both endpoints return `503` if the store
is disabled.

**`POST /lm-api/v1/memory/write`** — Write a memory entry. Accepts agent API
keys. Deduplication runs automatically: if a near-identical entry already
exists (cosine similarity ≥ 0.92) it is updated in place.

```json
{
  "text": "User prefers concise answers with code examples.",
  "tier": "durable",
  "topic": "communication style",
  "tags": ["preferences", "style"]
}
```

Response (`201`):
```json
{"ok": true, "id": "<uuid>"}
```

**`POST /lm-api/v1/memory/search`** — Semantic similarity search over stored
memories.

```json
{"query": "user interface preferences", "top_k": 5}
```

Response (`200`):
```json
{
  "ok": true,
  "count": 2,
  "results": [
    {"text": "...", "tier": "durable", "topic": "...", "tags": [], "score": 0.94, "id": "..."}
  ]
}
```
