# React Router Layout Migration — Implementation Plan

## Overview

Convert `AppShell` from a monolithic component with hand-rolled navigation to a proper
React Router layout route pattern. The existing `BrowserRouter` and two standalone routes
(`/ui/docs`, `/ui/test-chat`) are already in place. The main work is extracting AppShell's
sidebar/header/shell chrome into a layout route, then converting each page from the
`renderPage` callback to a `<Route>` element.

**Current state:** AppShell is 484 lines with a `renderPage` render-prop that acts as a
hand-built router switch. Navigation uses manual `pushState`/`popstate`. Pages receive
callbacks (`onNavigate`, `onOpenLogs`, `refreshKey`) that couple them to AppShell's
internal state.

**Target state:** A standard React Router v7 layout route with `<Outlet />`. Pages declare
their own routes and pull shared state from context providers.

---

## Phase 1 — Visible Context & Refresh Infrastructure

### 1.1 Create `GlobalStatusContext`

**Why:** AppShell currently holds `globalMode`, `globalStatus`, `globalControllerUrl`,
`globalControllerReachable`, `globalAgentNodes`, and `refreshKey` in local state. These are
consumed by the sidebar, header, and various pages. Moving them to a context makes them
available to any layout or route.

**Files to create:**
- `frontend/src/features/globalStatus/globalStatusContext.tsx`

**Contents:**
- Export a `GlobalStatusProvider` component and a `useGlobalStatus()` hook
- The provider encapsulates the `refreshGlobal()` logic (currently in AppShell lines 63–104)
- Expose: `appMode`, `status`, `controllerUrl`, `controllerReachable`, `agentNodes`,
  `refreshKey`, `refreshGlobal`, `globalRefreshing`
- The `useGlobalStatus()` hook replaces direct state access from AppShell

### 1.2 Create `LogModalContext`

**Why:** AppShell owns `logsOpen`, `logSelection`, and the `openLogs` function. These are
passed down to pages via the `renderPage` callback. A context decouples the modal from the
layout.

**Files to create:**
- `frontend/src/features/logs/logModalContext.tsx`

**Contents:**
- Export `LogModalProvider` and `useLogModal()` hook
- Expose `openLogs(selection?)`, `closeLogs`, `isOpen`, `selection`
- The `LogModal` component is rendered once inside the layout, consuming this context

### 1.3 Create `AuthGate` guard

**Why:** AppShell handles auth checks (`authRequired`, `authChecked`, `isAuthenticated`)
and redirects to setup. This logic should be a route guard.

**Files to create:**
- `frontend/src/router/AuthGate.tsx`

**Contents:**
- Wraps `useAuthSession()` and `getSetupStatus()`
- Shows "Checking session..." while pending
- Renders `<Outlet />` if authenticated or setup is required
- Redirects to `/ui/setup` if `auth_bootstrap_required` and not authenticated
- Replaces AppShell lines 146–163

---

## Phase 2 — Layout Route Extraction

### 2.1 Create `AppLayout` component

**Why:** The sidebar, header, mobile nav scrim, plugin status alerts, plugin secondary nav,
and the refresh button all belong in the layout shell, not in a page.

**Files to create:**
- `frontend/src/router/AppLayout.tsx`

**Contents:**
- Receives nothing via props (contexts supply all data)
- Renders the full shell structure from AppShell lines 188–347:
  ```tsx
  <AppModeProvider appMode={appMode}>
    <div className="app-shell">
      <aside className="app-sidebar">...</aside>
      <div className="app-main">
        <header className="app-header">...</header>
        <main className="layout">
          {pluginStatusIssues conditional alert}
          {pluginSecondaryNav conditional}
          <Outlet />
        </main>
      </div>
      {mobileNavScrim}
      <LogModalWrapper />
    </div>
  </AppModeProvider>
  ```
- Navigation uses `<NavLink>` / `useNavigate()` instead of `window.history.pushState`
- Active page highlighting uses `useLocation()` to resolve the current path to a
  `PageDefinition` from `routes/pages.ts`
