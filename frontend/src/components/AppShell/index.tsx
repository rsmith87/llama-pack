import "./styles.css";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { getControllerStatus, getHealth } from "../../api/health";
import { listNodes } from "../../api/nodes";
import { getEnabledPlugins, getPluginStatus, type EnabledPlugin, type PluginStatus } from "../../api/plugins";
import { getSetupStatus } from "../../api/setup";
import { AuthLoginForm, useAuthSession } from "../../features/auth/authSession";
import { AppModeProvider, type AppMode } from "../../features/appMode/appModeContext";
import { ThemeToggle } from "../../features/theme/themeSession";
import { pageForKey, pageForPath, pagesBySectionForMode, pathForPage, type PageDefinition, type PageIcon, type PageKey, type PageNavigationOptions } from "../../routes/pages";
import { LogModal, type LogSelection } from "../LogModal";
import { Button, Panel } from "../ui";
import { IoRefreshSharp } from "react-icons/io5";
import { PLUGIN_NAV_CACHE_KEY } from "../../constants";

type AppShellProps = {
  authRefreshKey?: string;
  renderPage: (page: PageDefinition, setPage: (page: PageKey, options?: PageNavigationOptions) => void, refreshKey: number, openLogs: (selection?: Omit<LogSelection, "requestId">) => void) => ReactNode;
};

function LlamaManagerLogo() {
  return (
    <svg className="brand-logo" viewBox="0 0 64 64" role="img" aria-label="Neuraxis logo">
      <path className="logo-chip" d="M17 14h26c7.2 0 13 5.8 13 13v20H30c-7.2 0-13-5.8-13-13V14Z" />
      <path className="logo-neck" d="M9 43V18c0-4.4 3.6-8 8-8h4v33H9Z" />
      <path className="logo-ear" d="M16 10 21 3l4 9" />
      <path className="logo-face" d="M22 26h17c3.9 0 7 3.1 7 7v7H29c-3.9 0-7-3.1-7-7v-7Z" />
      <path className="logo-line" d="M34 17v9M44 20v7M33 39h12" />
      <circle className="logo-eye" cx="30" cy="31" r="2" />
    </svg>
  );
}

function MenuIcon({ icon }: { icon: PageIcon | "logs" | "menu" | "close" }) {
  return (
    <svg className={`nav-icon icon-${icon} ml-1`} viewBox="0 0 24 24" aria-hidden="true">
      {icon === "dashboard" ? <path d="M4 12.5 12 5l8 7.5V20h-5v-5H9v5H4v-7.5Z" /> : null}
      {icon === "setup" ? <path d="M5 5h14v5H5V5Zm0 9h6v5H5v-5Zm9 0h5v5h-5v-5Z" /> : null}
      {icon === "chat" ? <path d="M5 6h14v9H9l-4 4V6Z" /> : null}
      {icon === "nodes" ? <path d="M6 7h5v5H6V7Zm7 5h5v5h-5v-5ZM7 14h3v3H7v-3Zm4-4h3m-4 6h3" /> : null}
      {icon === "library" ? <path d="M5 5h5v14H5V5Zm7 0h7v4h-7V5Zm0 6h7v8h-7v-8Z" /> : null}
      {icon === "convert" ? <path d="M6 8h10l-3-3m3 3-3 3M18 16H8l3 3m-3-3 3-3" /> : null}
      {icon === "download" ? <path d="M12 4v10m0 0 4-4m-4 4-4-4M5 18h14" /> : null}
      {icon === "quantize" ? <path d="M6 6h12v4H6V6Zm0 8h5v4H6v-4Zm7 0h5v4h-5v-4Z" /> : null}
      {icon === "controller" ? <path d="M5 7h14v10H5V7Zm4 3v4m3-4v4m3-4v4" /> : null}
      {icon === "runtime" ? <path d="M5 5h14v14H5V5Zm4 4h6M9 12h6M9 15h3" /> : null}
      {icon === "embeddings" ? <path d="M12 4v16M5 8l14 8M19 8 5 16" /> : null}
      {icon === "audit" ? <path d="M6 4h9l3 3v13H6V4Zm3 7h6M9 15h6" /> : null}
      {icon === "benchmark" ? <path d="M4 18h3v-6H4v6Zm6 0h3V8h-3v10Zm6 0h3V4h-3v14Z" /> : null}
      {icon === "api-keys" ? <path d="M7 11a4 4 0 1 1 8 0 4 4 0 0 1-8 0Zm4-6V3m0 16v-2m6-5h2M3 11h2m8.5-3.5 1.5-1.5M5 19l3-3m9 0 2 2M5 5l2 2" /> : null}
      {icon === "plugins" ? <path d="M8 4h8v5H8V4Zm-3 11h6v5H5v-5Zm8 0h6v5h-6v-5Zm-1-6v3m-4 0h8M8 12v3m8-3v3" /> : null}
      {icon === "settings" ? <path d="M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8Zm0-4v3m0 10v3M4 12h3m10 0h3" /> : null}
      {icon === "docs" ? <path d="M7 4h10v16H7V4Zm3 4h4M10 10h4M10 14h2" /> : null}
      {icon === "logs" ? <path d="M5 5h14v14H5V5Zm4 5h6M9 14h4" /> : null}
      {icon === "menu" ? <path d="M5 7h14M5 12h14M5 17h14" /> : null}
      {icon === "close" ? <path d="M7 7l10 10M17 7 7 17" /> : null}
    </svg>
  );
}

