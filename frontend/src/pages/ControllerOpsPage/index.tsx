import "./styles.css";
import { useEffect, useMemo, useState } from "react";
import { cancelJob, exportArchive, getControllerStats, getJob, getJobArtifacts, getJobEvents, getRetentionPolicy, listJobs } from "../../api/controller";
import { useAsyncResource } from "../../hooks/useAsyncResource";
import { getNodeModels, listNodes } from "../../api/nodes";
import { checkOfflineReadiness, distributeOfflineModel, type OfflineDistributionResponse, type OfflineReadinessResponse } from "../../api/offline";
import { DataTable, EmptyState, ErrorBanner, FormField, Panel, StatusBadge, Button } from "../../components/ui";
import { mergeNodeInventory } from "../../features/nodes/nodesView";
import { field } from "../../features/shared/helpers";
import type { RecordItem, JobDetail } from "../../types/operations";

function asArray(payload: unknown, key?: string): RecordItem[] {
  if (Array.isArray(payload)) return payload as RecordItem[];
  if (key) {
    const value = (payload as Record<string, unknown> | null)?.[key];
    if (Array.isArray(value)) return value as RecordItem[];
  }
  return [];
}

function jobId(job: RecordItem) {
  return field(job, "id");
}

function shortJobId(job: RecordItem) {
  const id = jobId(job);
  return id.length > 8 ? id.slice(0, 8) : id;
}

function statusTone(status: unknown) {
  const value = String(status || "").toLowerCase();
  if (["succeeded", "complete", "completed"].includes(value)) return "success";
  if (["running", "queued", "pending", "cancel_requested"].includes(value)) return "warning";
  if (["failed", "error", "cancelled", "canceled"].includes(value)) return "danger";
  return "muted";
}

function pretty(value: unknown) {
  return JSON.stringify(value || {}, null, 2);
}

function modelFileId(model: Record<string, unknown>): string {
  return field(model, "file_id", field(model, "source_file_id"));
}

function modelName(model: Record<string, unknown>): string {
  return field(model, "name", field(model, "registered_as"));
}

type ControllerOpsData = {
  jobs: RecordItem[];
  nodes: RecordItem[];
  stats: RecordItem | null;
  policy: RecordItem | null;
};

async function loadControllerOpsData(): Promise<ControllerOpsData> {
  const [nodeConfig, nodeModels, jobPayload, statsPayload, policyPayload] = await Promise.all([
    listNodes(),
    getNodeModels(),
    listJobs(50),
    getControllerStats(),
    getRetentionPolicy(),
  ]);
  return {
    nodes: mergeNodeInventory(asArray(nodeConfig, "nodes"), asArray(nodeModels, "nodes")) as RecordItem[],
    jobs: asArray(jobPayload, "jobs"),
    stats: statsPayload,
    policy: policyPayload,
  };
}

