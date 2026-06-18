# Setup

This page covers installation, onboarding, admin keys, migrations, smoke checks,
and local test/build commands.

## Quick Start

Guided terminal setup for a fresh controller or agent:

```bash
scripts/setup_llama_pack.sh
```

The wizard asks whether the machine is a controller, agent, or single-machine
setup. It then runs dependency sync, onboarding, optional llama.cpp setup for
agents, and optional service startup.

Repeatable non-interactive controller setup:

```bash
scripts/setup_llama_pack.sh \
  --non-interactive \
  --role controller \
  --host 127.0.0.1 \
  --port 9137 \
  --start
```

Repeatable non-interactive agent setup:

```bash
scripts/setup_llama_pack.sh \
  --non-interactive \
  --role agent \
  --node linux-2080ti \
  --controller-url "$LLAMA_PACK_CONTROLLER_URL" \
  --agent-url "$LLAMA_PACK_AGENT_URL" \
  --controller-registration-key "$LLAMA_PACK_CONTROLLER_REGISTRATION_KEY_OUTBOUND" \
  --llama-cpp-backend auto \
  --start
```

UI-first setup remains available for a fresh controller:

```bash
uv sync
scripts/start_controller.sh
```

Then open the web UI and follow **Setup**. On first run, the Setup Assistant
creates the first admin key before showing controller/agent guidance. The Setup
UI can actively write `config.yaml` / `.llama_pack.env` during first-run setup.
If either file already exists, Apply is blocked unless the operator checks
**Allow setup to overwrite existing config.yaml or .llama_pack.env**.
Successful and blocked apply attempts are recorded in the audit log without
secret values.

Script-first setup for a controller:

```bash
uv sync
scripts/onboard_controller.sh
scripts/start_controller.sh
```

Script-first setup for an agent:

```bash
uv sync
scripts/install_llama_cpp.sh --backend auto
cp .llama_pack.env.example .llama_pack.env
# Edit .llama_pack.env before onboarding:
# - LLAMA_PACK_CONTROLLER_REGISTRATION_KEY_OUTBOUND must match the controller's
#   LLAMA_PACK_CONTROLLER_REGISTRATION_KEY from the controller .llama_pack.env.
# - LLAMA_PACK_CONTROLLER_URL should point at the controller.
# - LLAMA_PACK_AGENT_URL should be the URL the controller uses for this agent.
set -a
source .llama_pack.env
set +a
scripts/onboard_agent.sh \
  --node linux-2080ti \
  --controller-url "$LLAMA_PACK_CONTROLLER_URL" \
  --agent-url "$LLAMA_PACK_AGENT_URL"
scripts/start_agent.sh
```

The onboarding scripts write local secrets to `.llama_pack.env`, which is
ignored by git. The start/stop helper scripts source that file automatically.
For encrypted controller/agent traffic, set up Caddy before switching
`LLAMA_PACK_CONTROLLER_URL` and `LLAMA_PACK_AGENT_URL` to HTTPS; see
`docs/caddy-local-tls.md` for the operator checklist and
`docs/tls-caddy-plan.md` for the design rationale.

Two network exposure modes are supported:

- Direct LAN HTTP: set `LLAMA_PACK_HOST=0.0.0.0` and use `http://<host>:9137`
  URLs. This is simpler but sends API keys and traffic in plaintext.
- Caddy/local TLS: set `LLAMA_PACK_HOST=127.0.0.1` and use
  `https://<host>.local` URLs. Uvicorn is reachable only from the local
  machine, and Caddy is the LAN-facing listener.

Manual setup remains available:

```bash
uv sync
cp config.example.yaml config.yaml
export LLAMA_PACK_CONFIG=config.yaml
uv run python scripts/migrate_all.py --config config.yaml
uv run python -m llama_pack.auth --config config.yaml create-admin {user_name}
LLAMA_PACK_CONFIG=config.yaml uvicorn llama_pack.main:app --host 127.0.0.1 --port 9000
```

`uv sync` is the recommended install path because this repository includes a
lockfile. It also avoids shell-specific ambiguity where `python` may not exist
or `pip` may resolve to something other than CPython pip. If you need a
pip-based editable install, use an explicit supported interpreter:

```bash
python3.12 -m venv .venv
source .venv/bin/activate
python -m pip install -e ".[dev]"
```

Or use the helper scripts:

```bash
scripts/start_agent.sh
scripts/start_agent_stack.sh
scripts/stop_server.sh
```

## Onboarding Scripts

Onboard a fresh controller without manually copying config or generating keys:

```bash
scripts/onboard_controller.sh
```

The controller onboarding script writes local secrets to `.llama_pack.env`,
including `LLAMA_PACK_CONTROLLER_REGISTRATION_KEY` and the first generated
admin API key when migrations are enabled.

To enable controller semantic memory during the same setup step:

```bash
scripts/onboard_controller.sh --enable-memory
```

That installs the `controller-memory` extras, downloads the default embedding
model to `./models/embedding/all-MiniLM-L6-v2`, writes a working `memory:`
block to the controller config, and records `LLAMA_PACK_MEMORY_MODEL_PATH` in
`.llama_pack.env`. Use `--memory-model-path PATH` or `--memory-store-path PATH`
to choose different local paths.

Onboard a fresh agent:

```bash
scripts/install_llama_cpp.sh --backend auto
cp .llama_pack.env.example .llama_pack.env
# Edit .llama_pack.env and set LLAMA_PACK_CONTROLLER_REGISTRATION_KEY_OUTBOUND
# to the controller's LLAMA_PACK_CONTROLLER_REGISTRATION_KEY.
set -a
source .llama_pack.env
set +a
scripts/onboard_agent.sh \
  --node linux-2080ti \
  --controller-url "$LLAMA_PACK_CONTROLLER_URL" \
  --agent-url "$LLAMA_PACK_AGENT_URL"
```

