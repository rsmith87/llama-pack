import "./styles.css";
import { useState } from "react";
import { startNodeModel } from "../../api/nodes";
import { getRuntimeOverview, previewRoute } from "../../api/runtime";
import { useAsyncResource } from "../../hooks/useAsyncResource";
import { Button, DataTable, ErrorBanner, FormField, Panel } from "../../components/ui";
import { benchmarkSearch } from "../../features/benchmarks/handoff";
import { useNavigate } from "react-router-dom";
import type { RoutePreviewResponse, RuntimeOverview } from "../../types/index";

function yesNo(value?: boolean) {
  return value ? "Yes" : "No";
}

function countList(counts?: Record<string, number>) {
  const entries = Object.entries(counts || {});
  if (!entries.length) return "None";
  return entries.map(([key, value]) => `${key}: ${value}`).join(", ");
}

function keyValueList(values?: Record<string, unknown>) {
  const entries = Object.entries(values || {});
  if (!entries.length) return "None";
  return entries.map(([key, value]) => `${key}=${String(value)}`).join(", ");
}

type WorkerOverview = NonNullable<RuntimeOverview["worker"]>;
type RunningModelItems = NonNullable<RuntimeOverview["running_models"]>["items"];

function executorList(executors?: WorkerOverview["executors"]) {
  const names = [
    executors?.chat ? "chat" : "",
    executors?.embeddings ? "embeddings" : "",
    executors?.model_transfer ? "model transfer" : "",
  ].filter(Boolean);
  return names.length ? names.join(", ") : "None";
}

function workerStatus(worker?: WorkerOverview) {
  if (worker?.running) return "Running";
  if (worker?.enabled) return "Configured, idle";
  if (worker?.configured_enabled) return "Misconfigured";
  return "Disabled";
}

type AgentAction = {
  label: string;
  detail: string;
  buttonLabel: string;
  path: string;
};

function agentModelStatus(overview: RuntimeOverview, runningModels: RunningModelItems) {
  if (overview.running_models?.error) return "Needs attention";
  const runningCount = overview.running_models?.count ?? runningModels?.length ?? 0;
  return runningCount > 0 ? "Serving" : "No models running";
}

function agentControllerStatus(worker?: WorkerOverview) {
  if (!worker?.controller_url) return "Not configured";
  if (worker.running) return "Connected";
  if (worker.configured_enabled) return "Configured, not polling";
  return "Configured";
}

function agentActions(
  overview: RuntimeOverview,
  worker: RuntimeOverview["worker"],
  runningModels: RunningModelItems,
): AgentAction[] {
  const actions: AgentAction[] = [];
  const runningCount = overview.running_models?.count ?? runningModels?.length ?? 0;
  if (overview.running_models?.error) {
    actions.push({
      label: "Fix model status",
      detail: overview.running_models.error,
      buttonLabel: "Open Settings",
      path: "/ui/settings?section=runtime",
    });
  } else if (runningCount === 0) {
    actions.push({
      label: "Start a model",
      detail: "No llama-server processes are running on this agent.",
      buttonLabel: "Open Models",
      path: "/ui/models",
    });
  }
  if (!worker?.controller_url) {
    actions.push({
      label: "Set controller URL",
      detail: "This agent cannot claim controller work until controller_url is configured.",
      buttonLabel: "Open Settings",
      path: "/ui/settings?section=runtime",
    });
  } else if (worker.configured_enabled && !worker.running) {
    actions.push({
      label: "Start worker polling",
      detail: "Worker is enabled in config but is not currently claiming work.",
      buttonLabel: "Open Settings",
      path: "/ui/settings?section=runtime",
    });
  }
  if (!worker?.executors?.chat && !worker?.executors?.embeddings && !worker?.executors?.model_transfer) {
    actions.push({
      label: "Enable worker executors",
      detail: "No worker executors are advertised to the controller.",
      buttonLabel: "Open Settings",
      path: "/ui/settings?section=runtime",
    });
  }
  return actions;
}


