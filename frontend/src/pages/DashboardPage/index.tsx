import "./styles.css";
import { useEffect, useState } from "react";
import { loadDashboardData } from "../../api/health";
import { createGgufTransfer } from "../../api/library";
import { startModel, stopModel } from "../../api/models";
import { startNodeModel, stopNodeModel } from "../../api/nodes";
import { Button, EmptyState, ErrorBanner, Panel } from "../../components/ui";
import { NodeCard } from "../../components/NodeCard";
import { DashboardModelCard, modelName, statusTone } from "../../components/DashboardModelCard";
import type { LogSelection } from "../../components/LogModal";
import type { DashboardData, LocalModel } from "../../types/api";
import type { PageKey } from "../../components/AppShell";
import type { PageNavigationOptions } from "../../routes/pages";
import { isActiveModel } from "../../features/models/modelStatus";
import { transferDestinationOptions, type NodeRecord } from "../../features/nodes/nodesView";
import { benchmarkSearch } from "../../features/benchmarks/handoff";
import type { TransferState } from "../../types/nodes";
import { SendModelModal } from "../../components/SendModelModal";

type DashboardPageProps = {
  onNavigate: (page: PageKey, options?: PageNavigationOptions) => void;
  onOpenLogs?: (selection?: Omit<LogSelection, "requestId">) => void;
};

const emptyData: DashboardData = {
  health: null,
  localModels: [],
  nodes: [],
};

function chatSearch(model: string, target: string, mode: "direct" | "thread", source: string): string {
  const params = new URLSearchParams();
  params.set("model", model);
  params.set("target", target);
  params.set("mode", mode);
  params.set("source", source);
  return params.toString();
}

function metricPercent(
  health: DashboardData["health"],
  flatKey: "cpu_percent" | "memory_percent" | "vram_percent",
  nestedKey: "cpu" | "ram" | "vram",
): number | null {
  const system = health?.system as Record<string, unknown> | undefined;
  const flat = system?.[flatKey];
  if (typeof flat === "number") return flat;
  const nested = system?.[nestedKey] as Record<string, unknown> | null | undefined;
  const nestedPercent = nested?.percent;
  if (typeof nestedPercent === "number") return nestedPercent;
  return null;
}

function percent(value: number | null | undefined): string {
  return typeof value === "number" ? `${Math.round(value)}%` : "-";
}

function modelFileId(model: LocalModel): string {
  return String(model.file_id || model.id || "");
}

function isGgufBacked(model: LocalModel): boolean {
  const path = String(model.model_path || model.path || model.model || "").toLowerCase();
  return Boolean(modelFileId(model) && path.endsWith(".gguf"));
}

function modelNode(model: LocalModel, data: DashboardData): string | null {
  const directNode = model.node || model.node_name;
  if (directNode) return directNode;
  const matchingNode = data.nodes.find((node) => node.models?.some((nodeModel) => modelName(nodeModel) === modelName(model)));
  return (matchingNode?.name || matchingNode?.node_id || null);
}

function modelForNode(node: DashboardData["nodes"][number], nodeModel: LocalModel, data: DashboardData): LocalModel {
  const expectedNode = nodeName(node);
  const expectedModel = modelName(nodeModel);
  return data.localModels.find((model) => {
    const localNode = model.node || model.node_name || modelNode(model, data);
    if (!localNode && expectedNode === "controller-local") return modelName(model) === expectedModel;
    return localNode === expectedNode && modelName(model) === expectedModel;
  }) || { ...nodeModel, node: expectedNode };
}

function nodeName(node: { name?: string; node_id?: string }): string {
  return String(node.name || node.node_id || "");
}

function asNodeRecords(nodes: DashboardData["nodes"]): NodeRecord[] {
  return nodes.map((node) => ({
    ...node,
    name: nodeName(node),
  }));
}

