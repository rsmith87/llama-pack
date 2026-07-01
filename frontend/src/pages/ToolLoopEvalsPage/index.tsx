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
import { DataTable, ErrorBanner, Panel, StatusBadge, Button, FormField, Modal } from "../../components/ui";
import { useAppMode } from "../../features/appMode/appModeContext";
import { useDateTime } from "../../features/dateTime/dateTimeContext";
import { compareToolLoopRuns, type ToolLoopComparison } from "../../features/toolLoopEvals/comparisonAnalysis";
import { analyzeToolLoopFailures } from "../../features/toolLoopEvals/failureAnalysis";
import {
  asModelArray,
  flattenNodeModels,
  firstCase,
  formatDate,
  nodeModelName,
  presetGroupsWithAllOption,
  presetSummary,
  runTargetLabel,
  runningNodeModelOptions,
  scorePercent,
  statusTone,
} from "../../features/toolLoopEvals/viewModels";
import { useAsyncResource } from "../../hooks/useAsyncResource";
import { FailureSummaryPanel, RunComparisonPanel, ToolLoopCaseDetail, ToolLoopCaseList } from "./components";
import type {
  LocalModel,
  ToolLoopEvalLatest,
  ToolLoopEvalPresetsResponse,
  ToolLoopEvalRunDetail,
  ToolLoopEvalRunSummary,
  ToolLoopEvalRunsResponse,
  TraceEvent,
} from "../../types/index";



export function ToolLoopEvalsPage() {
  const appMode = useAppMode();
  const { timeZone } = useDateTime();
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
  const [detailModalRun, setDetailModalRun] = useState<ToolLoopEvalRunDetail | null>(null);
  const [detailModalCaseId, setDetailModalCaseId] = useState("");
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
    () => runningNodeModelOptions(
      isLocalMode ? nodeModels : nodeModels.filter((model) => !runNode || model.node === runNode || model.node_name === runNode),
    ),
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
  const detailModalCase = useMemo(() => {
    if (!detailModalRun) return null;
    return detailModalRun.cases?.find((item) => item.case_id === detailModalCaseId) || firstCase(detailModalRun);
  }, [detailModalCaseId, detailModalRun]);
  const failureSummary = useMemo(() => analyzeToolLoopFailures(activeSuite as ToolLoopEvalRunDetail | null), [activeSuite]);
  const detailModalFailureSummary = useMemo(() => analyzeToolLoopFailures(detailModalRun), [detailModalRun]);
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
      setDetailModalRun(detail);
      setDetailModalCaseId("");
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
        partial_count: suite.partial_count,
        failed_count: suite.failed_count,
        case_ids: suite.cases?.map((item) => String(item.case_id || "")).filter(Boolean),
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
            { key: "generated", header: "Generated", render: (row) => formatDate(row.generated_at, timeZone) },
            { key: "model", header: "Model", render: (row) => String(row.model || "-") },
            { key: "preset", header: "Preset", render: (row) => presetSummary(row.case_ids) },
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
              <div><span className="muted">Generated</span><strong>{formatDate(data.generated_at, timeZone)}</strong></div>
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
            <ToolLoopCaseList suite={activeSuite} activeCase={activeCase} onSelect={setSelectedCaseId} />
          </Panel>

          <Panel title={activeCase?.case_id || "Case Detail"} eyebrow="Evaluation">
            <ToolLoopCaseDetail
              activeCase={activeCase}
              liveTraceEvents={liveTraceEvents}
              replayToken={replayToken}
            />
          </Panel>
        </div>
      ) : null}

      <Modal
        title="Tool-loop run details"
        open={Boolean(detailModalRun)}
        onClose={() => {
          setDetailModalRun(null);
          setDetailModalCaseId("");
        }}
      >
        {detailModalRun ? (
          <div className="tool-loop-modal-content">
            <div className="tool-loop-summary">
              <div><span className="muted">Model</span><strong>{detailModalRun.model || "-"}</strong></div>
              <div><span className="muted">Status</span><strong>{detailModalRun.status || "-"}</strong></div>
              <div><span className="muted">Preset</span><strong>{presetSummary(detailModalRun.case_ids)}</strong></div>
            </div>
            {detailModalFailureSummary.failedCaseCount > 0 ? <FailureSummaryPanel summary={detailModalFailureSummary} /> : null}
            <div className="tool-loop-grid tool-loop-modal-grid">
              <Panel title={detailModalRun.model || "Model"} eyebrow={`Persisted run cases${runTargetLabel(detailModalRun) ? ` · ${runTargetLabel(detailModalRun)}` : ""}`}>
                <ToolLoopCaseList suite={detailModalRun} activeCase={detailModalCase} onSelect={setDetailModalCaseId} />
              </Panel>
              <Panel title={detailModalCase?.case_id || "Case Detail"} eyebrow="Evaluation">
                <ToolLoopCaseDetail activeCase={detailModalCase} liveTraceEvents={[]} replayToken={0} />
              </Panel>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