export function RuntimeOverviewPage() {
  const navigate = useNavigate();
  const { data: overview, error, setError, refresh } = useAsyncResource<RuntimeOverview | null>(
    () => getRuntimeOverview(),
    null,
  );
  const [routeTask, setRouteTask] = useState("Summarize a long document");
  const [requestType, setRequestType] = useState("general");
  const [minContext, setMinContext] = useState("");
  const [needsJson, setNeedsJson] = useState(false);
  const [preview, setPreview] = useState<RoutePreviewResponse | null>(null);
  const [previewError, setPreviewError] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [startingRoute, setStartingRoute] = useState("");

  async function submitRoutePreview() {
    setPreviewError("");
    setPreviewLoading(true);
    try {
      setPreview(await previewRoute({
        task: routeTask,
        request_type: requestType || "general",
        target: "auto",
        requirements: {
          min_context: minContext ? Number(minContext) : null,
          needs_json: needsJson,
          needs_tools: false,
        },
      }));
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : "Failed to preview route");
    } finally {
      setPreviewLoading(false);
    }
  }

  async function startSelectedRouteModel() {
    const selected = preview?.selected;
    if (!selected?.node || !selected.model) return;
    const key = `${selected.node}/${selected.model}`;
    setPreviewError("");
    setStartingRoute(key);
    try {
      await startNodeModel(selected.node, selected.model);
      await submitRoutePreview();
      await refresh();
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : "Failed to start route model");
    } finally {
      setStartingRoute("");
    }
  }

  const tools = overview?.agent_tools?.tools || [];
  const nodes = overview?.nodes?.items || [];
  const nodeRuntimes = overview?.node_runtimes?.items || [];
  const runningModels = overview?.running_models?.items || [];
  const worker = overview?.worker;
  const selectedRouteKey = preview?.selected?.node && preview.selected.model ? `${preview.selected.node}/${preview.selected.model}` : "";
  const selectedCanStart = Boolean(
    preview?.selected?.node
      && preview.selected.model
      && preview.selected.startup_needed
      && preview.selected.startup_decision === "start_now",
  );
  const localToolNote = overview?.mode === "controller"
    ? "This shows tools configured on the controller process. Agent-hosted tools are listed in Node Runtime Capabilities."
    : "This shows tools configured on this agent process.";
  const isAgentMode = overview?.mode === "agent";

  if (isAgentMode) {
    const actions = agentActions(overview, worker, runningModels);
    return (
      <div className="runtime-overview-page">
        <div className="page-heading">
          <div>
            <span className="eyebrow">Runtime</span>
            <h2>Agent Runtime</h2>
          </div>
          <span className="muted">Health checks and next actions for this agent node</span>
        </div>
        <ErrorBanner message={error} />

        <div className="agent-health-grid">
          <Panel eyebrow="Model Serving" title={agentModelStatus(overview, runningModels)}>
            <div className="runtime-summary">
              <div><span className="muted">Running models</span><strong>{overview.running_models?.count ?? runningModels.length}</strong></div>
              <div><span className="muted">Serving API</span><strong>{overview.running_models?.available ? "Reachable" : "Unavailable"}</strong></div>
            </div>
            <ErrorBanner message={overview.running_models?.error || ""} />
            {runningModels.length ? (
              <div className="agent-compact-list">
                {runningModels.map((model, index) => (
                  <div key={String(model.name || index)}>
                    <strong>{String(model.name || "-")}</strong>
                    <span className="muted">{model.port ? `:${model.port}` : "No port"} / {model.profile_label || model.profile_kind || "default"} / {model.resource_tier || "unclassified"}</span>
                  </div>
                ))}
              </div>
            ) : <p className="empty">No models running.</p>}
          </Panel>

          <Panel eyebrow="Controller" title={agentControllerStatus(worker)}>
            <div className="runtime-summary">
              <div><span className="muted">URL</span><strong>{worker?.controller_url || "Missing"}</strong></div>
              <div><span className="muted">Node name</span><strong>{worker?.node_name || "-"}</strong></div>
            </div>
            <p className="muted runtime-note">Work claim endpoint: {worker?.claim_url || "not available"}</p>
          </Panel>

          <Panel eyebrow="Worker" title={workerStatus(worker)}>
            <div className="runtime-summary">
              <div><span className="muted">Max jobs</span><strong>{worker?.max_jobs ?? "-"}</strong></div>
              <div><span className="muted">Poll interval</span><strong>{worker?.poll_interval_seconds ?? "-"}s</strong></div>
              <div><span className="muted">Executors</span><strong>{executorList(worker?.executors)}</strong></div>
              <div><span className="muted">Capacity</span><strong>{keyValueList(worker?.capacity)}</strong></div>
            </div>
          </Panel>

          <Panel eyebrow="Local Tools" title={overview.agent_tools?.enabled ? "Enabled" : "Disabled"}>
            <div className="runtime-summary">
              <div><span className="muted">Configured tools</span><strong>{overview.agent_tools?.tool_count ?? 0}</strong></div>
              <div><span className="muted">Max iterations</span><strong>{overview.agent_tools?.max_iterations ?? "-"}</strong></div>
            </div>
            <p className="muted runtime-note">{tools.length ? tools.map((tool) => tool.name || tool.type || "unnamed").join(", ") : localToolNote}</p>
          </Panel>
        </div>

        <Panel eyebrow="Operator Actions" title={actions.length ? "Next Actions" : "No Immediate Action"}>
          {actions.length ? (
            <div className="agent-action-list">
              {actions.map((action) => (
                <div className="agent-action-row" key={action.label}>
                  <div>
                    <strong>{action.label}</strong>
                    <span className="muted">{action.detail}</span>
                  </div>
                  <Button type="button" onClick={() => navigate(action.path)}>{action.buttonLabel}</Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="empty">Model serving, controller connectivity, and worker polling look ready.</p>
          )}
        </Panel>
      </div>
    );
  }

  return (
    <div className="runtime-overview-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">Runtime</span>
          <h2>Runtime Overview</h2>
        </div>
        <span className="muted">Read-only status for tools, memory, jobs, threads, and node capabilities</span>
      </div>
      <ErrorBanner message={error} />

      <div className="runtime-grid">
        {overview?.mode === "controller" ? (
          <Panel eyebrow="Runtime Router" title="Route Preview">
            <p className="muted runtime-note">Preview model selection without sending a chat request.</p>
            <div className="route-preview-form">
              <FormField label="Task">
                <input type="text" value={routeTask} onChange={(event) => setRouteTask(event.target.value)} />
              </FormField>
              <FormField label="Request type">
                <select value={requestType} onChange={(event) => setRequestType(event.target.value)}>
                  <option value="general">general</option>
                  <option value="coding">coding</option>
                  <option value="summarization">summarization</option>
                  <option value="structured">structured</option>
                  <option value="planning">planning</option>
                </select>
              </FormField>
              <FormField label="Min context">
                <input inputMode="numeric" value={minContext} onChange={(event) => setMinContext(event.target.value)} placeholder="8192" />
              </FormField>
              <label className="route-preview-check">
                <input type="checkbox" checked={needsJson} onChange={(event) => setNeedsJson(event.target.checked)} />
                <span>Needs JSON schema</span>
              </label>
            </div>
            <Button variant="primary" onClick={submitRoutePreview} disabled={previewLoading}>
              {previewLoading ? "Previewing..." : "Preview Route"}
            </Button>
            <ErrorBanner message={previewError} />
            {preview ? (
              <div className="route-preview-result">
                <div className="runtime-summary">
                  <div>
                    <span className="muted">Selected</span>
                    <strong>{preview.selected ? `${preview.selected.node} / ${preview.selected.model}` : "No match"}</strong>
                  </div>
                  <div>
                    <span className="muted">Reason</span>
                    <strong>{preview.selected?.reason || "-"}</strong>
                  </div>
                </div>
                <p className="muted runtime-note">{preview.explanation}</p>
                {preview.selected?.model ? (
                  <Button
                    type="button"
                    onClick={() => navigate(`/ui/benchmarks?${benchmarkSearch(
                      preview.selected?.model || "",
                      preview.selected?.node ? `node:${preview.selected.node}` : "auto",
                      preview.selected?.node || "",
                      "runtime-preview",
                    )}`)}
                    aria-label={`Benchmark ${preview.selected.model}${preview.selected.node ? ` on ${preview.selected.node}` : ""}`}
                  >
                    Benchmark
                  </Button>
                ) : null}
                {selectedCanStart ? (
                  <div className="route-preview-start">
                    <span>Model is available but stopped.</span>
                    <Button
                      variant="success"
                      onClick={() => void startSelectedRouteModel()}
                      disabled={startingRoute === selectedRouteKey}
                      aria-label={`Start ${preview.selected?.model} on ${preview.selected?.node}`}
                    >
                      {startingRoute === selectedRouteKey ? "Starting..." : "Start Model"}
                    </Button>
                  </div>
                ) : preview.selected?.startup_needed && preview.selected.startup_decision === "defer" ? (
                  <p className="muted runtime-note">Model is available but startup is deferred by node capacity.</p>
                ) : null}
                <DataTable
                  rows={preview.candidates || []}
                  emptyMessage="No route candidates."
                  getRowKey={(row, index) => `${row.node || "node"}-${row.model || index}`}
                  columns={[
                    { key: "route", header: "Route", render: (row) => `${row.node || "-"} / ${row.model || "-"}` },
                    { key: "eligible", header: "Eligible", render: (row) => yesNo(row.eligible) },
                    { key: "score", header: "Score", render: (row) => String(row.score ?? 0) },
                    { key: "source", header: "Source", render: (row) => String(row.source || "-") },
                    { key: "running", header: "Running", render: (row) => yesNo(row.running) },
                    { key: "startup", header: "Startup", render: (row) => row.startup_needed ? String(row.startup_decision || "-") : "-" },
                    { key: "strengths", header: "Strengths", render: (row) => row.strengths?.join(", ") || "-" },
                    { key: "cost_tier", header: "Cost", render: (row) => String(row.cost_tier || "-") },
                    { key: "rejections", header: "Rejections", render: (row) => row.rejections?.join(", ") || "-" },
                  ]}
                />
              </div>
            ) : null}
          </Panel>
        ) : null}


        <Panel eyebrow="Local Runtime" title="Tool Runtime">
          <p className="muted runtime-note">{localToolNote}</p>
          <div className="runtime-summary">
            <div><span className="muted">Enabled</span><strong>{yesNo(overview?.agent_tools?.enabled)}</strong></div>
            <div><span className="muted">Tool count</span><strong>{overview?.agent_tools?.tool_count ?? 0}</strong></div>
            <div><span className="muted">Max iterations</span><strong>{overview?.agent_tools?.max_iterations ?? "-"}</strong></div>
          </div>
          <DataTable
            rows={tools}
            emptyMessage="No agent tools configured."
            getRowKey={(row, index) => String(row.name || index)}
            columns={[
              { key: "name", header: "Name", render: (row) => String(row.name || "-") },
              { key: "type", header: "Type", render: (row) => String(row.type || "-") },
              { key: "description", header: "Description", render: (row) => String(row.description || "-") },
            ]}
          />
        </Panel>

        <Panel eyebrow="Agent Runtime" title="Worker">
          <div className="runtime-summary worker-summary">
            <div><span className="muted">Status</span><strong>{workerStatus(worker)}</strong></div>
            <div><span className="muted">Node</span><strong>{worker?.node_name || "-"}</strong></div>
            <div><span className="muted">Max jobs</span><strong>{worker?.max_jobs ?? "-"}</strong></div>
            <div><span className="muted">Poll</span><strong>{worker?.poll_interval_seconds ?? "-"}s</strong></div>
            <div><span className="muted">Executors</span><strong>{executorList(worker?.executors)}</strong></div>
            <div><span className="muted">Controller</span><strong>{worker?.controller_url || "-"}</strong></div>
          </div>
          <div className="runtime-debug-lines">
            <div><span className="muted">Labels</span><code>{keyValueList(worker?.labels)}</code></div>
            <div><span className="muted">Capacity</span><code>{keyValueList(worker?.capacity)}</code></div>
            <div><span className="muted">Claim</span><code>{worker?.claim_url || "-"}</code></div>
          </div>
        </Panel>

        {overview?.node_runtimes?.available ? (
          <Panel eyebrow="Controller Runtime" title="Node Runtime Capabilities">
            <p className="muted runtime-note">Runtime features reported by each connected agent.</p>
            <DataTable
              rows={nodeRuntimes}
              emptyMessage="No node runtime reports available."
              getRowKey={(row, index) => String(row.name || index)}
              columns={[
                { key: "name", header: "Node", render: (row) => String(row.name || "-") },
                { key: "reachable", header: "Reachable", render: (row) => yesNo(row.reachable) },
                { key: "tools_enabled", header: "Tools", render: (row) => row.tools_enabled ? `Enabled (${row.tool_count ?? 0})` : "Disabled" },
                { key: "memory_configured", header: "Memory config", render: (row) => yesNo(row.memory_configured) },
                { key: "memory_available", header: "Memory available", render: (row) => yesNo(row.memory_available) },
                { key: "worker", header: "Worker", render: (row) => workerStatus({ enabled: row.worker_enabled, running: row.worker_running }) },
                { key: "worker_jobs", header: "Jobs", render: (row) => String(row.worker_max_jobs ?? "-") },
                { key: "worker_labels", header: "Labels", render: (row) => keyValueList(row.worker_labels) },
                { key: "worker_executors", header: "Executors", render: (row) => executorList(row.worker_executors) },
              ]}
            />
          </Panel>
        ) : null}

        <Panel eyebrow="Memory" title="Semantic Memory">
          <div className="runtime-summary">
            <div><span className="muted">Configured</span><strong>{yesNo(overview?.memory?.configured)}</strong></div>
            <div><span className="muted">Available</span><strong>{yesNo(overview?.memory?.available)}</strong></div>
            <div><span className="muted">Auto inject</span><strong>{yesNo(overview?.memory?.auto_inject)}</strong></div>
            <div><span className="muted">Top K</span><strong>{overview?.memory?.top_k ?? "-"}</strong></div>
          </div>
          <p className="muted runtime-path">{overview?.memory?.path || "No memory path configured."}</p>
        </Panel>

        {overview?.mode === "controller" ? (
        <Panel eyebrow="Controller Runtime" title="Jobs And Threads">
          <div className="runtime-summary">
            <div><span className="muted">Jobs available</span><strong>{yesNo(overview?.jobs?.available)}</strong></div>
            <div><span className="muted">Job counts</span><strong>{countList(overview?.jobs?.counts)}</strong></div>
            <div><span className="muted">Threads available</span><strong>{yesNo(overview?.threads?.available)}</strong></div>
            <div><span className="muted">Thread count</span><strong>{overview?.threads?.count ?? 0}</strong></div>
            {overview?.downloads?.available && (
              <div>
                <span className="muted">Active downloads</span>
                <strong>{overview.downloads.active_count ?? 0}</strong>
              </div>
            )}
          </div>
          <ErrorBanner message={overview?.downloads?.error || ""} />
        </Panel>
        ) : null}

        {overview?.mode === "controller" ? (
        <Panel eyebrow="Controller Runtime" title="Node Capabilities">
          <div className="runtime-summary">
            <div><span className="muted">Available</span><strong>{yesNo(overview?.nodes?.available)}</strong></div>
            <div><span className="muted">Node count</span><strong>{overview?.nodes?.count ?? 0}</strong></div>
          </div>
          <DataTable
            rows={nodes}
            emptyMessage="No controller nodes available."
            getRowKey={(row, index) => String(row.name || index)}
            columns={[
              { key: "name", header: "Node", render: (row) => String(row.name || "-") },
              { key: "registration", header: "Type", render: (row) => String(row.registration || "-") },
              { key: "default_model", header: "Default model", render: (row) => String(row.default_model || "-") },
              {
                key: "request_types",
                header: "Request types",
                render: (row) => Array.isArray(row.request_types) ? row.request_types.join(", ") || "-" : "-",
              },
              {
                key: "fresh",
                header: "Heartbeat",
                render: (row) => {
                  if (row.heartbeat_fresh === false) {
                    const age = row.heartbeat_age_seconds;
                    return typeof age === "number" ? `Stale (${age}s ago)` : "Stale";
                  }
                  const age = row.heartbeat_age_seconds;
                  return typeof age === "number" ? `Fresh (${age}s ago)` : "Fresh/Static";
                },
              },
            ]}
          />
        </Panel>
        ) : null}

        {(overview?.running_models?.available || overview?.running_models?.error) && (
          <Panel eyebrow="Agent Runtime" title="Running Models">
            <div className="runtime-summary">
              <div><span className="muted">Running</span><strong>{overview.running_models.count ?? 0}</strong></div>
            </div>
            <ErrorBanner message={overview.running_models.error || ""} />
            <DataTable
              rows={runningModels}
              emptyMessage="No models running."
              getRowKey={(row, index) => String(row.name || index)}
              columns={[
                { key: "name", header: "Model", render: (row) => String(row.name || "-") },
                { key: "port", header: "Port", render: (row) => String(row.port ?? "-") },
                { key: "profile_label", header: "Profile", render: (row) => String(row.profile_label || "-") },
                { key: "profile_kind", header: "Kind", render: (row) => String(row.profile_kind || "-") },
                { key: "resource_tier", header: "Tier", render: (row) => String(row.resource_tier || "-") },
              ]}
            />
          </Panel>
        )}
      </div>
    </div>
  );
}