The agent onboarding script keeps `controller_url` and `agent_url` as
environment placeholders in the generated config, and writes the real LAN URLs
to `.llama_pack.env` alongside the agent API key, controller registration
key, config path, host, and port. `scripts/start_agent.sh` and
`scripts/stop_server.sh` source `.llama_pack.env` automatically.

To make agent setup closer to one command, let onboarding install llama.cpp
first:

```bash
scripts/onboard_agent.sh \
  --node linux-2080ti \
  --controller-url "$LLAMA_PACK_CONTROLLER_URL" \
  --agent-url "$LLAMA_PACK_AGENT_URL" \
  --install-llama-cpp \
  --llama-cpp-backend auto
```

`scripts/install_llama_cpp.sh --backend auto` picks Metal on Apple Silicon,
CUDA when `nvcc` is available, and CPU otherwise. Use `--backend cuda`,
`--backend metal`, or `--backend cpu` to force a specific build. The installer
prints the matching `llama_server_bin`, `llama_cpp_dir`, and `python_bin`
values after it verifies `llama-server`, `llama-quantize`, the converter, and
the llama.cpp Python venv.

The controller registration key comes from the controller machine's
`.llama_pack.env` after `scripts/onboard_controller.sh` runs:

```bash
grep LLAMA_PACK_CONTROLLER_REGISTRATION_KEY .llama_pack.env
```

Copy that value to each agent as
`LLAMA_PACK_CONTROLLER_REGISTRATION_KEY_OUTBOUND`.

Regenerate a local key and print the matching update for the other machines:

```bash
scripts/regenerate_key.sh --type controller-registration
scripts/regenerate_key.sh --type agent-api --node linux-2080ti --agent-url "$LLAMA_PACK_AGENT_URL"
```

Script defaults:

```text
LLAMA_PACK_HOST=127.0.0.1
LLAMA_PACK_PORT=9137
LLAMA_PACK_CONFIG=./config.yaml if present, otherwise ./config.example.yaml
```

## First Admin Key

Llama Pack fails closed until you create an admin key or configure
`agent_api_key`. `scripts/onboard_controller.sh` creates the first admin key
for fresh controller setup and stores it in `.llama_pack.env`.

For manual setup, create the first admin key from the terminal:

```bash
uv run python -m llama_pack.auth --config config.yaml create-admin {user_name}
```

The command stores a hashed key in `log_dir/auth_store.db` and prints the raw API key once. Use that key in the UI login form, or send it as `X-Llama-Pack-Key` for API requests. To create more keys later, log in as an admin and use the auth key management UI/API.

There is no built-in `dev` login fallback. For local development, create a throwaway admin key with the same command.

For static shared secrets in agent/controller config, prefer the onboarding or
rotation scripts:

```bash
scripts/onboard_controller.sh
scripts/onboard_agent.sh --controller-url "$LLAMA_PACK_CONTROLLER_URL" --agent-url "$LLAMA_PACK_AGENT_URL"
scripts/regenerate_key.sh --type controller-registration
scripts/regenerate_key.sh --type agent-api --node linux-2080ti --agent-url "$LLAMA_PACK_AGENT_URL"
```

For one-off manual values, generate a strong URL-safe value with:

```bash
scripts/generate_api_key.py
```

Use the printed value for matching config fields such as `agent_api_key`, `nodes.<name>.api_key`, `controller_registration_key`, and `controller_registration_key_outbound`.

## Linux Agent Smoke Test

Linux agent smoke test for the `linux-2080ti` setup:

```bash
export LLAMA_PACK_AGENT_API_KEY=...
export LLAMA_PACK_CONTROLLER_REGISTRATION_KEY_OUTBOUND=...
# Required if the controller protects GET /nodes with an admin/API key:
export LLAMA_PACK_CONTROLLER_API_KEY=...
scripts/linux_agent_smoke.py --config linux-agent.config.example.yaml
```

The smoke test validates the Linux agent config and runtime paths, starts the agent with that config, checks the agent `/health`, and waits until the controller lists the expected node with a fresh heartbeat. Add `--stop-after-check` if you want the script to stop the agent after a successful run.

## Schema Migrations

Run migration upgrades before starting the app or creating admin keys.

Persistence is now Alembic-managed and SQLAlchemy-backed across all app
databases.

Alembic is scaffolded with multiple DB targets:

- `controller`
- `auth`
- `audit`
- `chat_sessions`
- `downloads`
- `benchmarks`

Select a target via `-x db=<target>`.

Examples:

```bash
alembic -x db=controller current
alembic -x db=auth revision -m "auth change" --version-path migrations/versions/auth
alembic -x db=audit upgrade audit@head
alembic -x db=chat_sessions downgrade -1
alembic -x db=downloads upgrade downloads@head
alembic -x db=benchmarks upgrade benchmarks@head
alembic -x db=controller stamp controller@head
```

If `-x db=` is omitted, target defaults to `controller`. Use target-qualified heads such as `auth@head`; unqualified `head` is ambiguous because each database target has its own Alembic branch.

## Testing

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

- [Frontend](frontend.md)
- `scripts/start_controller_stack.sh` starts the controller backend + React Vite dev server, or reports that the stack is currently up.
- `scripts/start_agent_stack.sh` starts the agent backend + React Vite dev server, or reports that the stack is currently up.
- `scripts/dev_fullstack.sh` starts backend + React Vite dev server in one command and auto-detects agent/controller mode from config.
- `LLAMA_PACK_START_FRONTEND=1 scripts/start_controller.sh` starts the
  backend and the React Vite dev server together for local development.
- `scripts/start_frontend.sh` starts only the React Vite dev server when a
  backend is already running.