export function ControllerOpsPage() {
  const { data, loading, error, refresh, setError } = useAsyncResource<ControllerOpsData>(loadControllerOpsData, {
    jobs: [],
    nodes: [],
    stats: null,
    policy: null,
  });
  const { jobs, nodes, stats, policy } = data;

  const [detail, setDetail] = useState<JobDetail | null>(null);
  const [archiveResult, setArchiveResult] = useState("No archive export run yet.");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [targetFilter, setTargetFilter] = useState("");
  const [offlineSourceNode, setOfflineSourceNode] = useState("");
  const [offlineModel, setOfflineModel] = useState("");
  const [offlineSourceFileId, setOfflineSourceFileId] = useState("");
  const [offlineTargets, setOfflineTargets] = useState<string[]>([]);
  const [offlineReadiness, setOfflineReadiness] = useState<OfflineReadinessResponse | null>(null);
  const [offlineDistribution, setOfflineDistribution] = useState<OfflineDistributionResponse | null>(null);

  const reachableNodes = useMemo(() => nodes.filter((node) => field(node, "name") && Boolean(node.reachable)), [nodes]);
  const selectedSource = useMemo(() => reachableNodes.find((node) => field(node, "name") === offlineSourceNode), [reachableNodes, offlineSourceNode]);
  const selectedSourceModels = useMemo(
    () => Array.isArray(selectedSource?.models) ? selectedSource.models as Record<string, unknown>[] : [],
    [selectedSource],
  );
  const availableTargetNodes = useMemo(
    () => reachableNodes.filter((node) => field(node, "name") !== offlineSourceNode),
    [offlineSourceNode, reachableNodes],
  );

  useEffect(() => {
    if (offlineSourceNode || reachableNodes.length === 0) return;
    setOfflineSourceNode(field(reachableNodes[0], "name"));
  }, [offlineSourceNode, reachableNodes]);

  useEffect(() => {
    const validTargets = new Set(availableTargetNodes.map((node) => field(node, "name")));
    setOfflineTargets((current) => current.filter((node) => validTargets.has(node)));
  }, [availableTargetNodes]);

  const filteredJobs = useMemo(() => jobs.filter((job) => {
    const status = field(job, "status", "").toLowerCase();
    const type = field(job, "type", "").toLowerCase();
    const target = field(job, "target_selector", "auto").toLowerCase();
    return (!statusFilter || status.includes(statusFilter.toLowerCase()))
      && (!typeFilter || type.includes(typeFilter.toLowerCase()))
      && (!targetFilter || target.includes(targetFilter.toLowerCase()));
  }), [jobs, statusFilter, typeFilter, targetFilter]);

  async function loadDetail(id: string) {
    const [job, events, artifacts] = await Promise.all([getJob(id), getJobEvents(id), getJobArtifacts(id)]);
    setDetail({ job, events: asArray(events), artifacts: asArray(artifacts) });
  }

  async function cancel(id: string) {
    await cancelJob(id);
    await refresh();
  }

  async function runArchiveExport() {
    const result = await exportArchive();
    setArchiveResult(JSON.stringify(result, null, 2));
  }

  async function checkReadiness() {
    const targetNodes = offlineTargets.filter((node) => node.trim());
    if (!offlineSourceNode.trim()) {
      setError("Select a source node before checking offline readiness.");
      return;
    }
    if (!offlineModel.trim()) {
      setError("Enter a model name before checking offline readiness.");
      return;
    }
    if (targetNodes.length === 0) {
      setError("Select at least one target node before checking offline readiness.");
      return;
    }
    try {
      setError("");
      setOfflineReadiness(await checkOfflineReadiness({
        source_node: offlineSourceNode,
        model: offlineModel,
        target_nodes: targetNodes,
      }));
      setOfflineDistribution(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Offline readiness check failed");
    }
  }

  async function distributeModel() {
    const targetNodes = offlineTargets.filter((node) => node.trim());
    if (!offlineSourceNode.trim()) {
      setError("Select a source node before distributing an offline model.");
      return;
    }
    if (!offlineSourceFileId.trim()) {
      setError("Enter a source file id before distributing an offline model.");
      return;
    }
    if (targetNodes.length === 0) {
      setError("Select at least one target node before distributing an offline model.");
      return;
    }
    try {
      setError("");
      setOfflineDistribution(await distributeOfflineModel({
        source_node: offlineSourceNode,
        source_file_id: offlineSourceFileId,
        target_nodes: targetNodes,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Offline model distribution failed");
    }
  }

  function toggleOfflineTarget(node: string, checked: boolean) {
    setOfflineTargets((current) => checked ? [...new Set([...current, node])] : current.filter((item) => item !== node));
  }

  const nodeSummary = nodes.map((node) => ({
    name: field(node, "name"),
    reachable: String(Boolean(node.reachable)),
    models: String(Array.isArray(node.models) ? node.models.length : 0),
    source: field(node, "models_source"),
    heartbeat: field(node, "last_heartbeat"),
  }));

  return (
    <div className="controller-ops-page-react">
      <div className="page-heading">
        <div><span className="eyebrow">Fleet</span><h2>Controller Ops</h2></div>
        <Button type="button" onClick={refresh} disabled={loading}>{loading ? "Refreshing" : "Refresh"}</Button>
      </div>
      <ErrorBanner message={error} />
      <div className="controller-grid-react">
        <Panel title="Jobs" eyebrow="Queue">
          <div className="filter-bar">
            <FormField label="Status"><input value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} placeholder="status" /></FormField>
            <FormField label="Type"><input value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} placeholder="type" /></FormField>
            <FormField label="Target"><input value={targetFilter} onChange={(event) => setTargetFilter(event.target.value)} placeholder="target" /></FormField>
          </div>
          <DataTable
            rows={filteredJobs}
            emptyMessage={loading ? "Loading jobs..." : "No jobs found."}
            getRowKey={(row, index) => jobId(row) || String(index)}
            columns={[
              { key: "id", header: "ID", render: (row) => shortJobId(row) },
              { key: "status", header: "Status", render: (row) => <StatusBadge tone={statusTone(row.status)}>{field(row, "status")}</StatusBadge> },
              { key: "type", header: "Type", render: (row) => field(row, "type") },
              { key: "target", header: "Target", render: (row) => field(row, "target_selector", "auto") },
              { key: "updated", header: "Updated", render: (row) => field(row, "updated_at") },
              { key: "actions", header: "Actions", render: (row) => {
                const id = jobId(row);
                return <div className="actions"><Button type="button" onClick={() => void loadDetail(id)} aria-label={`View ${id}`}>View</Button><Button type="button" onClick={() => void cancel(id)} disabled={!id || ["succeeded", "failed", "cancelled", "canceled"].includes(field(row, "status", "").toLowerCase())} aria-label={`Cancel ${id}`}>Cancel</Button></div>;
              } },
            ]}
          />
        </Panel>

        <Panel title="Job Detail" eyebrow="Events and artifacts">
          {detail ? (
            <div className="job-detail-react">
              <div className="job-detail-summary">
                <strong>{field(detail.job, "id")}</strong>
                <span className="muted">status={field(detail.job, "status")} type={field(detail.job, "type")} target={field(detail.job, "target_selector", "auto")}</span>
                <span className="muted">created={field(detail.job, "created_at")} updated={field(detail.job, "updated_at")}</span>
              </div>
              <h4>Events</h4>
              <DataTable
                rows={detail.events}
                emptyMessage="No events."
                getRowKey={(row, index) => `${field(row, "created_at", "event")}-${index}`}
                columns={[
                  { key: "time", header: "Time", render: (row) => field(row, "created_at") },
                  { key: "type", header: "Type", render: (row) => field(row, "event_type", field(row, "type")) },
                  { key: "payload", header: "Payload", render: (row) => <pre className="inline-json">{pretty(row.event_json || row.payload || row)}</pre> },
                ]}
              />
              <h4>Artifacts</h4>
              <DataTable
                rows={detail.artifacts}
                emptyMessage="No artifacts."
                getRowKey={(row, index) => `${field(row, "uri", "artifact")}-${index}`}
                columns={[
                  { key: "kind", header: "Kind", render: (row) => field(row, "kind") },
                  { key: "uri", header: "URI", render: (row) => field(row, "uri") },
                  { key: "meta", header: "Meta", render: (row) => <pre className="inline-json">{pretty(row.meta || row)}</pre> },
                ]}
              />
            </div>
          ) : (
            <p className="muted">Select a job to inspect details, events, and artifacts.</p>
          )}
        </Panel>

        <Panel title="Node Capabilities" eyebrow="Controller inventory">
          {nodeSummary.length ? <DataTable rows={nodeSummary} emptyMessage="No nodes." getRowKey={(row, index) => row.name || String(index)} columns={[
            { key: "node", header: "Node", render: (row) => row.name },
            { key: "reachable", header: "Reachable", render: (row) => row.reachable },
            { key: "models", header: "Models", render: (row) => row.models },
            { key: "source", header: "Source", render: (row) => row.source },
            { key: "heartbeat", header: "Heartbeat", render: (row) => row.heartbeat },
          ]} /> : <EmptyState message="No nodes." />}
        </Panel>

        <Panel title="Offline Setup" eyebrow="Readiness and distribution">
          <div className="offline-setup-react">
            <div className="filter-bar">
              <FormField label="Source node">
                <select value={offlineSourceNode} onChange={(event) => setOfflineSourceNode(event.target.value)} data-testid="offline-source-node">
                  <option value="">Select source</option>
                  {reachableNodes.map((node) => <option key={field(node, "name")} value={field(node, "name")}>{field(node, "name")}</option>)}
                </select>
              </FormField>
              <FormField label="Model">
                <input
                  list="offline-source-models"
                  value={offlineModel}
                  onChange={(event) => setOfflineModel(event.target.value)}
                  placeholder="registered model name"
                />
                <datalist id="offline-source-models">
                  {selectedSourceModels.map((model, index) => <option key={`${modelName(model)}-${index}`} value={modelName(model)} />)}
                </datalist>
              </FormField>
              <FormField label="Source file id">
                <input
                  list="offline-source-file-ids"
                  value={offlineSourceFileId}
                  onChange={(event) => setOfflineSourceFileId(event.target.value)}
                  placeholder="file id"
                />
                <datalist id="offline-source-file-ids">
                  {selectedSourceModels.map((model, index) => {
                    const fileId = modelFileId(model);
                    return fileId ? <option key={`${fileId}-${index}`} value={fileId} /> : null;
                  })}
                </datalist>
              </FormField>
            </div>
            <div className="offline-target-list" aria-label="Target nodes">
              {availableTargetNodes.length ? availableTargetNodes.map((node) => {
                const name = field(node, "name");
                return (
                  <label key={name} className="offline-target-option">
                    <input
                      type="checkbox"
                      checked={offlineTargets.includes(name)}
                      onChange={(event) => toggleOfflineTarget(name, event.target.checked)}
                    />
                    <span>{name}</span>
                  </label>
                );
              }) : <span className="muted">No reachable target nodes.</span>}
            </div>
            <div className="actions">
              <Button type="button" onClick={() => void checkReadiness()}>Check Readiness</Button>
              <Button type="button" onClick={() => void distributeModel()} disabled={!offlineReadiness}>Distribute Model</Button>
            </div>
            {offlineReadiness ? (
              <DataTable
                rows={offlineReadiness.nodes}
                emptyMessage="No readiness results."
                getRowKey={(row) => row.node}
                columns={[
                  { key: "node", header: "Node", render: (row) => row.node },
                  { key: "ready", header: "Ready", render: (row) => <StatusBadge tone={row.ready ? "success" : "warning"}>{row.ready ? "ready" : "not ready"}</StatusBadge> },
                  { key: "registered", header: "Registered", render: (row) => String(row.registered) },
                  { key: "artifact", header: "Artifact", render: (row) => String(row.artifact_present) },
                  { key: "error", header: "Error", render: (row) => row.error || "-" },
                ]}
              />
            ) : null}
            {offlineDistribution ? (
              <DataTable
                rows={offlineDistribution.nodes}
                emptyMessage="No distribution jobs."
                getRowKey={(row) => row.node}
                columns={[
                  { key: "node", header: "Node", render: (row) => row.node },
                  { key: "status", header: "Status", render: (row) => <StatusBadge tone={statusTone(row.status)}>{row.status}</StatusBadge> },
                  { key: "transfer", header: "Transfer", render: (row) => row.transfer_id || "-" },
                  { key: "error", header: "Error", render: (row) => row.error || "-" },
                ]}
              />
            ) : null}
          </div>
        </Panel>

        <Panel title="Retention & Archive" eyebrow="Policy">
          <div className="stacked-controls">
            <Button type="button" onClick={() => void runArchiveExport()}>Run Archive Export</Button>
            <div className="muted">retention_days={String(policy?.retention_days ?? "-")}</div>
            <div className="muted">archive_retention_days={String(policy?.archive_retention_days ?? "-")}</div>
            <h4>Last Sweep</h4>
            <pre className="detail-json compact-json">{pretty(stats?.last_sweep)}</pre>
            <h4>Job Counts</h4>
            <pre className="detail-json compact-json">{pretty(stats?.job_counts)}</pre>
            <h4>Archive Export</h4>
            <pre className="detail-json compact-json">{archiveResult}</pre>
          </div>
        </Panel>
      </div>
    </div>
  );
}
