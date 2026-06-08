# Plugin Page Authoring v1 (Draft)

This document proposes a plugin page model with a better authoring experience
than large JavaScript render files. The target is a WordPress/Drupal-like
workflow where plugin developers primarily edit templates, styles, and action
handlers.

## Why

Current plugin pages are difficult to maintain when they rely on:

- large inline `<style>` blocks in JavaScript
- `innerHTML` injection for most rendering
- template HTML embedded as string literals

This proposal replaces that model with template-first pages and small,
predictable client controllers.

## Goals

- Make plugin UI authoring mostly HTML/CSS, not string-based JS rendering.
- Keep backend and frontend contracts stable and explicit.
- Preserve dynamic actions (forms, search, delete, upload, etc.).
- Keep plugins isolated from core internals.
- Support gradual migration from existing `mount(container, host)` plugins.

## Non-Goals

- Sandboxing plugin JavaScript.
- Remote plugin bundles or third-party script origins.
- Replacing all current plugin frontend APIs in one release.

## v1 Authoring Model

### 1) Plugin manifest declares pages, assets, and actions

`plugin.yaml` adds a page contract (illustrative schema):

```yaml
id: neuraxis_business
name: Neuraxis Business
version: "1.0"
requires_core: "1.0"
backend_api_version: "1.0"
frontend_api_version: "1.1"
entrypoint: neuraxis_business.plugin:plugin

frontend:
  static_dir: neuraxis_business/static
  style_entries:
    - /plugin-assets/neuraxis_business/business.css
  pages:
    - route: /ui/plugins/neuraxis_business/overview
      template: templates/overview.html
      controller: static/controllers/overview.js
      title: Business Overview
    - route: /ui/plugins/neuraxis_business/documents
      template: templates/documents.html
      controller: static/controllers/documents.js
      title: Documents
```

Rules:

- `template` is a plugin-local file served as HTML fragment or full page shell.
- `controller` is optional and should be small (actions + state wiring only).
- CSS is external (`style_entries`), not embedded in runtime JS strings.

### 2) Template-first rendering

The plugin host renders page templates into the plugin container. The template
is the source of structure; JavaScript only binds behavior.

Preferred flow:

1. Host resolves the current plugin route.
2. Host loads the template.
3. Host injects template content into container.
4. Host loads optional page controller and calls:

```js
export function mountPage(root, host) {
  // bind events, call host.apiGet/apiPost, update specific nodes
  return () => {};
}
```

### 3) Action-oriented JavaScript

Controllers should:

- use event delegation on stable container nodes
- submit forms through `host.api*` helpers
- update targeted DOM nodes via `textContent`, `replaceChildren`, and
  `createElement`

Controllers should avoid:

- writing full page markup with `innerHTML`
- inline style injection
- large template strings for structural UI

### 4) Reusable host UI primitives

Core should expose a small, stable set of primitives for plugin pages:

- layout classes and design tokens
- shared form/table/panel patterns
- toast/inline error helpers
- loading and empty-state helpers

This reduces copy/paste CSS and keeps plugin UX consistent.

## Recommended Plugin Layout

```text
plugins/neuraxis_business_plugin/
|-- plugin.yaml
`-- neuraxis_business/
    |-- plugin.py
    |-- templates/
    |   |-- overview.html
    |   |-- identity.html
    |   |-- knowledge-bases.html
    |   `-- documents.html
    `-- static/
        |-- business.css
        `-- controllers/
            |-- overview.js
            |-- identity.js
            |-- knowledge-bases.js
            `-- documents.js
```

## Backward Compatibility

v1 keeps support for existing JS entry modules:

- Existing `frontend.entry` with `mount(container, host)` remains valid.
- New pages can opt into template-first rendering incrementally.
- A plugin can mix both models during migration.

## Migration Guide (from `business-entry.js`)

1. Move CSS from JS string to `static/business.css`.
2. Split major sections (overview, identity, settings, KB, documents) into
   `templates/*.html`.
3. Replace full-page `content.innerHTML = ...` rendering with per-page
   controllers.
4. Keep API interactions in controllers; keep structure in templates.
5. Remove inline template string rendering once each page has migrated.

## Security And Reliability Notes

- Treat plugin templates and scripts as trusted extension code.
- Prefer DOM APIs (`textContent`, `setAttribute`) for dynamic data insertion.
- If HTML insertion is necessary, sanitize untrusted input first.
- Keep route and asset loading constrained to plugin-owned paths.

## Open Questions

- Should templates be served as full HTML documents or host-inserted fragments?
- Should controller loading be static (manifest-only) or allow lazy imports?
- Should we support optional server-side template rendering with plugin data?
- What minimum host UI primitive set should be guaranteed in `frontend_api 1.1`?

