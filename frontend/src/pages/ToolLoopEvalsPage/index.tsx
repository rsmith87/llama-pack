import "./styles.css";
import { useEffect, useMemo, useState } from "react";
import { getNodeModels } from "../../api/nodes";
import {
  getToolLoopEvalLatest,
  getToolLoopEvalRun,
  listToolLoopEvalRuns,
  startToolLoopEvalNodeRun,
} from "../../api/toolLoopEvals";
import { DataTable, ErrorBanner, Panel, StatusBadge, Button, FormField } from "../../components/ui";
import { useAsyncResource } from "../../hooks/useAsyncResource";
import type {
  LocalModel,
  ToolLoopEvalCaseResult,
  ToolLoopEvalLatest,
  ToolLoopEvalRunDetail,
  ToolLoopEvalRunSummary,
  ToolLoopEvalRunsResponse,
  ToolLoopEvalSuite,
} from "../../types/index";

const CASE_PRESET_GROUPS = [
  {
    label: "Synthetic presets",
    presets: [
      { id: "all", label: "All presets" },
      { id: "two-step-tool-synthesis", label: "Two-step synthesis" },
      { id: "avoid-unneeded-tools", label: "Avoid unneeded tools" },
      { id: "linear-4-step-synthesis", label: "Linear 4-step synthesis" },
      { id: "linear-8-step-synthesis", label: "Linear 8-step synthesis" },
      { id: "tool-error-recovery", label: "Tool-error recovery" },
      { id: "avoid-loop-trap", label: "Avoid loop trap" },
      { id: "branching-decision", label: "Branching decision" },
      { id: "argument-repair", label: "Argument repair" },
      { id: "parallel-fact-gathering", label: "Parallel fact gathering" },
      { id: "subagent-delegation-simulation", label: "Subagent delegation simulation" },
    ],
  },
  {
    label: "Real-world scenarios",
    presets: [
      { id: "technical-design-doc-draft", label: "Technical design doc draft" },
    ],
  },
];

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

function firstCase(suite: ToolLoopEvalSuite | null): ToolLoopEvalCaseResult | null {
  return suite?.cases?.[0] || null;
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
    data: nodeModels,
    loading: nodesLoading,
    error: nodesError,
  } = useAsyncResource<LocalModel[]>(
    async () => flattenNodeModels(await getNodeModels()),
    [],
  );
  const suites = data?.suites || [];
  const historyRuns = historyData.runs || [];
  const [selectedModel, setSelectedModel] = useState("");
  const [selectedCaseId, setSelectedCaseId] = useState("");
  const [selectedRun, setSelectedRun] = useState<ToolLoopEvalRunDetail | null>(null);
  const [runLoading, setRunLoading] = useState(false);
  const [runError, setRunError] = useState("");
  const [runNode, setRunNode] = useState("");
  const [runModel, setRunModel] = useState("");
  const [runPreset, setRunPreset] = useState("all");
  const [submitMessage, setSubmitMessage] = useState("");

  const nodeOptions = useMemo(
    () => Array.from(new Set(nodeModels.map((model) => String(model.node || model.node_name || "")).filter(Boolean))),
    [nodeModels],
  );
  const modelOptions = useMemo(
    () => nodeModels.filter((model) => !runNode || model.node === runNode || model.node_name === runNode),
    [nodeModels, runNode],
  );

  useEffect(() => {
    if (!runNode && nodeOptions.length) setRunNode(nodeOptions[0]);
  }, [nodeOptions, runNode]);

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

  async function submitRun(event: React.FormEvent) {
    event.preventDefault();
    const node = runNode.trim();
    const model = runModel.trim();
    if (!node || !model) {
      setRunError("Node and model are required to run tool-loop evals.");
      return;
    }
    setRunLoading(true);
    setRunError("");
    setSubmitMessage("");
    try {
      const payload = {
        node,
        model,
        ...(runPreset === "all" ? {} : { case_ids: [runPreset] }),
      };
      const suite = await startToolLoopEvalNodeRun(payload);
      setSelectedRun({
        id: suite.persisted_run_id,
        generated_at: new Date().toISOString(),
        model: suite.model,
        target_selector: `node:${node}`,
        target_node: node,
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
        <Button type="button" onClick={() => void refreshAll()} disabled={loading || historyLoading || runLoading}>
          {loading || historyLoading || runLoading ? "Refreshing..." : "Refresh"}
        </Button>
      </div>
      <ErrorBanner message={error || historyError || nodesError || runError || data?.error || ""} />

      <Panel title="Run Tool-Loop Eval" eyebrow="Controller-triggered node run">
        <form className="tool-loop-run-form stacked-controls" onSubmit={(event) => void submitRun(event)}>
          <FormField label="Node">
            <select value={runNode} onChange={(event) => setRunNode(event.target.value)} disabled={nodesLoading || runLoading}>
              {nodeOptions.length ? nodeOptions.map((node) => <option key={node} value={node}>{node}</option>) : <option value="">No reachable nodes</option>}
            </select>
          </FormField>
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
                return <option key={`${model.node || model.node_name}-${name}`} value={name} />;
              })}
            </datalist>
          </FormField>
          <FormField label="Preset">
            <select value={runPreset} onChange={(event) => setRunPreset(event.target.value)} disabled={runLoading}>
              {CASE_PRESET_GROUPS.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.presets.map((preset) => <option key={preset.id} value={preset.id}>{preset.label}</option>)}
                </optgroup>
              ))}
            </select>
          </FormField>
          <div className="tool-loop-run-actions">
            <Button type="submit" variant="primary" disabled={runLoading || !runNode || !runModel}>
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
      </Panel>

      {!loading && !data?.available ? (
        <Panel title="No tool-loop eval results yet." eyebrow="Latest results">
          <p className="muted">Run the local evaluator, then refresh this page.</p>
          <code className="tool-loop-command">uv run python scripts/tool_loop_eval.py --config /path/to/controller-config.yaml --model gpt-oss-20b --target node:mac-mini</code>
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
        <div className="tool-loop-grid">
          <Panel title={activeSuite?.model || "Model"} eyebrow={selectedRun ? "Persisted run cases" : "Cases"}>
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
                <p className="muted">Expected</p>
                <p className="tool-loop-sequence">{sequenceText(activeCase.expected_tool_sequence)}</p>
                <div className="tool-loop-checks" aria-label="Case checks">
                  {checks(activeCase).map(([key, ok]) => (
                    <StatusBadge key={key} tone={ok ? "success" : "danger"}>{key}</StatusBadge>
                  ))}
                </div>
                <ToolCallTimeline result={activeCase} />
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
