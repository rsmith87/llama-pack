import { apiDelete, apiGet, apiPost } from "./client";
import type { DownloadRecommendationsResponse, DownloadRecord, QuantRecord } from "../types/index";

export type DownloadMutationResponse = Record<string, unknown>;

function isRecord(payload: unknown): payload is Record<string, unknown> {
  return typeof payload === "object" && payload !== null && !Array.isArray(payload);
}

function requireRecordResponse(endpoint: string, payload: unknown): Record<string, unknown> {
  if (!isRecord(payload)) {
    throw new TypeError(`${endpoint} response must be an object.`);
  }
  return payload;
}

function requireArrayResponse(endpoint: string, payload: unknown, fieldNames: string[]): unknown[] {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (isRecord(payload)) {
    for (const fieldName of fieldNames) {
      if (Array.isArray(payload[fieldName])) {
        return payload[fieldName];
      }
    }
  }
  const fields = fieldNames.join(" or ");
  throw new TypeError(`${endpoint} response must be an array or include a ${fields} array.`);
}

function requireObjectArray(endpoint: string, payload: unknown, fieldNames: string[], itemName: string): Record<string, unknown>[] {
  const values = requireArrayResponse(endpoint, payload, fieldNames);
  const invalidIndex = values.findIndex((value) => !isRecord(value));
  if (invalidIndex !== -1) {
    throw new TypeError(`${endpoint} ${itemName}[${invalidIndex}] must be an object.`);
  }
  return values.map((value) => value as Record<string, unknown>);
}

function parseDownloadHistory(payload: unknown): DownloadRecord[] {
  return requireObjectArray("/downloads/history", payload, ["downloads"], "downloads") as DownloadRecord[];
}

function parseQuantDiscovery(payload: unknown): QuantRecord[] {
  return requireObjectArray("/downloads/quants", payload, ["files", "quants"], "files") as QuantRecord[];
}

export function listDownloadHistory(limit = 200): Promise<DownloadRecord[]> {
  return apiGet<unknown>(`/downloads/history?limit=${limit}`).then(parseDownloadHistory);
}

export function discoverQuants(repoId: string, revision = ""): Promise<QuantRecord[]> {
  const params = new URLSearchParams({ repo_id: repoId });
  if (revision) params.set("revision", revision);
  return apiGet<unknown>(`/downloads/quants?${params.toString()}`).then(parseQuantDiscovery);
}

export function listDownloadRecommendations(): Promise<DownloadRecommendationsResponse> {
  return apiGet<unknown>("/downloads/recommendations")
    .then((payload) => requireRecordResponse("/downloads/recommendations", payload) as DownloadRecommendationsResponse);
}

export function startDownload(repoId: string, payload: Record<string, unknown>): Promise<DownloadMutationResponse> {
  const path = `/downloads/${repoId}/start`;
  return apiPost<unknown>(path, payload).then((response) => requireRecordResponse(path, response));
}

export function cancelDownload(downloadId: string): Promise<DownloadMutationResponse> {
  const path = `/downloads/${encodeURIComponent(downloadId)}/cancel`;
  return apiPost<unknown>(path).then((payload) => requireRecordResponse(path, payload));
}

export function deleteDownload(downloadId: string): Promise<DownloadMutationResponse> {
  const path = `/downloads/${encodeURIComponent(downloadId)}`;
  return apiDelete<unknown>(path).then((payload) => requireRecordResponse(path, payload));
}
