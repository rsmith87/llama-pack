export type BenchmarkRunStatus = "pending" | "running" | "completed" | "failed" | "partial";

export type BenchmarkDefinitionRecord = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  prompt_text: string;
  system_prompt?: string | null;
  request_defaults: Record<string, unknown>;
  sample_count: number;
  max_tokens: number;
  tags: string[];
  created_at: string;
  updated_at: string;
  archived: boolean;
};

export type BenchmarkAggregate = {
  ttft_ms_median?: number | null;
  ttft_ms_p95?: number | null;
  tokens_per_second_median?: number | null;
  tokens_per_second_p95?: number | null;
  total_duration_ms_median?: number | null;
  success_rate?: number | null;
  sample_count?: number | null;
};

export type BenchmarkRunSampleRecord = {
  id: string;
  run_id: string;
  sample_index: number;
  status: "success" | "failed";
  ttft_ms?: number | null;
  tokens_per_second?: number | null;
  total_duration_ms?: number | null;
  prompt_tokens?: number | null;
  completion_tokens?: number | null;
  completion_chars?: number | null;
  response_excerpt?: string | null;
  error_detail?: string | null;
  created_at: string;
};

export type BenchmarkRunRecord = {
  id: string;
  benchmark_definition_id: string;
  model: string;
  target_selector: string;
  target_node?: string | null;
  managed_load: boolean;
  restore_after: boolean;
  status: BenchmarkRunStatus;
  started_at?: string | null;
  finished_at?: string | null;
  error_detail?: string | null;
  aggregate?: BenchmarkAggregate | null;
  samples?: BenchmarkRunSampleRecord[];
};

export type BenchmarkDefinitionsResponse = { definitions: BenchmarkDefinitionRecord[] };
export type BenchmarkRunsResponse = { runs: BenchmarkRunRecord[] };
export type BenchmarkStartRunsResponse = { runs: BenchmarkRunRecord[] };
export type BenchmarkComparisonResponse = { definition_id: string; runs: BenchmarkRunRecord[] };
