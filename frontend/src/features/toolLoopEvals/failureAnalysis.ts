import type { ToolLoopEvalCaseResult, ToolLoopEvalRunDetail } from "../../types";

export type ToolLoopFailureBucketId =
  | "missing_tools"
  | "unexpected_tools"
  | "repeated_tools"
  | "tool_errors"
  | "missing_final_facts"
  | "max_iterations"
  | "artifact_failures"
  | "argument_mismatch";

export type ToolLoopFailureBucket = {
  id: ToolLoopFailureBucketId;
  label: string;
  count: number;
  caseIds: string[];
  description: string;
};

export type ToolLoopFailureSummary = {
  totalCaseCount: number;
  failedCaseCount: number;
  buckets: ToolLoopFailureBucket[];
  likelyCauses: string[];
};

const BUCKET_DEFINITIONS: Array<Omit<ToolLoopFailureBucket, "count" | "caseIds">> = [
  {
    id: "missing_tools",
    label: "Missing tools",
    description: "Required tools were not called.",
  },
  {
    id: "unexpected_tools",
    label: "Unexpected tools",
    description: "The model called tools outside the expected path.",
  },
  {
    id: "repeated_tools",
    label: "Repeated tools",
    description: "The model repeated tool calls beyond the preset allowance.",
  },
  {
    id: "tool_errors",
    label: "Tool errors",
    description: "Tool calls returned errors outside expected recovery paths.",
  },
  {
    id: "missing_final_facts",
    label: "Missing final facts",
    description: "The final answer omitted required facts or sections.",
  },
  {
    id: "max_iterations",
    label: "Max iterations",
    description: "The loop ended before a final assistant response.",
  },
  {
    id: "artifact_failures",
    label: "Artifact failures",
    description: "Expected generated artifacts or artifact content were missing.",
  },
  {
    id: "argument_mismatch",
    label: "Argument mismatch",
    description: "Required tool arguments were missing or incorrect.",
  },
];

export function analyzeToolLoopFailures(run: ToolLoopEvalRunDetail | null): ToolLoopFailureSummary {
  const cases = run?.cases || [];
  const failedCases = cases.filter((item) => item.status === "failed");
  const bucketCases = new Map<ToolLoopFailureBucketId, Set<string>>();
  for (const item of failedCases) {
    const caseId = item.case_id || "unknown-case";
    for (const bucketId of bucketIdsForCase(item)) {
      const caseIds = bucketCases.get(bucketId) || new Set<string>();
      caseIds.add(caseId);
      bucketCases.set(bucketId, caseIds);
    }
  }
  const buckets = BUCKET_DEFINITIONS.flatMap((definition) => {
    const caseIds = Array.from(bucketCases.get(definition.id) || []);
    if (!caseIds.length) return [];
    return [{ ...definition, count: caseIds.length, caseIds }];
  });
  return {
    totalCaseCount: cases.length || Number(run?.case_count || 0),
    failedCaseCount: failedCases.length || Number(run?.failed_count || 0),
    buckets,
    likelyCauses: likelyCausesForBuckets(buckets),
  };
}

function bucketIdsForCase(item: ToolLoopEvalCaseResult): ToolLoopFailureBucketId[] {
  const bucketIds: ToolLoopFailureBucketId[] = [];
  const checks = item.checks || {};
  if (item.missing_expected_tools?.length || checks.expected_tool_sequence === false) {
    bucketIds.push("missing_tools");
  }
  if (item.unexpected_tools?.length) {
    bucketIds.push("unexpected_tools");
  }
  if (checks.no_repeated_calls === false || hasRepeatedTools(item.observed_tool_sequence || [])) {
    bucketIds.push("repeated_tools");
  }
  if (checks.no_tool_errors === false || item.tool_results?.some((result) => result.ok === false)) {
    bucketIds.push("tool_errors");
  }
  if (checks.expected_final_substrings === false) {
    bucketIds.push("missing_final_facts");
  }
  if (String(item.error || "").includes("max_iterations")) {
    bucketIds.push("max_iterations");
  }
  if (hasArtifactFailure(item)) {
    bucketIds.push("artifact_failures");
  }
  if (checks.expected_tool_arguments === false) {
    bucketIds.push("argument_mismatch");
  }
  return bucketIds;
}

function hasRepeatedTools(sequence: string[]): boolean {
  const seen = new Set<string>();
  for (const toolName of sequence) {
    if (seen.has(toolName)) return true;
    seen.add(toolName);
  }
  return false;
}

function hasArtifactFailure(item: ToolLoopEvalCaseResult): boolean {
  const checks = item.checks || {};
  if (checks.expected_artifacts === false || checks.expected_artifact_substrings === false) return true;
  return Object.keys(item.diagnostics || {}).some((key) => key.toLowerCase().includes("artifact"));
}

function likelyCausesForBuckets(buckets: ToolLoopFailureBucket[]): string[] {
  const ids = new Set(buckets.map((bucket) => bucket.id));
  const causes: string[] = [];
  if (ids.has("repeated_tools") || ids.has("max_iterations")) {
    causes.push("Loop control: repeated calls or max-iteration exits.");
  }
  if (ids.has("missing_tools") || ids.has("unexpected_tools")) {
    causes.push("Tool selection: missing required tools or unrelated tool calls.");
  }
  if (ids.has("argument_mismatch")) {
    causes.push("Argument handling: required tool arguments were not preserved.");
  }
  if (ids.has("missing_final_facts") || ids.has("artifact_failures")) {
    causes.push("Synthesis: gathered evidence was not fully reflected in the final output.");
  }
  if (ids.has("tool_errors")) {
    causes.push("Runtime/tooling: tool calls failed or recovery behavior was incomplete.");
  }
  return causes;
}
