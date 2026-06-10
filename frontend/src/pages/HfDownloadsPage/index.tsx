import "./styles.css";
import { useEffect, useState, type FormEvent } from "react";
import { useAsyncResource } from "../../hooks/useAsyncResource";
import { createJob } from "../../api/controller";
import { cancelDownload, deleteDownload, discoverQuants, listDownloadHistory, listDownloadRecommendations, startDownload } from "../../api/downloads";
import { createGgufTransfer, listGgufs } from "../../api/library";
import { getNodeModels } from "../../api/nodes";
import { DataTable, EmptyState, ErrorBanner, FormField, Modal, Panel, StatusBadge, Button } from "../../components/ui";
import { useAppMode } from "../../features/appMode/appModeContext";
import { transferDestinationOptions, type NodeRecord } from "../../features/nodes/nodesView";
import type { DownloadRecommendation, DownloadRecord, DownloadRecommendationsResponse, GgufFile } from "../../types/index";
import type { QuantRecord, RemoteGgufSource, RecommendedInventory, HfTransferState, RecommendedDownload } from "../../types/downloads";
import { RecommendationModelCard } from "../../components/RecommendationModelCard";
import { field } from "../../features/shared/helpers";
import { modelName, modelFileId } from "../../features/models";

function asDownloads(payload: unknown): DownloadRecord[] {
  if (Array.isArray(payload)) return payload as DownloadRecord[];
  const downloads = (payload as { downloads?: DownloadRecord[] } | null)?.downloads;
  return Array.isArray(downloads) ? downloads : [];
}

function asQuants(payload: unknown): QuantRecord[] {
  if (Array.isArray(payload)) return payload as QuantRecord[];
  const quants = (payload as { quants?: QuantRecord[]; files?: QuantRecord[] } | null)?.quants || (payload as { files?: QuantRecord[] } | null)?.files;
  return Array.isArray(quants) ? quants : [];
}

function asGgufs(payload: unknown): GgufFile[] {
  if (Array.isArray(payload)) return payload as GgufFile[];
  const files = (payload as { files?: GgufFile[]; ggufs?: GgufFile[] } | null)?.files || (payload as { ggufs?: GgufFile[] } | null)?.ggufs;
  return Array.isArray(files) ? files : [];
}

function asNodes(payload: unknown): NodeRecord[] {
  const nodes = Array.isArray(payload) ? payload : (payload as { nodes?: NodeRecord[] } | null)?.nodes;
  return Array.isArray(nodes) ? nodes : [];
}

function quantPath(quant: QuantRecord) {
  return String(quant.path || quant.filename || "model.gguf");
}

