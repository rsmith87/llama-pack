export type ToolLoopEvalCheckMap = {
  completed?: boolean;
  expected_tool_sequence?: boolean;
  expected_final_substrings?: boolean;
  no_tool_errors?: boolean;
  expected_tool_arguments?: boolean;
  no_repeated_calls?: boolean;
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

export type ToolLoopEvalNodeRunRequest = {
  node: string;
  model: string;
  case_ids?: string[];
};

export type ToolLoopEvalRunRequest = {
  model: string;
  case_ids?: string[];
};
