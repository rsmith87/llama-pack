import { apiGet } from "./client";
import type { DashboardData, HealthResponse, LocalModel, NodeInventoryItem } from "../types/index";
import { getNodeModels } from "./nodes";

export type ControllerStatusResponse = {
  reachable: boolean;
  error?: string;
  status_code?: number;
};

let healthRequest: Promise<HealthResponse> | null = null;

function isRecord(payload: unknown): payload is Record<string, unknown> {
  return typeof payload === "object" && payload !== null && !Array.isArray(payload);
}

function requireRecord(payload: unknown, endpoint: string): Record<string, unknown> {
  if (!isRecord(payload)) {
    throw new TypeError(`${endpoint} response must be an object.`);
  }
  return payload;
}

function requireArrayResponse(endpoint: string, payload: unknown, fieldName: string): unknown[] {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (isRecord(payload) && Array.isArray(payload[fieldName])) {
    return payload[fieldName];
  }
  throw new TypeError(`${endpoint} response must be an array or include a ${fieldName} array.`);
}

function requireObjectArray(endpoint: string, payload: unknown, fieldName: string): Record<string, unknown>[] {
  const values = requireArrayResponse(endpoint, payload, fieldName);
  const invalidIndex = values.findIndex((value) => !isRecord(value));
  if (invalidIndex !== -1) {
    throw new TypeError(`${endpoint} ${fieldName}[${invalidIndex}] must be an object.`);
  }
  return values.map((value) => value as Record<string, unknown>);
}

function parseHealthResponse(payload: unknown): HealthResponse {
  return requireRecord(payload, "/health") as HealthResponse;
}

function parseModelList(payload: unknown): LocalModel[] {
  return requireObjectArray("/models", payload, "models") as LocalModel[];
}

function parseControllerStatus(payload: unknown): ControllerStatusResponse {
  const record = requireRecord(payload, "/health/controller");
  if (typeof record.reachable !== "boolean") {
    throw new TypeError("/health/controller response must include a reachable boolean.");
  }
  if (record.error !== undefined && typeof record.error !== "string") {
    throw new TypeError("/health/controller error must be a string when present.");
  }
  if (record.status_code !== undefined && typeof record.status_code !== "number") {
    throw new TypeError("/health/controller status_code must be a number when present.");
  }
  return record as ControllerStatusResponse;
}

export function getHealth(): Promise<HealthResponse> {
  if (healthRequest) {
    return healthRequest;
  }
  healthRequest = apiGet<unknown>("/health")
    .then(parseHealthResponse)
    .finally(() => {
      healthRequest = null;
    });
  return healthRequest;
}

export function getControllerStatus(): Promise<ControllerStatusResponse> {
  return apiGet<unknown>("/health/controller").then(parseControllerStatus);
}

export async function loadDashboardData(): Promise<DashboardData> {
  const [health, localModelsPayload, nodes] = await Promise.all([
    getHealth(),
    apiGet<unknown>("/models"),
    getNodeModels(),
  ]);

  return {
    health: parseHealthResponse(health),
    localModels: parseModelList(localModelsPayload),
    nodes: nodes as NodeInventoryItem[],
  };
}
