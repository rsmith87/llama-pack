# How To Use Llama Pack

This guide shows how to run Llama Pack as a secure local/private LLM gateway
with an operations console. A controller provides the stable API surface for
your apps, while agents run on model hosts and manage local `llama-server`
processes.

For the current Raspberry Pi controller deployment snapshot and smoke checks,
see [Raspberry Pi Controller Topology](pi-controller-topology.md).

## 1. Install

From this project directory:

```bash
uv sync
```

On Windows PowerShell:

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -e ".[dev]"
```

Prefer `uv sync` on macOS and Linux because it uses the checked-in `uv.lock`.
For pip-based installs, use an explicit supported interpreter and invoke pip as
`python -m pip` from the activated environment.

Windows support is currently limited to manual Python environment setup and
agent-style operation. There is no separate Windows checklist in this docs set.

## 2. Script-First Setup

For a controller host:

```bash
scripts/onboard_controller.sh
scripts/start_controller.sh
```

`scripts/onboard_controller.sh` creates `config.yaml` when needed, writes
`.llama_pack.env`, generates `LLAMA_PACK_CONTROLLER_REGISTRATION_KEY`,
runs migrations, and creates the first admin API key. Use
`--skip-migrations` only when you want to handle migrations/admin-key creation
manually.

To opt into controller semantic memory in the same setup command:

```bash
scripts/onboard_controller.sh --enable-memory
```

The memory option installs `.[controller-memory]`, downloads the default
embedding model, and writes the required `memory:` config. If the host already
has the extras and model, pass `--skip-memory-install --memory-model-path PATH`
to only write and validate config.

For an agent host:

```bash
export LLAMA_PACK_CONTROLLER_REGISTRATION_KEY_OUTBOUND=...
scripts/onboard_agent.sh \
  --node mac-agent \
  --controller-url "$LLAMA_PACK_CONTROLLER_URL" \
  --agent-url "$LLAMA_PACK_AGENT_URL"
scripts/start_agent.sh
```

`scripts/onboard_agent.sh` creates an agent config, writes
`.llama_pack.env`, generates `LLAMA_PACK_AGENT_API_KEY`, and prints the
controller `nodes:` entry that must use that agent key. The generated config
keeps `controller_url` and `agent_url` as environment placeholders; the real
LAN URLs passed to `--controller-url` and `--agent-url` are written only to
`.llama_pack.env`.

To rotate keys later:

```bash
scripts/regenerate_key.sh --type controller-registration
scripts/regenerate_key.sh --type agent-api --node mac-agent --agent-url "$LLAMA_PACK_AGENT_URL"
```

The startup and stop scripts source `.llama_pack.env` automatically:

```bash
scripts/start_agent.sh
scripts/stop_server.sh
```

## 3. Manual Agent Config

Start from:

```bash
cp config.example.yaml config.yaml
```

Example Mac agent:

```yaml
mode: agent
llama_server_bin: /Users/{user_name}/Apps/llama.cpp/build/bin/llama-server
llama_cpp_dir: /Users/{user_name}/Apps/llama.cpp
python_bin: /Users/{user_name}/Apps/llama.cpp/.venv/bin/python
hf_models_dirs:
  - /Users/{user_name}/models
log_dir: ./logs
agent_api_key: local-agent-key
agent_worker_enabled: false

models:
  qwen-coder:
    path: /Users/{user_name}/models/qwen-coder.gguf
    port: 8081
    ctx: 16384
    gpu_layers: 999
    host: 127.0.0.1
    reasoning: auto
    reasoning_budget: 2048
    extra_args: []
    supports_json_schema: false
    supports_grammar: false
