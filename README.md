# Neuraxis

Neuraxis is a secure local/private LLM gateway with an operations console.
It gives your apps one stable private AI backend while giving you an operator UI
for the machines, models, keys, routing, logs, and jobs behind it.

The app can run in two modes:

- `agent`: runs on each model host and manages local `llama-server` processes.
- `controller`: runs on a central host, routes app traffic, and aggregates operations across known agents.

The controller is the gateway and operations surface. Agents provide local
compute, model lifecycle control, and the foundation for a private agent
runtime.

## Quick Start

Controller:

```bash
uv sync
scripts/onboard_controller.sh
scripts/start_controller.sh
```

Agent:

```bash
uv sync
export NEURAXIS_CONTROLLER_REGISTRATION_KEY_OUTBOUND=...
scripts/onboard_agent.sh \
  --node linux-2080ti \
  --controller-url "$NEURAXIS_CONTROLLER_URL" \
  --agent-url "$NEURAXIS_AGENT_URL"
scripts/start_agent.sh
```

The onboarding scripts write local secrets to `.neuraxis.env`, which is
ignored by git. The start/stop helper scripts source that file automatically.

Manual setup, migrations, admin keys, smoke tests, and test commands are in
[Setup](docs/setup.md).

## What It Does

- **Gateway:** exposes OpenAI-compatible `/v1/chat/completions` and Ollama-compatible
  `/api/chat` endpoints for other applications through chat-only external app keys.
- **Operations console:** manages nodes, local `llama-server` processes, model
  lifecycle, downloads, conversion, quantization, logs, benchmarks, auth, and audit.
- **Routing layer:** routes controller chat by `request_type` through configured
  node priorities and returns route metadata to callers.
- **Private runtime foundation:** tracks durable chat threads, route decisions,
  orchestration jobs, memory, and agent-tool execution paths.
- **Personal AI backend:** lets other apps depend on one stable local/private API
  while hardware and models change behind the scenes.

## Documentation

- [Setup](docs/setup.md): install, onboarding scripts, admin keys, migrations, smoke tests, and test commands.
- [Configuration](docs/configuration.md): agent, controller, Raspberry Pi, security, worker, and model capability settings.
- [Agent Tools](docs/agent-tools.md): all tool types, config fields, and safety rules.
- [API](docs/api.md): endpoint list and external OpenAI/Ollama chat compatibility examples.
- [Model Downloads](docs/downloads.md): Hugging Face GGUF download workflow, history, logs, cancellation, and recommendations.
- [Benchmarks](docs/benchmarks.md): benchmark definitions, managed runs, result metrics, and comparisons.
- [How To Use](docs/how-to-use.md): longer end-to-end operating guide.
- [Raspberry Pi Controller Topology](docs/pi-controller-topology.md): current Pi controller deployment notes and smoke checks.
- [Frontend](docs/frontend.md): React development workflow.
- [Architecture](docs/architecture.md): contributor-focused code map and review guide.

## Common Commands

```bash
uv sync
scripts/start_controller.sh
scripts/start_agent.sh
scripts/stop_server.sh
scripts/regenerate_key.sh --type controller-registration
scripts/regenerate_key.sh --type agent-api --node linux-2080ti --agent-url "$NEURAXIS_AGENT_URL"
uv run pytest -v
```

Prefer `uv sync` for local setup. It uses `uv.lock` and avoids relying on a
shell-specific `python` or `pip` executable. If you need a pip-based install,
use an explicit supported interpreter, for example:

```bash
python3.12 -m venv .venv
source .venv/bin/activate
python -m pip install -e ".[dev]"
```

## External Chat Endpoints

Use `/v1/chat/completions` as the primary integration surface for other apps.
Use `/api/chat` when migrating older Ollama clients. Both endpoints support
controller routing metadata in headers, including `X-Llama-Manager-Thread-Id`,
`X-Llama-Manager-Route`, `X-Llama-Manager-Node`, and
`X-Llama-Manager-Model`.

See [API: External Chat Compatibility](docs/api.md#external-chat-compatibility)
for request examples.

## Notes

- `agent` mode starts `llama-server` with `--model`, `--host`, `--port`, `--ctx-size`, and `--n-gpu-layers`.
- HF model conversion writes `{model-name}.gguf` inside the existing HF model directory, and existing conversion detection checks for any top-level `*.gguf` in that directory.
- Logs are written per model under `log_dir`.
- Process state is in-memory for this MVP. If the manager restarts, it reports configured models but does not reattach to old processes.
