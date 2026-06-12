import { apiGet, apiPost, apiStream } from "./client";
import { finalTraceStreamEvents, parseTraceStreamChunk } from "../features/toolLoopEvals/traceStream";
import type {
  TraceEvent,
  ToolLoopEvalLatest,
  ToolLoopEvalNodeRunRequest,
  ToolLoopEvalPresetsResponse,
  ToolLoopEvalRunDetail,
  ToolLoopEvalRunRequest,
  ToolLoopEvalRunsResponse,
  ToolLoopEvalSuite,
} from "../types/index";

export function getToolLoopEvalLatest() {
  return apiGet<ToolLoopEvalLatest>("/runtime/tool-loop-evals/latest");
}

export function getToolLoopEvalPresets() {
  return apiGet<ToolLoopEvalPresetsResponse>("/runtime/tool-loop-evals/presets");
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

async function streamToolLoopEvalSuite(
  path: string,
  payload: ToolLoopEvalRunRequest | ToolLoopEvalNodeRunRequest,
  onEvent: (event: TraceEvent) => void,
): Promise<ToolLoopEvalSuite & { persisted_run_id?: string }> {
  const reader = await apiStream(path, { method: "POST", body: payload });
  const decoder = new TextDecoder();
  let buffer = "";
  let suite: (ToolLoopEvalSuite & { persisted_run_id?: string }) | null = null;
  while (true) {
    const { done, value } = await reader.read();
    const chunk = decoder.decode(value || new Uint8Array(), { stream: !done });
    const parsed = parseTraceStreamChunk(chunk, buffer);
    buffer = parsed.buffer;
    for (const event of parsed.events) {
      onEvent(event);
      const maybeSuite = event.payload?.suite;
      if ((event.event_type === "run_completed" || event.event_type === "run_failed") && maybeSuite && typeof maybeSuite === "object") {
        suite = maybeSuite as ToolLoopEvalSuite & { persisted_run_id?: string };
      }
    }
    if (done) break;
  }
  for (const event of finalTraceStreamEvents(buffer)) {
    onEvent(event);
    const maybeSuite = event.payload?.suite;
    if ((event.event_type === "run_completed" || event.event_type === "run_failed") && maybeSuite && typeof maybeSuite === "object") {
      suite = maybeSuite as ToolLoopEvalSuite & { persisted_run_id?: string };
    }
  }
  if (!suite) throw new Error("Tool-loop eval stream ended without a final suite.");
  return suite;
}

export function streamToolLoopEvalRun(payload: ToolLoopEvalRunRequest, onEvent: (event: TraceEvent) => void) {
  return streamToolLoopEvalSuite("/runtime/tool-loop-evals/run/stream", payload, onEvent);
}

export function streamToolLoopEvalNodeRun(payload: ToolLoopEvalNodeRunRequest, onEvent: (event: TraceEvent) => void) {
  return streamToolLoopEvalSuite("/runtime/tool-loop-evals/node-run/stream", payload, onEvent);
}
