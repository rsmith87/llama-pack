import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getControllerStatus, getHealth } from "../../api/health";
import { listNodes } from "../../api/nodes";
import { useAuthSession } from "../auth/authSession";
import type { AppMode } from "../appMode/appModeContext";

type AgentNode = { name: string; url: string; reachable: boolean };

type GlobalStatusContextValue = {
  appMode: AppMode;
  status: string;
  controllerUrl: string | null;
  controllerReachable: boolean | null;
  agentNodes: AgentNode[];
  configuredModels: number;
  refreshKey: number;
  globalRefreshing: boolean;
  refreshGlobal: (refreshPage: boolean) => Promise<void>;
};

const GlobalStatusContext = createContext<GlobalStatusContextValue>({
  appMode: "",
  status: "Backend status unknown",
  controllerUrl: null,
  controllerReachable: null,
  agentNodes: [],
  configuredModels: 0,
  refreshKey: 0,
  globalRefreshing: false,
  refreshGlobal: async (_refreshPage: boolean) => {},
});

export function GlobalStatusProvider({ children }: { children: ReactNode }) {
  const { authToken } = useAuthSession();
  const [status, setStatus] = useState("Backend status unknown");
  const [appMode, setAppMode] = useState<AppMode>("");
  const [controllerUrl, setControllerUrl] = useState<string | null>(null);
  const [controllerReachable, setControllerReachable] = useState<boolean | null>(null);
  const [agentNodes, setAgentNodes] = useState<AgentNode[]>([]);
  const [configuredModels, setConfiguredModels] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [globalRefreshing, setGlobalRefreshing] = useState(false);

  const refreshGlobal = useCallback(async (refreshPage: boolean) => {
    setGlobalRefreshing(true);
    try {
      const health = await getHealth();
      const mode = String(health.mode || "") as AppMode;
      const configuredModelCount = typeof health.configured_models === "number" ? health.configured_models : 0;
      setAppMode(mode);
      setControllerUrl(typeof health.controller_url === "string" ? health.controller_url : null);
      setConfiguredModels(configuredModelCount);
      setStatus("Backend online");
      if (refreshPage && mode === "controller") {
        try {
          const nodesPayload = await listNodes();
          const nodeList: Array<{ name?: unknown; url?: unknown; heartbeat_fresh?: unknown }> = Array.isArray(nodesPayload)
            ? nodesPayload
            : (nodesPayload as { nodes?: Array<{ name?: unknown; url?: unknown; heartbeat_fresh?: unknown }> } | null)?.nodes ?? [];
          setAgentNodes(
            nodeList
              .filter((n) => n.name && n.url)
              .map((n) => ({ name: String(n.name), url: String(n.url), reachable: n.heartbeat_fresh === true }))
          );
        } catch {
          // non-fatal
        }
      } else {
        setAgentNodes([]);
      }
      if (refreshPage && mode === "agent") {
        try {
          const cs = await getControllerStatus();
          setControllerReachable(cs.reachable);
        } catch {
          setControllerReachable(null);
        }
      } else {
        setControllerReachable(null);
      }
      if (refreshPage) setRefreshKey((key) => key + 1);
    } catch {
      setStatus("Backend offline");
      setConfiguredModels(0);
    } finally {
      setGlobalRefreshing(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    void refreshGlobal(false);
  }, [refreshGlobal]);

  // Bump refreshKey when auth token changes
  useEffect(() => {
    if (authToken) setRefreshKey((key) => key + 1);
  }, [authToken]);

  const value = useMemo<GlobalStatusContextValue>(() => ({
    appMode,
    status,
    controllerUrl,
    controllerReachable,
    agentNodes,
    configuredModels,
    refreshKey,
    globalRefreshing,
    refreshGlobal,
  }), [appMode, status, controllerUrl, controllerReachable, agentNodes, configuredModels, refreshKey, globalRefreshing, refreshGlobal]);

  return <GlobalStatusContext.Provider value={value}>{children}</GlobalStatusContext.Provider>;
}

export function useGlobalStatus(): GlobalStatusContextValue {
  return useContext(GlobalStatusContext);
}
