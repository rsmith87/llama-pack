import "./styles.css";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  compareBenchmarkRuns,
  createBenchmarkDefinition,
  getBenchmarkRun,
  listBenchmarkDefinitions,
  listBenchmarkRuns,
  startBenchmarkRuns,
} from "../../api/benchmarks";
import { getNodeModels } from "../../api/nodes";
import { DataTable, ErrorBanner, FormField, Panel, Button } from "../../components/ui";
import { readBenchmarkHandoff } from "../../features/benchmarks/handoff";
import type {
  BenchmarkAggregate,
  BenchmarkDefinitionRecord,
  BenchmarkRunRecord,
  BenchmarkRunStatus,
  LocalModel,
} from "../../types/api";

const TERMINAL_STATUSES: BenchmarkRunStatus[] = ["completed", "failed", "partial"];

function nodeModelName(m: LocalModel): string {
  return String(m.name || m.id || m.model || "");
}

function nodeModelTarget(m: LocalModel): string {
  const n = m.node || m.node_name;
  return n ? `node:${n}` : "local";
}

function asNodeArray(payload: unknown): Array<{ name?: string; reachable?: boolean; models?: LocalModel[] }> {
  if (Array.isArray(payload)) return payload as Array<{ name?: string; reachable?: boolean; models?: LocalModel[] }>;
  return (payload as { nodes?: Array<{ name?: string; reachable?: boolean; models?: LocalModel[] }> } | null)?.nodes || [];
}

function flattenNodeModels(payload: unknown): LocalModel[] {
  return asNodeArray(payload).flatMap((node) => {
    const nodeName = String(node.name || "");
    if (!nodeName || node.reachable === false || !Array.isArray(node.models)) return [];
    return node.models.map((m) => ({ ...(m as LocalModel), node: nodeName }));
  }).filter((m) => nodeModelName(m));
}
const POLL_INTERVAL_MS = 2500;

function statusLabel(status: BenchmarkRunStatus): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function statusClass(status: BenchmarkRunStatus): string {
  if (status === "completed") return "status-ok";
  if (status === "failed") return "status-fail";
  if (status === "partial") return "status-warn";
  return "status-pending";
}

function fmt(val: number | null | undefined, decimals = 1): string {
  return val != null ? val.toFixed(decimals) : "—";
}

// ---------------------------------------------------------------------------
// Mini SVG bar chart — horizontal bars normalized to the max value
// ---------------------------------------------------------------------------
function MetricBar({ value, max, color }: { value: number | null | undefined; max: number; color: string }) {
  const pct = max > 0 && value != null ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <svg className="metric-bar-svg" viewBox="0 0 100 12" preserveAspectRatio="none" aria-hidden="true">
      <rect x="0" y="2" width="100" height="8" fill="var(--color-surface-2, #eee)" rx="2" />
      <rect x="0" y="2" width={pct} height="8" fill={color} rx="2" />
    </svg>
  );
}

