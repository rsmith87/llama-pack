# Plugin Architecture

This document defines the Llama Pack plugin architecture. The goal is to keep the
core product free, home-network friendly, and fully usable while allowing
optional add-ons such as `llama_pack_business` to provide enterprise features.

`llama_pack_business` is a paid private add-on and is developed in a separate
private repository; core only knows it through the generic plugin runtime.

For the first implementation pass, see
[plugin-foundation-implementation-plan.md](plugin-foundation-implementation-plan.md).

## Goals

- Core works without any plugins installed.
- Plugins are self-contained where practical, including backend code, frontend
  source, frontend build artifacts, migrations, and static assets.
- Core exposes stable extension points instead of importing plugin code
  directly.
- Plugin failures do not break core startup by default.
- Future developers can build plugins from documented backend and frontend
  extension APIs.

## Non-Goals

- Sandboxing plugin Python or JavaScript in the first implementation.
- Payment or license enforcement in the first implementation.
- Auto-running plugin migrations during startup.
- Letting plugins depend on unstable core frontend internals.

## Core And Plugin Boundary

Llama Pack core owns:

- Model management.
- Native chat.
- OpenAI-compatible and Ollama-compatible APIs.
- Basic auth and API keys.
- Node/controller operation.
- Chat admission and queue safety.
- Per-thread turn serialization.
- Basic logs and health.
- Plugin runtime and extension points.

Business or enterprise plugins own:

- Usage accounting dashboards.
- Team, user, department, and group management.
- Quotas and workload policy.
- SSO/OIDC/SAML and directory integrations.
- Audit reporting.
- Business assistants and team workspaces.
- Document governance.
- Cost-savings reports.
- Advanced admin dashboards.
- Compliance-oriented retention/export controls.
- Enterprise connectors.

Core must not import or require a business plugin. The plugin registers into
core extension points.

## Configuration

Prefer plugin-based configuration over a permanent top-level business flag:

```yaml
enabled_plugins:
  - llama_pack_business

plugins:
  llama_pack_business:
    path: /path/to/private/llama_pack_business_plugin
    enabled: true
```

Avoid adding a separate `business_features_enabled` flag unless absolutely
needed for an intermediate migration. The target architecture is plugin
installation plus plugin configuration.

## Version Compatibility

Start with version `1.0` for:

- Core plugin API.
- Backend plugin API.
- Frontend plugin API.
- Private `llama_pack_business` plugin.

While the plugin system is in active development, keep those versions at `1.0`.
Once released, move to versioned releases and explicit compatibility checks.

Incompatible plugins should not load. Core should continue to start with the
plugin disabled and a warning explaining the incompatibility.

## Core Runtime Layout

Add a core plugin runtime:

```text
llama_pack/core/plugins/
|-- __init__.py
|-- manifest.py
|-- registry.py
|-- loader.py
|-- context.py
|-- hooks.py
|-- events.py
`-- migrations.py
```

The core package owns plugin discovery, manifest validation, lifecycle,
extension registration, events, hooks, and migration metadata. It should not
contain business-specific behavior.

## Manifest

Each plugin declares metadata and an entrypoint:

```yaml
id: llama_pack_business
name: Llama Pack Business
version: "1.0"
requires_core: "1.0"
backend_api_version: "1.0"
frontend_api_version: "1.0"
entrypoint: llama_pack_business.plugin:plugin
```

The manifest should support:

- Plugin id, name, version, and description.
- Core version compatibility.
- Backend plugin API version compatibility.
- Frontend plugin API version compatibility.
- Python entrypoint.
- Optional frontend bundle metadata.
- Optional migration target metadata.
- Optional permission or capability declarations.

Plugin ids must match a safe identifier pattern and must be rejected if unsafe.

## Plugin Interface

Core exposes a small protocol:

```python
class Llama PackPlugin(Protocol):
    id: str
    name: str
    version: str

    def register(self, context: PluginContext) -> None:
        ...
