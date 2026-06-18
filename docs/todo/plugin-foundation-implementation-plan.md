# Plugin Foundation Implementation Plan

This plan covers the first implementation pass for the Llama Pack plugin
foundation. It implements the platform pieces needed before building the
`llama_pack_business` add-on.

For the long-term architecture, see [plugin-architecture.md](plugin-architecture.md).
For the business product roadmap, see
[business-local-ai-roadmap.md](business-local-ai-roadmap.md).

## Scope

Build a small, testable plugin runtime that allows core to load enabled plugins,
collect plugin metadata, register backend routes, expose frontend/navigation
metadata, emit events, run hooks, and report plugin health.

The first pass should prove the architecture with a minimal `hello_plugin`.

## Current Status

Completed in the first incremental implementation pass:

- Phase 1 core plugin runtime:
  - Config-driven local-path plugin enable/disable.
  - Manifest parsing and validation.
  - Core/backend/frontend plugin API version checks.
  - Runtime mode compatibility checks for `agent` and `controller`.
  - Plugin loader, registry, context, and status metadata.
  - Failed/incompatible plugins do not crash core startup.
- Phase 2 routes and metadata:
  - `/lm-api/v1/plugins/enabled`.
  - `/lm-api/v1/plugins/status`.
  - Backend plugin route registration under
    `/lm-api/v1/plugins/{plugin_id}/...`.
  - Route namespace and collision protection.
- Phase 3 event bus and hooks:
  - In-process event envelope and emitter.
  - Plugin event subscribers with failure and timeout health recording.
  - Policy hook registry.
  - `llama_pack.chat_admission` wired through the shared `ChatScheduler`
    admission path before scheduler capacity is consumed.
- Phase 4 static assets and first frontend metadata pass:
  - Plugin-owned static assets served under `/plugin-assets/{plugin_id}/...`.
  - Static asset path traversal protection.
  - Backend-provided frontend/nav/route metadata.
  - Core React navigation and placeholder plugin route rendering.
  - Dynamic plugin frontend bundle loading is still deferred.
- Phase 5 plugin config and health:
  - Manifest `config_schema` support.
  - Pre-registration plugin config validation.
  - Secret config field redaction in status metadata.
  - `PluginContext.add_health_check(...)`.
  - Health check results and failures surfaced in
    `/lm-api/v1/plugins/status`.
- Phase 6 plugin migration metadata:
  - `PluginContext.add_migration_target(...)`.
  - Plugin migration target metadata storage.
  - `/lm-api/v1/plugins/{plugin_id}/migrations/status`.
  - Pending/missing migrations surfaced as plugin health warnings.
  - Migration execution remains explicit; startup does not auto-run plugin
    migrations.
- Phase 7 sample plugin:
  - `plugins/hello_plugin/` is checked in as a real sample and integration
    target.
  - It includes a backend route, frontend metadata/static asset, event
    subscriber, `llama_pack.chat_admission` hook example, config schema, and
    health check.
  - It registers current migration metadata as an integration target.
- Business plugin repository policy:
  - `llama_pack_business` should live in a separate private repository because it
    is intended to become a paid/private plugin.
  - Main keeps only the generic plugin runtime, docs, fixture tests, and the
    public `hello_plugin` sample.
  - Local development should load private plugins through configured local
    plugin paths.
- Phase 8 frontend integration, first pass complete:
  - Backend-provided nav metadata and placeholder plugin routes are wired.
  - Admin-visible plugin status alerts surface failed/incompatible plugins and
    health warnings/errors in the shell.
  - Built-in `/ui/plugins` admin page lists plugin status, health, frontend
    metadata, redacted config metadata, and registered migration targets.
  - Dynamic `import()` of plugin frontend bundles remains intentionally
    deferred.
- Phase 9 documentation:
  - Live architecture, configuration, and frontend docs describe the current
    runtime, frontend metadata, static assets, config schema, secret redaction,
    runtime modes, health checks, and migration metadata.
  - `docs/plugins.md` provides the manifest reference, backend extension API,
    frontend metadata contract, testing guidance, and hello-world walkthrough.

Remaining next implementation work:

- Later frontend work:
  - Dynamic plugin frontend bundle loading.
  - Frontend bundle failure isolation.
- Separate private plugin repository:
  - Keep `llama_pack_business` in its private paid-add-on repository and load it
    through configured local plugin paths during development.
  - Keep business-owned implementation tests and CI in that private repository.

## Non-Goals

- Full `llama_pack_business` implementation, which belongs in the private paid
  add-on repository rather than core.
