import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getEnabledPlugins, getPluginStatus } from "../../api/plugins";
import type { EnabledPlugin, PluginStatus } from "../../types/plugins";
import { PLUGIN_NAV_CACHE_KEY } from "../../constants/plugins";
import { useAuthSession } from "../auth/authSession";
import type { PageDefinition } from "../../routes/pages";

type PluginNavContextValue = {
  enabledPlugins: EnabledPlugin[];
  pluginPages: PageDefinition[];
  pluginStatusIssues: string[];
};

const PluginNavContext = createContext<PluginNavContextValue>({
  enabledPlugins: [],
  pluginPages: [],
  pluginStatusIssues: [],
});

export function PluginNavProvider({ children }: { children: ReactNode }) {
  const { authToken } = useAuthSession();
  const [enabledPlugins, setEnabledPlugins] = useState<EnabledPlugin[]>(() => readCachedPluginNavigation());
  const [pluginStatusIssues, setPluginStatusIssues] = useState<string[]>([]);

  const pluginPages = useMemo(
    () => enabledPlugins.flatMap((plugin) => pluginPagesForPlugin(plugin)),
    [enabledPlugins],
  );

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
  }, [authToken]);

  const value = useMemo<PluginNavContextValue>(() => ({
    enabledPlugins,
    pluginPages,
    pluginStatusIssues,
  }), [enabledPlugins, pluginPages, pluginStatusIssues]);

  return <PluginNavContext.Provider value={value}>{children}</PluginNavContext.Provider>;
}

export function usePluginNav(): PluginNavContextValue {
  return useContext(PluginNavContext);
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

function pluginPagesForPlugin(plugin: EnabledPlugin): PageDefinition[] {
  const manifestPages = (plugin.frontend?.pages || [])
    .filter((item) => typeof item.route === "string" && item.route.startsWith(`/ui/plugins/${plugin.id}`))
    .map((item) => ({ label: item.title || plugin.name, path: item.route }));
  const secondaryNavigation = manifestPages.length > 1
    ? manifestPages.map((item) => ({ label: item.label, path: item.path }))
    : (plugin.secondary_navigation || [])
      .map((item) => normalizePluginNavItem(item))
      .filter((item): item is { label: string; path: string } => item !== null);
  const primary = manifestPages.length > 0
    ? [manifestPages[0]]
    : (plugin.navigation || [])
      .map((item, index) => normalizePluginNavItem(item, plugin.name, `/ui/plugins/${plugin.id}`, index))
      .filter((item): item is { label: string; path: string } => item !== null);
  const routeItems = manifestPages.length > 0
    ? manifestPages
    : (plugin.ui_routes || [])
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