- `document.body.classList.toggle("nav-open", navOpen)` stays in a `useEffect` here
- `refreshGlobal(false)` on mount stays in a `useEffect` here

### 2.2 Create `NavSidebar` component (optional but recommended)

**Why:** The sidebar is ~90 lines of JSX. Extracting it as a child of `AppLayout` keeps
`AppLayout` clean and the sidebar independently testable.

**Files to create:**
- `frontend/src/router/NavSidebar.tsx`

**Contents:**
- Receives nav sections and active page from context/URL
- Uses `<NavLink>` for each nav item instead of `<button onClick={navigate}>`
- The "Logs" button calls `openLogs()` from `useLogModal()`
- Sidebar footer (controller/agent peer links) is rendered here

---

## Phase 3 — Route Conversion

### 3.1 Update `App.tsx`

**Changes to `frontend/src/App.tsx`:**
- Keep `BrowserRouter` at the top level
- Wrap content in `GlobalStatusProvider`, `LogModalProvider`, `PluginNavProvider`
- Remove `LegacyShellRoute` import
- Define all routes as `<Route>` elements nested inside `AppLayout`

**New structure:**
```tsx
export default function App() {
  return (
    <ThemeProvider>
      <AuthSessionProvider>
        <BrowserRouter>
          <GlobalStatusProvider>
            <PluginNavProvider>
              <LogModalProvider>
                <Routes>
                  <Route element={<AuthGate />}>
                    <Route element={<AppLayout />}>
                      <Route path="/" element={<DashboardPage />} />
                      <Route path="/ui/chat" element={<ChatPage />} />
                      <Route path="/ui/setup" element={<SetupPage />} />
                      <Route path="/ui/nodes" element={<NodesPage />} />
                      <Route path="/ui/gguf-library" element={<GgufLibraryPage />} />
                      <Route path="/ui/hf-to-gguf" element={<HfToGgufPage />} />
                      <Route path="/ui/hf-downloads" element={<HfDownloadsPage />} />
                      <Route path="/ui/quantization" element={<QuantizationPage />} />
                      <Route path="/ui/controller-ops" element={<ControllerOpsPage />} />
                      <Route path="/ui/embeddings" element={<EmbeddingsPage />} />
                      <Route path="/ui/runtime" element={<RuntimeOverviewPage />} />
                      <Route path="/ui/audit" element={<AuditPage />} />
                      <Route path="/ui/benchmarks" element={<BenchmarksPage />} />
                      <Route path="/ui/api-keys" element={<ApiKeysPage />} />
                      <Route path="/ui/plugins" element={<PluginsPage />} />
                      <Route path="/ui/plugins/:pluginId/*" element={<PluginHostPage />} />
                      <Route path="/ui/settings" element={<SettingsPage />} />
                    </Route>
                    <Route path="/ui/docs" element={<DocsPage />} />
                    <Route path="/ui/test-chat" element={<TestChatPage />} />
                  </Route>
                </Routes>
              </LogModalProvider>
            </PluginNavProvider>
          </GlobalStatusProvider>
        </BrowserRouter>
      </AuthSessionProvider>
    </ThemeProvider>
  );
}
```

### 3.2 Delete `LegacyShellRoute.tsx`

**File to delete:** `frontend/src/router/LegacyShellRoute.tsx`

This file is no longer needed once all pages are routed.

---

## Phase 4 — Page Prop Migration

### 4.1 Remove `onNavigate` prop from 3 pages

Each page that currently receives `onNavigate` should instead use `useNavigate()` and/or
`useSearchParams()` from react-router-dom.

| Page | Current usage | Replacement |
|------|--------------|-------------|
| `GgufLibraryPage/index.tsx` | `onNavigate("chat", { search: ... })` | `useNavigate()` + `navigate("/ui/chat?model=...")` |
| `RuntimeOverviewPage/index.tsx` | `onNavigate("benchmarks", { search: ... })` | `useNavigate()` + `navigate("/ui/benchmarks?...")` |
| `PluginHostPage/index.tsx` | `onNavigate` passed to plugin host | Derive from `useNavigate()` |