```

Plugins register through `PluginContext`; they should not mutate arbitrary
`app.state` fields directly.

`PluginContext` should support:

- `add_api_router(router, prefix=...)`
- `add_ui_route(...)`
- `add_navigation_item(...)`
- `subscribe(event_name, handler)`
- `add_policy_hook(hook_name, handler)`
- `add_health_check(handler)`
- `add_migration_target(...)`
- `get_plugin_config()`

## Startup Flow

During app creation:

1. Load normal core config.
2. Build core services.
3. Create `PluginRegistry`.
4. Load enabled plugin manifests.
5. Import plugin entrypoints.
6. Create a `PluginContext` for each plugin.
7. Let each plugin register routes, hooks, events, migrations, UI entries, and
   health checks.
8. Register plugin API routes with FastAPI.
9. Expose enabled plugin metadata to the frontend.

Example endpoint:

```http
GET /lm-api/v1/plugins/enabled
```

Example response:

```json
[
  {
    "id": "llama_pack_business",
    "name": "Llama Pack Business",
    "version": "1.0",
    "status": "enabled",
    "frontend": {
      "entry": "/plugin-assets/llama_pack_business/business-entry.js",
      "style": "/plugin-assets/llama_pack_business/business.css"
    },
    "navigation": [],
    "secondary_navigation": [],
    "ui_routes": []
  }
]
```

## Namespaces

Use these namespaces:

- Backend plugin APIs: `/lm-api/v1/plugins/{plugin_id}/...`
- Plugin frontend/static assets: `/plugin-assets/{plugin_id}/...`
- Business frontend routes: `/ui/business/*`

The business plugin may present user-friendly frontend paths while still using
generic plugin API paths internally.

## Security And Trust Boundary

Installed plugins are trusted code. The initial plugin foundation does not
sandbox plugin Python or JavaScript.

Core must still enforce rules that keep plugins in their lane:

- Validate plugin manifests before loading.
- Reject unsafe plugin ids.
- Reject backend route prefixes that collide with core routes or other plugins.
- Serve plugin assets only from the plugin's declared static directory.
- Prevent path traversal in plugin asset routes.
- Do not let plugin asset routes shadow core UI or API routes.
- Keep plugin backend APIs under `/lm-api/v1/plugins/{plugin_id}/...`.
- Keep plugin assets under `/plugin-assets/{plugin_id}/...`.
- Keep business frontend routes under `/ui/business/*`.
- Fail closed when plugin manifest validation or imports fail.

User-facing language should make clear that enabling a plugin means trusting
that plugin's code.

## Failure Behavior

If a plugin fails to load, core should still start. The failed plugin should be
disabled and reported with a clear warning. The frontend should show an error
alert to administrators explaining which plugin failed and why, similar to how
WordPress reports plugin failures.

If a plugin is configured as required in the future, core may refuse startup.
Required plugins are out of scope for the initial implementation.

## Permissions

For the first pass, admin users can see all business routes. Other users should
only see navigation entries returned for their current role or capability. The
backend plugin metadata endpoint should filter navigation server-side. Every
business plugin API route still needs backend authorization.

The business plugin can extend the permissions model later with business roles
such as `business_admin`, `manager`, and `compliance`.

## Self-Contained Plugin Frontends

Plugin frontend work should live inside the plugin. The business plugin should
own its frontend source, build output, route modules, page components, and
styles. Core should only provide a frontend extension host and stable plugin API.

Recommended plugin layout:

```text
plugins/llama_pack_business/
|-- plugin.yaml
|-- llama_pack_business/
|   |-- plugin.py
|   |-- api/
|   |-- policies/
|   |-- usage/
|   |-- identity/
|   |-- documents/
|   |-- migrations/
|   `-- static/
|       |-- manifest.json
|       |-- assets/
|       |-- business-entry.js
|       `-- business.css
`-- frontend/
    |-- package.json
    |-- src/
    `-- dist/
```

Core serves plugin assets through a stable route:

```text
/plugin-assets/llama_pack_business/business-entry.js
/plugin-assets/llama_pack_business/business.css
```

Core builds should not bundle plugin frontend assets. Plugin frontend code
should build into the plugin's own `dist/` or static asset folder. Packaged
deployments include plugin assets only when the plugin is installed.

Development mode should be able to load plugin frontend assets directly from
the plugin output directory.

## Frontend Extension Host

The core React app loads enabled plugin frontend modules dynamically from the
metadata returned by `/lm-api/v1/plugins/enabled`.

Example dynamic import:

```ts
const pluginModule = await import(/* @vite-ignore */ plugin.frontend.entry)
pluginModule.registerPlugin(pluginFrontendContext)
```

The plugin frontend module registers its own routes:

```ts
export function registerPlugin(app: PluginFrontendContext) {
  app.addRoute({
    path: "/ui/business",
    component: BusinessOverviewPage,
  })

  app.addRoute({
    path: "/ui/business/usage",
    component: UsagePage,
  })
}
```

Plugin frontend code should not import core frontend internals by relative path.
Core should expose a small frontend plugin API:

```ts
export type PluginFrontendContext = {
  addRoute(route: PluginRoute): void
  addNavigationItem(item: NavigationItem): void
  addSecondaryNavigationItem(item: NavigationItem): void
  apiFetch: typeof fetch
  components: {
    PageHeader: React.ComponentType<any>
    EmptyState: React.ComponentType<any>
    DataTable: React.ComponentType<any>
  }
}
```

The first frontend extension host should allow plugins to:

- Register routes.
- Add primary navigation.
- Add scoped secondary navigation.
- Access a stable core API client.
- Access a small documented shared component set.
- Inject plugin settings pages.

Do not expose broad global frontend state access in the first version.

## Navigation Model

The business plugin should add one top-level primary navigation item:

```text
Primary nav
|-- Chat
|-- Models
|-- Nodes
|-- Downloads
|-- Benchmarks
|-- Settings
`-- Business        only when llama_pack_business is enabled
```

