export type { NodeRecord } from "../../types/nodes";
import type { NodeRecord } from "../../types/nodes";

export type NodeVisibilityDetails = {
  reachability: string;
  heartbeat: string;
  cert: string;
  placement: string;
  actionTarget: string;
  error: string;
};

export function nodeSearchText(node: NodeRecord) {
  return [node.name, node.url, node.agent_config_source, node.controller_config_source]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function filterNodes(nodes: NodeRecord[], { query = "", status = "", registration = "" }: { query?: string; status?: string; registration?: string } = {}) {
  const normalizedQuery = query.trim().toLowerCase();
  return nodes.filter((node) => {
    const okQuery = !normalizedQuery || nodeSearchText(node).includes(normalizedQuery);
    const okStatus = !status || (status === "reachable" ? Boolean(node.reachable) : !node.reachable);
    const okRegistration = !registration || node.registration === registration;
    return okQuery && okStatus && okRegistration;
  });
}

export function nodeSummary(nodes: NodeRecord[]) {
  const reachable = nodes.filter((node) => node.reachable).length;
  const models = nodes.reduce((sum, node) => sum + (Array.isArray(node.models) ? node.models.length : 0), 0);
  return { reachable, total: nodes.length, models };
}

export function nodeVisibilityDetails(node: NodeRecord): NodeVisibilityDetails {
  const name = String(node.name || "this node");
  const modelCount = Array.isArray(node.models) ? node.models.length : 0;
  const modelsSource = String(node.models_source || "").trim();

  return {
    reachability: node.reachable ? "Controller can reach this agent." : "Controller cannot reach this agent.",
    heartbeat: heartbeatText(node.heartbeat_fresh, node.heartbeat_age_seconds),
    cert: certText(node.cert_expires_in_seconds, node.url),
    placement: placementText(modelCount, modelsSource),
    actionTarget: node.reachable
      ? `Actions run on ${name} through the controller.`
      : `Actions are unavailable until ${name} is reachable.`,
    error: String(node.error || ""),
  };
}

function heartbeatText(fresh: boolean | undefined, ageSeconds: number | null | undefined): string {
  const prefix = fresh === false ? "Heartbeat stale" : "Heartbeat fresh";
  if (typeof ageSeconds !== "number" || Number.isNaN(ageSeconds)) return `${prefix}.`;
  return `${prefix}, ${durationText(ageSeconds)} old.`;
}

function certText(expiresInSeconds: number | null | undefined, url: string | undefined): string {
  if (!isHttpsUrl(url)) return "TLS is not configured for this node.";
  if (typeof expiresInSeconds !== "number" || Number.isNaN(expiresInSeconds)) return "TLS certificate status unknown.";
  if (expiresInSeconds <= 0) return "TLS certificate expired.";
  return `TLS certificate valid for ${durationText(expiresInSeconds)}.`;
}

function isHttpsUrl(url: string | undefined): boolean {
  if (!url) return true;
  return url.trim().toLowerCase().startsWith("https://");
}

function placementText(modelCount: number, modelsSource: string): string {
  if (modelCount === 0) return "No models reported.";
  const noun = modelCount === 1 ? "model" : "models";
  const source = modelsSource ? ` by ${modelsSource}` : "";
  return `${modelCount} ${noun} reported${source}.`;
}

function durationText(seconds: number): string {
  if (seconds < 60) return `${Math.max(0, Math.round(seconds))}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 120) return `${minutes}m`;
  const hours = Math.round(seconds / 3600);
  if (hours < 48) return `${hours}h`;
  return `${Math.round(seconds / 86400)}d`;
}

export function mergeNodeInventory(nodes: NodeRecord[], nodeModels: NodeRecord[]) {
  const byName = new Map<string, NodeRecord>();
  for (const node of Array.isArray(nodes) ? nodes : []) {
    if (node?.name) byName.set(node.name, { ...node, reachable: false, models: [] });
  }
  for (const node of Array.isArray(nodeModels) ? nodeModels : []) {
    if (!node?.name) continue;
    byName.set(node.name, { ...(byName.get(node.name) || {}), ...node });
  }
  return Array.from(byName.values()).sort((a, b) => String(a.name).localeCompare(String(b.name)));
}

export function suggestedGgufModelName(file: Record<string, unknown>) {
  return String(file?.name || file?.model_dir || "").trim();
}

export function suggestedPromptTemplate(file: Record<string, unknown>) {
  const text = [file?.name, file?.model_dir, file?.filename, file?.path]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (text.includes("gpt-oss")) return "gpt-oss";
  if (text.includes("llama-3") || text.includes("llama3")) return "llama3";
  if (text.includes("gemma")) return "gemma";
  if (text.includes("qwen")) return "qwen";
  if (text.includes("chatml")) return "chatml";
  return "";
}

export function sortModelsForDisplay<T extends { favorite?: boolean; name?: string }>(models: T[]) {
  return [...(Array.isArray(models) ? models : [])].sort((a, b) => {
    const favoriteDelta = Number(Boolean(b?.favorite)) - Number(Boolean(a?.favorite));
    if (favoriteDelta !== 0) return favoriteDelta;
    return String(a?.name || "").localeCompare(String(b?.name || ""));
  });
}

export function nodeEditFormDefaults(node: NodeRecord) {
  return {
    name: String(node?.name || ""),
    url: String(node?.url || ""),
    api_key: "",
    verify_tls: node?.verify_tls ?? true,
  };
}

export function nodeEditMarkup(node: NodeRecord, { compact }: { compact?: boolean } = {}) {
  if (compact) return "";
  return `<button class="primary node-edit-button" type="button" data-edit-node="${escapeAttribute(node?.name || "")}">Edit Node</button>`;
}

export function transferDestinationOptions(nodes: NodeRecord[], sourceName: string) {
  return (Array.isArray(nodes) ? nodes : [])
    .filter((node) => node?.name && node.name !== sourceName && Boolean(node.reachable))
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));
}

export function receivedBadgeText(file: Record<string, unknown>) {
  if (!file?.recently_received) return "";
  return file.received_from_node ? `Received from ${file.received_from_node}` : "Recently received";
}

function escapeAttribute(value: unknown) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
