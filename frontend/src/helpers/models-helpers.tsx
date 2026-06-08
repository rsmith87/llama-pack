import { LocalModel, DashboardData, NodeRecord } from "../types";
import { TIMERS } from "../constants";

type CertTone = "success" | "warning" | "danger" | "muted";

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