### 4.2 Remove `onOpenLogs` prop from 2 pages

| Page | Current usage | Replacement |
|------|--------------|-------------|
| `DashboardPage/index.tsx` | `onOpenLogs({ source, identifier })` | `useLogModal()` -> `openLogs(...)` |
| `NodesPage/index.tsx` | `onOpenLogs({ source, identifier, node })` | `useLogModal()` -> `openLogs(...)` |

### 4.3 Remove `refreshKey` prop from 1 page

| Page | Current usage | Replacement |
|------|--------------|-------------|
| `PluginHostPage/index.tsx` | `refreshKey` prop for forcing re-render | Use `useGlobalStatus().refreshKey` |

### 4.4 Remove `page` prop from `PluginHostPage`

`PluginHostPage` currently receives the full `PageDefinition` object from
`AppShell.renderPage`. After migration, it should derive the plugin ID from
`useParams()` (`:pluginId`) and the route path from `useLocation()`.

### 4.5 Summary of prop removals

| Page | Props to remove |
|------|----------------|
| `DashboardPage` | `onOpenLogs` |
| `NodesPage` | `onOpenLogs` |
| `GgufLibraryPage` | `onNavigate` |
| `RuntimeOverviewPage` | `onNavigate` |
| `PluginHostPage` | `onNavigate`, `refreshKey`, `page` |

Pages with **no AppShell callback props** (no changes needed):
`ChatPage`, `HfToGgufPage`, `HfDownloadsPage`, `QuantizationPage`,
`ControllerOpsPage`, `EmbeddingsPage`, `AuditPage`, `BenchmarksPage`,
`ApiKeysPage`, `PluginsPage`, `SettingsPage`, `SetupPage`

---

## Phase 5 — Navigation & URL Sync

### 5.1 Replace manual `pushState` with `useNavigate()`

AppShell's `navigate()` function (lines 46–54) does:
1. Resolve page definition from key
2. Compute path from page + options
3. Set `activePage` state
4. `window.history.pushState(...)`

With react-router:
1. `useNavigate()` replaces steps 2–4
2. `activePage` state is replaced by `useLocation()` + a helper that resolves the current
   path to a `PageDefinition`
3. The `popstate` listener (lines 106–114) is handled natively by `BrowserRouter`

### 5.2 Replace `activePage` state with URL-derived page

Create a helper (or extend `routes/pages.ts`):
```tsx
export function pageForCurrentPath(
  pathname: string,
  extraPages: PageDefinition[] = []
): PageDefinition {
  return (
    [...pages, ...extraPages].find((p) => p.path === pathname) ||
    pageForKey("dashboard")
  );
}
```

Used in `AppLayout`:
```tsx
const location = useLocation();
const activePage = pageForCurrentPath(location.pathname, pluginPages);
```

### 5.3 Mode-based page visibility

The `visibleSections` / `visiblePages` conditional filtering (AppShell lines 42–44) moves
into the layout:
- The `GlobalStatusContext` provides `appMode`
- The layout uses `pagesBySectionForMode(appMode, pluginPages)` to render the sidebar
- Pages that should be hidden use a guard in a layout `useEffect` (redirect to dashboard
  if user navigates to a hidden page), matching AppShell lines 169–174

### 5.4 Setup redirect

AppShell checks `getSetupStatus()` and redirects to `/ui/setup` if
`auth_bootstrap_required`. This logic moves to `AuthGate` (Phase 1.3).

---

## Phase 6 — Plugin System Integration

### 6.1 Plugin navigation context

Plugin pages are dynamic (fetched from backend, cached in localStorage). The current
`enabledPlugins`, `pluginPages`, and `pluginStatusIssues` live in AppShell local state.

