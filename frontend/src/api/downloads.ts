import { apiDelete, apiGet, apiPost, apiStream } from "./client";
import type { DownloadRecommendationsResponse, DownloadsResponse, QuantDiscoveryResponse } from "../types/api";

export function listDownloadModels() { return apiGet<Record<string, unknown>>("/downloads/models"); }
export function listDownloadHistory(limit = 200) { return apiGet<DownloadsResponse>(`/downloads/history?limit=${limit}`); }
export function discoverQuants(repoId: string, revision = "") {
  const params = new URLSearchParams({ repo_id: repoId });
  if (revision) params.set("revision", revision);
  return apiGet<QuantDiscoveryResponse>(`/downloads/quants?${params.toString()}`);
}
export function listDownloadRecommendations() {
  return apiGet<DownloadRecommendationsResponse>("/downloads/recommendations");
}
export function startDownload(repoId: string, payload: Record<string, unknown>) { return apiPost<Record<string, unknown>>(`/downloads/${repoId}/start`, payload); }
export function getDownload(downloadId: string) { return apiGet<Record<string, unknown>>(`/downloads/${encodeURIComponent(downloadId)}`); }
export function streamDownloadLogs(downloadId: string) { return apiStream(`/downloads/${encodeURIComponent(downloadId)}/logs/stream`); }
export function cancelDownload(downloadId: string) { return apiPost<Record<string, unknown>>(`/downloads/${encodeURIComponent(downloadId)}/cancel`); }
export function deleteDownload(downloadId: string) { return apiDelete<Record<string, unknown>>(`/downloads/${encodeURIComponent(downloadId)}`); }
