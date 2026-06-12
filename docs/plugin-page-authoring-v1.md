# Plugin Page Authoring v1

This document defines the v1 template-first plugin page model. The goal is to
make plugin UI authoring mostly HTML/CSS, with small JavaScript controllers for
dynamic behavior.

## Why

Current plugin pages are difficult to maintain when they rely on:

- large inline `<style>` blocks in JavaScript
- `innerHTML` injection for most rendering
- template HTML embedded as string literals

Template-first pages keep page structure in HTML fragments, styles in CSS files,
and dynamic behavior in focused controller modules.

## v1 Decisions

- `frontend_api_version` remains `"1.0"`.
- `frontend.pages` is the preferred source of plugin UI routes.
- `frontend.pages` replaces author-facing `ui_routes`; legacy `ui_routes`
  remains supported for existing plugins.
- Templates are HTML fragments, not full HTML documents.
- Templates, controllers, and styles live under `frontend.static_dir` and are
  served through `/plugin-assets/{plugin_id}/...`.
- Page controllers export `mountPage(root, host)`.
- Legacy `frontend.entry` modules exporting `mount(container, host)` remain
  supported.
- The stable host CSS class contract uses the `lp-plugin-*` prefix.

## Manifest Schema

```yaml
id: neuraxis_business
name: Neuraxis Business
version: "1.0"
requires_core: "1.0"
backend_api_version: "1.0"
frontend_api_version: "1.0"
entrypoint: neuraxis_business.plugin:plugin

frontend:
  static_dir: neuraxis_business/static
  style_entries:
    - business.css
  pages:
    - route: /ui/plugins/neuraxis_business/overview
      template: templates/overview.html
      controller: controllers/overview.js
      title: Business Overview
    - route: /ui/plugins/neuraxis_business/documents
      template: templates/documents.html
      controller: controllers/documents.js
      title: Documents
```

Rules:

- `route` must stay under `/ui/plugins/{plugin_id}`.
- `template`, `controller`, and `style_entries` are plugin asset paths. Relative
  paths are resolved under `/plugin-assets/{plugin_id}/`.
- Same-plugin `/plugin-assets/{plugin_id}/...` URLs are accepted.
- Cross-plugin asset URLs and traversal segments are rejected.
- `frontend.static_dir` is required when frontend assets are declared and must
  resolve inside the plugin root.
- `controller` is optional.
- `title` is used for route labels and page headings.

## Runtime Flow

1. The React shell resolves the current plugin route.
2. The shell matches it to `frontend.pages[].route`.
3. The shell fetches the page HTML fragment from `template`.
4. The shell inserts the fragment into the plugin container.
5. If `controller` is present, the shell imports it as an ES module and calls:

```js
export function mountPage(root, host) {
  return () => {};
}
```

Controllers should use event delegation on stable container nodes, submit forms
through `host.api*` helpers, and update dynamic values with DOM APIs such as
`textContent`, `replaceChildren`, and `createElement`.

Controllers should avoid writing full page markup with `innerHTML`, injecting
inline styles, or embedding large structural templates in JavaScript strings.

## Host CSS Contract

Core exposes these stable classes for plugin pages:

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

Plugin-specific CSS may add local classes, but shared layout and control styling
should prefer the `lp-plugin-*` classes where they fit.

## Recommended Layout

```text
plugins/neuraxis_business_plugin/
|-- plugin.yaml
`-- neuraxis_business/
    |-- plugin.py
    `-- static/
        |-- business.css
        |-- templates/
        |   |-- overview.html
        |   |-- identity.html
        |   |-- knowledge-bases.html
        |   `-- documents.html
        `-- controllers/
            |-- overview.js
            |-- identity.js
            |-- knowledge-bases.js
            `-- documents.js
```

## Backward Compatibility

Existing plugin frontend modules remain valid:

```yaml
frontend:
  static_dir: hello_plugin/static
  entry: hello-entry.js
```

Legacy modules still export:

```js
export function mount(container, host) {
  return () => {};
}
```

A plugin can migrate one route at a time by adding `frontend.pages` while legacy
plugins continue to use `frontend.entry`, `navigation`, `secondary_navigation`,
and `ui_routes`.

The checked-in `plugins/hello_plugin/` is the reference migrated sample: its
manifest declares `frontend.pages` and `style_entries`, and its page structure,
styles, and behavior live in `static/templates/hello.html`, `static/hello.css`,
and `static/controllers/hello.js`.

## Migration Guide

1. Move CSS from JavaScript strings to files under `static/`.
2. Split major sections into `static/templates/*.html` fragments.
3. Move dynamic behavior into `static/controllers/*.js`.
4. Replace full-page `content.innerHTML = ...` rendering with `mountPage()`
   controllers that update targeted nodes.
5. Declare routes in `frontend.pages` instead of authoring `ui_routes`.
