import { describe, expect, it } from "vitest";
import { analyzeToolLoopFailures } from "../../features/toolLoopEvals/failureAnalysis";
import type { ToolLoopEvalRunDetail } from "../../types";

describe("analyzeToolLoopFailures", () => {
  it("groups failed cases into stable failure buckets", () => {
    const run: ToolLoopEvalRunDetail = {
      id: "run-failures",
      model: "gpt-oss-20b",
      status: "failed",
      case_count: 3,
      passed_count: 1,
      failed_count: 2,
      cases: [
        {
          case_id: "argument-repair",
          status: "failed",
          checks: {
            completed: true,
            expected_tool_sequence: false,
            expected_final_substrings: false,
            expected_tool_arguments: false,
            no_tool_errors: false,
          },
          missing_expected_tools: ["fetch_ticket"],
          unexpected_tools: ["read_status"],
          observed_tool_sequence: ["read_status", "read_status"],
          tool_results: [
            {
              tool_name: "read_status",
              ok: false,
              error: "wrong tool",
            },
          ],
          final_answer: "",
        },
        {
          case_id: "live-collaborative-notes-design",
          status: "failed",
          error: "live tool loop reached max_iterations before final assistant response",
          checks: {
            completed: false,
            expected_artifacts: false,
            expected_artifact_substrings: false,
            no_repeated_calls: false,
          },
          diagnostics: {
            missing_artifact_substrings: { "docs/notes-app-design.md": ["registration"] },
          },
          observed_tool_sequence: ["read_workspace_file", "read_workspace_file"],
        },
        {
          case_id: "avoid-unneeded-tools",
          status: "passed",
          checks: { completed: true },
        },
      ],
    };

    const summary = analyzeToolLoopFailures(run);

    expect(summary.failedCaseCount).toBe(2);
    expect(summary.totalCaseCount).toBe(3);
    expect(summary.buckets.map((bucket) => [bucket.id, bucket.count])).toEqual([
      ["missing_tools", 1],
      ["unexpected_tools", 1],
      ["repeated_tools", 2],
      ["tool_errors", 1],
      ["missing_final_facts", 1],
      ["max_iterations", 1],
      ["artifact_failures", 1],
      ["argument_mismatch", 1],
    ]);
    expect(summary.buckets.find((bucket) => bucket.id === "repeated_tools")?.caseIds).toEqual([
      "argument-repair",
      "live-collaborative-notes-design",
    ]);
    expect(summary.likelyCauses).toContain("Loop control: repeated calls or max-iteration exits.");
    expect(summary.likelyCauses).toContain("Tool selection: missing required tools or unrelated tool calls.");
  });

  it("returns an empty summary when the run has no failed cases", () => {
    const summary = analyzeToolLoopFailures({
      status: "passed",
      case_count: 1,
      passed_count: 1,
      failed_count: 0,
      cases: [{ case_id: "avoid-unneeded-tools", status: "passed" }],
    });

    expect(summary.failedCaseCount).toBe(0);
    expect(summary.buckets).toEqual([]);
    expect(summary.likelyCauses).toEqual([]);
  });
});
