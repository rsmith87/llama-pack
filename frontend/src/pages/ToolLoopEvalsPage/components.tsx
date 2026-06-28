import { useEffect, useState } from "react";
import { DataTable, ErrorBanner, Panel, StatusBadge, Button } from "../../components/ui";
import { compareToolLoopRuns, type ToolLoopComparison } from "../../features/toolLoopEvals/comparisonAnalysis";
import { analyzeToolLoopFailures } from "../../features/toolLoopEvals/failureAnalysis";
import type { ToolLoopEvalCaseResult, ToolLoopEvalSuite, TraceEvent } from "../../types";
import { checks, hasDiagnostics, jsonBlock, scorePercent, sequenceText, statusTone, timelineEntries, traceEventsForCase } from "../../features/toolLoopEvals/viewModels";

export function ToolLoopCaseList({
  suite,
  activeCase,
  onSelect,
}: {
  suite: ToolLoopEvalSuite;
  activeCase: ToolLoopEvalCaseResult | null;
  onSelect: (caseId: string) => void;
}) {
  return (
    <div className="tool-loop-case-list">
      {(suite.cases || []).map((item) => (
        <button
          key={item.case_id}
          type="button"
          className={`tool-loop-case-button ${item.case_id === activeCase?.case_id ? "active" : ""}`}
          onClick={() => onSelect(String(item.case_id || ""))}
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
  );
}

export function ToolLoopCaseDetail({
  activeCase,
  liveTraceEvents,
  replayToken,
}: {
  activeCase: ToolLoopEvalCaseResult | null;
  liveTraceEvents: TraceEvent[];
  replayToken: number;
}) {
  if (!activeCase) return <p className="muted">No case selected.</p>;
  return (
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
  );
}

export function RunComparisonPanel({ comparison }: { comparison: ToolLoopComparison }) {
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

export function FailureSummaryPanel({ summary }: { summary: ReturnType<typeof analyzeToolLoopFailures> }) {
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

export function ToolLoopDiagnostics({ result }: { result: ToolLoopEvalCaseResult }) {
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

export function ToolCallTimeline({ result }: { result: ToolLoopEvalCaseResult }) {
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

export function TraceReplayPanel({ events, autoPlayToken }: { events: TraceEvent[]; autoPlayToken: number }) {
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
