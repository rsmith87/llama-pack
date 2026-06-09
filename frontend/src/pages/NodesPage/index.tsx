import "./styles.css";
import { useMemo, useState } from "react";
import { createGgufTransfer } from "../../api/library";
import { useAsyncResource } from "../../hooks/useAsyncResource";
import { getNodeModels, getTransfer, listNodes, restartNodeModel, startNodeModel, stopNodeModel, updateNode } from "../../api/nodes";
import { EmptyState, ErrorBanner, FormField, Modal, Panel, StatusBadge, Button } from "../../components/ui";
import type { LogSelection } from "../../components/LogModal";
import { isActiveModel } from "../../features/models/modelStatus";
import { filterNodes, mergeNodeInventory, nodeEditFormDefaults, nodeSummary, sortModelsForDisplay, transferDestinationOptions, type NodeRecord } from "../../features/nodes/nodesView";
import type { TransferState } from "../../types/nodes";
import { SendModelModal } from "../../components/SendModelModal";
import { modelName, modelFileId } from "../../features/models";

type NodeEditState = {
  name: string;
  url: string;
  api_key: string;
  verify_tls: boolean;
};

type NodesPageProps = {
  onOpenLogs?: (selection?: Omit<LogSelection, "requestId">) => void;
};

function asNodeArray(payload: unknown): NodeRecord[] {
  if (Array.isArray(payload)) return payload as NodeRecord[];
  const nodes = (payload as { nodes?: NodeRecord[] } | null)?.nodes;
  return Array.isArray(nodes) ? nodes : [];
}

function isSendableGgufModel(node: NodeRecord, model: Record<string, unknown>) {
  const path = String(model.model_path || model.path || model.filename || "").toLowerCase();
  return Boolean(node.reachable && modelFileId(model) && path.endsWith(".gguf"));
}

function transferProgressText(transfer: Record<string, unknown> | null) {
  if (!transfer) return "";
  const total = transfer.files_total;
  const copied = transfer.files_copied;
  const skipped = transfer.files_skipped;
  if (total == null && copied == null && skipped == null) return "";
  return `${Number(copied || 0)}/${Number(total || 0)} files copied, ${Number(skipped || 0)} skipped`;
}

