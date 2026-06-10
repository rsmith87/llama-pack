import { apiGet, apiPost } from "./client";
import type { ExternalApiKey, ExternalApiKeyAnalytics, ExternalApiKeyCreated } from "../types/index";

export function listExternalKeys() {
  return apiGet<{ keys?: ExternalApiKey[] }>("/external-keys");
}

export function createExternalKey(payload: { site_name: string; site_url: string }) {
  return apiPost<ExternalApiKeyCreated>("/external-keys", payload);
}

export function revokeExternalKey(keyId: string) {
  return apiPost<{ ok: boolean }>(`/external-keys/${encodeURIComponent(keyId)}/revoke`);
}

export function getExternalKeyAnalytics(keyId: string) {
  return apiGet<ExternalApiKeyAnalytics>(`/external-keys/${encodeURIComponent(keyId)}/analytics`);
}
