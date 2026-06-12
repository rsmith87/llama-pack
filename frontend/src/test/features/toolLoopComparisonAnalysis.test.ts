import { describe, expect, it } from "vitest";
import { compareToolLoopRuns } from "../../features/toolLoopEvals/comparisonAnalysis";
import type { ToolLoopEvalRunDetail } from "../../types";

describe("compareToolLoopRuns", () => {
  it("builds run metrics and case rows across selected persisted runs", () => {
    const baseline: ToolLoopEvalRunDetail = {
      id: "run-a",
      model: "model-a",
      target_selector: "node:mac-mini",
      status: "failed",
      average_score: 0.5,
      case_count: 2,
      passed_count: 1,
      failed_count: 1,
      cases: [
        {
          case_id: "avoid-unneeded-tools",
          status: "passed",
          score: 1,
          checks: { completed: true },
        },
        {
          case_id: "argument-repair",
          status: "failed",
          score: 0,
          checks: {
            expected_tool_arguments: false,
            expected_tool_sequence: false,
          },
          missing_expected_tools: ["fetch_ticket"],
          observed_tool_sequence: ["read_status"],
        },
      ],
    };
    const challenger: ToolLoopEvalRunDetail = {
      id: "run-b",
      model: "model-b",
      target_selector: "node:linux-2080ti",
      status: "passed",
      average_score: 1,
      case_count: 2,
      passed_count: 2,
      failed_count: 0,
      cases: [
        {
          case_id: "avoid-unneeded-tools",
          status: "passed",
          score: 1,
          checks: { completed: true },
        },
        {
          case_id: "argument-repair",
          status: "passed",
          score: 1,
          checks: {
            expected_tool_arguments: true,
            expected_tool_sequence: true,
          },
        },
      ],
    };

    const comparison = compareToolLoopRuns([baseline, challenger]);

    expect(comparison.bestRunId).toBe("run-b");
    expect(comparison.scoreDelta).toBe(0.5);
    expect(comparison.runs.map((run) => ({
      runId: run.runId,
      label: run.label,
      score: run.averageScore,
      passRate: run.passRate,
      failedCases: run.failedCaseCount,
    }))).toEqual([
      {
        runId: "run-a",
        label: "model-a · node:mac-mini",
        score: 0.5,
        passRate: 0.5,
        failedCases: 1,
      },
      {
        runId: "run-b",
        label: "model-b · node:linux-2080ti",
        score: 1,
        passRate: 1,
        failedCases: 0,
      },
    ]);
    expect(comparison.caseRows).toEqual([
      {
        caseId: "argument-repair",
        cells: {
          "run-a": { status: "failed", score: 0, failedChecks: ["expected_tool_arguments", "expected_tool_sequence"] },
          "run-b": { status: "passed", score: 1, failedChecks: [] },
        },
      },
      {
        caseId: "avoid-unneeded-tools",
        cells: {
          "run-a": { status: "passed", score: 1, failedChecks: [] },
          "run-b": { status: "passed", score: 1, failedChecks: [] },
        },
      },
    ]);
    expect(comparison.failedCheckDeltas).toEqual({
      "run-a": ["expected_tool_arguments", "expected_tool_sequence"],
      "run-b": [],
    });
    expect(comparison.failureBucketDeltas["run-a"].map((bucket) => bucket.id)).toEqual([
      "missing_tools",
      "argument_mismatch",
    ]);
    expect(comparison.failureBucketDeltas["run-b"]).toEqual([]);
  });
});
