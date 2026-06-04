# Plugin Author Guide

Neuraxis plugins are trusted local Python packages loaded from configured
filesystem paths. The initial plugin runtime is intentionally local-path only:
there is no Python package entrypoint discovery, sandboxed execution, remote
frontend JavaScript, or automatic plugin migration execution yet.

Use the checked-in `plugins/hello_plugin/` as the reference sample.

## Enable A Plugin

Add the plugin id to `enabled_plugins` and provide a matching `plugins` entry:

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

Plugins whose id is not enabled, whose configured entry is disabled, or whose
runtime mode is incompatible are not registered. Failed and incompatible plugins
are reported through `/lm-api/v1/plugins/status`.

## Layout

Recommended local layout:

```text
plugins/hello_plugin/
|-- plugin.yaml
`-- hello_plugin/
    |-- __init__.py
    |-- plugin.py
    `-- static/
        `-- hello-entry.js
```

The manifest `entrypoint` points at an object with a `register(context)` method.

## Manifest Reference

Required fields:

```yaml
id: hello_plugin
name: Hello Plugin
version: "1.0"
requires_core: "1.0"
backend_api_version: "1.0"
frontend_api_version: "1.0"
entrypoint: hello_plugin.plugin:plugin
```

Field rules:

- `id`: lowercase safe identifier matching `^[a-z][a-z0-9_]*$`.
- `name`: display name.
- `version`: plugin version string.
- `requires_core`, `backend_api_version`, `frontend_api_version`: currently
  use `"1.0"`.
- `entrypoint`: `module.path:attribute` import path relative to the plugin root.
- `modes`: optional list of `agent` and/or `controller`; defaults to both.
- `description`: optional text.
- `frontend`: optional static asset metadata.
- `navigation`, `secondary_navigation`, `ui_routes`: optional frontend route
  metadata.
- `config_schema`: optional validation schema for plugin config.

Example controller-only plugin:

```yaml
modes:
  - controller
```

## Config Schema

Plugins can declare a small config schema. Core validates config before plugin
registration; invalid config leaves the plugin disabled with a warning.

Supported field types:

- `string`
- `integer`
- `number`
- `boolean`

Example:

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

Secret values are passed to plugin code through
`context.get_plugin_config()`, but are redacted as `<redacted>` in status
metadata. Do not log secrets from plugin code.

## Backend Extension API

Minimal plugin object:

```python
from fastapi import APIRouter


class Plugin:
    def register(self, context):
        router = APIRouter()

        @router.get("/hello")
        async def hello():
            return {"message": "hello from plugin"}

        context.add_api_router(router)


plugin = Plugin()
```

Available `PluginContext` methods:

- `add_api_router(router, prefix=None)`: registers backend routes under
  `/lm-api/v1/plugins/{plugin_id}/...`. The default prefix is `/{plugin_id}`.
  Custom prefixes must stay inside the plugin namespace and must not collide
  with another plugin route prefix.
- `add_navigation_item(item)`: appends primary frontend navigation metadata.
- `add_secondary_navigation_item(item)`: appends scoped secondary navigation
  metadata for plugin pages.
- `add_ui_route(item)`: appends placeholder frontend route metadata.
- `subscribe(event_name, handler)`: subscribes to in-process best-effort events.
- `add_policy_hook(hook_name, handler)`: registers a policy hook.
- `add_health_check(handler)`: registers a dynamic health check for
  `/lm-api/v1/plugins/status`.
- `add_migration_target(...)`: registers read-only migration metadata.
- `get_plugin_config()`: returns the plugin's configured config values.

## Events

Event subscribers receive an event envelope with stable metadata:

```python
async def record_event(event):
    print(event.type, event.id, event.occurred_at)

context.subscribe("neuraxis.plugin.loaded", record_event)
```

Subscriber failures and timeouts are isolated: they do not stop other
subscribers, but they are recorded in plugin health/status metadata.

Current built-in event names include:

- `neuraxis.plugin.loaded`
- `neuraxis.plugin.disabled`
- `neuraxis.plugin.failed`
- `neuraxis.plugin.config.updated`
- `neuraxis.plugin.migration.pending`
- `neuraxis.plugin.migration.completed`

## Hooks

Policy hooks run in deterministic registration order. Safety-sensitive hook
failures reject the action.

The initial hook is `neuraxis.chat_admission`. It runs through the shared
`ChatScheduler` admission path before scheduler capacity is consumed, so it
applies to native chat, OpenAI-compatible chat, Ollama-compatible chat, and
threaded chat surfaces that route through the scheduler.

Example:

```python
async def chat_admission(payload):
    config = context.get_plugin_config()
    if config.get("reject_chat"):
        return {"allowed": False, "message": "Plugin rejected chat"}
    return {"allowed": True}

