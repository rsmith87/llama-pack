import type { ToolLoopEvalCaseResult, ToolLoopEvalRunDetail } from "../../types";
import { analyzeToolLoopFailures, type ToolLoopFailureBucket } from "./failureAnalysis";

export type ToolLoopComparisonRun = {
  runId: string;
  label: string;
  model: string;
  target: string;
  status: string;
  averageScore: number;
  passRate: number;
  caseCount: number;
  passedCount: number;
  failedCaseCount: number;
};

export type ToolLoopComparisonCaseCell = {
  status: string;
  score: number;
  failedChecks: string[];
};

export type ToolLoopComparisonCaseRow = {
  caseId: string;
  cells: Record<string, ToolLoopComparisonCaseCell>;
};

export type ToolLoopComparison = {
  runs: ToolLoopComparisonRun[];
  caseRows: ToolLoopComparisonCaseRow[];
  bestRunId: string | null;
  scoreDelta: number;
  failedCheckDeltas: Record<string, string[]>;
  failureBucketDeltas: Record<string, ToolLoopFailureBucket[]>;
};

export function compareToolLoopRuns(runs: ToolLoopEvalRunDetail[]): ToolLoopComparison {
  const comparisonRuns = runs.map(toComparisonRun);
  const bestRun = comparisonRuns.toSorted((left, right) => right.averageScore - left.averageScore)[0] || null;
  const sortedScores = comparisonRuns.map((run) => run.averageScore).toSorted((left, right) => right - left);
  const runIds = comparisonRuns.map((run) => run.runId);
  return {
    runs: comparisonRuns,
    caseRows: caseRowsForRuns(runs, runIds),
    bestRunId: bestRun?.runId || null,
    scoreDelta: roundMetric((sortedScores[0] || 0) - (sortedScores[1] || 0)),
    failedCheckDeltas: Object.fromEntries(runs.map((run) => [runId(run), failedChecksForRun(run)])),
    failureBucketDeltas: Object.fromEntries(runs.map((run) => [runId(run), analyzeToolLoopFailures(run).buckets])),
  };
}

function toComparisonRun(run: ToolLoopEvalRunDetail): ToolLoopComparisonRun {
  const id = runId(run);
  const caseCount = Number(run.case_count ?? run.cases?.length ?? 0);
  const passedCount = Number(run.passed_count ?? run.cases?.filter((item) => item.status === "passed").length ?? 0);
  const failedCaseCount = Number(run.failed_count ?? run.cases?.filter((item) => item.status === "failed").length ?? 0);
  const target = String(run.target_node || run.target_selector || "-");
  const model = String(run.model || "-");
  return {
    runId: id,
    label: `${model} · ${target}`,
    model,
    target,
    status: String(run.status || "-"),
    averageScore: Number(run.average_score ?? averageCaseScore(run.cases || [])),
    passRate: caseCount > 0 ? roundMetric(passedCount / caseCount) : 0,
    caseCount,
    passedCount,
    failedCaseCount,
  };
}

function caseRowsForRuns(runs: ToolLoopEvalRunDetail[], runIds: string[]): ToolLoopComparisonCaseRow[] {
  const caseIds = Array.from(new Set(runs.flatMap((run) => (run.cases || []).map((item) => String(item.case_id || "unknown-case"))))).sort();
  return caseIds.map((caseId) => ({
    caseId,
    cells: Object.fromEntries(
      runs.map((run, index) => {
        const item = (run.cases || []).find((candidate) => candidate.case_id === caseId);
        return [runIds[index], item ? caseCell(item) : { status: "missing", score: 0, failedChecks: ["missing_case"] }];
      }),
    ),
  }));
}

function caseCell(item: ToolLoopEvalCaseResult): ToolLoopComparisonCaseCell {
  return {
    status: String(item.status || "-"),
    score: Number(item.score ?? 0),
    failedChecks: failedChecks(item),
  };
}

function failedChecksForRun(run: ToolLoopEvalRunDetail): string[] {
  return Array.from(new Set((run.cases || []).flatMap((item) => failedChecks(item)))).sort();
}

function failedChecks(item: ToolLoopEvalCaseResult): string[] {
  return Object.entries(item.checks || {})
    .filter(([, value]) => value === false)
    .map(([key]) => key)
    .sort();
}

function averageCaseScore(cases: ToolLoopEvalCaseResult[]): number {
  if (!cases.length) return 0;
  return roundMetric(cases.reduce((total, item) => total + Number(item.score || 0), 0) / cases.length);
}

function runId(run: ToolLoopEvalRunDetail): string {
  return String(run.id || `${run.model || "run"}-${run.generated_at || ""}` || "run");
}

function roundMetric(value: number): number {
  return Math.round(value * 10000) / 10000;
}