The business area owns its own scoped secondary navigation. The secondary
navigation appears directly to the right of the primary navigation only when
the active route is inside `/ui/business/*`.

```text
[Primary nav] [Business subnav] [Business page content]
```

The business plugin should avoid adding many top-level primary navigation
items. As the enterprise surface grows, pages should be organized under the
single Business area:

```text
Business
|-- Overview
|-- Usage
|-- Capacity
|-- Users & Groups
|-- Quotas
|-- Assistants
|-- Knowledge Bases
|-- Documents
|-- Connectors
|-- Audit
|-- Reports
`-- Business Settings
```

The plugin metadata endpoint should support both primary and secondary
navigation and should return only entries visible to the current user.
Backend authorization is still required on every plugin API route; frontend
visibility is only a usability layer.

## Events And Hooks

Core should expose:

- `usage_events`: stable event emission and subscription.
- `policy`: hooks that can approve, reject, or modify actions.
- `chat_admission`: hooks that can add quota checks while core keeps base
  capacity safety.

Events and hooks are separate concepts:

- Events are facts that already happened. Plugins observe them.
- Hooks are decision points before an action. Plugins can approve, reject, or
  modify the action.

For example:

- `llama_pack.chat.request.completed` is an event.
- `llama_pack.chat_admission` is a hook.

Use `llama_pack.` as the prefix for core-defined events and hooks. Plugins should
prefix their own events and hooks with their plugin id, for example
`llama_pack_business.usage.rollup.completed`.

Useful core events:

- `llama_pack.chat.request.accepted`
- `llama_pack.chat.request.rejected`
- `llama_pack.chat.request.completed`
- `llama_pack.chat.request.failed`
- `llama_pack.api_key.used`
- `llama_pack.model.started`
- `llama_pack.model.stopped`
- `llama_pack.node.capacity.changed`
- `llama_pack.document.retrieved`
- `llama_pack.plugin.loaded`
- `llama_pack.plugin.disabled`
- `llama_pack.plugin.failed`
- `llama_pack.plugin.config.updated`
- `llama_pack.plugin.migration.pending`
- `llama_pack.plugin.migration.completed`

### Event Delivery Semantics

The first implementation should use in-process, best-effort event delivery:

- Events are delivered to subscribers in the current process.
- Events are not durable across process restarts.
- Events are not guaranteed to be delivered if the process crashes.
- One plugin subscriber failure must not prevent other subscribers from running.
- Subscriber errors should be logged and reported in plugin health/status.
- Event handlers should have timeouts.
- Slow plugin handlers should not block core request handling indefinitely.

Durable event delivery, outbox storage, replay, and cross-process event delivery
can be added later if the business plugin needs stronger accounting guarantees.

### Event Envelope

Every event should use a standard envelope:

```json
{
  "id": "uuid",
  "type": "llama_pack.chat.request.completed",
  "version": "1.0",
  "occurred_at": "2026-06-04T12:00:00Z",
  "source": {
    "kind": "core",
    "id": "llama-pack"
  },
  "correlation_id": "request-or-operation-id",
  "actor": {
    "user": "alice",
    "role": "admin",
    "api_key_id": "key-id-or-null",
    "session_id": "session-id-or-null"
  },
  "payload": {}
}
```

`event.id` should be a UUID. Plugins should treat it as the idempotency key.
Even though the first implementation is in-process and best-effort, designing
for idempotency now keeps the door open for durable event delivery later.

### Event Ordering

Core should only guarantee ordering within a single correlation path. For
example, a single chat request can emit `accepted` before `completed` or
`failed`. Core should not promise a global total ordering across unrelated
requests, users, nodes, models, or plugins.

Plugins that need aggregation should rely on `occurred_at`, `correlation_id`,
and `event.id`, not global delivery order.

### Hook Semantics

Hooks are pre-action extension points. Core waits for hook decisions before
continuing.

Hook rules:

- Hooks run in deterministic order.
- Any hook rejection rejects the action.
- Hook responses can include a reason and user-facing error message.
- Hook timeouts should reject safety-sensitive actions such as chat admission.
- Hook failures should reject safety-sensitive actions by default.
- Hook failures should be logged and surfaced in plugin health/status.
- Non-safety hooks may choose fail-open behavior, but the hook definition must
  state that explicitly.

Initial core hooks:

- `llama_pack.chat_admission`
- `llama_pack.api_key_authorization`
- `llama_pack.document_access`
- `llama_pack.retention_policy`

## Event Privacy Rules

Core usage events need documented schemas before business accounting depends on
them. Events should include stable metadata such as timestamps, request ids,
model, target, route, user/session/api-key identifiers where available, status,
latency, queue wait time, and token counts when available.

Privacy defaults:

- Do not include raw prompt text in usage accounting events by default.
- Do not include raw completion text in usage accounting events by default.
- Do not include document contents in audit events by default.
- Make sensitive logging explicit and configurable.

## Plugin Configuration Schema And Secrets

Plugins should declare a configuration schema so core can validate plugin config
before loading the plugin.

The schema should support:

- Required fields.
- Optional fields and defaults.
- Type validation.
- Human-readable labels and descriptions.
- Secret fields.
- Validation errors.
- Setup warnings when configuration is incomplete.

Secret fields should not be returned by plugin metadata endpoints, written to
logs, or shown in frontend forms after save. If a secret exists, UI responses
should only expose that it is configured.

Example shape:

```yaml
config_schema:
  usage_retention_days:
    type: integer
    default: 180
    min: 1
    label: Usage retention days
  oidc_client_secret:
    type: string
    secret: true
    required: false
    label: OIDC client secret