```

Legacy single-root config still works:

```yaml
hf_models_dir: /Volumes/4TB/HFModels
```

If `hf_models_dirs` is present, it is used instead of the legacy single-root field.
After first startup, admins can update the active local model roots from
**System Settings -> Storage**. The UI stores those roots in the settings
database and they override the YAML roots for that node until changed again.

The setup UI's **Standalone** choice uses this same backend mode. It is a
single-machine setup preset, not a third `mode:` value; do not write
`mode: standalone` in `config.yaml`.

## 4. Manual Admin Key

Before creating admin keys or starting the service, apply migrations:

```bash
uv run python scripts/migrate_all.py --config config.yaml
```

Before using the UI or protected API routes, create an admin key:

```bash
uv run python -m llama_pack.auth --config config.yaml create-admin {user_name}
```

The command stores only a hash in `log_dir/auth_store.db` and prints the raw key once. Use that key in the UI login form or as the `X-Llama-Pack-Key` header for API requests. There is no `dev` fallback login.

`scripts/onboard_controller.sh` performs these migration and first-admin-key
steps for fresh controller setup.

## 5. Start An Agent

```bash
LLAMA_PACK_CONFIG=config.yaml uvicorn llama_pack.main:app --host 127.0.0.1 --port 9000
```

On Windows PowerShell:

```powershell
$env:LLAMA_PACK_CONFIG = "config.yaml"
uvicorn llama_pack.main:app --host 127.0.0.1 --port 9000
```

Check health:

```bash
curl http://127.0.0.1:9000/health
```

Local Mac helper scripts:

```bash
scripts/start_agent.sh
scripts/stop_server.sh
```

## 6. Control Models On An Agent

```bash
curl http://127.0.0.1:9000/models
curl -X POST http://127.0.0.1:9000/models/qwen-coder/start
curl -X POST http://127.0.0.1:9000/models/qwen-coder/stop
curl -X POST http://127.0.0.1:9000/models/qwen-coder/restart
curl "http://127.0.0.1:9000/logs/qwen-coder?lines=200"
```

The underlying OpenAI-compatible endpoint remains on the model port:

```bash
curl http://127.0.0.1:8081/health
```

## 7. Use Chat Features

Basic API call:

```bash
curl -X POST http://127.0.0.1:9000/chat/qwen-coder \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "Say hello in one sentence."}
    ],
    "temperature": 0.7,
    "max_tokens": 128
  }'
```

The Chat UI supports:

- advanced sampling controls (`top_p`, `top_k`, `min_p`, `repeat_penalty`, `seed`, `stop`, `n_predict` alias behavior)
- structured output mode (`None`, `JSON Schema`, `Grammar`) with mutual exclusion and client-side validation
- per-model capability gating from `GET /chat/capabilities/{model}`
- capability source metadata (`default`, `config_flag`, `extra_args`) in the feature matrix and capabilities detail panel
- capability debug tools: full JSON detail + `Copy Capabilities JSON`
- session save/load with persisted advanced defaults, including structured mode and schema/grammar text

### Multi-User Chat

Llama Pack supports multiple people using the same runtime when the hardware has enough capacity. Each person should sign in with a local account created by an admin:

- Controller deployments: create local accounts on the controller. The controller is the user-facing gateway and routes chat to agents.
- Standalone agent deployments: create local accounts on the agent when it has no `controller_url`, because that single process is the whole app.
- Node agents behind a controller: do not create separate family/operator accounts on every agent. Human accounts are managed on the controller; agents use machine credentials for controller-to-agent calls.

Saved chat sessions are scoped to the signed-in local account, so one user cannot list, load, overwrite, or delete another user's saved sessions. Test-chat browser sessions remain scoped per browser.

Chat admission uses the signed-in account as the session identity. This means per-session limits apply per person rather than globally. Tune these settings in config for the available hardware:

- `chat_max_active_per_target`
- `chat_max_queue_per_target`
- `chat_max_active_per_session`
- `chat_max_queue_per_session`
- `chat_admission_timeout_seconds`

For llama.cpp KV slot isolation, authenticated non-admin users are assigned a stable slot per route/model/account when the chat request does not specify one. If a non-admin user tries to manually use a slot assigned to another account, Llama Pack rejects the request. Admins can still send an explicit `slot_id` for operational/debug work.

Useful chat endpoints:

- `POST /lm-api/v1/chat/{model}`
- `POST /lm-api/v1/chat/{model}/stream`
- `GET /lm-api/v1/chat/capabilities/{model}`
- `POST /lm-api/v1/chat/{model}/inspect`
- `POST /lm-api/v1/chat/{model}/embeddings`
- `GET /lm-api/v1/chat/{model}/kv/slots`
- `POST /lm-api/v1/chat/{model}/kv/slots/{slot_id}`
- `GET /lm-api/v1/chat/{model}/kv/capabilities`
- `GET|POST|DELETE /lm-api/v1/chat/sessions...`

## 8. Add Existing GGUFs As Runnable Models

Scan and register existing GGUF files:

```bash
curl http://127.0.0.1:9000/library/ggufs
curl -X POST http://127.0.0.1:9000/library/ggufs/{file_id}/add-model \
  -H "Content-Type: application/json" \
  -d '{
    "name": "gemma-4-E2B-it",
    "port": 8080,
    "ctx": 8192,
    "gpu_layers": 999,
    "host": "127.0.0.1"
  }'
```

## 9. Convert HF Models To GGUF

Set config values on the agent with HF models:

```yaml
hf_models_dirs:
  - /Volumes/4TB/HFModels
  - /Volumes/4TB/OtherModels
