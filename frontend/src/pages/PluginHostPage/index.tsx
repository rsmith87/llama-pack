import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { createPluginHostApi, type PluginHostApi } from "../../api/pluginHost";
import { getEnabledPlugins } from "../../api/plugins";
import { EnabledPlugin } from "../../types/plugins";
import { useAsyncResource } from "../../hooks/useAsyncResource";
import { Button, ErrorBanner, Panel } from "../../components/ui";
import { useGlobalStatus } from "../../features/globalStatus/globalStatusContext";
import { usePluginNav } from "../../features/plugins/pluginNavContext";
import "./styles.css";

export type PluginFrontendModule = {
  mountPage?: (root: HTMLElement, host: PluginHostApi) => void | (() => void);
};

type PluginModuleLoader = (entry: string) => Promise<PluginFrontendModule>;

const defaultLoader: PluginModuleLoader = (entry) => import(/* @vite-ignore */ entry) as Promise<PluginFrontendModule>;

function cacheBustedEntry(entry: string, version: string | undefined, reloadCount: number): string {
  const separator = entry.includes("?") ? "&" : "?";
  return `${entry}${separator}v=${encodeURIComponent(version || "dev")}&r=${encodeURIComponent(String(reloadCount))}`;
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

export function PluginHostPage({
  loadModule = defaultLoader,
}: {
  loadModule?: PluginModuleLoader;
} = {}) {
  const { pluginId: routePluginId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { refreshKey } = useGlobalStatus();
  const { pluginPages } = usePluginNav();

  const page = useMemo(() => {
    const match = pluginPages.find((p) => p.pluginId === routePluginId && p.path === location.pathname);
    if (match) return match;
    return {
      key: `plugin:${routePluginId}:${location.pathname}`,
      label: "Plugin",
      path: location.pathname,
      icon: "settings" as const,
      section: "plugins" as const,
      pluginId: routePluginId || "",
      pluginName: "Plugin",
    };
  }, [routePluginId, pluginPages, location.pathname]);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const pendingCleanupErrorRef = useRef("");
  const styleLinksRef = useRef<HTMLLinkElement[]>([]);
  const [reloadCount, setReloadCount] = useState(0);

  const fetcher = useCallback(async () => {
    if (!page.pluginId) return null;
    const plugins = await getEnabledPlugins();
    return plugins.find((item) => item.id === page.pluginId) || null;
  }, [page.pluginId]);

  const { data: plugin, loading, error, setError } = useAsyncResource<EnabledPlugin | null>(fetcher, null, [fetcher]);

  const currentPluginPage = useMemo(() => {
    const pages = plugin?.frontend?.pages || [];
    return pages.find((item) => item.route === location.pathname) || null;
  }, [plugin, location.pathname]);

  const hostApi = useMemo(() => createPluginHostApi({
    pluginId: page.pluginId || "",
    navigate,
    refreshPluginStatus: () => undefined,
  }), [navigate, page.pluginId]);

  function cleanupPlugin(): string {
    const cleanup = cleanupRef.current;
    cleanupRef.current = null;
    if (!cleanup) return "";
    try {
      cleanup();
      return "";
    } catch (err) {
      return errorMessage(err, "Plugin cleanup failed");
    }
  }

  function cleanupStyles() {
    for (const link of styleLinksRef.current) link.remove();
    styleLinksRef.current = [];
  }

  function loadStyles(styleEntries: string[], version: string | undefined) {
    cleanupStyles();
    for (const href of styleEntries) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = cacheBustedEntry(href, version, reloadCount);
      link.dataset.pluginStyle = page.pluginId;
      document.head.appendChild(link);
      styleLinksRef.current.push(link);
    }
  }

  useEffect(() => {
    if (!page.pluginId || !plugin) return;
    const cleanupError = pendingCleanupErrorRef.current || cleanupPlugin();
    pendingCleanupErrorRef.current = "";
    if (containerRef.current) containerRef.current.innerHTML = "";
    loadStyles(plugin.frontend?.style_entries || [], plugin.version);
    const manifestPage = currentPluginPage;
    if (manifestPage) {
      setError(cleanupError);
      let cancelled = false;
      fetch(manifestPage.template)
        .then(async (response) => {
          if (!response.ok) throw new Error(`Plugin template unavailable: ${response.status} ${response.statusText}`);
          return response.text();
        })
        .then(async (html) => {
          if (cancelled || !containerRef.current) return;
          containerRef.current.innerHTML = html;
          if (!manifestPage.controller) return;
          const module = await loadModule(cacheBustedEntry(manifestPage.controller, plugin.version, reloadCount));
          if (cancelled || !containerRef.current) return;
          if (typeof module.mountPage !== "function") {
            setError(`Plugin ${page.pluginId} controller does not export mountPage()`);
            return;
          }
          const mountedCleanup = module.mountPage(containerRef.current, hostApi);
          cleanupRef.current = typeof mountedCleanup === "function" ? mountedCleanup : null;
        })
        .catch((err) => {
          if (!cancelled) {
            const loadError = errorMessage(err, "Plugin page unavailable");
            setError(cleanupError ? `${cleanupError}; ${loadError}` : loadError);
          }
        });
      return () => {
        cancelled = true;
        const cleanErr = cleanupPlugin();
        if (cleanErr) pendingCleanupErrorRef.current = cleanErr;
        cleanupStyles();
      };
    }
    setError(cleanupError ? `${cleanupError}; Plugin ${page.pluginId} does not declare a plugin page for ${location.pathname}` : `Plugin ${page.pluginId} does not declare a plugin page for ${location.pathname}`);
    return () => {
      cleanupStyles();
    };
  }, [page.pluginId, refreshKey, reloadCount, plugin, currentPluginPage, hostApi, loadModule, setError, location.pathname]);

  return (
    <div className="plugin-host-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">{plugin?.name || page.pluginName || "Plugin"}</span>
          <h2>{page.label}</h2>
        </div>
        <Button type="button" onClick={() => setReloadCount((c) => c + 1)} disabled={loading}>{loading ? "Loading" : "Reload"}</Button>
      </div>
      {error ? <ErrorBanner message={error} /> : null}
      <Panel className="plugin-host-panel">
        <div ref={containerRef} className="plugin-host-container" />
      </Panel>
    </div>
  );
}
