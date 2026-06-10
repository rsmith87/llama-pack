import { apiDelete, apiGet, apiPost } from "./client";
import type { DownloadRecommendationsResponse, DownloadsResponse, QuantDiscoveryResponse } from "../types/index";

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
export function cancelDownload(downloadId: string) { return apiPost<Record<string, unknown>>(`/downloads/${encodeURIComponent(downloadId)}/cancel`); }
export function deleteDownload(downloadId: string) { return apiDelete<Record<string, unknown>>(`/downloads/${encodeURIComponent(downloadId)}`); }
