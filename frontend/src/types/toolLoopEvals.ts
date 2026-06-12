export type ToolLoopEvalCheckMap = {
  completed?: boolean;
  expected_tool_sequence?: boolean;
  expected_final_substrings?: boolean;
  no_tool_errors?: boolean;
  expected_tool_arguments?: boolean;
  no_repeated_calls?: boolean;
  expected_artifacts?: boolean;
  expected_artifact_substrings?: boolean;
  no_forbidden_artifact_substrings?: boolean;
};

export type TraceEvent = {
  id?: string;
  trace_id?: string;
  sequence?: number;
  timestamp?: string;
  event_type?: string;
  source?: string;
  scope?: string;
  status?: string;
  case_id?: string;
  tool_call_id?: string;
  model?: string;
  title?: string;
  summary?: string;
  payload?: Record<string, unknown>;
};

export type ToolLoopEvalCaseResult = {
  case_id?: string;
  case_category?: string;
  model?: string;
  status?: string;
  score?: number;
  checks?: ToolLoopEvalCheckMap;
  error?: string;
  iteration_count?: number;
  tool_call_count?: number;
  observed_tool_sequence?: string[];
  expected_tool_sequence?: string[];
  missing_expected_tools?: string[];
  unexpected_tools?: string[];
  scoring_mode?: string | null;
  tool_results?: Array<{
    tool_call_id?: string;
    tool_name?: string;
    function?: { name?: string; arguments?: string };
    raw_arguments?: string;
    ok?: boolean;
    error?: string;
    expected_error?: boolean;
    arguments?: Record<string, unknown>;
    result?: Record<string, unknown>;
  }>;
  trace_events?: TraceEvent[];
  diagnostics?: Record<string, unknown>;
  final_answer?: string;
};

export type ToolLoopEvalSuite = {
  model?: string;
  status?: string;
  case_count?: number;
  passed_count?: number;
  failed_count?: number;
  average_score?: number;
  cases?: ToolLoopEvalCaseResult[];
};

export type ToolLoopEvalLatest = {
  available?: boolean;
  path?: string;
  generated_at?: string | null;
  suite_count?: number;
  models?: string[];
  suites?: ToolLoopEvalSuite[];
  error?: string;
};

export type ToolLoopEvalRunSummary = {
  id?: string;
  generated_at?: string | null;
  model?: string;
  target_selector?: string;
  target_node?: string | null;
  status?: string;
  average_score?: number;
  case_count?: number;
  passed_count?: number;
  failed_count?: number;
  error?: string | null;
  created_at?: string;
};

export type ToolLoopEvalRunDetail = ToolLoopEvalRunSummary & {
  cases?: ToolLoopEvalCaseResult[];
};

export type ToolLoopEvalRunsResponse = {
  runs?: ToolLoopEvalRunSummary[];
};

export type ToolLoopEvalPreset = {
  id: string;
  label: string;
  category?: string;
  scoring_mode?: string | null;
  expected_tool_count?: number;
  max_iterations?: number | null;
};

export type ToolLoopEvalPresetGroup = {
  id: string;
  label: string;
  presets: ToolLoopEvalPreset[];
};

export type ToolLoopEvalPresetsResponse = {
  groups?: ToolLoopEvalPresetGroup[];
  preset_count?: number;
};

export type ToolLoopEvalNodeRunRequest = {
  node: string;
  model: string;
  case_ids?: string[];
};

export type ToolLoopEvalRunRequest = {
  model: string;
  case_ids?: string[];
};