context.add_policy_hook("neuraxis.chat_admission", chat_admission)
```

## Health Checks

Health checks can be sync or async. They may return one dict, a list of dicts,
or `None`.

```python
async def health_check():
    return {"level": "ok", "message": "Plugin ready"}

context.add_health_check(health_check)
```

Use `level: "warning"` or `level: "error"` for operator-visible issues.
Exceptions are caught and reported as health errors.

## Migration Metadata

Plugins can register migration targets for visibility:

```python
context.add_migration_target(
    "usage",
    directory="migrations/usage",
    database_url="sqlite:///usage.db",
    current_revision="001_initial",
    head_revision="002_usage",
)
```

Core reports those targets at:

```text
GET /lm-api/v1/plugins/{plugin_id}/migrations/status
```

Pending or missing migrations are also surfaced as warnings in
`/lm-api/v1/plugins/status`. Core does not run plugin migrations during startup.
Execution commands/workflows are deferred.

## Frontend Metadata

The backend exposes enabled plugin metadata at:

```text
GET /lm-api/v1/plugins/enabled
```

Manifest example:

```yaml
frontend:
  static_dir: hello_plugin/static
  entry: /plugin-assets/hello_plugin/hello-entry.js
navigation:
  - label: Hello
    path: /ui/plugins/hello_plugin
secondary_navigation:
  - label: Settings
    path: /ui/plugins/hello_plugin/settings
ui_routes:
  - path: /ui/plugins/hello_plugin
    label: Hello Plugin
```

Core serves static files from the declared static directory under:

```text
/plugin-assets/{plugin_id}/...
```

The React shell currently renders plugin navigation, scoped secondary
navigation, and placeholder plugin pages. Dynamic frontend bundle loading from
`frontend.entry` is intentionally deferred, so plugin JavaScript is served but
not executed by the core React app yet.

The shell also reads `/lm-api/v1/plugins/status` and shows administrator-facing
alerts for failed, incompatible, warning, or error plugin states.

## Testing Plugins

Backend plugin behavior should have focused tests in `tests/test_plugins.py`.
Use isolated fixture plugins for failure, collision, config, hook, event, and
migration edge cases. Use `plugins/hello_plugin/` as the checked-in integration
target for the happy path.

Recommended coverage:

- Core starts with no plugins.
- Enabled plugin registers metadata and routes.
- Disabled, failed, and incompatible plugins do not register routes.
- Route namespace and collision failures are reported.
- Static assets are served only from the declared static directory.
- Path traversal is rejected.
- Config schema validation disables invalid plugins.
- Secret config values are redacted from status metadata.
- Event and hook failures are isolated and reported.
- Health checks appear in `/lm-api/v1/plugins/status`.
- Migration metadata appears in `/migrations/status`.
- Pending or missing migrations produce health warnings.
- Plugin registration does not auto-run migrations.

Frontend plugin shell behavior is covered in `frontend/src/components/AppShell.test.tsx`.

## Hello Plugin Walkthrough

1. Enable `hello_plugin` in controller config:

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

2. Start the controller.

3. Confirm backend route:

   ```bash
   curl http://127.0.0.1:9137/lm-api/v1/plugins/hello_plugin/hello
   ```

4. Confirm metadata:

   ```bash
   curl http://127.0.0.1:9137/lm-api/v1/plugins/enabled
   curl http://127.0.0.1:9137/lm-api/v1/plugins/status
   curl http://127.0.0.1:9137/lm-api/v1/plugins/hello_plugin/migrations/status
   ```

5. Open the React UI on the controller. The `Hello` nav item should appear in
   the `Plugins` section and route to a placeholder page.

6. Set `reject_chat: true` to exercise the `neuraxis.chat_admission` hook. Chat
   requests that route through `ChatScheduler` should be rejected before
   scheduler capacity is consumed.

## Deferred Work

These are not part of the current plugin foundation:

- Dynamic React `import()` of plugin frontend bundles.
- Frontend bundle failure isolation beyond backend status alerts.
- Remote plugin JavaScript or third-party asset origins.
- Sandboxed plugin Python or JavaScript execution.
- Auto-running plugin migrations on startup.
- Plugin install/update/uninstall lifecycle commands.
- Python package entrypoint discovery.