**Create:** `frontend/src/features/plugins/pluginNavContext.tsx`

**Contents:**
- `PluginNavProvider` — manages `enabledPlugins`, `pluginPages`, `pluginStatusIssues`
- Exposes `pluginPages`, `enabledPlugins`, `pluginStatusIssues`
- Fetches from `getEnabledPlugins()` + `getPluginStatus()` on mount and when
  `authRefreshKey` changes
- The plugin cache logic moves here:
  - `readCachedPluginNavigation()`
  - `writeCachedPluginNavigation()`
  - `pluginPagesForPlugin()`
  - `pluginStatusIssuesFromPayload()`

### 6.2 Dynamic plugin routes

Plugin routes are dynamic and based on backend data. The layout renders them conditionally:
- `AppLayout` uses `usePluginNav().pluginPages` to build sidebar nav items
- A catch-all route `<Route path="/ui/plugins/:pluginId/*" element={<PluginHostPage />} />`
  handles all plugin sub-routes
- `PluginHostPage` resolves its plugin details from `useParams().pluginId` + the plugin
  nav context

### 6.3 Plugin secondary navigation

AppShell renders plugin secondary nav inside `<main>` (lines 316–333). This stays in
`AppLayout`:
- Conditionally rendered when `activePage.pluginId && activePage.secondaryNavigation.length`
- Uses `<NavLink>` for each secondary nav item

---

## Phase 7 — Test Migration

### 7.1 Update `AppShell.test.tsx`

The test file (632 lines) currently renders `<App />` and manipulates
`window.history.pushState` / dispatches `PopStateEvent`.

**Changes needed:**
- Wrap test renders in `<MemoryRouter initialEntries={[...]}>` for tests that need a
  specific starting route
- Replace `window.history.pushState` + `PopStateEvent` with
  `act(() => navigate("/ui/nodes"))` or `<MemoryRouter initialEntries={["/ui/nodes"]}>`
- Remove direct assertions on `activePage` state — assert on rendered content or URL
- The test file should be renamed and restructured to test `AppLayout`, `NavSidebar`,
  `AuthGate`, and context providers individually

### 7.2 Add tests for new context providers

- `GlobalStatusContext` — test that status reflects health API response
- `LogModalContext` — test open/close/select flows
- `AuthGate` — test auth routes, setup redirect, and authenticated sessions
- `PluginNavContext` — test plugin loading and caching

### 7.3 Update page-level tests

Pages that currently receive callback props should have their tests updated to:
- Use `MemoryRouter` and mock `useNavigate()` instead of passing props
- Use `useLogModal()` instead of passing mocks
- Ensure `npm test` passes after each page is migrated

---

## Phase 8 — Cleanup

### 8.1 Remove dead code from AppShell

After all pages are migrated:
- Delete `frontend/src/components/AppShell/index.tsx` (484 lines)
- Delete `frontend/src/components/AppShell/styles.css` (move any shared styles to
  `AppLayout` or a shared layout stylesheet)
- Delete `frontend/src/components/AppShell.test.tsx`
- Remove the `PageKey` re-export (`export type { PageKey }`) — already defined in
  `routes/pages.ts`

### 8.2 Remove `LegacyShellRoute.tsx`

Delete `frontend/src/router/LegacyShellRoute.tsx` — replaced by declarative routes.

### 8.3 Clean up imports

- Remove unused imports in `App.tsx` and any migrated pages
- Remove `renderPage` callback type references
- Verify no dead code remains with a TypeScript build check

---

## File Summary

### Files to create

| File | Purpose |
|------|---------|
| `frontend/src/features/globalStatus/globalStatusContext.tsx` | Global status, mode, refresh state |
| `frontend/src/features/logs/logModalContext.tsx` | Log modal open/close/selection |
| `frontend/src/features/plugins/pluginNavContext.tsx` | Plugin navigation cache and pages |
| `frontend/src/router/AppLayout.tsx` | Layout route with `<Outlet />` |
| `frontend/src/router/NavSidebar.tsx` | Sidebar nav component (optional) |
| `frontend/src/router/AuthGate.tsx` | Auth guard route component |

