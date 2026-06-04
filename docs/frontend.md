# Frontend Development

The web UI lives in `frontend/` and is a Vite + React + TypeScript app. The production build is emitted into `llama_manager/ui/react` so FastAPI can serve it as static package data.

## Install

```bash
cd frontend
npm ci
```

Do not commit `frontend/node_modules`.

## Run The Backend

Start FastAPI in another terminal:

```bash
NEURAXIS_CONFIG=config.example.yaml uv run uvicorn llama_manager.main:app --host 127.0.0.1 --port 9137
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
(`NEURAXIS_CONFIG` or `config.yaml`) and starts `agent` or `controller`
accordingly. Set `NEURAXIS_MODE` explicitly if you want to override this.

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

The script writes its PID to `.neuraxis_frontend.pid` and logs to
`logs/neuraxis_frontend_vite.log`. Stop it with:

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
llama_manager/ui/react
```

FastAPI serves `/` from `llama_manager/ui/react/index.html` when the React build exists. The generated `assets/*` files are content-hashed, so a rebuild may delete an old asset and add a new one.

## Project Layout

- `src/api/`: typed API helpers by backend domain.
- `src/components/`: shell, logs modal, and shared UI primitives.
- `src/features/`: typed pure helpers migrated from the former vanilla frontend.
- `src/pages/`: routed React pages.
- `src/routes/pages.ts`: canonical React navigation model.
- `src/test/`: Vitest setup and app-level smoke coverage.

## Plugin Frontend Metadata

Core loads enabled plugin metadata from `/lm-api/v1/plugins/enabled`.
The React shell uses that metadata to add plugin primary navigation, scoped
secondary navigation, and placeholder pages for plugin UI routes. Dynamic
plugin bundle imports are intentionally deferred; plugin frontend entry files
are exposed in metadata now so the backend contract is ready.

The shell also reads `/lm-api/v1/plugins/status` and shows a compact
administrator-facing alert when plugins are failed, incompatible, or reporting
health warnings/errors such as pending migration metadata.

Plugin assets are served by FastAPI from each plugin's declared static
directory under:

```text
/plugin-assets/{plugin_id}/...
```

Core serves those files but does not bundle them into the core React build.

## Release Notes

- `frontend` is the canonical frontend test/build package.
- `frontend-tests` has been removed after parity coverage moved into `frontend`.
- `llama_manager/ui/react` is included in Python package data for release builds.
- The former vanilla static console files under `llama_manager/ui/*.js`,
  `llama_manager/ui/index.html`, and `llama_manager/ui/styles.css` have been
  removed; FastAPI serves the React build directly.