export function DashboardPage({ onNavigate, onOpenLogs }: DashboardPageProps) {
  const [data, setData] = useState<DashboardData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actingModel, setActingModel] = useState("");
  const [transfer, setTransfer] = useState<TransferState | null>(null);

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      setData(await loadDashboardData());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  }

  async function runModelAction(model: LocalModel, action: "start" | "stop") {
    const name = modelName(model);
    const node = modelNode(model, data);
    setActingModel(`${action}:${name}`);
    setError("");
    try {
      if (node) {
        if (action === "start") await startNodeModel(node, name);
        if (action === "stop") await stopNodeModel(node, name);
      } else {
        if (action === "start") await startModel(name);
        if (action === "stop") await stopModel(name);
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${action} ${name}`);
    } finally {
      setActingModel("");
    }
  }

  function openTransfer(model: LocalModel) {
    const name = modelName(model);
    const sourceNode = modelNode(model, data) || "";
    const destinations = transferDestinationOptions(asNodeRecords(data.nodes), sourceNode);
    setTransfer({
      sourceNode,
      modelName: name,
      sourceFileId: modelFileId(model),
      destinationNode: String(destinations[0]?.name || ""),
      include: "selected_with_sidecars",
      status: null,
      submitting: false,
    });
  }

  async function submitTransfer() {
    if (!transfer?.sourceNode || !transfer.destinationNode || !transfer.sourceFileId || transfer.sourceNode === transfer.destinationNode) return;
    setError("");
    setTransfer({ ...transfer, submitting: true });
    try {
      const created = await createGgufTransfer(transfer.sourceNode, {
        destination_node: transfer.destinationNode,
        source_file_id: transfer.sourceFileId,
        include: transfer.include,
      });
      setTransfer((existing) => existing ? { ...existing, status: created, submitting: false } : existing);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start transfer");
      setTransfer((existing) => existing ? { ...existing, submitting: false } : existing);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const mode = data.health?.mode || "unknown";
  const isController = mode === "controller";
  const nodeRecords = asNodeRecords(data.nodes);
  const controllerNodes = (() => {
    const byName = new Map<string, DashboardData["nodes"][number]>();
    for (const node of data.nodes) byName.set(nodeName(node) || "unnamed node", node);
    for (const model of data.localModels) {
      const name = model.node || model.node_name || "controller-local";
      const existing = byName.get(name);
      const models = existing?.models || [];
      if (models.some((nodeModel) => modelName(nodeModel) === modelName(model))) continue;
      byName.set(name, {
        ...(existing || { name, reachable: true, status: name === "controller-local" ? "local" : "reachable" }),
        models: [...models, model],
      });
    }
    return [...byName.values()];
  })();

  function renderModelCard(model: LocalModel, key: string) {
    const name = modelName(model);
    const resolvedNode = modelNode(model, data);
    const destinationOptions = resolvedNode ? transferDestinationOptions(nodeRecords, resolvedNode) : [];
    const canSend = Boolean(resolvedNode && isGgufBacked(model) && destinationOptions.length);
    return (
      <DashboardModelCard
        key={key}
        model={model}
        resolvedNode={resolvedNode}
        canSend={canSend}
        actingModel={actingModel}
        onOpen={() => onNavigate("gguf-library")}
        onStart={() => void runModelAction(model, "start")}
        onStop={() => void runModelAction(model, "stop")}
        onChat={() => onNavigate("chat", {
          search: chatSearch(name, resolvedNode ? `node:${resolvedNode}` : "auto", resolvedNode ? "thread" : "direct", "dashboard"),
        })}
        onBenchmark={() => onNavigate("benchmarks", {
          search: benchmarkSearch(name, resolvedNode ? `node:${resolvedNode}` : "auto", resolvedNode || "", "dashboard"),
        })}
        onTransfer={() => openTransfer(model)}
        onLogs={() => onOpenLogs?.({
          source: resolvedNode ? "node-model" : "model",
          identifier: name,
          node: resolvedNode || undefined,
          autoLoad: true,
        })}
      />
    );
  }

  return (
    <div className="dashboard-page">
      <Panel
        className="health-panel dashboard-health"
        eyebrow="Live Health"
        title="System Snapshot"
        actions={(
          <Button type="button" onClick={refresh} disabled={loading}>
            {loading ? "Refreshing" : "Refresh"}
          </Button>
        )}
      >
        <ErrorBanner message={error} />
        <div className="metric-grid">
          <div><span className="label">Mode</span><strong>{mode}</strong></div>
          <div><span className="label">CPU</span><strong>{percent(metricPercent(data.health, "cpu_percent", "cpu"))}</strong></div>
          <div><span className="label">RAM</span><strong>{percent(metricPercent(data.health, "memory_percent", "ram"))}</strong></div>
          <div><span className="label">VRAM</span><strong>{percent(metricPercent(data.health, "vram_percent", "vram"))}</strong></div>
          <div>
            <span className="label">Configured</span>
            <strong>{data.health?.configured_models ?? (data.health as { models_configured?: number } | null)?.models_configured ?? data.localModels.length}</strong>
          </div>
        </div>
      </Panel>

      {mode !== "agent" ? (
        <Panel
          className="dashboard-controller-nodes"
          eyebrow="Controller view"
          title="All Nodes"
          actions={<Button type="button" onClick={() => onNavigate("nodes")}>Manage Nodes</Button>}
        >
          <div className="controller-node-grid">
            {controllerNodes.length === 0 ? <EmptyState message="No controller nodes reported." /> : null}
            {controllerNodes.map((node, index) => {
              const name = nodeName(node) || "unnamed node";
              const models = node.models || [];
              const nodeStatus = node.reachable === false ? "offline" : node.status || "reachable";
              const nodeTone = node.reachable === false ? "danger" : statusTone(node.status || "reachable");
              return (
                <NodeCard
                  key={`${name}-${index}`}
                  name={name}
                  statusLabel={nodeStatus}
                  badgeTone={nodeTone}
                  modelCount={models.length}
                  onOpenNode={() => onNavigate("nodes")}
                  emptyMessage="No models reported for this node."
                >
                  {models.map((nodeModel, modelIndex) => renderModelCard(modelForNode(node, nodeModel, data), `${name}-${modelName(nodeModel)}-${modelIndex}`))}
                </NodeCard>
              );
            })}
          </div>
        </Panel>
      ) : (
        <Panel
          className="dashboard-models"
          eyebrow="This agent"
          title="Local Models"
          actions={<Button type="button" onClick={() => onNavigate("gguf-library")}>Add Model</Button>}
        >
          <div className="library-cards">
            {data.localModels.length === 0 ? <EmptyState message="No local models reported." /> : null}
            {data.localModels.map((model, index) => renderModelCard(model, `${modelName(model)}-${index}`))}
          </div>
        </Panel>
      )}

      <SendModelModal
        transfer={transfer}
        destinationOptions={transferDestinationOptions(nodeRecords, transfer?.sourceNode || "")}
        onClose={() => setTransfer(null)}
        onChangeDestination={(value) => setTransfer((t) => t ? { ...t, destinationNode: value } : t)}
        onChangeInclude={(value) => setTransfer((t) => t ? { ...t, include: value } : t)}
        onSubmit={() => void submitTransfer()}
      />

      <Panel className="quick-actions-panel" eyebrow="Shortcuts" title="Quick Actions">
        <div className="quick-actions">
          <button type="button" className="quick-action" onClick={() => onNavigate("chat")}><strong>Open Chat</strong><small>Smoke test a route</small></button>
          <button type="button" className="quick-action" onClick={() => onNavigate("quantization")}><strong>Quantize</strong><small>Fit a model to VRAM</small></button>
          <button type="button" className="quick-action" onClick={() => onNavigate("controller-ops")}><strong>Controller</strong><small>Jobs and nodes</small></button>
        </div>
      </Panel>
    </div>
  );
}
