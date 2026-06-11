import "./styles.css";
import { useMemo, useState } from "react";
import { getToolLoopEvalLatest } from "../../api/toolLoopEvals";
import { DataTable, ErrorBanner, Panel, StatusBadge, Button } from "../../components/ui";
import { useAsyncResource } from "../../hooks/useAsyncResource";
import type { ToolLoopEvalCaseResult, ToolLoopEvalLatest, ToolLoopEvalSuite } from "../../types/index";

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

function firstCase(suite: ToolLoopEvalSuite | null): ToolLoopEvalCaseResult | null {
  return suite?.cases?.[0] || null;
}

export function ToolLoopEvalsPage() {
  const { data, loading, error, refresh } = useAsyncResource<ToolLoopEvalLatest | null>(
    () => getToolLoopEvalLatest(),
    null,
  );
  const suites = data?.suites || [];
  const [selectedModel, setSelectedModel] = useState("");
  const [selectedCaseId, setSelectedCaseId] = useState("");

  const activeSuite = useMemo(() => {
    if (!suites.length) return null;
    return suites.find((suite) => suite.model === selectedModel) || suites[0];
  }, [selectedModel, suites]);

  const activeCase = useMemo(() => {
    if (!activeSuite) return null;
    return activeSuite.cases?.find((item) => item.case_id === selectedCaseId) || firstCase(activeSuite);
  }, [activeSuite, selectedCaseId]);

  return (
    <div className="tool-loop-evals-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">Runtime</span>
          <h2>Tool Loop Evals</h2>
        </div>
        <Button type="button" onClick={() => void refresh()} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </Button>
      </div>
      <ErrorBanner message={error || data?.error || ""} />

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

          <div className="tool-loop-grid">
            <Panel title={activeSuite?.model || "Model"} eyebrow="Cases">
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
                  {activeCase.error ? <ErrorBanner message={activeCase.error} /> : null}
                  <p className="muted">Final answer</p>
                  <pre className="tool-loop-answer">{activeCase.final_answer || "-"}</pre>
                </>
              ) : (
                <p className="muted">No case selected.</p>
              )}
            </Panel>
          </div>
        </>
      ) : null}
    </div>
  );
}