function AggregateRow({
  run,
  maxTtft,
  maxTps,
}: {
  run: BenchmarkRunRecord;
  maxTtft: number;
  maxTps: number;
}) {
  const agg: BenchmarkAggregate | null = run.aggregate ?? null;
  return (
    <tr>
      <td>{run.model}</td>
      <td>
        <span className={`bench-status ${statusClass(run.status)}`}>{statusLabel(run.status)}</span>
      </td>
      <td>
        <div className="metric-cell">
          <span>{fmt(agg?.ttft_ms_median)} ms</span>
          <MetricBar value={agg?.ttft_ms_median} max={maxTtft} color="var(--color-accent, #7c6cf0)" />
        </div>
      </td>
      <td>
        <div className="metric-cell">
          <span>{fmt(agg?.tokens_per_second_median)} tok/s</span>
          <MetricBar value={agg?.tokens_per_second_median} max={maxTps} color="var(--color-success, #3dba78)" />
        </div>
      </td>
      <td>{fmt(agg?.total_duration_ms_median)} ms</td>
      <td>{agg?.success_rate != null ? `${(agg.success_rate * 100).toFixed(0)}%` : "—"}</td>
      <td className="muted">{run.started_at ? new Date(run.started_at).toLocaleString() : "—"}</td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Create definition form
// ---------------------------------------------------------------------------
function CreateDefinitionForm({ onCreated }: { onCreated: (def: BenchmarkDefinitionRecord) => void }) {
  const [name, setName] = useState("");
  const [promptText, setPromptText] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [sampleCount, setSampleCount] = useState(3);
  const [maxTokens, setMaxTokens] = useState(256);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const def = await createBenchmarkDefinition({
        name: name.trim(),
        prompt_text: promptText.trim(),
        system_prompt: systemPrompt.trim() || undefined,
        sample_count: sampleCount,
        max_tokens: maxTokens,
      });
      onCreated(def);
      setName("");
      setPromptText("");
      setSystemPrompt("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create definition");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="create-definition-form" onSubmit={(e) => void handleSubmit(e)}>
      <ErrorBanner message={error} />
      <FormField label="Name">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. My Custom Benchmark"
          required
        />
      </FormField>
      <FormField label="Prompt text">
        <textarea
          value={promptText}
          onChange={(e) => setPromptText(e.target.value)}
          rows={3}
          placeholder="User prompt to benchmark"
          required
        />
      </FormField>
      <FormField label="System prompt (optional)">
        <textarea
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          rows={2}
          placeholder="Optional system prompt"
        />
      </FormField>
      <div className="create-form-row">
        <FormField label="Samples">
          <input
            type="number"
            min={1}
            max={20}
            value={sampleCount}
            onChange={(e) => setSampleCount(Number(e.target.value))}
          />
        </FormField>
        <FormField label="Max tokens">
          <input
            type="number"
            min={1}
            max={4096}
            value={maxTokens}
            onChange={(e) => setMaxTokens(Number(e.target.value))}
          />
        </FormField>
      </div>
      <button type="submit" disabled={saving}>
        {saving ? "Creating…" : "Create Definition"}
      </button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export function BenchmarksPage() {
  const handoff = readBenchmarkHandoff();
  const [definitions, setDefinitions] = useState<BenchmarkDefinitionRecord[]>([]);
  const [selectedDefId, setSelectedDefId] = useState<string>("");
  const [runs, setRuns] = useState<BenchmarkRunRecord[]>([]);
  const [models, setModels] = useState<LocalModel[]>([]);
  const [selectedModels, setSelectedModels] = useState<Set<string>>(() => new Set(handoff.model ? [handoff.model] : []));
  const [targetSelector, setTargetSelector] = useState(handoff.target || "auto");
  const [managedLoad, setManagedLoad] = useState(Boolean(handoff.targetNode));
  const [targetNode, setTargetNode] = useState(handoff.targetNode);
  const [restoreAfter, setRestoreAfter] = useState(false);
  const [error, setError] = useState("");
  const [loadingDefs, setLoadingDefs] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [compareIds, setCompareIds] = useState<Set<string>>(new Set());
  const [comparison, setComparison] = useState<BenchmarkRunRecord[] | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadDefinitions = useCallback(async () => {
    setLoadingDefs(true);
    try {
      const resp = await listBenchmarkDefinitions();
      setDefinitions(resp.definitions ?? []);
      if (!selectedDefId && resp.definitions?.length) {
        setSelectedDefId(resp.definitions[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load definitions");
    } finally {
      setLoadingDefs(false);
    }
  }, [selectedDefId]);

  const loadRuns = useCallback(async (defId: string) => {
    if (!defId) return;
    try {
      const resp = await listBenchmarkRuns(defId, 100);
      setRuns(resp.runs ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load runs");
    }
  }, []);

  const loadModels = useCallback(async () => {
    try {
      const resp = await getNodeModels();
      setModels(flattenNodeModels(resp));
    } catch {
      // non-fatal
    }
  }, []);

  // initial load
  useEffect(() => {
    void loadDefinitions();
    void loadModels();
  }, [loadDefinitions, loadModels]);

  // reload runs when definition changes
  useEffect(() => {
    if (selectedDefId) void loadRuns(selectedDefId);
  }, [selectedDefId, loadRuns]);

  // polling for in-flight runs
  useEffect(() => {
    function stopPolling() {
      if (pollingRef.current !== null) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    }

    const activeIds = runs
      .filter((r) => !TERMINAL_STATUSES.includes(r.status))
      .map((r) => r.id);

    if (activeIds.length === 0) {
      stopPolling();
      return;
    }

    if (pollingRef.current !== null) return; // already polling

    pollingRef.current = setInterval(() => {
      void Promise.all(activeIds.map((id) => getBenchmarkRun(id))).then((updated) => {
        setRuns((prev) => {
          const map = new Map(prev.map((r) => [r.id, r]));
          for (const run of updated) map.set(run.id, run);
          return Array.from(map.values());
        });
        if (updated.every((r) => TERMINAL_STATUSES.includes(r.status))) {
          stopPolling();
        }
      });
    }, POLL_INTERVAL_MS);

    return stopPolling;
  }, [runs]);

  async function handleStartRuns() {
    if (!selectedDefId || selectedModels.size === 0) return;
    if (managedLoad && !targetNode) {
      setError("Select a target node for managed loading");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const resp = await startBenchmarkRuns({
        definition_id: selectedDefId,
        models: Array.from(selectedModels),
        target_selector: targetSelector || "auto",
        target_node: managedLoad ? targetNode : undefined,
        managed_load: managedLoad,
        restore_after: managedLoad ? restoreAfter : false,
      });
      setRuns((prev) => [...(resp.runs ?? []), ...prev]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start runs");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCompare() {
    if (compareIds.size < 2) return;
    setError("");
    try {
      const resp = await compareBenchmarkRuns(Array.from(compareIds));
      setComparison(resp.runs ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to compare runs");
    }
  }

  function toggleCompare(id: string) {
    setComparison(null);
    setCompareIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleModel(name: string) {
    setSelectedModels((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  const selectedDef = definitions.find((d) => d.id === selectedDefId) ?? null;
  const displayRuns = comparison ?? runs;

  const maxTtft = Math.max(
    1,
    ...displayRuns.map((r) => r.aggregate?.ttft_ms_median ?? 0),
  );
  const maxTps = Math.max(
    1,
    ...displayRuns.map((r) => r.aggregate?.tokens_per_second_median ?? 0),
  );

  const availableModelNames = models.map(nodeModelName).filter(Boolean);

  const targetOptions = [
    "auto",
    targetSelector,
    ...Array.from(new Set(models.map(nodeModelTarget))).filter(Boolean),
  ].filter((opt, index, all) => opt && all.indexOf(opt) === index);
  const nodeOptions = Array.from(
    new Set([targetNode, ...models.map((model) => String(model.node || model.node_name || ""))].filter(Boolean)),
  );

  return (
    <div className="benchmarks-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">Performance</span>
          <h2>Benchmarks</h2>
        </div>
        <span className="muted">Run repeatable inference tests and compare results</span>
      </div>

      <ErrorBanner message={error} />

      <div className="benchmarks-layout">
        {/* Left column: definition selector + run controls */}
        <div className="benchmarks-sidebar">
          <Panel title="Benchmark Definition">
            {loadingDefs ? (
              <p className="muted">Loading…</p>
            ) : (
              <div className="definition-selector">
                <FormField label="Select definition">
                  <select
                    value={selectedDefId}
                    onChange={(e) => {
                      setSelectedDefId(e.target.value);
                      setComparison(null);
                      setCompareIds(new Set());
                    }}
                  >
                    {definitions.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </FormField>

                {selectedDef && (
                  <div className="definition-detail">
                    {selectedDef.description && (
                      <p className="muted">{selectedDef.description}</p>
                    )}
                    {selectedDef.tags.length > 0 && (
                      <div className="definition-tags" aria-label="Benchmark tags">
                        {selectedDef.tags.map((tag) => (
                          <span key={tag} className="definition-tag">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    <p>
                      <span className="label">Prompt:</span>{" "}
                      <span className="prompt-preview">{selectedDef.prompt_text}</span>
                    </p>
                    <p>
                      <span className="label">Samples:</span> {selectedDef.sample_count}
                      {"  "}
                      <span className="label">Max tokens:</span> {selectedDef.max_tokens}
                    </p>
                  </div>
                )}

                <Button variant="link" type="button" onClick={() => setShowCreateForm((v) => !v)}>
                  {showCreateForm ? "Cancel" : "+ New definition"}
                </Button>

                {showCreateForm && (
                  <CreateDefinitionForm
                    onCreated={(def) => {
                      setDefinitions((prev) => [def, ...prev]);
                      setSelectedDefId(def.id);
                      setShowCreateForm(false);
                    }}
                  />
                )}
              </div>
            )}
          </Panel>

          <Panel title="Run">
            <FormField label="Models to benchmark">
              {availableModelNames.length === 0 ? (
                <p className="muted">No models discovered</p>
              ) : (
                <div className="model-checkboxes">
                  {availableModelNames.map((name) => (
                    <label key={name} className="model-checkbox-label">
                      <input
                        type="checkbox"
                        checked={selectedModels.has(name)}
                        onChange={() => toggleModel(name)}
                      />
                      {name}
                    </label>
                  ))}
                </div>
              )}
            </FormField>
            <FormField label="Target">
              <select
                value={targetSelector}
                onChange={(e) => setTargetSelector(e.target.value)}
                disabled={managedLoad}
              >
                {targetOptions.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </FormField>
            <label className="benchmark-option">
              <input
                type="checkbox"
                checked={managedLoad}
                onChange={(e) => {
                  setManagedLoad(e.target.checked);
                  if (e.target.checked && !targetNode && nodeOptions.length > 0) {
                    setTargetNode(nodeOptions[0]);
                  }
                }}
              />
              <span>Load model on a node before running</span>
            </label>
            {managedLoad && (
              <>
                <FormField label="Target node">
                  <select value={targetNode} onChange={(e) => setTargetNode(e.target.value)}>
                    <option value="" disabled>Select node</option>
                    {nodeOptions.map((node) => (
                      <option key={node} value={node}>{node}</option>
                    ))}
                  </select>
                </FormField>
                <label className="benchmark-option">
                  <input
                    type="checkbox"
                    checked={restoreAfter}
                    onChange={(e) => setRestoreAfter(e.target.checked)}
                  />
                  <span>Restore previously running models after benchmark</span>
                </label>
              </>
            )}
            <button
              type="button"
              onClick={() => void handleStartRuns()}
              disabled={submitting || !selectedDefId || selectedModels.size === 0 || (managedLoad && !targetNode)}
            >
              {submitting ? "Starting…" : "Run Benchmark"}
            </button>
          </Panel>
        </div>

        {/* Right column: results */}
        <div className="benchmarks-results">
          <Panel
            title={`Results${selectedDef ? ` — ${selectedDef.name}` : ""}`}
            actions={
              compareIds.size >= 2 ? (
                <button type="button" onClick={() => void handleCompare()}>
                  Compare {compareIds.size} runs
                </button>
              ) : comparison ? (
                <button type="button" onClick={() => { setComparison(null); setCompareIds(new Set()); }}>
                  Clear comparison
                </button>
              ) : undefined
            }
          >
            {comparison && (
              <p className="muted compare-notice">
                Showing comparison of {comparison.length} selected runs from the same definition.
              </p>
            )}
            {displayRuns.length === 0 ? (
              <p className="muted">No runs yet. Select a definition and models, then click Run Benchmark.</p>
            ) : (
              <div className="results-table-wrap">
                <table className="bench-results-table">
                  <thead>
                    <tr>
                      <th></th>
                      <th>Model</th>
                      <th>Status</th>
                      <th>TTFT (median)</th>
                      <th>Tok/s (median)</th>
                      <th>Duration (median)</th>
                      <th>Success rate</th>
                      <th>Started</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayRuns.map((run) => (
                      <tr key={run.id}>
                        <td>
                          <input
                            type="checkbox"
                            checked={compareIds.has(run.id)}
                            onChange={() => toggleCompare(run.id)}
                            title="Select for comparison"
                          />
                        </td>
                        <td>{run.model}</td>
                        <td>
                          <span className={`bench-status ${statusClass(run.status)}`}>
                            {statusLabel(run.status)}
                          </span>
                        </td>
                        <td>
                          <div className="metric-cell">
                            <span>{fmt(run.aggregate?.ttft_ms_median)} ms</span>
                            <MetricBar
                              value={run.aggregate?.ttft_ms_median}
                              max={maxTtft}
                              color="var(--color-accent, #7c6cf0)"
                            />
                          </div>
                        </td>
                        <td>
                          <div className="metric-cell">
                            <span>{fmt(run.aggregate?.tokens_per_second_median)} tok/s</span>
                            <MetricBar
                              value={run.aggregate?.tokens_per_second_median}
                              max={maxTps}
                              color="var(--color-success, #3dba78)"
                            />
                          </div>
                        </td>
                        <td>{fmt(run.aggregate?.total_duration_ms_median)} ms</td>
                        <td>
                          {run.aggregate?.success_rate != null
                            ? `${(run.aggregate.success_rate * 100).toFixed(0)}%`
                            : "—"}
                        </td>
                        <td className="muted">
                          {run.started_at ? new Date(run.started_at).toLocaleString() : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          {/* Comparison chart area */}
          {(comparison ?? (compareIds.size >= 2 ? [] : null)) !== null && comparison && comparison.length >= 2 && (
            <Panel title="Comparison charts">
              <div className="chart-section">
                <h3>TTFT — median (ms) · lower is better</h3>
                <div className="chart-bars">
                  {comparison.map((run) => (
                    <AggregateRow
                      key={run.id}
                      run={run}
                      maxTtft={maxTtft}
                      maxTps={maxTps}
                    />
                  ))}
                </div>
              </div>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