```

Core should include plugin config validation status in plugin health metadata.

## Database And Migrations

Plugins can use core database infrastructure, but should use separate plugin
databases by default. Plugin database files should live under the configured
state directory.

Use plugin-specific migration targets and status endpoints:

```text
/lm-api/v1/plugins/{plugin_id}/migrations/status
```

Plugin tables should live behind plugin-owned migrations. Core can detect and
report pending plugin migrations, but should not silently create enterprise
tables by default.

Initial command shape:

```bash
curl -X POST /lm-api/v1/plugins/llama_pack_business/migrations/{target_id}/upgrade
```

Startup should expose health warnings for missing or pending plugin migrations.
Auto-running plugin migrations is out of scope for the initial plugin
foundation.

## Licensing Readiness

Payment and license enforcement are out of scope for now, but the plugin model
should leave room for a plugin to be installed but not entitled. Plugin metadata
and health should be able to report license state later without breaking core.

Core must remain usable when a paid plugin is disabled, unlicensed, expired, or
failed.

## Install, Update, Disable, And Uninstall Lifecycle

The plugin lifecycle should support:

- Install.
- Enable.
- Disable.
- Update.
- Migrate.
- Uninstall.

First-pass behavior:

- Install makes plugin files available but does not imply the plugin is enabled.
- Enable loads the plugin, registers routes, registers hooks, subscribes to
  events, and exposes frontend metadata.
- Disable hides navigation, stops routes, stops hooks, stops subscribers, and
  leaves plugin data in place or archives it.
- Update replaces plugin files and requires compatibility checks.
- Migrate runs plugin-owned migrations explicitly.
- Uninstall archives plugin data before deleting plugin tables or plugin
  databases.

Rollback is manual restore from backup in the first implementation.

## Disable And Uninstall

When a plugin is disabled:

- Hide its navigation.
- Stop registering its routes.
- Stop its event subscribers.
- Stop its policy hooks.
- Keep or archive plugin data.
- Show warnings for inactive plugin data when appropriate.
- Do not break core startup.

When a plugin is uninstalled, archive plugin data before deleting plugin tables
or plugin databases.

## Frontend Loading Safety

Plugin frontend bundles are dynamically loaded JavaScript. Core should keep this
same-origin and controlled:

- Do not load remote plugin JavaScript in the first implementation.
- Serve plugin frontend assets from `/plugin-assets/{plugin_id}/...`.
- Apply the same plugin id and path traversal validation used for static assets.
- If a plugin frontend bundle fails to load, hide that plugin's routes and show
  an administrator-visible warning.
- A plugin frontend load failure should not break the core UI.
- Document Content Security Policy implications before allowing remote assets or
  third-party origins.

The initial implementation should only support same-origin plugin assets served
by the Llama Pack backend.

## Runtime Observability

Core should expose enough plugin runtime metadata to debug plugin behavior:

- Loaded plugins.
- Disabled plugins.
- Failed plugins and failure reasons.
- Plugin version and API compatibility status.
- Registered plugin routes.
- Registered plugin assets.
- Registered hooks.
- Registered event subscribers.
- Plugin health check results.
- Plugin migration status.

This can start as backend metadata and health endpoints, then become UI panels
for administrators.

## Testing Strategy

Initial plugin foundation tests should cover:

- Core starts without plugins.
- Enabled plugin registers metadata and routes.
- Disabled plugin is invisible.
- Failed plugin does not crash core by default.
- Failed plugin is reported in health/status metadata.
- Plugin route prefix collisions are rejected.
- Plugin asset paths are served safely.
- Path traversal against plugin assets is rejected.
- Server-filtered navigation respects role/capability metadata.
- Event subscribers receive emitted events.
- Subscriber failure does not prevent other subscribers from running.
- Event envelopes include UUID ids and stable metadata.
- Event ordering is preserved within one correlation path.
- Policy hooks can reject chat admission.
- Safety-sensitive hook timeout rejects chat admission.
- Plugin migration status is reported.
- Plugin config schema validation catches invalid config.
- Secret plugin config fields are redacted from metadata and logs.
- Plugin frontend load failure does not break the core UI.

## Developer Experience

Add a later task to create a sample plugin and plugin author documentation:

- Minimal `hello_plugin` sample plugin.
- Manifest schema documentation.
- Backend extension API docs.
- Frontend extension API docs.
- Plugin build workflow docs.
- Testing helpers.
- Hello-world plugin walkthrough.

The `hello_plugin` should prove the architecture is not business-specific:

- One backend API route.
- One primary navigation item or route entry.
- One frontend route.
- One event subscriber.
- One policy hook example.
- One health check.

## Initial Implementation Checklist

- Manifest loading and validation.
- Config-driven plugin enable/disable.
- Plugin entrypoint loading.
- `PluginContext` registration API.
- Backend route registration.
- Plugin-owned frontend asset metadata.
- Static serving for plugin frontend assets.
- Frontend route, primary navigation, and scoped secondary navigation metadata.
- Frontend extension host placeholder.
- Usage event bus.
- Policy hook registry.
- Plugin health checks.
- Plugin migration metadata.
- `/lm-api/v1/plugins/enabled` metadata endpoint.
- Plugin failure warnings surfaced to administrators.
- Route and asset namespace collision checks.
- Plugin API/frontend API version compatibility checks.
