# Plugin Author Guide

Llama Pack plugins are trusted local Python packages loaded from configured
filesystem paths. The initial plugin runtime is intentionally local-path only:
there is no Python package entrypoint discovery, sandboxed execution, or remote
frontend JavaScript.

Use the checked-in `plugins/hello_plugin/` as the reference sample. Paid or
private plugins, including the private `llama_pack_business` add-on, live outside
this repository and are loaded from configured local paths.

For a draft of the next plugin-page developer experience (template-first pages,
external styles, and action-focused controllers), see
[Plugin Page Authoring v1 (Draft)](plugin-page-authoring-v1.md).

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
        |-- hello.css
        |-- controllers/
        |   `-- hello.js
        `-- templates/
            `-- hello.html
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
- `client_auth`: optional client discovery metadata for plugin-owned auth.
- `navigation`, `secondary_navigation`, `ui_routes`: optional frontend route
  metadata.
- `config_schema`: optional validation schema for plugin config.

Example controller-only plugin:

```yaml
modes:
  - controller
```

Example plugin-owned client auth discovery metadata:

```yaml
client_auth:
  method: external_plugin_auth
  endpoint: /lm-api/v1/plugins/external_plugin_auth/auth/login
  endpoint_key: externalPluginAuth
```

When the plugin is enabled and has no health errors, `GET
/lm-api/v1/client-discovery` adds `method` to `auth.methods` and adds
`endpoint` under `endpoints[endpoint_key]`.

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
- `add_background_task(task_id, start=..., stop=...)`: registers a cooperative
  plugin task lifecycle. `start(app)` runs when the enabled plugin starts with
  the FastAPI app or is activated at runtime. `stop(app)` runs during app
  shutdown or before runtime deactivation disables the plugin. Task ids must be
  unique within the plugin.
- `get_database(name="main")`: returns a plugin-owned SQLite database handle
  rooted under `{log_dir}/plugins/{plugin_id}/state/`.
- `add_migration_target(...)`: registers plugin migration metadata and optional
  explicit migration execution for a plugin-owned database.
- `get_plugin_config()`: returns the plugin's configured config values.
- `get_state_dir()`: returns a `Path` for the plugin's private persistent state
  directory (`{log_dir}/plugins/{plugin_id}/state/`). The directory is **not**
  created automatically; the plugin must call `mkdir(parents=True, exist_ok=True)`
  before writing to it (or delegate that to a store class). Use this path to
  locate plugin-owned SQLite databases or other data files. The directory is
  scoped to the runtime `log_dir`, keeping plugin data alongside other app state.

Background task callbacks can be synchronous or asynchronous. They receive the
FastAPI app object so they can read app state, and they must cooperate with
shutdown by stopping their own worker, watcher, or subscription before returning.

```python
class Plugin:
    def register(self, context):
        state_dir = context.get_state_dir()

        async def start(app):
            state_dir.mkdir(parents=True, exist_ok=True)
            (state_dir / "started.txt").write_text("started", encoding="utf-8")

        async def stop(app):
            (state_dir / "stopped.txt").write_text("stopped", encoding="utf-8")

        context.add_background_task("writer", start=start, stop=stop)


plugin = Plugin()
```

## Events

Event subscribers receive an event envelope with stable metadata:

```python
async def record_event(event):
    print(event.type, event.id, event.occurred_at)

context.subscribe("llama_pack.plugin.loaded", record_event)
```

Handlers can be synchronous or asynchronous. Use `context.subscribe(...)` during
plugin registration only; subscriptions are removed when the plugin is disabled
or unloaded.

```python
class Plugin:
    id = "chat_audit_plugin"
    name = "Chat Audit Plugin"
    version = "1.0"

    def register(self, context):
        async def record_thread_error(event):
            payload = event.payload
            print(
                "Thread error",
                payload["thread_id"],
                payload["error_code"],
                event.correlation_id,
            )

        context.subscribe("llama_pack.thread.error.created", record_thread_error)


