import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { createPluginHostApi, type PluginHostApi } from "../../api/pluginHost";
import { getEnabledPlugins } from "../../api/plugins";
import { EnabledPlugin } from "../../types/plugins";
import { useAsyncResource } from "../../hooks/useAsyncResource";
import { Button, ErrorBanner, Panel } from "../../components/ui";
import { useGlobalStatus } from "../../features/globalStatus/globalStatusContext";
import { usePluginNav } from "../../features/plugins/pluginNavContext";
import "./styles.css";

export type PluginFrontendModule = {
  mount?: (container: HTMLElement, host: PluginHostApi) => void | (() => void);
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
  const { refreshKey } = useGlobalStatus();
  const { pluginPages } = usePluginNav();

  const page = useMemo(() => {
    const match = pluginPages.find((p) => p.pluginId === routePluginId && p.path === window.location.pathname);
    if (match) return match;
    return {
      key: `plugin:${routePluginId}:${window.location.pathname}`,
      label: "Plugin",
      path: window.location.pathname,
      icon: "settings" as const,
      section: "plugins" as const,
      pluginId: routePluginId || "",
      pluginName: "Plugin",
    };
  }, [routePluginId, pluginPages]);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const pendingCleanupErrorRef = useRef("");
  const [reloadCount, setReloadCount] = useState(0);

  const fetcher = useCallback(async () => {
    if (!page.pluginId) return null;
    const plugins = await getEnabledPlugins();
    return plugins.find((item) => item.id === page.pluginId) || null;
  }, [page.pluginId]);

  const { data: plugin, loading, error, setError } = useAsyncResource<EnabledPlugin | null>(fetcher, null, [fetcher]);

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

  useEffect(() => {
    if (!page.pluginId || !plugin) return;
    const cleanupError = pendingCleanupErrorRef.current || cleanupPlugin();
    pendingCleanupErrorRef.current = "";
    if (containerRef.current) containerRef.current.innerHTML = "";
    const entry = plugin?.frontend?.entry;
    if (!entry) {
      setError(`Plugin ${page.pluginId} does not declare a frontend entry`);
      return;
    }
    setError(cleanupError);
    let cancelled = false;
    loadModule(cacheBustedEntry(entry, plugin.version, reloadCount)).then((module) => {
      if (cancelled || !containerRef.current || typeof module.mount !== "function") {
        if (!cancelled && typeof module.mount !== "function") {
          setError(`Plugin ${page.pluginId} frontend does not export mount()`);
        }
        return;
      }
      const mountedCleanup = module.mount(containerRef.current, hostApi);
      cleanupRef.current = typeof mountedCleanup === "function" ? mountedCleanup : null;
    }).catch((err) => {
      if (!cancelled) {
        const loadError = errorMessage(err, "Plugin frontend unavailable");
        setError(cleanupError ? `${cleanupError}; ${loadError}` : loadError);
      }
    });
    return () => {
      cancelled = true;
      const cleanErr = cleanupPlugin();
      if (cleanErr) pendingCleanupErrorRef.current = cleanErr;
    };
  }, [page.pluginId, refreshKey, reloadCount, plugin, hostApi, loadModule, setError]);

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
