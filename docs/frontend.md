# Frontend Development

The web UI lives in `frontend/` and is a Vite + React + TypeScript app. The production build is emitted into `llama_pack/ui/react` so FastAPI can serve it as static package data.

## Install

```bash
cd frontend
npm ci
```

Do not commit `frontend/node_modules`.

## Run The Backend

Start FastAPI in another terminal:

```bash
LLAMA_PACK_CONFIG=config.example.yaml uv run uvicorn llama_pack.main:app --host 127.0.0.1 --port 9137
```

Use your normal controller or agent config instead of `config.example.yaml` when testing real nodes and model workflows.

The runtime scripts can also start the backend:

```bash
scripts/start_controller.sh
```

For local development, start the backend and React dev site together:

```bash
scripts/start_controller_stack.sh
```

For agent-mode development, use the matching agent stack helper:

```bash
scripts/start_agent_stack.sh
```

Both stack helpers check their backend and frontend PID files first. If the
whole stack is already running, they print a `currently up` message and do not
restart either process. If only one side is running, they start the missing
side.

You can also use the mode-detecting helper:

```bash
scripts/dev_fullstack.sh
```

`scripts/dev_fullstack.sh` auto-detects backend mode from your active config
(`LLAMA_PACK_CONFIG` or `config.yaml`) and starts `agent` or `controller`
accordingly. Set `LLAMA_PACK_MODE` explicitly if you want to override this.

Use `scripts/start_controller.sh` or `scripts/start_agent.sh` when you only
want to start the backend.

## Run The Vite Dev Server

```bash
scripts/start_frontend.sh
```

Open:

```text
http://127.0.0.1:5173/ui/react/
```

The script writes its PID to `.llama_pack_frontend.pid` and logs to
`logs/llama_pack_frontend_vite.log`. Stop it with:

```bash
scripts/stop_frontend.sh
```

The Vite dev server proxies API requests to `http://127.0.0.1:9137` by default. Override the backend target with:

```bash
VITE_API_PROXY_TARGET=http://127.0.0.1:9000 scripts/start_frontend.sh
```

You can still run Vite directly when you want foreground logs:

```bash
cd frontend
npm run dev
```

## Run The Electron Development Shell

The desktop shell lives in `desktop/` and attaches to an already-running
development stack. It does not start or stop the backend or the Vite frontend.

Start the backend and frontend first:

```bash
scripts/dev_fullstack.sh
```

Then launch Electron in another terminal:

```bash
cd desktop
npm ci
npm run dev
```

By default, Electron loads:

```text
http://127.0.0.1:5173/ui/
```

Override the target URL when testing a different Vite host or port:

```bash
LLAMA_PACK_DESKTOP_URL=http://127.0.0.1:6000/ui/ npm run dev
```

If the target URL is unavailable, the shell shows a local error page with the
command needed to start the development stack.

## Test

Run frontend tests directly:

```bash
cd frontend
npm test
```

Run the Python integration wrapper that installs frontend dependencies and runs the same Vitest suite:

```bash
uv run pytest tests/test_frontend_tests.py -v
```

Run UI static-serving checks:

```bash
uv run pytest tests/test_ui_static_serving.py tests/test_package_data.py -v
```

## Build

```bash
cd frontend
npm run build
```

Build output is written to:

```text
llama_pack/ui/react
```

FastAPI serves `/` from `llama_pack/ui/react/index.html` when the React build exists. The generated `assets/*` files are content-hashed, so a rebuild may delete an old asset and add a new one.

## Project Layout

- `src/api/`: typed API helpers by backend domain.
- `src/components/`: shell, logs modal, and shared UI primitives.
- `src/features/`: typed pure helpers migrated from the former vanilla frontend.
- `src/pages/`: routed React pages.
- `src/routes/pages.ts`: canonical React navigation model.
- `src/test/`: Vitest setup and app-level smoke coverage.

## Chat Conversations

The frontend should present chat as conversation history. Avoid exposing
`thread` as the primary user-facing term unless an operator/debug detail needs
the backend identifier.

Internally, an active conversation is backed by a durable backend thread. Any
frontend state named `activeConversationId` or equivalent should store the
backend `thread_id`. If the user sends a message without an active
conversation, the chat UI should create the thread first and then append the
message to that thread.

The Chat page streams conversation turns through
`/lm-api/v1/threads/{thread_id}/messages/stream`. After a stream completes, the
UI may refresh thread events for route details, but it should preserve the
visible streamed message state when that state includes client-side telemetry
or reasoning display that is not present in the persisted event payload.

The OpenAI-compatible and Ollama-compatible chat endpoints remain public API
surfaces for external consumers. They should not be removed just because the
frontend uses thread-backed conversations.

## Plugin Frontend Metadata

Core loads enabled plugin metadata from `/lm-api/v1/plugins/enabled`.
The React shell uses that metadata to add plugin primary navigation, scoped
secondary navigation, and host pages for plugin UI routes. New plugin pages use
`frontend.pages`: the shell fetches an HTML fragment template, imports the
optional page controller, calls `mountPage(root, host)`, and attaches declared
`style_entries`.

The shell also reads `/lm-api/v1/plugins/status` and shows a compact
administrator-facing alert when plugins are failed, incompatible, or reporting
health warnings/errors such as pending migration metadata.

The built-in `/ui/plugins` page lists configured plugin status, health,
frontend metadata, redacted config metadata, and registered migration targets.

For the full plugin frontend metadata contract, see
[Plugin Author Guide](plugins.md).

Plugin assets are served by FastAPI from each plugin's declared static
directory under:

```text
/plugin-assets/{plugin_id}/...
```

Core serves those files but does not bundle them into the core React build.

## Release Notes

- `frontend` is the canonical frontend test/build package.
- `frontend-tests` has been removed after parity coverage moved into `frontend`.
- `llama_pack/ui/react` is included in Python package data for release builds.
- The former vanilla static console files under `llama_pack/ui/*.js`,
  `llama_pack/ui/index.html`, and `llama_pack/ui/styles.css` have been
  removed; FastAPI serves the React build directly.
