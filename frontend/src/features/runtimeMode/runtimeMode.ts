import type { AppMode } from "../appMode/appModeContext";

export type RuntimeTopology = "controller" | "standalone_agent" | "node_agent" | "unknown";

export function runtimeTopology(mode: AppMode, controllerUrl: string | null): RuntimeTopology {
  if (mode === "controller") return "controller";
  if (mode === "agent") {
    return controllerUrl && controllerUrl.trim() ? "node_agent" : "standalone_agent";
  }
  return "unknown";
}

export function managesLocalAccounts(topology: RuntimeTopology): boolean {
  return topology === "controller" || topology === "standalone_agent";
}
