import { apiGet } from "./client";
import type { ToolLoopEvalLatest, ToolLoopEvalRunDetail, ToolLoopEvalRunsResponse } from "../types/index";

export function getToolLoopEvalLatest() {
  return apiGet<ToolLoopEvalLatest>("/runtime/tool-loop-evals/latest");
}

export function listToolLoopEvalRuns(limit = 50) {
  return apiGet<ToolLoopEvalRunsResponse>(`/runtime/tool-loop-evals/runs?limit=${encodeURIComponent(String(limit))}`);
}

export function getToolLoopEvalRun(runId: string) {
  return apiGet<ToolLoopEvalRunDetail>(`/runtime/tool-loop-evals/runs/${encodeURIComponent(runId)}`);
}