export function AppShell({ authRefreshKey = "", renderPage }: AppShellProps) {
  const { authChecked, isAuthenticated } = useAuthSession();
  const initialPage = pageForPathOrPluginPlaceholder(window.location.pathname);
  const [activePage, setActivePage] = useState<PageDefinition>(() => initialPage);
  const [setupStatusPending, setSetupStatusPending] = useState(initialPage.key === "dashboard");
  const [authRequired, setAuthRequired] = useState(false);
  const [logsOpen, setLogsOpen] = useState(false);
  const [logSelection, setLogSelection] = useState<LogSelection | null>(null);
  const [navOpen, setNavOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [globalRefreshing, setGlobalRefreshing] = useState(false);
  const [globalStatus, setGlobalStatus] = useState("Backend status unknown");
  const [globalMode, setGlobalMode] = useState<AppMode>("");
  const [globalControllerUrl, setGlobalControllerUrl] = useState<string | null>(null);
  const [globalControllerReachable, setGlobalControllerReachable] = useState<boolean | null>(null);
  const [globalAgentNodes, setGlobalAgentNodes] = useState<Array<{ name: string; url: string; reachable: boolean }>>([]); 
  const [enabledPlugins, setEnabledPlugins] = useState<EnabledPlugin[]>(() => readCachedPluginNavigation());
  const [pluginStatusIssues, setPluginStatusIssues] = useState<string[]>([]);
  const pluginPages = useMemo(() => enabledPlugins.flatMap((plugin) => pluginPagesForPlugin(plugin)), [enabledPlugins]);
  const visibleSections = useMemo(() => pagesBySectionForMode(globalMode, pluginPages), [globalMode, pluginPages]);
  const visiblePages = useMemo(() => visibleSections.flatMap((section) => section.pages), [visibleSections]);

  function navigate(pageKey: PageKey, options: PageNavigationOptions = {}) {
    const nextPage = pageForKey(pageKey, pluginPages);
    const nextPath = pathForPage(nextPage, options);
    setActivePage(nextPage);
    setNavOpen(false);
    if (`${window.location.pathname}${window.location.search}` !== nextPath) {
      window.history.pushState({ page: nextPage.key }, "", nextPath);
    }
  }

  function openLogs(selection?: Omit<LogSelection, "requestId">) {
    if (selection) {
      setLogSelection({ ...selection, requestId: Date.now() });
    }
    setLogsOpen(true);
  }

  async function refreshGlobal(refreshPage = true) {
    setGlobalRefreshing(true);
    try {
      const health = await getHealth();
      const mode = String(health.mode || "") as AppMode;
      setGlobalMode(mode);
      setGlobalControllerUrl(typeof health.controller_url === "string" ? health.controller_url : null);
      setGlobalStatus("Backend online");
      if (mode === "controller") {
        try {
          const nodesPayload = await listNodes();
          const nodeList: Array<{ name?: unknown; url?: unknown; heartbeat_fresh?: unknown }> = Array.isArray(nodesPayload)
            ? nodesPayload
            : (nodesPayload as { nodes?: Array<{ name?: unknown; url?: unknown; heartbeat_fresh?: unknown }> } | null)?.nodes ?? [];
          setGlobalAgentNodes(
            nodeList
              .filter((n) => n.name && n.url)
              .map((n) => ({ name: String(n.name), url: String(n.url), reachable: n.heartbeat_fresh === true }))
          );
        } catch {
          // non-fatal
        }
      } else {
        setGlobalAgentNodes([]);
      }
      if (mode === "agent") {
        try {
          const cs = await getControllerStatus();
          setGlobalControllerReachable(cs.reachable);
        } catch {
          setGlobalControllerReachable(null);
        }
      } else {
        setGlobalControllerReachable(null);
      }
      if (refreshPage) setRefreshKey((key) => key + 1);
    } catch {
      setGlobalStatus("Backend offline");
    } finally {
      setGlobalRefreshing(false);
    }
  }

  useEffect(() => {
    function onPopState() {
      const page = pageForPath(window.location.pathname, pluginPages);
      setActivePage(page.key === "dashboard" ? pageForPathOrPluginPlaceholder(window.location.pathname) : page);
      setNavOpen(false);
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [pluginPages]);

  useEffect(() => {
    document.body.classList.toggle("nav-open", navOpen);
    return () => document.body.classList.remove("nav-open");
  }, [navOpen]);

  useEffect(() => {
    void refreshGlobal(false);
  }, []);

  useEffect(() => {
    let alive = true;
    void Promise.allSettled([getEnabledPlugins(), getPluginStatus()])
      .then(([enabledResult, statusResult]) => {
        if (!alive) return;
        const status = statusResult.status === "fulfilled" ? statusResult.value : null;
        const enabled = enabledResult.status === "fulfilled" && Array.isArray(enabledResult.value) ? enabledResult.value : null;
        if (enabled && enabled.length > 0) {
          writeCachedPluginNavigation(enabled);
          setEnabledPlugins(enabled);
        } else if (enabled && pluginStatusExplicitlyEmpty(status)) {
          writeCachedPluginNavigation([]);
          setEnabledPlugins([]);
        }
        setPluginStatusIssues(statusResult.status === "fulfilled" ? pluginStatusIssuesFromPayload(statusResult.value) : []);
      });
    return () => {
      alive = false;
    };
  }, [authRefreshKey]);

  useEffect(() => {
    let alive = true;
    void getSetupStatus()
      .then((status) => {
        if (alive) setAuthRequired(Boolean(status.auth_enabled));
        if (alive && status.auth_bootstrap_required && activePage.key !== "setup") {
          navigate("setup");
        }
        if (alive) setSetupStatusPending(false);
      })
      .catch(() => {
        if (alive) setAuthRequired(false);
        if (alive) setSetupStatusPending(false);
      })
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (authRefreshKey) setRefreshKey((key) => key + 1);
  }, [authRefreshKey]);

  useEffect(() => {
    if (globalMode && !visiblePages.some((page) => page.key === activePage.key)) {
      if (activePage.pluginId) return;
      if (activePage.key !== "dashboard") navigate("dashboard");
    }
  }, [activePage.key, globalMode, visiblePages]);

  useEffect(() => {
    const pluginPage = pageForPath(window.location.pathname, pluginPages);
    if (pluginPage.pluginId && (
      pluginPage.key !== activePage.key
      || pluginPage.label !== activePage.label
      || pluginPage.pluginName !== activePage.pluginName
      || pluginPage.secondaryNavigation !== activePage.secondaryNavigation
    )) {
      setActivePage(pluginPage);
    }
  }, [activePage.key, pluginPages]);

  return (
    <AppModeProvider appMode={globalMode}>
    <div className={`app-shell ${navOpen ? "mobile-nav-open" : ""}`}>
      <aside className="app-sidebar" aria-label="Primary">
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true"><LlamaManagerLogo /></div>
          <div>
            <h1>Neuraxis</h1>
            <p>{globalMode === "agent" ? "Agent runtime" : globalMode === "controller" ? "Private AI gateway" : "Gateway console"}</p>
          </div>
        </div>
        <nav className="app-nav" aria-label="Primary navigation">
          {visibleSections.map((section) => (
            <div className="nav-section" key={section.key}>
              <div className="nav-section-label">{section.label}</div>
              {section.pages.map((item) => (
                <button
                  key={item.key}
                  className={`nav-button cursor-pointer ${activePage.key === item.key ? "active" : ""}`}
                  type="button"
                  onClick={() => {
                    if (item.path.startsWith("/ui/docs")) {
                      window.location.href = item.path;
                    } else {
                      navigate(item.key);
                    }
                  }}
                >
                  <MenuIcon icon={item.icon} />
                  <span>{item.navLabel || item.label}</span>
                </button>
              ))}
              {section.key === "operations" ? (
                <button
                  className="nav-button modal-nav-button"
                  type="button"
                  onClick={() => {
                    setLogSelection(null);
                    setLogsOpen(true);
                  }}
                >
                  <MenuIcon icon="logs" />
                  <span>Logs</span>
                </button>
              ) : null}
            </div>
          ))}
        </nav>
        <div className="sidebar-footer absolute bottom-0">
          {globalMode === "agent" && globalControllerUrl ? (
            <div className="sidebar-peers">
              <div className="sidebar-peers-label">Controller</div>
              <a
                className="sidebar-peer-link"
                href={globalControllerUrl}
                target="_blank"
                rel="noopener noreferrer"
                title={globalControllerUrl}
              >
                <span
                  className={`peer-status-dot ${globalControllerReachable === true ? "online" : globalControllerReachable === false ? "offline" : ""}`}
                  aria-hidden="true"
                />
                <MenuIcon icon="controller" />
                <span className="sidebar-peer-name">{globalControllerUrl}</span>
              </a>
            </div>
          ) : null}
          {globalMode === "controller" && globalAgentNodes.length > 0 ? (
            <div className="sidebar-peers">
              <div className="sidebar-peers-label">Agent Nodes</div>
              {globalAgentNodes.map((node) => (
                <a
                  key={node.name}
                  className="sidebar-peer-link"
                  href={node.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={node.url}
                >
                  <span
                    className={`peer-status-dot ${node.reachable ? "online" : "offline"}`}
                    aria-hidden="true"
                  />
                  <MenuIcon icon="nodes" />
                  <span className="sidebar-peer-name">{node.name}</span>
                </a>
              ))}
            </div>
          ) : null}
        </div>
      </aside>
      <div className="app-main">
        <header className="app-header">
          <button
            className="mobile-menu-button"
            type="button"
            aria-label={navOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={navOpen}
            onClick={() => setNavOpen((open) => !open)}
          >
            <MenuIcon icon={navOpen ? "close" : "menu"} />
          </button>
          <div className="command-center">
            <span className="command-icon" aria-hidden="true"><LlamaManagerLogo /></span>
            <span className="command-copy">{activePage.label}</span>
          </div>
          <div className="global-status">
            <span className={`status-dot ${globalStatus === "Backend online" ? "online" : globalStatus === "Backend offline" ? "offline" : ""}`} aria-hidden="true" />
            <span>{globalStatus}</span>
            <Button type="button" onClick={() => void refreshGlobal()} disabled={globalRefreshing} aria-label={globalRefreshing ? "Refreshing" : "Global Refresh"}>
              {globalRefreshing ? "Refreshing" : <IoRefreshSharp />}
            </Button>
          </div>
          <div className="header-actions">
            <AuthLoginForm />
            <ThemeToggle />
          </div>
        </header>
        <main className="layout" key={`${activePage.key}-${refreshKey}`}>
          {pluginStatusIssues.length ? (
            <section className="plugin-status-alert" role="alert" aria-label="Plugin status">
              <strong>Plugin attention needed</strong>
              <ul>
                {pluginStatusIssues.map((issue) => <li key={issue}>{issue}</li>)}
              </ul>
            </section>
          ) : null}
          {activePage.pluginId && activePage.secondaryNavigation?.length ? (
            <nav className="plugin-secondary-nav" aria-label={`${activePage.pluginName || activePage.label} navigation`}>
              {activePage.secondaryNavigation.map((item) => (
                <button
                  key={item.path}
                  className={`plugin-secondary-button ${window.location.pathname === item.path ? "active" : ""}`}
                  type="button"
                  onClick={() => {
                    const nextPage = pageForPath(item.path, pluginPages);
                    setActivePage(nextPage.pluginId ? nextPage : { ...activePage, path: item.path, label: item.label });
                    window.history.pushState({ page: item.path }, "", item.path);
                  }}
                >
                  {item.label}
                </button>
              ))}
            </nav>
          ) : null}
          {setupStatusPending || (authRequired && !authChecked) ? (
            <div className="muted">Checking session...</div>
          ) : authRequired && !isAuthenticated && activePage.key !== "setup" ? (
            <Panel title="Login Required" eyebrow="Session">
              <p className="muted">Log in to Neuraxis to continue.</p>
            </Panel>
          ) : renderPage(activePage, navigate, refreshKey, openLogs)}
        </main>
      </div>
      {navOpen ? <button className="mobile-nav-scrim" type="button" aria-label="Close navigation overlay" onClick={() => setNavOpen(false)} /> : null}
      <LogModal open={logsOpen} onClose={() => setLogsOpen(false)} initialSelection={logSelection} />
    </div>
    </AppModeProvider>
  );
}

export type { PageKey };

function pageForPathOrPluginPlaceholder(pathname: string): PageDefinition {
  const page = pageForPath(pathname);
  if (page.key !== "dashboard" || !pathname.startsWith("/ui/plugins/")) {
    return page;
  }
  const pluginId = pathname.slice("/ui/plugins/".length).split("/")[0];
  if (!pluginId) return page;
  return pluginPage(
    { id: pluginId, name: "Plugin", version: "", status: "enabled" },
    pathname,
    "Plugin",
    [],
    { hideFromPrimary: true },
  );
}

function readCachedPluginNavigation(): EnabledPlugin[] {
  try {
    const raw = window.localStorage.getItem(PLUGIN_NAV_CACHE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(isEnabledPluginLike) : [];
  } catch {
    return [];
  }
}

function writeCachedPluginNavigation(plugins: EnabledPlugin[]): void {
  try {
    if (plugins.length === 0) {
      window.localStorage.removeItem(PLUGIN_NAV_CACHE_KEY);
    } else {
      window.localStorage.setItem(PLUGIN_NAV_CACHE_KEY, JSON.stringify(plugins));
    }
  } catch {
    // Plugin navigation cache is a convenience fallback only.
  }
}

function isEnabledPluginLike(value: unknown): value is EnabledPlugin {
  if (!value || typeof value !== "object") return false;
  const plugin = value as { id?: unknown; name?: unknown; version?: unknown; status?: unknown };
  return typeof plugin.id === "string" && typeof plugin.name === "string" && typeof plugin.version === "string" && plugin.status === "enabled";
}

function pluginStatusExplicitlyEmpty(status: PluginStatus | null): boolean {
  const plugins = Array.isArray(status?.plugins) ? status.plugins : [];
  return plugins.length > 0 && plugins.every((plugin) => plugin.status !== "enabled");
}

export function pluginStatusIssuesFromPayload(status: PluginStatus | null | undefined): string[] {
  const plugins = Array.isArray(status?.plugins) ? status.plugins : [];
  const issues: string[] = [];
  for (const plugin of plugins) {
    const label = plugin.id || "unknown plugin";
    if (plugin.status && !["enabled", "disabled"].includes(plugin.status)) {
      issues.push(`${label} is ${plugin.status}`);
    }
    for (const warning of plugin.warnings || []) {
      issues.push(`${label}: ${warning}`);
    }
    for (const error of plugin.errors || []) {
      issues.push(`${label}: ${error}`);
    }
    for (const item of plugin.health || []) {
      const level = String(item.level || "").toLowerCase();
      const message = String(item.message || "");
      if (message && ["warning", "error"].includes(level)) {
        issues.push(`${label}: ${message}`);
      }
    }
  }
  return Array.from(new Set(issues)).slice(0, 5);
}

export function pluginPagesForPlugin(plugin: EnabledPlugin): PageDefinition[] {
  const secondaryNavigation = (plugin.secondary_navigation || [])
    .map((item) => normalizePluginNavItem(item))
    .filter((item): item is { label: string; path: string } => item !== null);
  const primary = (plugin.navigation || [])
    .map((item, index) => normalizePluginNavItem(item, plugin.name, `/ui/plugins/${plugin.id}`, index))
    .filter((item): item is { label: string; path: string } => item !== null);
  const routeItems = (plugin.ui_routes || [])
    .map((item, index) => normalizePluginNavItem(item, plugin.name, `/ui/plugins/${plugin.id}`, index))
    .filter((item): item is { label: string; path: string } => item !== null);
  const pages = new Map<string, PageDefinition>();
  for (const item of primary) {
    const route = routeItems.find((candidate) => candidate.path === item.path);
    pages.set(item.path, pluginPage(plugin, item.path, route?.label || item.label, secondaryNavigation, { navLabel: item.label }));
  }
  for (const item of routeItems) {
    if (!pages.has(item.path)) {
      pages.set(item.path, pluginPage(plugin, item.path, item.label, secondaryNavigation, { hideFromPrimary: true }));
    }
  }
  for (const item of secondaryNavigation) {
    if (!pages.has(item.path)) {
      pages.set(item.path, pluginPage(plugin, item.path, item.label, secondaryNavigation, { hideFromPrimary: true }));
    }
  }
  return Array.from(pages.values());
}

function pluginPage(
  plugin: EnabledPlugin,
  path: string,
  label: string,
  secondaryNavigation: Array<{ label: string; path: string }>,
  options: Pick<PageDefinition, "hideFromPrimary" | "navLabel"> = {},
): PageDefinition {
  return {
    key: `plugin:${plugin.id}:${path}`,
    label,
    path,
    icon: "settings",
    section: "plugins",
    pluginId: plugin.id,
    pluginName: plugin.name,
    secondaryNavigation,
    ...options,
  };
}

function normalizePluginNavItem(
  item: { label?: string; path?: string },
  fallbackLabel = "Plugin",
  fallbackPath = "",
  index = 0,
): { label: string; path: string } | null {
  const path = typeof item.path === "string" && item.path.startsWith("/ui/") ? item.path : fallbackPath;
  if (!path) return null;
  const label = typeof item.label === "string" && item.label.trim() ? item.label.trim() : index === 0 ? fallbackLabel : path;
  return { label, path };
}
