import { apiGet } from "./client";
import type { DashboardData, HealthResponse, LocalModel, NodeInventoryItem } from "../types/api";

function modelList(payload: unknown): LocalModel[] {
  if (Array.isArray(payload)) return payload as LocalModel[];
  const models = (payload as { models?: LocalModel[] } | null)?.models;
  return Array.isArray(models) ? models : [];
}

function nodeList(payload: unknown): NodeInventoryItem[] {
  if (Array.isArray(payload)) return payload as NodeInventoryItem[];
  const nodes = (payload as { nodes?: NodeInventoryItem[] } | null)?.nodes;
  return Array.isArray(nodes) ? nodes : [];
}

export function getHealth() {
  return apiGet<HealthResponse>("/health");
}

export function getControllerStatus() {
  return apiGet<{ reachable: boolean; error?: string; status_code?: number }>("/health/controller");
}

export async function loadDashboardData(): Promise<DashboardData> {
  const [health, localModelsPayload, nodesPayload] = await Promise.all([
    getHealth(),
    apiGet<unknown>("/models"),
    apiGet<unknown>("/nodes/models"),
  ]);

  return {
    health,
    localModels: modelList(localModelsPayload),
    nodes: nodeList(nodesPayload),
  };
}
