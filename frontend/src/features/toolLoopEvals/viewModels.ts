import type { LocalModel, ToolLoopEvalCaseResult, ToolLoopEvalPresetGroup, ToolLoopEvalRunDetail, ToolLoopEvalSuite, TraceEvent } from "../../types";
import { formatDateTime } from "../dateTime/dateTime";
import { isRunnableModelOption } from "../models";

export function scorePercent(score?: number): string {
  return `${Math.round((score ?? 0) * 100)}%`;
}

export function statusTone(status?: string): "success" | "warning" | "danger" | "muted" {
  if (status === "passed") return "success";
  if (status === "failed") return "danger";
  if (status === "partial") return "warning";
  return "muted";
}

export function sequenceText(sequence?: string[]): string {
  return sequence?.length ? sequence.join(" -> ") : "-";
}

export function formatDate(value: string | null | undefined, timeZone: string): string {
  return formatDateTime(value, timeZone).label;
}

export function checks(result?: ToolLoopEvalCaseResult): Array<[string, boolean]> {
  return Object.entries(result?.checks || {}).map(([key, value]) => [key, Boolean(value)]);
}

export function jsonBlock(value: unknown): string {
  return JSON.stringify(value ?? {}, null, 2);
}

export function hasDiagnostics(result: ToolLoopEvalCaseResult): boolean {
  return Boolean(
    result.missing_expected_tools?.length ||
      result.unexpected_tools?.length ||
      Object.keys(result.diagnostics || {}).length,
  );
}

export function timelineEntries(result: ToolLoopEvalCaseResult): Array<{
  index: number;
  toolName: string;
  ok: boolean;
  expected: boolean;
  repeated: boolean;
  call: Record<string, unknown>;
  toolResult: Record<string, unknown>;
  error: string;
}> {
  const expected = result.expected_tool_sequence || [];
  const seen = new Map<string, number>();
  const toolResults = result.tool_results || [];
  if (toolResults.length) {
    return toolResults.map((toolResult, index) => {
      const toolName = String(toolResult.tool_name || toolResult.function?.name || result.observed_tool_sequence?.[index] || "-");
      const count = (seen.get(toolName) || 0) + 1;
      seen.set(toolName, count);
      return {
        index,
        toolName,
        ok: toolResult.ok !== false,
        expected: expected.includes(toolName),
        repeated: count > 1,
        call: {
          tool_call_id: toolResult.tool_call_id || `step-${index + 1}`,
          type: "function",
          function: toolResult.function || {
            name: toolName,
            arguments: toolResult.raw_arguments || jsonBlock(toolResult.arguments || {}),
          },
        },
        toolResult: toolResult.result || {
          ok: toolResult.ok !== false,
          error: toolResult.error || "",
          arguments: toolResult.arguments || {},
        },
        error: String(toolResult.error || ""),
      };
    });
  }
  return (result.observed_tool_sequence || []).map((toolName, index) => {
    const count = (seen.get(toolName) || 0) + 1;
    seen.set(toolName, count);
    return {
      index,
      toolName,
      ok: true,
      expected: expected.includes(toolName),
      repeated: count > 1,
      call: {
        tool_call_id: `step-${index + 1}`,
        type: "function",
        function: { name: toolName, arguments: "{}" },
      },
      toolResult: { ok: true },
      error: "",
    };
  });
}

export function traceEventsForCase(result: ToolLoopEvalCaseResult, liveEvents: TraceEvent[]): TraceEvent[] {
  if (result.trace_events?.length) return result.trace_events;
  const caseId = result.case_id || "";
  return liveEvents.filter((event) => !caseId || event.case_id === caseId);
}

export function firstCase(suite: ToolLoopEvalSuite | null): ToolLoopEvalCaseResult | null {
  return suite?.cases?.[0] || null;
}

export function presetSummary(caseIds?: string[]): string {
  if (!caseIds?.length) return "-";
  if (caseIds.length === 1) return caseIds[0];
  return `${caseIds[0]} +${caseIds.length - 1}`;
}

export function presetGroupsWithAllOption(groups?: ToolLoopEvalPresetGroup[]): ToolLoopEvalPresetGroup[] {
  const validGroups = (groups || []).filter((group) => group.label && group.presets?.length);
  if (!validGroups.length) return [{ id: "all", label: "Presets", presets: [{ id: "all", label: "All presets" }] }];
  const [first, ...rest] = validGroups;
  return [
    {
      ...first,
      presets: [{ id: "all", label: "All presets" }, ...first.presets],
    },
    ...rest,
  ];
}

export function runTargetLabel(suite: ToolLoopEvalSuite | ToolLoopEvalRunDetail | null): string {
  if (!suite) return "";
  const run = suite as ToolLoopEvalRunDetail;
  return String(run.target_node || run.target_selector || "");
}

export function nodeModelName(model: LocalModel): string {
  return String(model.name || model.id || model.model || "");
}

export function asNodeArray(payload: unknown): Array<{ name?: string; reachable?: boolean; models?: unknown }> {
  if (Array.isArray(payload)) return payload as Array<{ name?: string; reachable?: boolean; models?: unknown }>;
  return (payload as { nodes?: Array<{ name?: string; reachable?: boolean; models?: unknown }> } | null)?.nodes || [];
}

export function asModelArray(value: unknown): LocalModel[] {
  if (Array.isArray(value)) return value as LocalModel[];
  const nested = (value as { models?: unknown } | null)?.models;
  return Array.isArray(nested) ? nested as LocalModel[] : [];
}

export function flattenNodeModels(payload: unknown): LocalModel[] {
  return asNodeArray(payload).flatMap((node) => {
    const nodeName = String(node.name || "");
    const models = asModelArray(node.models);
    if (!nodeName || node.reachable === false || !models.length) return [];
    return models.map((model) => ({ ...(model as LocalModel), node: nodeName }));
  }).filter((model) => nodeModelName(model));
}

export function runningNodeModelOptions(models: LocalModel[]): LocalModel[] {
  return models.filter((model) => nodeModelName(model) && isModelRunning(model) && isRunnableModelOption(model));
}

function isModelRunning(model: LocalModel): boolean {
  const status = String(model.status || "").toLowerCase();
  return !status || status === "running" || status === "loaded";
}