plugin = Plugin()
```

The event envelope has these stable fields:

- `id`: unique event-envelope id.
- `type`: event name passed to subscribers.
- `version`: event-envelope schema version.
- `occurred_at`: UTC timestamp.
- `source`: event source metadata.
- `correlation_id`: request, turn, or source event id when available.
- `actor`: user/session metadata when available.
- `payload`: event-specific structured data.

Subscriber failures and timeouts are isolated: they do not stop other
subscribers, but they are recorded in plugin health/status metadata.
Events are in-process, best-effort notifications. They are not durable across
process restarts, and they are not replayed for plugins that were disabled or
not yet loaded when the event occurred.

Current built-in event names include:

- `llama_pack.plugin.loaded`
- `llama_pack.plugin.disabled`
- `llama_pack.plugin.failed`
- `llama_pack.plugin.config.updated`
- `llama_pack.plugin.migration.pending`
- `llama_pack.plugin.migration.completed`

Chat scheduler events:

- `llama_pack.chat.admitted`: a chat request passed policy and capacity
  admission. Payload fields include `model` and `session_id`.
- `llama_pack.chat.rejected`: a chat request was rejected by policy, queue
  limits, or admission timeout. Payload fields include `model`, `session_id`,
  `reason`, and `status_code`.
- `llama_pack.chat.completed`: a non-streaming or streaming chat request
  completed. Payload fields include `model`, `session_id`, token counts when
  available, `total_duration_ms`, `route`, and `streamed`.
- `llama_pack.chat.failed`: a chat request failed after admission. Payload
  fields include `model`, `session_id`, and `error`.

Thread events:

- `llama_pack.thread.user_message.created`
- `llama_pack.thread.assistant_message.created`
- `llama_pack.thread.routing_decision.created`
- `llama_pack.thread.error.created`
- `llama_pack.thread.workflow_step.started`
- `llama_pack.thread.workflow_step.completed`
- `llama_pack.thread.workflow_step.failed`
- `llama_pack.thread.history_summary.created`
- `llama_pack.thread.agent_request.created`
- `llama_pack.thread.agent_response.created`
- `llama_pack.thread.aggregation.created`

Thread event payloads use a common shape:

- `event_id`: durable thread event id.
- `thread_id`: thread id.
- `event_type`: stored thread event type, such as `user_message` or `error`.
- `turn_id`: shared id for events in the same user turn, when available.
- `role`: message role when applicable.
- `public`: whether the event is visible in the public thread event list.
- `route`: selected route metadata when applicable.
- `agent_node`: node that handled the event when applicable.
- `model`: model that handled the event when applicable.
- `error_code` and `error_detail`: present for error events.
- `content`: bounded event content with large/raw fields omitted.
- `created_at`: durable thread event timestamp.

For privacy and payload-size control, thread event `content` omits raw model
responses and full message arrays. String fields are truncated to 1000
characters, list fields to 20 items, and dictionary fields to 20 entries.

The built-in workflows plugin can trigger workflows from these high-value
events:

- `llama_pack.chat.completed`
- `llama_pack.chat.failed`
- `llama_pack.chat.rejected`
- `llama_pack.thread.error.created`
- `llama_pack.thread.user_message.created`
- `llama_pack.thread.assistant_message.created`
- `llama_pack.thread.workflow_step.failed`
- `llama_pack.thread.history_summary.created`

## Hooks

Policy hooks run in deterministic registration order. Safety-sensitive hook
failures reject the action.

The initial hook is `llama_pack.chat_admission`. It runs through the shared
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

context.add_policy_hook("llama_pack.chat_admission", chat_admission)
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
database = context.get_database("main")
context.add_migration_target(
    "main",
    directory="hello_plugin/migrations",
    database=database,
)
```

Core reports those targets at:

```text
GET  /lm-api/v1/plugins/{plugin_id}/migrations/status
POST /lm-api/v1/plugins/{plugin_id}/migrations/{target_id}/upgrade
```

Pending or missing migrations are also surfaced as warnings in
`/lm-api/v1/plugins/status`. Core does not run plugin migrations during startup;
migration execution is explicit through the plugin migration API.

Plugins that need durable data should use plugin-owned databases under their
private state directory, with plugin-owned schemas and migrations. Core provides
the storage location and migration lifecycle contract, but does not import
plugin models or place plugin tables in core databases. See
[Plugin Database Contract](plugin-databases.md).

