import { LocalModel, DashboardData, NodeRecord } from "../../types";
import { TIMERS } from "../../constants";

type CertTone = "success" | "warning" | "danger" | "muted";

export type ModelActionTargetInput = {
  resolvedNode: string | null | undefined;
  hasControllerAction: boolean;
  reachable: boolean;
};

export function modelName(model: { name?: string; id?: string; model?: string; path?: string }): string {
  return model.name || model.id || model.model || model.path || "unnamed model";
}

export function statusTone(status: string): CertTone {
  const normalized = status.toLowerCase();
  if (["running", "ready", "available", "loaded", "reachable"].includes(normalized)) return "success";
  if (["starting", "stopping", "loading"].includes(normalized)) return "warning";
  if (["failed", "error", "offline"].includes(normalized)) return "danger";
  return "muted";
}

export function percent(value: number | null | undefined): string {
  return typeof value === "number" ? `${Math.round(value)}%` : "-";
}

export function modelFileId(model: { file_id?: string; id?: string }): string {
  return String(model.file_id || model.id || "");
}

export function isGgufBacked(model: LocalModel): boolean {
  const path = String(model.model_path || model.path || model.model || "").toLowerCase();
  return Boolean(modelFileId(model) && path.endsWith(".gguf"));
}

export function modelNode(model: LocalModel, data: DashboardData): string | null {
  const directNode = model.node || model.node_name;
  if (directNode) return directNode;
  const matchingNode = data.nodes.find((node) => node.models?.some((nodeModel) => modelName(nodeModel) === modelName(model)));
  return (matchingNode?.name || matchingNode?.node_id || null);
}

export function modelActionTargetLabel(input: ModelActionTargetInput): string {
  const node = String(input.resolvedNode || "").trim();
  if (!node) return "Actions run on local runtime.";
  if (!input.reachable) return `Actions unavailable until agent ${node} is reachable.`;
  if (input.hasControllerAction) return `Actions run on agent ${node} through the controller.`;
  return `Actions run on agent ${node}.`;
}

export function modelPlacementDetails(model: Record<string, unknown>): string[] {
  return [
    configuredPlacement(model),
    ggufPlacement(model),
    deploymentPlacement(model),
    runtimePlacement(model),
  ];
}

function configuredPlacement(model: Record<string, unknown>): string {
  if (Boolean(model.registered)) {
    const name = String(model.registered_as || model.name || model.model || "").trim();
    return name ? `Configured as ${name}.` : "Configured as a runnable model.";
  }
  return "Not configured as a runnable model.";
}

function ggufPlacement(model: Record<string, unknown>): string {
  const fileId = String(model.file_id || model.id || "").trim();
  const path = String(model.path || model.model_path || model.filename || "").trim().toLowerCase();
  if (!fileId && !path.endsWith(".gguf")) return "GGUF file not reported.";
  return fileId ? `GGUF file present: ${fileId}.` : "GGUF file present.";
}

function deploymentPlacement(model: Record<string, unknown>): string {
  const deployments = Array.isArray(model.model_deployments) ? model.model_deployments : [];
  const deployment = deployments.find((item) => item && typeof item === "object" && (item as Record<string, unknown>).enabled !== false) as Record<string, unknown> | undefined;
  if (!deployment) return "No deployment registered.";
  const node = String(deployment.node_name || "").trim();
  const host = String(deployment.host || "").trim();
  const port = typeof deployment.port === "number" ? deployment.port : null;
  const profile = String(deployment.profile_key || "").trim();
  const endpoint = host && port !== null ? `${host}:${port}` : host || (port !== null ? `port ${port}` : "");
  const prefix = node ? `${node} ` : "";
  const suffix = profile ? ` (${profile})` : "";
  return endpoint ? `Deployment ${prefix}${endpoint}${suffix}.` : `Deployment ${prefix || "registered"}${suffix}.`;
}

function runtimePlacement(model: Record<string, unknown>): string {
  const status = String(model.status || "").toLowerCase();
  const running = status === "running" || status === "loaded" || status === "ready";
  if (!running) return "No running process reported.";
  const port = typeof model.port === "number" ? model.port : null;
  const pid = typeof model.pid === "number" ? model.pid : null;
  const parts = [port !== null ? `port ${port}` : "", pid !== null ? `pid ${pid}` : ""].filter(Boolean);
  return parts.length ? `Running process on ${parts.join(", ")}.` : "Running process reported.";
}

export function modelForNode(node: DashboardData["nodes"][number], nodeModel: LocalModel, data: DashboardData): LocalModel {
  const expectedNode = nodeName(node);
  const expectedModel = modelName(nodeModel);
  return data.localModels.find((model) => {
    const localNode = model.node || model.node_name || modelNode(model, data);
    if (!localNode && expectedNode === "controller-local") return modelName(model) === expectedModel;
    return localNode === expectedNode && modelName(model) === expectedModel;
  }) || { ...nodeModel, node: expectedNode };
}

export function nodeName(node: { name?: string; node_id?: string }): string {
  return String(node.name || node.node_id || "");
}

export function certBadge(seconds: number | null | undefined): { tone: CertTone; label: string } {
  if (typeof seconds !== "number") return { tone: "muted", label: "cert unknown" };
  if (seconds <= 0) return { tone: "danger", label: "cert expired" };
  if (seconds <= TIMERS.CERT_EXPIRING_SOON_SECONDS) return { tone: "warning", label: `cert ${Math.max(1, Math.ceil(seconds / TIMERS.DAY_SECONDS))}d left` };
  return { tone: "success", label: "cert valid" };
}

export function asNodeRecords(nodes: DashboardData["nodes"]): NodeRecord[] {
  return nodes.map((node) => ({
    ...node,
    name: nodeName(node),
  }));
}

export function metricPercent(
  health: DashboardData["health"],
  flatKey: "cpu_percent" | "memory_percent" | "vram_percent",
  nestedKey: "cpu" | "ram" | "vram",
): number | null {
  const system = health?.system as Record<string, unknown> | undefined;
  const flat = system?.[flatKey];
  if (typeof flat === "number") return flat;
  const nested = system?.[nestedKey] as Record<string, unknown> | null | undefined;
  const nestedPercent = nested?.percent;
  if (typeof nestedPercent === "number") return nestedPercent;
  return null;
}
