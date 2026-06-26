import { apiGet, apiPatch, apiPost } from "./client";

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
  status: "ok" | "warning" | "error";
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

export type JsonScalar = string | number | boolean | null;

export type RuntimeSettings = {
  controller_retention_days: number;
  controller_archive_retention_days: number;
  controller_archive_dir: string;
  routing_fanout_enabled: boolean;
  routing_fanout_max: number;
  agent_worker_enabled: boolean;
  agent_worker_poll_interval_seconds: number;
  agent_worker_max_jobs: number;
  agent_worker_labels: Record<string, JsonScalar>;
  agent_worker_capacity: Record<string, JsonScalar>;
  client_cors_origins: string[];
  context_summarization_enabled: boolean;
  context_summarization_trigger_ratio: number;
  context_summarization_target_ratio: number;
  context_summarization_recent_messages: number;
  context_summarization_max_tokens: number;
  thread_history_compaction_enabled: boolean;
  thread_history_context_ratio: number;
  thread_history_min_prompt_tokens: number;
  thread_history_recent_messages: number;
  thread_history_summary_max_chars: number;
  thread_history_summary_item_max_chars: number;
  agent_tools_enabled: boolean;
  agent_tools_max_iterations: number;
  agent_tools_tool_timeout_seconds: number;
  agent_tools_answer_verification_mode: "off" | "warn" | "strict";
  agent_tools_answer_verification_max_retries: number;
  agent_tools_safe_roots: string[];
};

export type RuntimeSettingsDocument = {
  settings: RuntimeSettings;
  sources: Record<keyof RuntimeSettings, "database" | "config" | "default">;
};

export type RuntimeSettingsPatch = Partial<RuntimeSettings>;

export type ToolCatalogSafety = {
  status: "ok" | "warning" | "error" | "not_applicable";
  message: string;
};

export type ToolCatalogItem = {
  name: string;
  type: string;
  description: string;
  summary: Record<string, unknown>;
  limits: Record<string, unknown>;
  parameters: Record<string, unknown>;
  safety: ToolCatalogSafety;
};

export type ToolCatalog = {
  enabled: boolean;
  safe_roots: string[];
  tool_count: number;
  tools: ToolCatalogItem[];
  definitions: Record<string, Record<string, unknown>>;
  profiles: Record<string, ToolProjectProfile>;
  active_profile: string | null;
  sources: Record<string, "database" | "config" | "default">;
};

export type ToolProjectProfile = {
  description?: string | null;
  safe_roots: string[];
  tools: string[];
};

export type ToolCatalogPatch = {
  tools?: Record<string, Record<string, unknown>>;
  profiles?: Record<string, ToolProjectProfile>;
  active_profile?: string | null;
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

export function getRuntimeSettings() {
  return apiGet<RuntimeSettingsDocument>("/settings/runtime");
}

export function patchRuntimeSettings(payload: RuntimeSettingsPatch) {
  return apiPatch<RuntimeSettingsDocument>("/settings/runtime", payload);
}

export function getToolCatalog() {
  return apiGet<ToolCatalog>("/settings/tool-catalog");
}

export function patchToolCatalog(payload: ToolCatalogPatch) {
  return apiPatch<ToolCatalog>("/settings/tool-catalog", payload);
}
