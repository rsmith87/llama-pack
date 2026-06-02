import { apiGet, apiPost } from "./client";
import type {
  BenchmarkComparisonResponse,
  BenchmarkDefinitionRecord,
  BenchmarkDefinitionsResponse,
  BenchmarkRunRecord,
  BenchmarkRunsResponse,
  BenchmarkStartRunsResponse,
} from "../types/api";

export function listBenchmarkDefinitions(includeArchived = false) {
  const q = includeArchived ? "?include_archived=true" : "";
  return apiGet<BenchmarkDefinitionsResponse>(`/benchmarks/definitions${q}`);
}

export function createBenchmarkDefinition(payload: {
  name: string;
  slug?: string;
  description?: string;
  prompt_text: string;
  system_prompt?: string;
  request_defaults?: Record<string, unknown>;
  sample_count?: number;
  max_tokens?: number;
  tags?: string[];
}) {
  return apiPost<BenchmarkDefinitionRecord>("/benchmarks/definitions", payload);
}

export function listBenchmarkRuns(definitionId?: string, limit = 50) {
  const params = new URLSearchParams();
  if (definitionId) params.set("definition_id", definitionId);
  params.set("limit", String(limit));
  return apiGet<BenchmarkRunsResponse>(`/benchmarks/runs?${params}`);
}

export function getBenchmarkRun(runId: string) {
  return apiGet<BenchmarkRunRecord>(`/benchmarks/runs/${encodeURIComponent(runId)}`);
}

export function startBenchmarkRuns(payload: {
  definition_id: string;
  models: string[];
  target_selector?: string;
  target_node?: string;
  managed_load?: boolean;
  restore_after?: boolean;
}) {
  return apiPost<BenchmarkStartRunsResponse>("/benchmarks/runs", payload);
}

export function compareBenchmarkRuns(runIds: string[]) {
  return apiPost<BenchmarkComparisonResponse>("/benchmarks/runs/compare", { run_ids: runIds });
}