## Frontend Metadata

The backend exposes enabled plugin metadata at:

```text
GET /lm-api/v1/plugins/enabled
```

For new plugin UI, prefer `frontend.pages`. Each page declares a core UI route,
an HTML fragment template under `frontend.static_dir`, an optional controller
module under `frontend.static_dir`, and a title.

Manifest example:

```yaml
frontend:
  static_dir: hello_plugin/static
  style_entries:
    - hello.css
  pages:
    - route: /ui/plugins/hello_plugin
      template: templates/hello.html
      controller: controllers/hello.js
      title: Hello Plugin
```

Core serves static files from the declared static directory under:

```text
/plugin-assets/{plugin_id}/...
```

The React shell renders plugin navigation, scoped secondary navigation, and a
generic plugin host page from `frontend.pages`. The host fetches the declared
HTML fragment, inserts it into the plugin container, then loads the optional
controller module and calls `mountPage(root, host)`.

Minimal page controller:

```js
export function mountPage(root, host) {
  root.querySelector("[data-plugin-id]").textContent = host.pluginId;
  return () => {};
}
```

The `host` object exposes:

- `pluginId`: current plugin id.
- `apiGet(path)`, `apiPost(path, body)`, `apiPut(path, body)`, and
  `apiDelete(path)`: scoped helpers for `/lm-api/v1/plugins/{plugin_id}`.
- `navigate(path)`: navigate inside the core UI.
- `refreshPluginStatus()`: request a plugin status refresh.

Plugin frontend modules run in the core UI origin. Treat plugin frontend code as
trusted extension code and keep private/paid plugin UI in the private plugin
repository.

Core provides a small stable CSS class contract for plugin pages:

- `lp-plugin-page`
- `lp-plugin-panel`
- `lp-plugin-header`
- `lp-plugin-title`
- `lp-plugin-muted`
- `lp-plugin-actions`
- `lp-plugin-button`
- `lp-plugin-field`
- `lp-plugin-input`
- `lp-plugin-table`

Plugin assets are served with `Cache-Control: no-store`, and the React plugin
host appends a version/reload query string when importing plugin controllers,
and styles.
During development, plugin frontend asset changes should only require a browser
reload or the plugin page's Reload button. Core frontend rebuilds are only
needed when the public host contract changes.

The shell also reads `/lm-api/v1/plugins/status` and shows administrator-facing
alerts for failed, incompatible, warning, or error plugin states.

Administrators can inspect configured plugins at `/ui/plugins`. That page
shows plugin status, health, frontend metadata, redacted config metadata, and
registered migration targets.

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

6. Set `reject_chat: true` to exercise the `llama_pack.chat_admission` hook. Chat
   requests that route through `ChatScheduler` should be rejected before
   scheduler capacity is consumed.

## Private Plugin Repositories

Private plugins should be tracked in separate private repositories.
Keep this repository focused on the core runtime, public extension contracts,
and the minimal `hello_plugin` sample.

Recommended local development setup:

```yaml
enabled_plugins:
  - llama_pack_business

plugins:
  llama_pack_business:
    path: /path/to/llama-pack-business-plugin
    enabled: true
    config:
      organization_name: Acme
```

That private plugin uses the same manifest schema, backend extension API,
frontend metadata contract, health checks, and migration metadata described
above. It should carry its own implementation tests and CI, while this
repository keeps fixture-based coverage for the generic plugin runtime and the
public `hello_plugin` sample.

Private plugins that provide end-user auth or chat policy should expose their
client-facing availability through core client discovery rather than requiring
clients to scrape plugin status or know private route details. Core discovery
advertises plugin auth endpoints only when the plugin is enabled and not
reporting errors that make the advertised feature unusable.

## Deferred Work

These are not part of the current plugin foundation:

- Dynamic React `import()` of plugin frontend bundles.
- Frontend bundle failure isolation beyond backend status alerts.
- Remote plugin JavaScript or third-party asset origins.
- Sandboxed plugin Python or JavaScript execution.
- Auto-running plugin migrations on startup.
- Plugin install/update/uninstall lifecycle commands.
- Python package entrypoint discovery.