- Payment or license enforcement.
- Sandboxed plugin execution.
- Durable event delivery or replay.
- Cross-process event delivery.
- Auto-running plugin migrations on startup.
- Fully dynamic React route loading from plugin bundles.
- Remote plugin JavaScript or third-party plugin asset origins.

## Phase 1: Core Plugin Runtime [complete]

Add the core plugin package:

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

Implementation tasks:

- Add config fields:
  - `enabled_plugins: list[str]`
  - `plugins: dict[str, PluginConfig]`
- Add manifest model and validation.
- Use version `1.0` for core, backend plugin API, and frontend plugin API.
- Validate plugin ids with a safe identifier pattern.
- Load enabled plugin manifests.
- Import plugin entrypoints.
- Register plugins through `PluginContext`.
- Record loaded, disabled, incompatible, and failed plugins.
- Do not crash core startup when a plugin fails by default.

Key tests:

- Core starts with no plugins configured.
- Disabled plugin is ignored.
- Enabled plugin loads successfully.
- Invalid plugin id is rejected.
- Incompatible plugin is disabled with a warning.
- Failed plugin import is disabled with a warning.

## Phase 2: Routes And Metadata [complete]

Add plugin API routes under core:

```text
GET /lm-api/v1/plugins/enabled
GET /lm-api/v1/plugins/status
```

`/enabled` returns plugin metadata safe for the frontend:

```json
[
  {
    "id": "hello_plugin",
    "name": "Hello Plugin",
    "version": "1.0",
    "status": "enabled",
    "frontend": {
      "style_entries": ["/plugin-assets/hello_plugin/hello.css"],
      "pages": [
        {
          "route": "/ui/plugins/hello_plugin",
          "template": "/plugin-assets/hello_plugin/templates/hello.html",
          "controller": "/plugin-assets/hello_plugin/controllers/hello.js",
          "title": "Hello Plugin"
        }
      ]
    },
    "navigation": [],
    "secondary_navigation": [],
    "ui_routes": []
  }
]
```

`/status` returns administrator/debug metadata:

```json
{
  "plugins": [
    {
      "id": "hello_plugin",
      "status": "enabled",
      "version": "1.0",
      "health": [],
      "warnings": [],
      "errors": []
    }
  ]
}
```

Implementation tasks:

- Add `PluginContext.add_api_router(...)`.
- Register plugin routers under `/lm-api/v1/plugins/{plugin_id}/...`.
- Reject route prefix collisions.
- Reject attempts to register plugin routes outside the plugin namespace.
- Add admin-visible failure/warning metadata.
- Filter navigation metadata server-side by role/capability.

Key tests:

- Enabled plugin route is reachable.
- Disabled plugin route is not registered.
- Failed plugin route is not registered.
- Plugin route outside namespace is rejected.
- Route collision is rejected.
- `/enabled` only returns enabled frontend-safe plugin metadata.
- `/status` reports loaded, disabled, failed, and incompatible plugins.

## Phase 3: Event Bus And Hooks [complete]

Implement in-process, best-effort event delivery.

Event envelope:

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

Implementation tasks:

- Add event envelope model.
- Add event emitter.
- Add subscriber registry.
- Add `PluginContext.subscribe(...)`.
- Isolate subscriber failures.
- Add subscriber timeout behavior.
- Preserve ordering within a single correlation path.
- Add hook registry.
- Add `PluginContext.add_policy_hook(...)`.
- Run hooks in deterministic order.
- Reject safety-sensitive actions when hooks reject, fail, or time out.

Initial events:

- `llama_pack.plugin.loaded`
- `llama_pack.plugin.disabled`
- `llama_pack.plugin.failed`
- `llama_pack.plugin.config.updated`
- `llama_pack.plugin.migration.pending`
- `llama_pack.plugin.migration.completed`

Initial hooks:

- `llama_pack.chat_admission`

Key tests:

- Event envelope includes UUID id and stable metadata.
- Event subscriber receives emitted event.
- Subscriber failure does not prevent other subscribers from running.
- Subscriber timeout is recorded in plugin health.
- Ordering is preserved within one correlation path.
- Policy hook can reject chat admission.
- Safety-sensitive hook timeout rejects chat admission.

## Phase 4: Static Assets And Frontend Metadata [complete]

Plugin frontend assets are plugin-owned. Core serves them but does not bundle
them.

Implementation tasks:

- Add plugin manifest frontend asset metadata.
- Serve assets under `/plugin-assets/{plugin_id}/...`.
- Serve files only from the plugin's declared static directory.
- Reject path traversal.
- Prevent asset routes from shadowing core routes.
- Include frontend metadata in `/lm-api/v1/plugins/enabled`.
- Add frontend extension host placeholder.
- Render plugin primary nav metadata in the core frontend.
- Render scoped secondary nav metadata when inside plugin route namespace.