llama_cpp_dir: /Users/{user_name}/Apps/llama.cpp
python_bin: /Users/{user_name}/Apps/llama.cpp/.venv/bin/python
```

Use:

```bash
curl http://127.0.0.1:9000/conversions/models
curl -X POST http://127.0.0.1:9000/conversions/qwen2.5-7b-instruct/start
curl "http://127.0.0.1:9000/conversions/qwen2.5-7b-instruct/logs?lines=200"
```

If conversion logs show missing packages (for example `ModuleNotFoundError: No module named 'transformers'`), point `python_bin` at the correct llama.cpp venv Python.

## 10. Quantize Existing GGUFs

Use:

```bash
curl http://127.0.0.1:9000/quantizations/files
curl -X POST http://127.0.0.1:9000/quantizations/{file_id}/start \
  -H "Content-Type: application/json" \
  -d '{"type":"Q4_K_M"}'
curl "http://127.0.0.1:9000/quantizations/{file_id}/logs?lines=200"
```

## 11. Create A Controller Config (Optional)

For fresh controller setup, prefer the onboarding script:

```bash
scripts/onboard_controller.sh
scripts/start_controller.sh
```

The script generates `.llama_pack.env`, runs migrations, creates the first
admin API key, and prints the registration key for agents. The manual config
shape is:

```yaml
mode: controller
log_dir: ./logs

nodes:
  windows-2080ti:
    url: ${LLAMA_PACK_WINDOWS_2080TI_AGENT_URL}
    api_key: windows-agent-key-if-enabled
    verify_tls: true

controller_registration_key: shared-registration-key
node_heartbeat_timeout_seconds: 90
```

Run controller (different port from local agent):

```bash
LLAMA_PACK_CONFIG=controller.yaml uvicorn llama_pack.main:app --host 127.0.0.1 --port 9100
```

If `controller.yaml` is recorded in `.llama_pack.env` as
`LLAMA_PACK_CONFIG`, you can also use:

```bash
scripts/start_controller.sh
```

For local React UI development, start the controller and Vite dev server
together:

```bash
LLAMA_PACK_START_FRONTEND=1 scripts/start_controller.sh
```

The React dev site runs at `http://127.0.0.1:5173/ui/react/`. See
[Frontend Development](frontend.md) for frontend-only start, stop, test, and
build commands.

Controller endpoints include node inventory/proxy plus orchestration
(`/lm-api/v1/jobs`, node `/lm-api/v1/nodes/{node}/work/*`, stats, retention,
archive export). In the UI, use the Nodes page to inspect registered agents,
heartbeat freshness, reported models, GGUF libraries, and remote model
Start/Stop/Restart/Logs actions.

## 12. Run The Controller On A Raspberry Pi

Raspberry Pi integration is a good fit for the always-on controller role. The Pi runs `mode: controller`, owns node inventory and durable orchestration state, and each agent machine points its `controller_url` at the Pi.

```bash
scripts/onboard_controller.sh \
  --config raspberry-pi-controller.config.yaml \
  --template raspberry-pi-controller.config.example.yaml
scripts/start_controller.sh
```

The Pi template keeps agent URLs and per-node API keys in environment
variables. Fill those in after each agent onboarding script prints its generated
`nodes:` block.

Pi controller config essentials:

```yaml
mode: controller
log_dir: /home/{user_name}/llama-pack/logs
controller_registration_key: ${LLAMA_PACK_CONTROLLER_REGISTRATION_KEY}
node_heartbeat_timeout_seconds: 90

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

On each agent, run `scripts/onboard_agent.sh --controller-url "$LLAMA_PACK_CONTROLLER_URL" --agent-url "$LLAMA_PACK_AGENT_URL"`. If the agent worker is enabled, make sure the agent's generated `LLAMA_PACK_AGENT_API_KEY` matches the corresponding `nodes.<name>.api_key` value on the Pi controller.

## 13. Enable Agent Worker Jobs

The controller owns durable jobs. Agents execute jobs only when the worker is explicitly enabled.

Controller config:

```yaml
mode: controller
log_dir: ./logs

nodes:
  mac-agent:
    url: http://127.0.0.1:9000
    api_key: local-agent-key
    verify_tls: true
