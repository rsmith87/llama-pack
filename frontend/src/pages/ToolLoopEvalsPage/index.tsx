import "./styles.css";
import { useEffect, useMemo, useState } from "react";
import { listModels } from "../../api/models";
import { getNodeModels } from "../../api/nodes";
import {
  getToolLoopEvalLatest,
  getToolLoopEvalPresets,
  getToolLoopEvalRun,
  listToolLoopEvalRuns,
  streamToolLoopEvalNodeRun,
  streamToolLoopEvalRun,
} from "../../api/toolLoopEvals";
import { DataTable, ErrorBanner, Panel, StatusBadge, Button, FormField } from "../../components/ui";
import { useAppMode } from "../../features/appMode/appModeContext";
import { compareToolLoopRuns, type ToolLoopComparison } from "../../features/toolLoopEvals/comparisonAnalysis";
import { analyzeToolLoopFailures } from "../../features/toolLoopEvals/failureAnalysis";
import { useAsyncResource } from "../../hooks/useAsyncResource";
import type {
  LocalModel,
  ToolLoopEvalCaseResult,
  ToolLoopEvalLatest,
  ToolLoopEvalPresetGroup,
  ToolLoopEvalPresetsResponse,
  ToolLoopEvalRunDetail,
  ToolLoopEvalRunSummary,
  ToolLoopEvalRunsResponse,
  ToolLoopEvalSuite,
  TraceEvent,
} from "../../types/index";

function scorePercent(score?: number): string {
  return `${Math.round((score ?? 0) * 100)}%`;
}

function statusTone(status?: string): "success" | "warning" | "danger" | "muted" {
  if (status === "passed") return "success";
  if (status === "failed") return "danger";
  if (status === "partial") return "warning";
  return "muted";
}

function sequenceText(sequence?: string[]): string {
  return sequence?.length ? sequence.join(" -> ") : "-";
}