### Files to modify (significantly)

| File | Change |
|------|--------|
| `frontend/src/App.tsx` | Refactor routes to use layout pattern |
| `frontend/src/pages/DashboardPage/index.tsx` | Replace `onOpenLogs` with `useLogModal()` |
| `frontend/src/pages/NodesPage/index.tsx` | Replace `onOpenLogs` with `useLogModal()` |
| `frontend/src/pages/GgufLibraryPage/index.tsx` | Replace `onNavigate` with `useNavigate()` |
| `frontend/src/pages/RuntimeOverviewPage/index.tsx` | Replace `onNavigate` with `useNavigate()` |
| `frontend/src/pages/PluginHostPage/index.tsx` | Replace `onNavigate`/`refreshKey`/`page` with contexts + `useParams()` |
| `frontend/src/routes/pages.ts` | Add `pageForCurrentPath()` helper |

### Files to delete

| File | Reason |
|------|--------|
| `frontend/src/router/LegacyShellRoute.tsx` | Replaced by declarative routes in `App.tsx` |
| `frontend/src/components/AppShell/index.tsx` | Replaced by `AppLayout` |
| `frontend/src/components/AppShell/styles.css` | Move to `AppLayout` or shared layout styles |
| `frontend/src/components/AppShell.test.tsx` | Rewrite as layout-specific tests |

---

## Implementation Order

Each phase should be a separate commit. Phase 3 can be further split per-page.

1. **Phase 1** — Contexts & auth guard (foundation; no pages change yet)
2. **Phase 2** — Layout route extraction (create `AppLayout` + `NavSidebar`)
3. **Phase 3** — Route conversion (move pages from `renderPage` to `<Route>`)
4. **Phase 4** — Page prop cleanup (remove callback props after each page is routed)
5. **Phase 5** — Navigation & URL sync (remove `pushState`/`popstate` machinery)
6. **Phase 6** — Plugin system (dynamic routes and plugin nav context)
7. **Phase 7** — Test migration (update test files to use `MemoryRouter`)
8. **Phase 8** — Cleanup (delete dead code, clean imports, verify build)

---

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Plugin dynamic routes break | Keep plugin nav context loaded before rendering routes; use catch-all `/ui/plugins/:pluginId/*` route |
| `refreshKey` pattern lost | `GlobalStatusProvider.refreshKey` must match current `<Outlet />` `key` behavior using `useLocation()` + `refreshKey` |
| Test breakage (632 lines) | Run `cd frontend && rtk npm test` after each phase; use `MemoryRouter` in tests |
| Auth redirect loop | `AuthGate` must check `auth_bootstrap_required` from `getSetupStatus()` and avoid infinite redirects |
| Sidebar nav highlighting regression | Use `useLocation()` + exact path matching; write dedicated tests for active state |
| Plugin pages lose context | `PluginNavProvider` must be above `AppLayout` and its data must load before `AppLayout` renders sidebar nav |

---

## Acceptance Criteria

After full migration:
- [ ] All pages accessible via their `/ui/` paths
- [ ] Browser back/forward buttons work correctly
- [ ] Deep-linking to any page works (URL is source of truth)
- [ ] Plugin pages load dynamically and appear in sidebar
- [ ] Auth gate redirects to `/ui/setup` when bootstrap is required
- [ ] Log modal opens from sidebar and from page-level buttons
- [ ] Global refresh works and re-renders the active page
- [ ] Mobile hamburger menu works
- [ ] Mode-based visibility (agent vs controller) correct
- [ ] All existing tests pass with `cd frontend && rtk npm test`
- [ ] TypeScript build passes with `cd frontend && rtk npm run build`
- [ ] No `AppShell`, `LegacyShellRoute`, or `renderPage` references remain