```

Worker APIs fail closed: the controller only accepts
`/lm-api/v1/nodes/{node}/work/*` requests for registered nodes that have an
`api_key`, and the request must send that key in `X-Llama-Pack-Key`.

Agent config:

```yaml
mode: agent
controller_url: ${LLAMA_PACK_CONTROLLER_URL}
node_name: mac-agent
agent_url: ${LLAMA_PACK_AGENT_URL}
agent_api_key: ${LLAMA_PACK_AGENT_API_KEY}
controller_registration_key_outbound: ${LLAMA_PACK_CONTROLLER_REGISTRATION_KEY_OUTBOUND}
agent_worker_enabled: true
agent_worker_poll_interval_seconds: 2
agent_worker_max_jobs: 1
agent_worker_labels:
  platform: mac
agent_worker_capacity:
  vram_gb: 24
```

For a new worker agent, `scripts/onboard_agent.sh` creates the base agent
config and `.llama_pack.env`; then enable `agent_worker_enabled` and add the
worker labels/capacity fields in the generated config. Keep concrete LAN URLs
in `.llama_pack.env`, not in the tracked agent config.

Create a typed generation job on the controller:

```bash
curl -X POST http://127.0.0.1:9100/lm-api/v1/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "type": "llm.generate",
    "target": "node:mac-agent",
    "payload": {
      "model": "qwen-coder",
      "messages": [
        {"role": "user", "content": "Say hello in one sentence."}
      ],
      "target": "local",
      "max_tokens": 64,
      "requirements": {
        "labels": {"platform": "mac"},
        "capacity": {"vram_gb": 8}
      }
    }
  }'
```

Watch durable events:

```bash
curl http://127.0.0.1:9100/lm-api/v1/jobs/{job_id}/events
```

Watch live events with SSE:

```bash
curl -N http://127.0.0.1:9100/lm-api/v1/jobs/{job_id}/events/stream
```

Cancel cooperatively:

```bash
curl -X POST http://127.0.0.1:9100/lm-api/v1/jobs/{job_id}/cancel
```

Queued jobs cancel immediately. Assigned or running jobs move to `cancel_requested`; workers check before and after local model execution and then report a terminal state.

Typed worker contracts include `llm.generate`, `llm.embed`, `llm.batch`,
`model.transfer`, `model.download`, and `model.install`. `model.download` jobs
run Hugging Face downloads on the target worker node using that agent's
configured model roots and Hugging Face credentials. `model.install` extends
that flow by verifying the downloaded GGUF, registering it in the agent's model
config, and starting it when requested.

## 14. Run Tests

Full test suite:

```bash
uv run pytest -v
```

The pytest suite installs `frontend` dependencies with `npm ci` before
running the React frontend unit tests, so `frontend/node_modules` does not need
to be checked in.

React frontend unit tests:

```bash
cd frontend
npm ci
npm test
```

React production build:

```bash
cd frontend
npm run build
```

The Vite build writes static assets to `llama_pack/ui/react`, which is
included in Python package data for release builds.

Frontend development workflow:

- `docs/frontend.md`

## 15. Runtime, Settings, And Tool-Loop Evals

The Runtime page summarizes the active mode, local tools, memory, worker
status, jobs, threads, running models, and downloads:

```bash
curl http://127.0.0.1:9137/lm-api/v1/runtime/overview
curl -X POST http://127.0.0.1:9137/lm-api/v1/runtime/route-preview \
  -H "Content-Type: application/json" \
  -d '{"model":"qwen-coder","request_type":"coding","target":"auto"}'
```

The Settings page reads and writes durable runtime settings through
`/lm-api/v1/settings/runtime`, and manages the agent tool catalog through
`/lm-api/v1/settings/tool-catalog`. Settings are stored in the `settings`
database target. The Storage tab also writes local `hf_models_dirs` through
runtime settings, so `config.yaml` can remain a bootstrap default while admins
adjust model roots from the UI.

Tool-loop evals are available from the Runtime section of the UI. Agent mode
runs local evals at `/lm-api/v1/runtime/tool-loop-evals/run`; controller mode
runs node evals at `/lm-api/v1/runtime/tool-loop-evals/node-run`. Results are
persisted in the benchmarks database and can be listed with:

```bash
curl http://127.0.0.1:9137/lm-api/v1/runtime/tool-loop-evals/runs?limit=50
```

## 16. Alembic-Managed Persistence

Legacy sqlite store code paths were removed after migration parity validation.
The app now always uses SQLAlchemy-managed persistence implementations across
all databases.

Safe startup procedure when not using `scripts/onboard_controller.sh`:

1. Run migrations for all targets:
```bash
uv run python scripts/migrate_all.py --config config.yaml
```
2. Start the app normally, or use `scripts/start_controller.sh` if
   `.llama_pack.env` points at the right config.
3. Run focused smoke checks for auth, audit, chat sessions, and jobs.

Rollback procedure:

1. Roll back to a previous application version.
2. Keep the database at its current Alembic head unless a schema rollback is explicitly required.
3. Re-run smoke checks.