function formatDate(value?: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function checks(result?: ToolLoopEvalCaseResult): Array<[string, boolean]> {
  return Object.entries(result?.checks || {}).map(([key, value]) => [key, Boolean(value)]);
}

function jsonBlock(value: unknown): string {
  return JSON.stringify(value ?? {}, null, 2);
}

function hasDiagnostics(result: ToolLoopEvalCaseResult): boolean {
  return Boolean(
    result.missing_expected_tools?.length ||
      result.unexpected_tools?.length ||
      Object.keys(result.diagnostics || {}).length,
  );
}

function timelineEntries(result: ToolLoopEvalCaseResult): Array<{
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

function traceEventsForCase(result: ToolLoopEvalCaseResult, liveEvents: TraceEvent[]): TraceEvent[] {
  if (result.trace_events?.length) return result.trace_events;
  const caseId = result.case_id || "";
  return liveEvents.filter((event) => !caseId || event.case_id === caseId);
}

function firstCase(suite: ToolLoopEvalSuite | null): ToolLoopEvalCaseResult | null {
  return suite?.cases?.[0] || null;
}

function presetGroupsWithAllOption(groups?: ToolLoopEvalPresetGroup[]): ToolLoopEvalPresetGroup[] {
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

function runTargetLabel(suite: ToolLoopEvalSuite | ToolLoopEvalRunDetail | null): string {
  if (!suite) return "";
  const run = suite as ToolLoopEvalRunDetail;
  return String(run.target_node || run.target_selector || "");
}

function nodeModelName(model: LocalModel): string {
  return String(model.name || model.id || model.model || "");
}

function asNodeArray(payload: unknown): Array<{ name?: string; reachable?: boolean; models?: unknown }> {
  if (Array.isArray(payload)) return payload as Array<{ name?: string; reachable?: boolean; models?: unknown }>;
  return (payload as { nodes?: Array<{ name?: string; reachable?: boolean; models?: unknown }> } | null)?.nodes || [];
}

function asModelArray(value: unknown): LocalModel[] {
  if (Array.isArray(value)) return value as LocalModel[];
  const nested = (value as { models?: unknown } | null)?.models;
  return Array.isArray(nested) ? nested as LocalModel[] : [];
}

function flattenNodeModels(payload: unknown): LocalModel[] {
  return asNodeArray(payload).flatMap((node) => {
    const nodeName = String(node.name || "");
    const models = asModelArray(node.models);
    if (!nodeName || node.reachable === false || !models.length) return [];
    return models.map((model) => ({ ...(model as LocalModel), node: nodeName }));
  }).filter((model) => nodeModelName(model));
}

export function ToolLoopEvalsPage() {
  const appMode = useAppMode();
  const isLocalMode = appMode === "agent";
  const isControllerMode = appMode === "controller";
  const { data, loading, error, refresh } = useAsyncResource<ToolLoopEvalLatest | null>(
    () => getToolLoopEvalLatest(),
    null,
  );
  const {
    data: historyData,
    loading: historyLoading,
    error: historyError,
    refresh: refreshHistory,
  } = useAsyncResource<ToolLoopEvalRunsResponse>(
    () => listToolLoopEvalRuns(50),
    { runs: [] },
  );
  const {
    data: presetData,
    error: presetError,
  } = useAsyncResource<ToolLoopEvalPresetsResponse>(
    () => getToolLoopEvalPresets(),
    { groups: [] },
  );
  const {
    data: nodeModels,
    loading: nodesLoading,
    error: nodesError,
  } = useAsyncResource<LocalModel[]>(
    async () => {
      if (isLocalMode) return asModelArray(await listModels());
      if (isControllerMode) return flattenNodeModels(await getNodeModels());
      return [];
    },
    [],
    [isControllerMode, isLocalMode],
  );
  const suites = data?.suites || [];
  const historyRuns = historyData.runs || [];
  const presetGroups = useMemo(() => presetGroupsWithAllOption(presetData.groups), [presetData.groups]);
  const [selectedModel, setSelectedModel] = useState("");
  const [selectedCaseId, setSelectedCaseId] = useState("");
  const [selectedRun, setSelectedRun] = useState<ToolLoopEvalRunDetail | null>(null);
  const [runLoading, setRunLoading] = useState(false);
  const [runError, setRunError] = useState("");
  const [runNode, setRunNode] = useState("");
  const [runModel, setRunModel] = useState("");
  const [runPreset, setRunPreset] = useState("all");
  const [submitMessage, setSubmitMessage] = useState("");
  const [comparisonRunIds, setComparisonRunIds] = useState<string[]>([]);
  const [comparisonRuns, setComparisonRuns] = useState<ToolLoopEvalRunDetail[]>([]);
  const [comparisonLoading, setComparisonLoading] = useState(false);
  const [comparisonError, setComparisonError] = useState("");
  const [liveTraceEvents, setLiveTraceEvents] = useState<TraceEvent[]>([]);
  const [replayToken, setReplayToken] = useState(0);

  const nodeOptions = useMemo(
    () => isControllerMode ? Array.from(new Set(nodeModels.map((model) => String(model.node || model.node_name || "")).filter(Boolean))) : [],
    [isControllerMode, nodeModels],
  );
  const modelOptions = useMemo(
    () => isLocalMode ? nodeModels : nodeModels.filter((model) => !runNode || model.node === runNode || model.node_name === runNode),
    [isLocalMode, nodeModels, runNode],
  );

  useEffect(() => {
    if (!runNode && nodeOptions.length) setRunNode(nodeOptions[0]);
    if (isLocalMode && runNode) setRunNode("");
  }, [isLocalMode, nodeOptions, runNode]);

  useEffect(() => {
    setRunModel(modelOptions.length ? nodeModelName(modelOptions[0]) : "");
  }, [modelOptions]);

  const activeSuite = useMemo(() => {
    if (selectedRun) return selectedRun;
    if (!suites.length) return null;
    return suites.find((suite) => suite.model === selectedModel) || suites[0];
  }, [selectedModel, selectedRun, suites]);

  const activeCase = useMemo(() => {
    if (!activeSuite) return null;
    return activeSuite.cases?.find((item) => item.case_id === selectedCaseId) || firstCase(activeSuite);
  }, [activeSuite, selectedCaseId]);
  const failureSummary = useMemo(() => analyzeToolLoopFailures(activeSuite as ToolLoopEvalRunDetail | null), [activeSuite]);
  const comparison = useMemo(() => comparisonRuns.length >= 2 ? compareToolLoopRuns(comparisonRuns) : null, [comparisonRuns]);

  async function refreshAll() {
    setRunError("");
    await Promise.all([refresh(), refreshHistory()]);
  }

  async function loadRun(row: ToolLoopEvalRunSummary) {
    if (!row.id) return;
    setRunLoading(true);
    setRunError("");
    try {
      const detail = await getToolLoopEvalRun(row.id);
      setSelectedRun(detail);
      setSelectedModel(String(detail.model || row.model || ""));
      setSelectedCaseId("");
    } catch (err) {
      setRunError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setRunLoading(false);
    }
  }

  function toggleComparisonRun(row: ToolLoopEvalRunSummary, checked: boolean) {
    const id = String(row.id || "");
    if (!id) return;
    setComparisonRuns([]);
    setComparisonError("");
    setComparisonRunIds((current) => {
      if (!checked) return current.filter((item) => item !== id);
      if (current.includes(id)) return current;
      return [...current, id].slice(-3);
    });
  }

  async function compareSelectedRuns() {
    if (comparisonRunIds.length < 2) {
      setComparisonError("Select at least two runs to compare.");
      return;
    }
    setComparisonLoading(true);
    setComparisonError("");
    try {
      const details = await Promise.all(comparisonRunIds.map((runId) => getToolLoopEvalRun(runId)));
      setComparisonRuns(details);
    } catch (err) {
      setComparisonError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setComparisonLoading(false);
    }
  }

  async function submitRun(event: React.FormEvent) {
    event.preventDefault();
    const node = runNode.trim();
    const model = runModel.trim();
    if (!model) {
      setRunError("Model is required to run tool-loop evals.");
      return;
    }
    if (!isLocalMode && !node) {
      setRunError("Node and model are required to run tool-loop evals.");
      return;
    }
    setRunLoading(true);
    setRunError("");
    setSubmitMessage("");
    try {
      const payload = {
        model,
        ...(runPreset === "all" ? {} : { case_ids: [runPreset] }),
      };
      setLiveTraceEvents([]);
      setReplayToken((value) => value + 1);
      const suite = isLocalMode
        ? await streamToolLoopEvalRun(payload, (event) => setLiveTraceEvents((current) => [...current, event]))
        : await streamToolLoopEvalNodeRun({ node, ...payload }, (event) => setLiveTraceEvents((current) => [...current, event]));
      setSelectedRun({
        id: suite.persisted_run_id,
        generated_at: new Date().toISOString(),
        model: suite.model,
        target_selector: isLocalMode ? "local" : `node:${node}`,
        target_node: isLocalMode ? null : node,
        status: suite.status,
        average_score: suite.average_score,
        case_count: suite.case_count,
        passed_count: suite.passed_count,
        failed_count: suite.failed_count,
        cases: suite.cases,
      });
      setSelectedModel(String(suite.model || model));
      setSelectedCaseId("");
      setSubmitMessage("Tool-loop eval run completed.");
      await Promise.all([refreshHistory(), refresh()]);
    } catch (err) {
      setRunError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setRunLoading(false);
    }
  }

  return (
    <div className="tool-loop-evals-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">Runtime</span>
          <h2>Tool Loop Evals</h2>
        </div>
        <Button type="button" onClick={() => void refreshAll()} disabled={loading || historyLoading || runLoading || comparisonLoading}>
          {loading || historyLoading || runLoading || comparisonLoading ? "Refreshing..." : "Refresh"}
        </Button>
      </div>
      <ErrorBanner message={error || historyError || presetError || nodesError || runError || comparisonError || data?.error || ""} />

      <Panel title="Run Tool-Loop Eval" eyebrow={isLocalMode ? "Local instance run" : isControllerMode ? "Controller-triggered node run" : "Runtime mode loading"}>
        <form className="tool-loop-run-form stacked-controls" onSubmit={(event) => void submitRun(event)}>
          {isControllerMode ? (
            <FormField label="Node">
              <select value={runNode} onChange={(event) => setRunNode(event.target.value)} disabled={nodesLoading || runLoading}>
                {nodeOptions.length ? nodeOptions.map((node) => <option key={node} value={node}>{node}</option>) : <option value="">No reachable nodes</option>}
              </select>
            </FormField>
          ) : null}
          <FormField label="Model">
            <input
              list="tool-loop-model-options"
              value={runModel}
              onChange={(event) => setRunModel(event.target.value)}
              placeholder="gpt-oss-20b"
              disabled={runLoading}
            />
            <datalist id="tool-loop-model-options">
              {modelOptions.map((model) => {
                const name = nodeModelName(model);
                return <option key={`${model.node || model.node_name || "local"}-${name}`} value={name} />;
              })}
            </datalist>
          </FormField>
          <FormField label="Preset">
            <select value={runPreset} onChange={(event) => setRunPreset(event.target.value)} disabled={runLoading}>
              {presetGroups.map((group) => (
                <optgroup key={group.id || group.label} label={group.label}>
                  {group.presets.map((preset) => <option key={preset.id} value={preset.id}>{preset.label}</option>)}
                </optgroup>
              ))}
            </select>
          </FormField>
          <div className="tool-loop-run-actions">
            <Button type="submit" variant="primary" disabled={runLoading || !runModel || (!isLocalMode && !isControllerMode) || (isControllerMode && !runNode)}>
              {runLoading ? "Running..." : "Run Eval"}
            </Button>
            {submitMessage ? <span className="muted">{submitMessage}</span> : null}
          </div>
        </form>
      </Panel>

      <Panel title="Run History" eyebrow="Persisted benchmark DB results">
        <DataTable
          rows={historyRuns}
          emptyMessage="No persisted tool-loop eval runs yet."
          getRowKey={(row, index) => String(row.id || index)}
          columns={[
            {
              key: "compare",
              header: "Compare",
              render: (row) => {
                const id = String(row.id || "");
                return (
                  <input
                    type="checkbox"
                    aria-label={`Compare ${row.model || id || "run"}`}
                    checked={Boolean(id && comparisonRunIds.includes(id))}
                    disabled={!id || comparisonLoading}
                    onChange={(event) => toggleComparisonRun(row, event.target.checked)}
                  />
                );
              },
            },
            { key: "generated", header: "Generated", render: (row) => formatDate(row.generated_at) },
            { key: "model", header: "Model", render: (row) => String(row.model || "-") },
            { key: "target", header: "Target", render: (row) => String(row.target_node || row.target_selector || "-") },
            { key: "status", header: "Status", render: (row) => <StatusBadge tone={statusTone(row.status)}>{row.status || "-"}</StatusBadge> },
            { key: "score", header: "Score", render: (row) => scorePercent(row.average_score) },
            { key: "passed", header: "Passed", render: (row) => `${row.passed_count ?? 0} / ${row.case_count ?? 0}` },
            {
              key: "view",
              header: "",
              render: (row) => (
                <Button
                  type="button"
                  aria-label={`View run ${row.model || row.id || "detail"}`}
                  disabled={runLoading}
                  onClick={() => void loadRun(row)}
                >
                  View
                </Button>
              ),
            },
          ]}
        />
        <div className="tool-loop-compare-actions">
          <Button
            type="button"
            onClick={() => void compareSelectedRuns()}
            disabled={comparisonLoading || comparisonRunIds.length < 2}
          >
            {comparisonLoading ? "Comparing..." : "Compare Selected"}
          </Button>
          <span className="muted">{comparisonRunIds.length} selected</span>
        </div>
      </Panel>

      {comparison ? <RunComparisonPanel comparison={comparison} /> : null}

      {!loading && !data?.available ? (
        <Panel title="No tool-loop eval results yet." eyebrow="Latest results">
          <p className="muted">Run a tool-loop eval from this page, then refresh to inspect the latest summary.</p>
          <p className="muted tool-loop-path">{data?.path || "logs/tool_loop_eval_latest.json"}</p>
        </Panel>
      ) : null}

      {data?.available ? (
        <>
          <Panel title="Latest Summary" eyebrow="Tool-call loop quality">
            <div className="tool-loop-summary">
              <div><span className="muted">Generated</span><strong>{formatDate(data.generated_at)}</strong></div>
              <div><span className="muted">Models</span><strong>{data.models?.length ?? 0}</strong></div>
              <div><span className="muted">Suites</span><strong>{data.suite_count ?? suites.length}</strong></div>
            </div>
            <p className="muted tool-loop-path">{data.path}</p>
            <DataTable
              rows={suites}
              emptyMessage="No suites in latest result."
              getRowKey={(row, index) => String(row.model || index)}
              columns={[
                { key: "model", header: "Model", render: (row) => String(row.model || "-") },
                { key: "status", header: "Status", render: (row) => <StatusBadge tone={statusTone(row.status)}>{row.status || "-"}</StatusBadge> },
                { key: "score", header: "Score", render: (row) => scorePercent(row.average_score) },
                { key: "passed", header: "Passed", render: (row) => `${row.passed_count ?? 0} / ${row.case_count ?? 0}` },
                {
                  key: "view",
                  header: "",
                  render: (row) => (
                    <Button
                      type="button"
                      onClick={() => {
                        setSelectedModel(String(row.model || ""));
                        setSelectedCaseId("");
                      }}
                    >
                      View
                    </Button>
                  ),
                },
              ]}
            />
          </Panel>
        </>
      ) : null}

      {activeSuite ? (
        <>
          {failureSummary.failedCaseCount > 0 ? <FailureSummaryPanel summary={failureSummary} /> : null}
        </>
      ) : null}

      {activeSuite ? (
        <div className="tool-loop-grid">
          <Panel title={activeSuite?.model || "Model"} eyebrow={selectedRun ? `Persisted run cases${runTargetLabel(activeSuite) ? ` · ${runTargetLabel(activeSuite)}` : ""}` : "Cases"}>
            <div className="tool-loop-case-list">
              {(activeSuite?.cases || []).map((item) => (
                <button
                  key={item.case_id}
                  type="button"
                  className={`tool-loop-case-button ${item.case_id === activeCase?.case_id ? "active" : ""}`}
                  onClick={() => setSelectedCaseId(String(item.case_id || ""))}
                >
                  <span className="tool-loop-case-heading">
                    <strong>{item.case_id || "-"}</strong>
                    <StatusBadge tone={statusTone(item.status)}>{item.status || "-"}</StatusBadge>
                  </span>
                  <span className="muted">{scorePercent(item.score)} · {item.tool_call_count ?? 0} calls · {item.iteration_count ?? 0} turns</span>
                  <span className="tool-loop-sequence">{sequenceText(item.observed_tool_sequence)}</span>
                </button>
              ))}
            </div>
          </Panel>

          <Panel title={activeCase?.case_id || "Case Detail"} eyebrow="Evaluation">
            {activeCase ? (
              <>
                <div className="tool-loop-summary">
                  <div><span className="muted">Score</span><strong>{scorePercent(activeCase.score)}</strong></div>
                  <div><span className="muted">Tool calls</span><strong>{activeCase.tool_call_count ?? 0}</strong></div>
                  <div><span className="muted">Iterations</span><strong>{activeCase.iteration_count ?? 0}</strong></div>
                </div>
                <p className="muted">Observed</p>
                <p className="tool-loop-sequence">{sequenceText(activeCase.observed_tool_sequence)}</p>
                <p className="muted">Required tools</p>
                <p className="tool-loop-sequence">{sequenceText(activeCase.expected_tool_sequence)}</p>
                <div className="tool-loop-checks" aria-label="Case checks">
                  {checks(activeCase).map(([key, ok]) => (
                    <StatusBadge key={key} tone={ok ? "success" : "danger"}>{key}</StatusBadge>
                  ))}
                </div>
                {hasDiagnostics(activeCase) ? <ToolLoopDiagnostics result={activeCase} /> : null}
                <ToolCallTimeline result={activeCase} />
                <TraceReplayPanel
                  events={traceEventsForCase(activeCase, liveTraceEvents)}
                  autoPlayToken={replayToken}
                />
                {activeCase.error ? <ErrorBanner message={activeCase.error} /> : null}
                <p className="muted">Final answer</p>
                <pre className="tool-loop-answer">{activeCase.final_answer || "-"}</pre>
              </>
            ) : (
              <p className="muted">No case selected.</p>
            )}
          </Panel>
        </div>
      ) : null}
    </div>
  );
}

function RunComparisonPanel({ comparison }: { comparison: ToolLoopComparison }) {
  const bestRun = comparison.runs.find((run) => run.runId === comparison.bestRunId);
  return (
    <Panel title="Run Comparison" eyebrow="Selected persisted runs">
      <div className="tool-loop-summary">
        <div><span className="muted">Best run</span><strong>{bestRun?.label || "-"}</strong></div>
        <div><span className="muted">Score delta</span><strong>{scorePercent(comparison.scoreDelta)}</strong></div>
        <div><span className="muted">Compared</span><strong>{comparison.runs.length}</strong></div>
      </div>
      <DataTable
        rows={comparison.runs}
        emptyMessage="No comparison runs selected."
        getRowKey={(row) => row.runId}
        columns={[
          { key: "run", header: "Run", render: (row) => row.label },
          { key: "status", header: "Status", render: (row) => <StatusBadge tone={statusTone(row.status)}>{row.status}</StatusBadge> },
          { key: "score", header: "Score", render: (row) => scorePercent(row.averageScore) },
          { key: "passRate", header: "Pass rate", render: (row) => scorePercent(row.passRate) },
          { key: "failed", header: "Failed", render: (row) => String(row.failedCaseCount) },
        ]}
      />
      <div className="tool-loop-comparison-section">
        <div className="tool-loop-section-heading">
          <strong>Case Comparison</strong>
          <span className="muted">{comparison.caseRows.length} case{comparison.caseRows.length === 1 ? "" : "s"}</span>
        </div>
        <DataTable
          rows={comparison.caseRows}
          emptyMessage="No cases to compare."
          getRowKey={(row) => row.caseId}
          columns={[
            { key: "case", header: "Case", render: (row) => row.caseId },
            ...comparison.runs.map((run) => ({
              key: run.runId,
              header: run.model,
              render: (row: ToolLoopComparison["caseRows"][number]) => {
                const cell = row.cells[run.runId];
                return (
                  <div className="tool-loop-comparison-cell">
                    <StatusBadge tone={statusTone(cell?.status)}>{cell?.status || "-"}</StatusBadge>
                    <span>{scorePercent(cell?.score)}</span>
                    {cell?.failedChecks.length ? <span className="muted">{cell.failedChecks.join(", ")}</span> : null}
                  </div>
                );
              },
            })),
          ]}
        />
      </div>
      <div className="tool-loop-comparison-section">
        <div className="tool-loop-section-heading">
          <strong>Failure Buckets</strong>
          <span className="muted">By run</span>
        </div>
        <div className="tool-loop-failure-buckets">
          {comparison.runs.map((run) => {
            const buckets = comparison.failureBucketDeltas[run.runId] || [];
            return (
              <div key={run.runId} className="tool-loop-failure-bucket">
                <span className="tool-loop-case-heading">
                  <strong>{run.label}</strong>
                  <StatusBadge tone={buckets.length ? "danger" : "success"}>{buckets.length}</StatusBadge>
                </span>
                {buckets.length ? (
                  <span className="tool-loop-sequence">{buckets.map((bucket) => bucket.label).join(", ")}</span>
                ) : (
                  <span className="muted">No failure buckets</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Panel>
  );
}

function FailureSummaryPanel({ summary }: { summary: ReturnType<typeof analyzeToolLoopFailures> }) {
  return (
    <Panel title="Failure Summary" eyebrow="Frontend-derived analysis">
      <div className="tool-loop-summary">
        <div><span className="muted">Failed cases</span><strong>{summary.failedCaseCount} failed cases</strong></div>
        <div><span className="muted">Total cases</span><strong>{summary.totalCaseCount}</strong></div>
        <div><span className="muted">Failure buckets</span><strong>{summary.buckets.length}</strong></div>
      </div>
      <div className="tool-loop-failure-buckets" aria-label="Failure buckets">
        {summary.buckets.map((bucket) => (
          <div key={bucket.id} className="tool-loop-failure-bucket">
            <span className="tool-loop-case-heading">
              <strong>{bucket.label}</strong>
              <StatusBadge tone="danger">{bucket.count}</StatusBadge>
            </span>
            <span className="muted">{bucket.description}</span>
            <span className="tool-loop-sequence">{bucket.caseIds.join(", ")}</span>
          </div>
        ))}
      </div>
      {summary.likelyCauses.length ? (
        <div className="tool-loop-likely-causes" aria-label="Likely causes">
          <p className="muted">Likely causes</p>
          <ul>
            {summary.likelyCauses.map((cause) => <li key={cause}>{cause}</li>)}
          </ul>
        </div>
      ) : null}
    </Panel>
  );
}

function ToolLoopDiagnostics({ result }: { result: ToolLoopEvalCaseResult }) {
  return (
    <div className="tool-loop-diagnostics" aria-label="Case diagnostics">
      {result.missing_expected_tools?.length ? (
        <div>
          <span className="muted">Missing required tools</span>
          <pre className="tool-loop-json">{jsonBlock(result.missing_expected_tools)}</pre>
        </div>
      ) : null}
      {result.unexpected_tools?.length ? (
        <div>
          <span className="muted">Extra observed tools</span>
          <pre className="tool-loop-json">{jsonBlock(result.unexpected_tools)}</pre>
        </div>
      ) : null}
      {Object.keys(result.diagnostics || {}).length ? (
        <div>
          <span className="muted">Artifact diagnostics</span>
          <pre className="tool-loop-json">{jsonBlock(result.diagnostics)}</pre>
        </div>
      ) : null}
    </div>
  );
}

function ToolCallTimeline({ result }: { result: ToolLoopEvalCaseResult }) {
  const entries = timelineEntries(result);
  const missingTools = (result.expected_tool_sequence || []).filter(
    (toolName) => !(result.observed_tool_sequence || []).includes(toolName),
  );
  if (!entries.length && !missingTools.length) return null;
  return (
    <div className="tool-loop-timeline" aria-label="Tool call timeline">
      <div className="tool-loop-section-heading">
        <strong>Tool Call Timeline</strong>
        <span className="muted">{entries.length} call{entries.length === 1 ? "" : "s"}</span>
      </div>
      <div className="tool-loop-timeline-list">
        {entries.map((entry) => (
          <details key={`${entry.index}-${entry.toolName}`} className={`tool-loop-step ${entry.ok ? "" : "failed"}`}>
            <summary>
              <span className="tool-loop-step-index">{entry.index + 1}</span>
              <span className="tool-loop-step-name">{entry.toolName}</span>
              <StatusBadge tone={entry.ok ? "success" : "danger"}>{entry.ok ? "ok" : "error"}</StatusBadge>
              {!entry.expected ? <StatusBadge tone="warning">unexpected</StatusBadge> : null}
              {entry.repeated ? <StatusBadge tone="warning">repeated</StatusBadge> : null}
              <button
                type="button"
                className="tool-loop-inspect-label"
                aria-label={`Inspect tool call ${entry.index + 1} ${entry.toolName}`}
                onClick={(event) => {
                  event.preventDefault();
                  const details = event.currentTarget.closest("details");
                  if (details) details.open = !details.open;
                }}
              >
                Inspect
              </button>
            </summary>
            <div className="tool-loop-step-detail">
              <div>
                <p className="muted">Function call</p>
                <pre className="tool-loop-json">{jsonBlock(entry.call)}</pre>
              </div>
              <div>
                <p className="muted">Tool result</p>
                <pre className="tool-loop-json">{jsonBlock(entry.toolResult)}</pre>
              </div>
              {entry.error ? <ErrorBanner message={entry.error} /> : null}
            </div>
          </details>
        ))}
        {missingTools.map((toolName) => (
          <div key={`missing-${toolName}`} className="tool-loop-step missing">
            <span className="tool-loop-step-index">-</span>
            <span className="tool-loop-step-name">{toolName}</span>
            <StatusBadge tone="danger">missing</StatusBadge>
          </div>
        ))}
      </div>
    </div>
  );
}

function TraceReplayPanel({ events, autoPlayToken }: { events: TraceEvent[]; autoPlayToken: number }) {
  const [playing, setPlaying] = useState(false);
  const [visibleCount, setVisibleCount] = useState(events.length);
  const [speedMs, setSpeedMs] = useState(450);

  useEffect(() => {
    setVisibleCount(events.length);
    setPlaying(false);
  }, [events]);

  useEffect(() => {
    if (!autoPlayToken || !events.length) return;
    setVisibleCount(0);
    setPlaying(true);
  }, [autoPlayToken, events.length]);

  useEffect(() => {
    if (!playing) return;
    if (visibleCount >= events.length) {
      setPlaying(false);
      return;
    }
    const timer = window.setTimeout(() => setVisibleCount((count) => Math.min(count + 1, events.length)), speedMs);
    return () => window.clearTimeout(timer);
  }, [events.length, playing, speedMs, visibleCount]);

  if (!events.length) return null;
  const visibleEvents = events.slice(0, visibleCount);
  return (
    <div className="tool-loop-trace" aria-label="Runtime trace replay">
      <div className="tool-loop-section-heading">
        <strong>Runtime Trace</strong>
        <span className="muted">{visibleEvents.length} / {events.length} events</span>
      </div>
      <div className="tool-loop-trace-controls">
        <Button
          type="button"
          onClick={() => {
            if (visibleCount >= events.length) setVisibleCount(0);
            setPlaying((value) => !value);
          }}
        >
          {playing ? "Pause" : "Replay"}
        </Button>
        <Button
          type="button"
          onClick={() => {
            setVisibleCount(0);
            setPlaying(true);
          }}
        >
          Restart
        </Button>
        <label>
          <span className="muted">Speed</span>
          <select value={speedMs} onChange={(event) => setSpeedMs(Number(event.target.value))}>
            <option value={700}>Slow</option>
            <option value={450}>Normal</option>
            <option value={180}>Fast</option>
          </select>
        </label>
      </div>
      <div className="tool-loop-trace-list">
        {visibleEvents.map((event) => (
          <details key={event.id || `${event.sequence}-${event.event_type}`} className={`tool-loop-trace-event ${event.status === "failed" ? "failed" : ""}`}>
            <summary>
              <span className="tool-loop-step-index">{event.sequence ?? "-"}</span>
              <span className="tool-loop-step-name">{event.title || event.event_type || "trace event"}</span>
              <StatusBadge tone={event.status === "failed" ? "danger" : event.status === "passed" ? "success" : "muted"}>
                {event.status || "running"}
              </StatusBadge>
            </summary>
            <pre className="tool-loop-json">{jsonBlock(event.payload || {})}</pre>
          </details>
        ))}
      </div>
    </div>
  );
}
