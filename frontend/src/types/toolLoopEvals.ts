export type ToolLoopEvalCheckMap = {
  completed?: boolean;
  expected_tool_sequence?: boolean;
  expected_final_substrings?: boolean;
  no_tool_errors?: boolean;
};

export type ToolLoopEvalCaseResult = {
  case_id?: string;
  model?: string;
  status?: string;
  score?: number;
  checks?: ToolLoopEvalCheckMap;
  error?: string;
  iteration_count?: number;
  tool_call_count?: number;
  observed_tool_sequence?: string[];
  expected_tool_sequence?: string[];
  tool_results?: Array<{ tool_name?: string; ok?: boolean; error?: string }>;
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