Initial frontend behavior:

- Core React app can show plugin nav entries from backend metadata.
- Business/plugin route pages can render a placeholder route until dynamic
  plugin module loading is implemented.
- Plugin frontend dynamic import is planned but not required in this pass.

Key tests:

- Plugin asset is served from declared static directory.
- Path traversal is rejected.
- Unknown plugin asset path returns 404.
- Failed/disabled plugin assets are not served.
- Core frontend hides plugin navigation when plugin disabled.
- Core frontend shows plugin navigation when plugin enabled.

## Phase 5: Plugin Config And Health [complete]

Implementation tasks:

- Add plugin config schema support.
- Validate plugin config before plugin registration.
- Support secret fields.
- Redact secret fields from metadata and logs.
- Add `PluginContext.add_health_check(...)`.
- Include health warnings and errors in `/lm-api/v1/plugins/status`.

Key tests:

- Invalid plugin config disables plugin with warning.
- Secret config values are redacted.
- Plugin health check results appear in status endpoint.
- Health check failure does not crash core.

## Phase 6: Plugin Migrations Metadata [complete]

Implementation tasks:

- Add `PluginContext.add_migration_target(...)`.
- Track plugin migration metadata.
- Add plugin migration status shape.
- Expose migration status under:

```text
GET /lm-api/v1/plugins/{plugin_id}/migrations/status
```

- Report pending migrations in plugin health/status.
- Do not auto-run plugin migrations.

Key tests:

- Plugin migration target is registered.
- Migration status endpoint returns status.
- Pending migrations produce health warning.
- Auto-run is not performed during startup.

## Phase 7: Hello Plugin [complete]

Add a minimal `hello_plugin` to prove the extension points are generic.

Suggested location:

```text
plugins/hello_plugin/
|-- plugin.yaml
|-- hello_plugin/
|   |-- __init__.py
|   |-- plugin.py
|   `-- static/
|       |-- hello.css
|       |-- templates/
|       |   `-- hello.html
|       `-- controllers/
|           `-- hello.js
```

The sample plugin should include:

- One backend API route:
  - `GET /lm-api/v1/plugins/hello_plugin/hello`
- One primary navigation item or route entry.
- One frontend placeholder route.
- One static frontend asset.
- One event subscriber.
- One `llama_pack.chat_admission` hook example.
- One health check.

Key tests:

- `hello_plugin` loads from config.
- `hello_plugin` route is reachable.
- `hello_plugin` metadata appears in `/enabled`.
- `hello_plugin` health appears in `/status`.
- `hello_plugin` static asset is served.
- `hello_plugin` subscriber receives an event.
- `hello_plugin` hook can reject when configured to do so.

## Phase 8: Frontend Integration [partially complete]

Implementation tasks:

- Add API helper for `/lm-api/v1/plugins/enabled`.
- Add API helper for `/lm-api/v1/plugins/status`.
- Render plugin primary navigation entries.
- Render scoped secondary navigation for active plugin routes.
- Show administrator-visible plugin failure alerts.
- Add placeholder plugin route rendering.

Key tests:

- Frontend hides plugin nav without enabled plugin metadata.
- Frontend shows plugin nav with enabled plugin metadata.
- Frontend renders secondary nav only inside matching plugin route namespace.
- Frontend shows plugin failure alert for administrators.
- Frontend does not crash when plugin frontend metadata is missing or invalid.

## Phase 9: Documentation [partially complete]

Implementation tasks:

- Add manifest schema documentation.
- Add backend extension API documentation.
- Add frontend extension API documentation.
- Add plugin build workflow documentation.
- Add testing helper documentation.
- Add hello-world plugin walkthrough.

This phase can start after `hello_plugin` proves the architecture.

## Deliverables

- Core plugin runtime package.
- Plugin config model support.
- Plugin manifest parser and validator.
- Plugin registry and loader.
- Plugin context.
- Plugin metadata/status routes.
- Event bus and hook registry.
- Plugin static asset serving.
- Plugin config schema and health support.
- Plugin migration metadata/status support.
- `hello_plugin` sample.
- Focused backend tests.
- Focused frontend tests.
- Documentation updates.

## Open Questions

- Should plugin discovery initially support only configured local plugin paths,
  or also installed Python package entrypoints?
- Should the first frontend pass implement dynamic plugin module imports, or
  only navigation metadata and placeholder routes?
- What should the exact local development command be for rebuilding plugin
  frontend assets?

Default recommendation:

- Start with configured local plugin paths.
- Implement navigation metadata and placeholder routes first.
- Add dynamic plugin module imports after the backend plugin foundation is
  stable.
