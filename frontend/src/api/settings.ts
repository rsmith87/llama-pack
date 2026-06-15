import { apiGet, apiPost } from "./client";

export type ModelDiskInfo = {
  node_name: string;
  path: string;
  reachable: boolean;
  total_bytes: number;
  free_bytes: number;
  used_bytes: number;
  consumed_bytes: number;
  available_percent: number;
  used_percent: number;
  status: "ok" | "warning";
  warning?: string | null;
  error?: string | null;
  headroom_bytes: number;
  required_free_bytes: number;
};

export type NodeAuthInfo = {
  node_name: string;
  effective_url: string;
  effective_api_key_source: string;
  effective_api_key_present: boolean;
  configured_api_key_present: boolean;
  override_api_key_present: boolean;
  override_present: boolean;
  verify_tls: boolean;
};

export function generateApiKeys(payload: { prefix: string; token_bytes: number; count: number }) {
  return apiPost<{ keys?: string[]; count?: number; prefix?: string; token_bytes?: number }>("/settings/api-keys/generate", payload);
}

export function listModelDisks() {
  return apiGet<ModelDiskInfo[]>("/settings/disks");
}

export function listNodeAuth() {
  return apiGet<NodeAuthInfo[]>("/settings/node-auth");
}