export function NodesPage({ onOpenLogs }: NodesPageProps = {}) {
  const { data: nodes, loading, error, refresh, setError } = useAsyncResource<NodeRecord[]>(
    () => Promise.all([listNodes(), getNodeModels()])
      .then(([configuredPayload, modelsPayload]) => mergeNodeInventory(asNodeArray(configuredPayload), asNodeArray(modelsPayload))),
    [],
  );
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [registration, setRegistration] = useState("");
  const [editNode, setEditNode] = useState<NodeEditState | null>(null);
  const [transfer, setTransfer] = useState<TransferState | null>(null);

  const filteredNodes = useMemo(() => filterNodes(nodes, { query, status, registration }), [nodes, query, status, registration]);
  const summary = nodeSummary(nodes);

  function openEdit(node: NodeRecord) {
    setEditNode(nodeEditFormDefaults(node));
  }

  async function saveEdit() {
    if (!editNode?.name || !editNode.url) return;
    await updateNode(editNode.name, {
      url: editNode.url,
      api_key: editNode.api_key,
      verify_tls: editNode.verify_tls,
    });
    setEditNode(null);
    await refresh();
  }

  async function runModelAction(nodeName: string, name: string, action: "start" | "stop" | "restart") {
    if (action === "start") await startNodeModel(nodeName, name);
    if (action === "stop") await stopNodeModel(nodeName, name);
    if (action === "restart") await restartNodeModel(nodeName, name);
    await refresh();
  }

  function openTransfer(node: NodeRecord, model: Record<string, unknown>) {
    const sourceNode = String(node.name || "");
    const destinations = transferDestinationOptions(nodes, sourceNode);
    setTransfer({
      sourceNode,
      modelName: modelName(model),
      sourceFileId: modelFileId(model),
      destinationNode: String(destinations[0]?.name || ""),
      include: "selected_with_sidecars",
      status: null,
      submitting: false,
    });
  }

  async function submitTransfer() {
    if (!transfer?.sourceNode || !transfer.destinationNode || !transfer.sourceFileId) return;
    setError("");
    setTransfer({ ...transfer, submitting: true });
    try {
      const created = await createGgufTransfer(transfer.sourceNode, {
        destination_node: transfer.destinationNode,
        source_file_id: transfer.sourceFileId,
        include: transfer.include,
      });
      const id = String(created.id || "");
      const current = id ? await getTransfer(id) : created;
      setTransfer((existing) => existing ? { ...existing, status: current, submitting: false } : existing);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start transfer");
      setTransfer((existing) => existing ? { ...existing, submitting: false } : existing);
    }
  }

  const transferDestinations = transfer ? transferDestinationOptions(nodes, transfer.sourceNode) : [];
  const transferProgress = transferProgressText(transfer?.status || null);

  return (
    <div className="nodes-page-react">
      <div className="page-heading">
        <div>
          <span className="eyebrow">Fleet</span>
          <h2>Nodes</h2>
        </div>
        <span className="muted">{summary.reachable}/{summary.total} reachable nodes, {summary.models} reported models</span>
      </div>

      <div className="filter-bar nodes-filter-bar">
        <FormField label="Node or URL">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="node or url" />
        </FormField>
        <FormField label="Status">
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">all</option>
            <option value="reachable">reachable</option>
            <option value="offline">offline</option>
          </select>
        </FormField>
        <FormField label="Registration">
          <select value={registration} onChange={(event) => setRegistration(event.target.value)}>
            <option value="">all registrations</option>
            <option value="static">static</option>
            <option value="dynamic">dynamic</option>
          </select>
        </FormField>
        <Button type="button" onClick={refresh} disabled={loading}>{loading ? "Refreshing" : "Refresh Nodes"}</Button>
      </div>

      <Panel className="nodes-page-panel">
        <ErrorBanner message={error} />
        {!error && filteredNodes.length === 0 ? <EmptyState message={loading ? "Loading nodes..." : "No nodes match the current filters."} /> : null}
        <div className="nodes-page-list">
          {filteredNodes.map((node) => (
            <article className="node node-full" key={node.name || node.url}>
              <div className="node-header">
                <div>
                  <strong>{node.name || "unnamed node"}</strong>
                  <div className="node-url">{node.url || "-"}</div>
                </div>
                <div className="node-header-actions">
                  <StatusBadge tone={node.reachable ? "success" : "danger"}>{node.reachable ? "reachable" : "offline"}</StatusBadge>
                  <StatusBadge tone={!node.heartbeat_fresh ? "danger": "success"}>{!node.heartbeat_fresh ? "stale" : "fresh"}</StatusBadge>
                  <Button type="button" onClick={() => openEdit(node)} aria-label={`Edit ${node.name}`}>Edit Node</Button>
                </div>
              </div>

              <div className="model-cards">
                {node.models?.length ? sortModelsForDisplay(node.models).map((model) => {
                  const name = modelName(model);
                  return (
                    <article className={`model-card ${isActiveModel(model) ? "active" : ""}`.trim()} key={name}>
                      <strong>{name}</strong>
                      <span>{String(model.status || "available")}</span>
                      <div className="model-actions">
                        <button type="button" onClick={() => void runModelAction(node.name || "", name, "start")} aria-label={`Start ${name} on ${node.name}`}>Start</button>
                        <button type="button" onClick={() => void runModelAction(node.name || "", name, "stop")} aria-label={`Stop ${name} on ${node.name}`}>Stop</button>
                        <button type="button" onClick={() => void runModelAction(node.name || "", name, "restart")} aria-label={`Restart ${name} on ${node.name}`}>Restart</button>
                        <button
                          type="button"
                          onClick={() => onOpenLogs?.({
                            source: "node-model",
                            identifier: name,
                            node: node.name || "",
                            autoLoad: true,
                          })}
                          aria-label={`View logs for ${name} on ${node.name}`}
                        >
                          Logs
                        </button>
                        {isSendableGgufModel(node, model) ? (
                          <button type="button" onClick={() => openTransfer(node, model)} aria-label={`Send ${name} from ${node.name}`}>Send</button>
                        ) : null}
                      </div>
                    </article>
                  );
                }) : <EmptyState message={String(node.error || "No models reported.")} />}
              </div>
            </article>
          ))}
        </div>
      </Panel>

      <Modal title={editNode ? `Edit ${editNode.name}` : "Edit Node"} open={Boolean(editNode)} onClose={() => setEditNode(null)}>
        {editNode ? (
          <div className="node-edit-form">
            <input type="hidden" value={editNode.name} readOnly />
            <FormField label="URL">
              <input value={editNode.url} onChange={(event) => setEditNode({ ...editNode, url: event.target.value })} type="url" />
            </FormField>
            <FormField label="API key">
              <input value={editNode.api_key} onChange={(event) => setEditNode({ ...editNode, api_key: event.target.value })} type="password" placeholder="leave blank for none" />
            </FormField>
            <label className="checkbox-label"><input checked={editNode.verify_tls} onChange={(event) => setEditNode({ ...editNode, verify_tls: event.target.checked })} type="checkbox" /><span>Verify TLS</span></label>
            <Button type="button" onClick={() => void saveEdit()}>Save Node</Button>
          </div>
        ) : null}
      </Modal>

      <SendModelModal
        transfer={transfer}
        destinationOptions={transferDestinations}
        onClose={() => setTransfer(null)}
        onChangeDestination={(value) => setTransfer((t) => t ? { ...t, destinationNode: value } : t)}
        onSubmit={() => void submitTransfer()}
        progressText={transferProgress}
        progressErrorDetail={transfer?.status ? String(transfer.status.error_detail || "") : undefined}
        includeOptions={[{ value: "selected_with_sidecars", label: "Selected + sidecars" }]}
      />
    </div>
  );
}
