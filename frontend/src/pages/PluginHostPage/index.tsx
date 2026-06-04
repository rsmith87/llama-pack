import { useEffect, useMemo, useRef, useState } from "react";
import { createPluginHostApi, type PluginHostApi } from "../../api/pluginHost";
import { getEnabledPlugins, type EnabledPlugin } from "../../api/plugins";
import { Button, ErrorBanner, Panel } from "../../components/ui";
import type { PageDefinition } from "../../routes/pages";
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

export function PluginHostPage({
  page,
  onNavigate,
  refreshKey = "",
  loadModule = defaultLoader,
}: {
  page: PageDefinition;
  onNavigate: (pageKeyOrPath: string) => void;
  refreshKey?: string | number;
  loadModule?: PluginModuleLoader;
}) {
	  const containerRef = useRef<HTMLDivElement | null>(null);
	  const cleanupRef = useRef<(() => void) | null>(null);
	  const [plugin, setPlugin] = useState<EnabledPlugin | null>(null);
	  const [reloadCount, setReloadCount] = useState(0);
	  const [loading, setLoading] = useState(true);
	  const [error, setError] = useState("");

  const hostApi = useMemo(() => createPluginHostApi({
	    pluginId: page.pluginId || "",
	    navigate: onNavigate,
	    refreshPluginStatus: () => undefined,
	  }), [onNavigate, page.pluginId]);

  async function load() {
    if (!page.pluginId) return;
    cleanupRef.current?.();
    cleanupRef.current = null;
    if (containerRef.current) containerRef.current.innerHTML = "";
    setLoading(true);
    setError("");
    try {
      const plugins = await getEnabledPlugins();
      const current = plugins.find((item) => item.id === page.pluginId) || null;
      setPlugin(current);
      const entry = current?.frontend?.entry;
      if (!current) {
        throw new Error(`Plugin ${page.pluginId} is not enabled`);
      }
	      if (!entry) {
	        throw new Error(`Plugin ${page.pluginId} does not declare a frontend entry`);
	      }
	      const module = await loadModule(cacheBustedEntry(entry, current.version, reloadCount));
      if (typeof module.mount !== "function") {
        throw new Error(`Plugin ${page.pluginId} frontend does not export mount()`);
      }
      if (!containerRef.current) return;
      const cleanup = module.mount(containerRef.current, hostApi);
      cleanupRef.current = typeof cleanup === "function" ? cleanup : null;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Plugin frontend unavailable");
    } finally {
      setLoading(false);
    }
  }

	  useEffect(() => {
	    void load();
	    return () => {
	      cleanupRef.current?.();
	      cleanupRef.current = null;
	    };
  }, [page.pluginId, refreshKey, reloadCount]);

  return (
    <div className="plugin-host-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">{plugin?.name || page.pluginName || "Plugin"}</span>
          <h2>{page.label}</h2>
          <p className="muted">Plugin frontend loaded from {plugin?.frontend?.entry || "plugin metadata"}.</p>
        </div>
	        <Button type="button" onClick={() => {
	          setReloadCount((value) => value + 1);
	        }} disabled={loading}>{loading ? "Loading" : "Reload"}</Button>
      </div>
      {error ? <ErrorBanner message={error} /> : null}
      <Panel className="plugin-host-panel">
        <div ref={containerRef} className="plugin-host-container" />
      </Panel>
    </div>
  );
}
