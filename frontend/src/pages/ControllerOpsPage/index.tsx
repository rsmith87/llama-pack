import "./styles.css";
import { useEffect, useMemo, useState } from "react";
import { cancelJob, exportArchive, getControllerStats, getJob, getJobArtifacts, getJobEvents, getRetentionPolicy, listJobs } from "../../api/controller";
import { getNodeModels, listNodes } from "../../api/nodes";
import { DataTable, EmptyState, ErrorBanner, FormField, Panel, StatusBadge, Button } from "../../components/ui";
import { mergeNodeInventory } from "../../features/nodes/nodesView";
import type { RecordItem, JobDetail } from "../../types/operations";

function asArray(payload: unknown, key?: string): RecordItem[] {
  if (Array.isArray(payload)) return payload as RecordItem[];
  if (key) {
    const value = (payload as Record<string, unknown> | null)?.[key];
    if (Array.isArray(value)) return value as RecordItem[];
  }
  return [];
}

function field(record: RecordItem, key: string, fallback = "-") {
  return String(record[key] || fallback);
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

export function ControllerOpsPage() {
  const [jobs, setJobs] = useState<RecordItem[]>([]);
  const [nodes, setNodes] = useState<RecordItem[]>([]);
  const [stats, setStats] = useState<RecordItem | null>(null);
  const [policy, setPolicy] = useState<RecordItem | null>(null);
  const [detail, setDetail] = useState<JobDetail | null>(null);
  const [archiveResult, setArchiveResult] = useState("No archive export run yet.");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [targetFilter, setTargetFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const [nodeConfig, nodeModels, jobPayload, statsPayload, policyPayload] = await Promise.all([
        listNodes(),
        getNodeModels(),
        listJobs(50),
        getControllerStats(),
        getRetentionPolicy(),
      ]);
      setNodes(mergeNodeInventory(asArray(nodeConfig, "nodes"), asArray(nodeModels, "nodes")) as RecordItem[]);
      setJobs(asArray(jobPayload, "jobs"));
      setStats(statsPayload);
      setPolicy(policyPayload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load controller data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

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
