import { apiGet, apiPost } from "./client";
import type {
  ToolLoopEvalLatest,
  ToolLoopEvalNodeRunRequest,
  ToolLoopEvalRunDetail,
  ToolLoopEvalRunRequest,
  ToolLoopEvalRunsResponse,
  ToolLoopEvalSuite,
} from "../types/index";

export function getToolLoopEvalLatest() {
  return apiGet<ToolLoopEvalLatest>("/runtime/tool-loop-evals/latest");
}

export function listToolLoopEvalRuns(limit = 50) {
  return apiGet<ToolLoopEvalRunsResponse>(`/runtime/tool-loop-evals/runs?limit=${encodeURIComponent(String(limit))}`);
}

export function getToolLoopEvalRun(runId: string) {
  return apiGet<ToolLoopEvalRunDetail>(`/runtime/tool-loop-evals/runs/${encodeURIComponent(runId)}`);
}

export function startToolLoopEvalNodeRun(payload: ToolLoopEvalNodeRunRequest) {
  return apiPost<ToolLoopEvalSuite & { persisted_run_id?: string }>("/runtime/tool-loop-evals/node-run", payload);
}

export function startToolLoopEvalRun(payload: ToolLoopEvalRunRequest) {
  return apiPost<ToolLoopEvalSuite & { persisted_run_id?: string }>("/runtime/tool-loop-evals/run", payload);
}