function suggestedModelAlias(repo: string, includeFile = "") {
  const source = includeFile || repo.split("/").pop() || "model";
  return source
    .replace(/\.gguf$/i, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    || "model";
}

function mmprojPath(record: Record<string, unknown>) {
  const direct = record.mmproj_file;
  if (typeof direct === "string" && direct) return direct;
  const mmproj = record.mmproj;
  if (mmproj && typeof mmproj === "object") {
    const path = (mmproj as Record<string, unknown>).path || (mmproj as Record<string, unknown>).filename;
    if (typeof path === "string" && path) return path;
  }
  return null;
}

function fileText(record: Record<string, unknown>) {
  return [record.filename, record.path, record.model_path, record.model, record.name]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function matchesRecommendedFile(record: Record<string, unknown>, item: RecommendedDownload) {
  const expected = item.includeFile.toLowerCase();
  return fileText(record).includes(expected);
}

function bytesToGb(value: unknown) {
  const numeric = Number(value || 0);
  return Number.isFinite(numeric) && numeric > 0 ? numeric / 1024 ** 3 : 0;
}

function bytesValue(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : null;
}

function formatBytes(value: unknown) {
  const bytes = bytesValue(value);
  if (bytes == null) return "-";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let size = bytes / 1024;
  let unit = units[0];
  for (let index = 1; index < units.length && size >= 1024; index += 1) {
    size /= 1024;
    unit = units[index];
  }
  const rounded = size >= 10 ? Math.round(size) : Math.round(size * 10) / 10;
  return `${rounded} ${unit}`;
}

function progressPercent(record: DownloadRecord) {
  const explicit = bytesValue(record.progress_percent);
  if (explicit != null) return Math.max(0, Math.min(100, Math.round(explicit)));
  const downloaded = bytesValue(record.bytes_downloaded);
  const total = bytesValue(record.bytes_total);
  if (downloaded == null || total == null || total <= 0) return null;
  return Math.max(0, Math.min(100, Math.round((downloaded / total) * 100)));
}

function progressText(record: DownloadRecord) {
  const downloaded = bytesValue(record.bytes_downloaded);
  const total = bytesValue(record.bytes_total);
  if (downloaded == null && total == null) return record.status === "running" ? "Downloading" : "-";
  if (total == null || total <= 0) return `${formatBytes(downloaded)} downloaded`;
  return `${formatBytes(downloaded)} / ${formatBytes(total)}`;
}

function DownloadProgress({ record }: { record: DownloadRecord }) {
  const percent = progressPercent(record);
  const text = progressText(record);
  return (
    <div className="download-progress">
      <div className="download-progress-line">
        <span>{percent == null ? (record.status === "running" ? "Running" : "-") : `${percent}%`}</span>
        <small>{text}</small>
      </div>
      {percent == null ? null : (
        <div className="download-progress-track" aria-label={`Download progress ${percent}%`}>
          <span style={{ width: `${percent}%` }} />
        </div>
      )}
    </div>
  );
}

function asRecommendations(payload: DownloadRecommendationsResponse | null): RecommendedDownload[] {
  const items = payload?.recommendations;
  if (!Array.isArray(items)) return [];
  return items.map((item: DownloadRecommendation) => ({
    repoId: item.repo_id,
    title: item.title,
    includeFile: item.include_file,
    mmprojFile: item.mmproj_file || null,
    vision: Boolean(item.vision || item.mmproj_file),
    quant: item.quant,
    fitLabel: item.fit_label,
    useCase: item.use_case,
    fitReason: item.fit_reason,
    score: item.score,
  }));
}

function recommendationMachineText(payload: DownloadRecommendationsResponse | null) {
  const machine = payload?.machine;
  const ramGb = Number(machine?.ram_gb || 0);
  const vramGb = Number(machine?.vram_gb || 0);
  const platform = String(machine?.platform || "");
  const architecture = String(machine?.architecture || "");
  if (ramGb || vramGb) {
    if (!vramGb && platform.toLowerCase() === "darwin" && ["arm64", "aarch64"].includes(architecture.toLowerCase())) {
      return `${Math.round(ramGb || 0)} GB Apple unified memory detected`;
    }
    return `${Math.round(ramGb || 0)} GB RAM${vramGb ? `, ${Math.round(vramGb)} GB VRAM` : ""} detected`;
  }
  return "Conservative picks shown until hardware details are available.";
}

function formatTime(datetime: unknown) {
  if (datetime == null || datetime === "") return "-";
  const value = String(datetime).trim();
  if (!value) return "-";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return parsed.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function inventoryForRecommended(item: RecommendedDownload, localGgufs: GgufFile[], nodes: NodeRecord[]): RecommendedInventory {
  const local = localGgufs.find((file) => matchesRecommendedFile(file, item));
  if (local) {
    return {
      status: "local",
      label: "On this machine",
      detail: String(local.path || local.filename || item.includeFile),
      remoteSource: null,
    };
  }
  for (const node of nodes) {
    if (!node?.reachable || !node.name || !Array.isArray(node.models)) continue;
    const model = node.models.find((candidate) => matchesRecommendedFile(candidate, item) && modelFileId(candidate));
    if (model) {
      return {
        status: "remote",
        label: "Elsewhere in fleet",
        detail: `${node.name} has ${modelName(model)}`,
        remoteSource: { node: node.name, modelName: modelName(model), fileId: modelFileId(model) },
      };
    }
  }
  return {
    status: "missing",
    label: "Missing",
    detail: "Not found locally or on reachable nodes",
    remoteSource: null,
  };
}

type HfDownloadsData = {
  downloads: DownloadRecord[];
  recommendationPayload: DownloadRecommendationsResponse | null;
  recommendationError: string;
  localGgufs: GgufFile[];
  nodes: NodeRecord[];
};

async function loadHfDownloadsData(): Promise<HfDownloadsData> {
  const [downloadPayload, recommendationResult, ggufsPayload, nodePayload] = await Promise.all([
    listDownloadHistory(),
    listDownloadRecommendations()
      .then((payload) => ({ payload, error: "" }))
      .catch((err) => ({ payload: null, error: err instanceof Error ? err.message : "Recommendations unavailable" })),
    listGgufs().catch(() => []),
    getNodeModels().catch(() => []),
  ]);
  return {
    downloads: asDownloads(downloadPayload),
    recommendationPayload: recommendationResult.payload,
    recommendationError: recommendationResult.error,
    localGgufs: asGgufs(ggufsPayload),
    nodes: asNodes(nodePayload),
  };
}

export function HfDownloadsPage() {
  const appMode = useAppMode();
  const [transfer, setTransfer] = useState<HfTransferState | null>(null);
  const [repoId, setRepoId] = useState("");
  const [revision, setRevision] = useState("");
  const [targetNode, setTargetNode] = useState("");
  const [installModelName, setInstallModelName] = useState("");
  const [installPort, setInstallPort] = useState("8080");
  const [quants, setQuants] = useState<QuantRecord[]>([]);
  const [quantStatus, setQuantStatus] = useState("Select a repo to query remote GGUF quants.");

  const { data, loading, error, refresh } = useAsyncResource<HfDownloadsData>(loadHfDownloadsData, {
    downloads: [],
    recommendationPayload: null,
    recommendationError: "",
    localGgufs: [],
    nodes: [],
  });
  const { downloads, recommendationPayload, recommendationError, localGgufs, nodes } = data;

  useEffect(() => {
    if (!downloads.some((download) => download.status === "running")) return undefined;
    const intervalId = window.setInterval(() => {
      void refresh();
    }, 1500);
    return () => window.clearInterval(intervalId);
  }, [downloads, refresh]);

  async function onDiscover() {
    if (!repoId.trim()) {
      setQuantStatus("Enter a repo id first.");
      return;
    }
    setQuantStatus("Querying Hugging Face...");
    setQuants([]);
    try {
      const items = asQuants(await discoverQuants(repoId.trim(), revision.trim()));
      setQuants(items);
      setQuantStatus(items.length ? `${items.length} remote GGUF quant${items.length === 1 ? "" : "s"} found.` : "No remote GGUF quants found.");
    } catch (err) {
      setQuantStatus(err instanceof Error ? err.message : "Quant discovery failed");
    }
  }

  async function start(repo = repoId, includeFile = "", mmprojFile: string | null = null) {
    if (!repo.trim()) return;
    const payload: Record<string, unknown> = { revision: revision.trim() || null, include_file: includeFile || null };
    if (mmprojFile) payload.mmproj_file = mmprojFile;
    if (appMode === "controller" && targetNode) {
      await createJob({
        type: "model.install",
        target: `node:${targetNode}`,
        payload: {
          repo_id: repo.trim(),
          ...payload,
          model_name: installModelName.trim() || suggestedModelAlias(repo.trim(), includeFile),
          port: Number(installPort) || 8080,
          ctx: 4096,
          gpu_layers: 0,
          start: true,
        },
      });
    } else {
      await startDownload(repo.trim(), payload);
    }
    await refresh();
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    await start(repoId);
  }

  async function cancel(id: string) {
    await cancelDownload(id);
    await refresh();
  }

  async function remove(id: string) {
    await deleteDownload(id);
    await refresh();
  }

  function openTransfer(item: RecommendedDownload, source: RemoteGgufSource) {
    const destinations = transferDestinationOptions(nodes, source.node);
    setTransfer({
      item,
      source,
      destinationNode: destinations[0]?.name || "",
      status: "",
      submitting: false,
    });
  }

  async function submitTransfer() {
    if (!transfer?.destinationNode) return;
    setTransfer({ ...transfer, submitting: true, status: "" });
    try {
      const created = await createGgufTransfer(transfer.source.node, {
        destination_node: transfer.destinationNode,
        source_file_id: transfer.source.fileId,
        include: "selected_only",
      });
      setTransfer({ ...transfer, submitting: false, status: `Transfer ${created.id || ""} queued`.replace("  ", " ").trim() });
    } catch (err) {
      setTransfer({ ...transfer, submitting: false, status: err instanceof Error ? err.message : "Transfer failed" });
    }
  }

  const backendRecommendations = asRecommendations(recommendationPayload);
  const recommendations = backendRecommendations.filter(
    (item) => !localGgufs.some((file) => matchesRecommendedFile(file, item)),
  );
  const allRecommendedModelsLocal = backendRecommendations.length > 0 && recommendations.length === 0 && !recommendationError;
  const machineText = recommendationMachineText(recommendationPayload);
  const downloadTargetNodes = nodes
    .filter((node) => node.name && node.reachable)
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));

  return (
    <div className="hf-downloads-page-react">
      <div className="page-heading">
        <div><span className="eyebrow">Acquisition</span><h2>HF Downloads</h2></div>
        <Button type="button" onClick={() => void refresh()} disabled={loading}>{loading ? "Refreshing" : "Refresh"}</Button>
      </div>
      <ErrorBanner message={error} />

      <Panel className="download-panel">
        <section className="recommended-downloads" aria-label="Recommended model downloads">
          <div className="recommended-downloads-header">
            <div>
              <h3>Recommended for this machine</h3>
              <p className="muted">{machineText}</p>
              {recommendationError ? <p className="muted">Recommendations are unavailable. Manual downloads still work.</p> : null}
            </div>
          </div>
          <div className="recommended-download-cards">
            {allRecommendedModelsLocal ? <p className="muted">All recommended models are already available locally.</p> : null}
            {recommendations.map((item) => {
              const inventory = inventoryForRecommended(item, localGgufs, nodes);
              const canSend = inventory.remoteSource ? transferDestinationOptions(nodes, inventory.remoteSource.node).length > 0 : false;
              return (
                <RecommendationModelCard
                  key={`${item.repoId}:${item.includeFile}`}
                  item={item}
                  inventory={inventory}
                  canSend={canSend}
                  onSend={openTransfer}
                  onDownload={(recommendedItem) => void start(recommendedItem.repoId, recommendedItem.includeFile, recommendedItem.mmprojFile)}
                />
              );
            })}
          </div>
        </section>
        <form className="filter-bar download-form" onSubmit={onSubmit}>
          <FormField label="Repo ID"><input value={repoId} onChange={(event) => setRepoId(event.target.value)} placeholder="owner/model" /></FormField>
          <FormField label="Revision"><input value={revision} onChange={(event) => setRevision(event.target.value)} placeholder="revision (optional)" /></FormField>
          {appMode === "controller" ? (
            <FormField label="Target node">
              <select value={targetNode} onChange={(event) => setTargetNode(event.target.value)}>
                <option value="">This controller</option>
                {downloadTargetNodes.map((node) => <option key={node.name} value={node.name}>{node.name}</option>)}
              </select>
            </FormField>
          ) : null}
          {appMode === "controller" && targetNode ? (
            <>
              <FormField label="Model alias">
                <input value={installModelName} onChange={(event) => setInstallModelName(event.target.value)} placeholder={suggestedModelAlias(repoId)} />
              </FormField>
              <FormField label="Port">
                <input type="number" min={1024} max={65535} value={installPort} onChange={(event) => setInstallPort(event.target.value)} />
              </FormField>
            </>
          ) : null}
          <Button type="button" onClick={() => void onDiscover()}>Find Quants</Button>
          <Button type="submit">Download</Button>
          <span className="muted download-form-status">{quantStatus}</span>
        </form>
        <div className="download-quant-cards">
          {quants.map((quant) => {
            const path = quantPath(quant);
            const mmproj = mmprojPath(quant);
            return (
              <article className="model-card download-quant-card" key={path}>
                <strong>{field(quant, "filename", path)}</strong>
                <span>{path}</span>
                {mmproj ? <span>{mmproj}</span> : null}
                <small>{field(quant, "size", "unknown size")}</small>
                <Button type="button" onClick={() => void start(repoId, path, mmproj)} aria-label={`Download ${path}`}>Download</Button>
              </article>
            );
          })}
        </div>
      </Panel>

      <Panel title="Download History">
        {downloads.length === 0 ? <EmptyState message={loading ? "Loading downloads..." : "No download history yet."} /> : (
          <DataTable
            rows={downloads}
            emptyMessage="No download history yet."
            getRowKey={(row, index) => String(row.id || index)}
            columns={[
              { key: "repo", header: "Repo", render: (row) => field(row, "repo_id") },
              { key: "status", header: "Status", render: (row) => <StatusBadge tone={row.status === "running" ? "warning" : row.status === "complete" ? "success" : "muted"}>{field(row, "status")}</StatusBadge> },
              { key: "progress", header: "Progress", render: (row) => <DownloadProgress record={row} /> },
              { key: "started", header: "Started", render: (row) => formatTime(row.started_at) },
              { key: "finished", header: "Finished", render: (row) => formatTime(row.finished_at) },
              { key: "path", header: "Path", render: (row) => field(row, "local_path", field(row, "path")) },
              { key: "by", header: "By", render: (row) => field(row, "triggered_by") },
              { key: "actions", header: "Actions", render: (row) => {
                const id = String(row.id || "");
                const repo = field(row, "repo_id");
                return <div className="actions"><Button type="button" onClick={() => void start(repo)} aria-label={`Download ${repo}`}>Download</Button><Button type="button" onClick={() => void cancel(id)} disabled={row.status !== "running"} aria-label={`Stop ${repo}`}>Stop</Button><Button type="button" onClick={() => void remove(id)} disabled={row.status === "running"} aria-label={`Delete ${repo}`}>Delete</Button></div>;
              } },
            ]}
          />
        )}
      </Panel>

      <Modal title={transfer ? `Send ${transfer.item.title}` : "Send Model"} open={Boolean(transfer)} onClose={() => setTransfer(null)}>
        {transfer ? (
          <div className="library-detail">
            <p className="muted">Send {transfer.item.includeFile} from {transfer.source.node}.</p>
            <dl className="detail-list">
              <div><dt>Source</dt><dd>{transfer.source.node}</dd></div>
              <div><dt>File ID</dt><dd>{transfer.source.fileId}</dd></div>
            </dl>
            <FormField label="Destination node">
              <select value={transfer.destinationNode} onChange={(event) => setTransfer({ ...transfer, destinationNode: event.target.value })}>
                {transferDestinationOptions(nodes, transfer.source.node).map((node) => <option key={node.name} value={node.name}>{node.name}</option>)}
              </select>
            </FormField>
            {transfer.status ? <p className="muted">{transfer.status}</p> : null}
            <div className="modal-actions">
              <Button type="button" onClick={() => void submitTransfer()} disabled={!transfer.destinationNode || transfer.submitting}>
                {transfer.submitting ? "Sending" : "Start Transfer"}
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
