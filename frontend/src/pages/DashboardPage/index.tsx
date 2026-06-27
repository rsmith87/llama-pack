import "./styles.css";
import { useMemo, useState } from "react";
import { loadDashboardData } from "../../api/health";
import { useAsyncResource } from "../../hooks/useAsyncResource";
import { createGgufTransfer } from "../../api/library";
import { startModel, stopModel, setFavorite } from "../../api/models";
import { startNodeModel, stopNodeModel } from "../../api/nodes";
import { Button, EmptyState, ErrorBanner, Panel } from "../../components/ui";
import { NodeCard } from "../../components/NodeCard";
import { ModelCard } from "../../components/ModelCard";
import { ModelCarousel } from "../../components/ModelCarousel";
import { useLogModal } from "../../features/logs/logModalContext";
import type { DashboardData, LocalModel } from "../../types/index";
import { useNavigateToPage } from "../../hooks/useNavigateToPage";
import { nodeVisibilityDetails, transferDestinationOptions, type NodeRecord } from "../../features/nodes/nodesView";
import { benchmarkSearch } from "../../features/benchmarks/handoff";
import type { TransferState } from "../../types/nodes";
import { SendModelModal } from "../../components/SendModelModal";
import { modelName, statusTone } from "../../features/models";
import { isActiveModel } from "../../features/models/modelStatus";
import { librarySelectionSearch } from "../../features/ggufLibrary";
import { TIMERS } from "../../constants";
import { 
  percent,
  modelActionTargetLabel,
  modelFileId,
  modelNode,
  modelForNode,
  nodeName,
  certBadge,
  asNodeRecords,
  metricPercent
} from "../../features/models";

const emptyData: DashboardData = {
  health: null,
  localModels: [],
  nodes: [],
};

function loadDashboard() {
  return loadDashboardData();
}

function chatSearch(model: string, target: string, mode: "direct" | "thread", source: string): string {
  const params = new URLSearchParams();
  params.set("model", model);
  params.set("target", target);
  params.set("mode", mode);
  params.set("source", source);
  return params.toString();
}

function runningFirstModels(models: LocalModel[]): LocalModel[] {
  return models
    .map((model, index) => ({ model, index }))
    .sort((a, b) => {
      const runningDelta = Number(isActiveModel(b.model)) - Number(isActiveModel(a.model));
      if (runningDelta !== 0) return runningDelta;
      return a.index - b.index;
    })
    .map(({ model }) => model);
}

export function DashboardPage() {
  const { openLogs } = useLogModal();
  const navigateToPage = useNavigateToPage();
  const { data, loading, error, refresh, setError } = useAsyncResource<DashboardData>(loadDashboard, emptyData);
  const [actingModel, setActingModel] = useState("");
  const [transfer, setTransfer] = useState<TransferState | null>(null);

  async function toggleFavorite(model: LocalModel) {
    const name = modelName(model);
    const currently = Boolean((model as Record<string, unknown>).favorite);
    setActingModel(`favorite:${name}`);
    setError("");
    try {
      await setFavorite(name, !currently);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to favorite ${name}`);
    } finally {
      setActingModel("");
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

  const mode = data.health?.mode || "unknown";
  const isController = mode === "controller";
  const carouselModels = useMemo(() => runningFirstModels(data.localModels), [data.localModels]);
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
  const expiredCertNodes = controllerNodes
    .filter((node) => typeof node.cert_expires_in_seconds === "number" && node.cert_expires_in_seconds <= 0)
    .map((node) => nodeName(node) || "unnamed node");
  const expiringCertNodes = controllerNodes
    .filter((node) => {
      const expiry = node.cert_expires_in_seconds;
      return typeof expiry === "number" && expiry > 0 && expiry <= TIMERS.CERT_EXPIRING_SOON_SECONDS;
    })
    .map((node) => {
      const expiry = Number(node.cert_expires_in_seconds);
      return `${nodeName(node) || "unnamed node"} (${Math.max(1, Math.ceil(expiry / TIMERS.DAY_SECONDS))}d)`;
    });

  function renderModelCard(model: LocalModel, key: string) {
    const name = modelName(model);
    const resolvedNode = modelNode(model, data);
    const nodeRecord = resolvedNode ? nodeRecords.find((node) => node.name === resolvedNode) : undefined;
    return (
      <ModelCard
        key={key}
        model={model}
        resolvedNode={resolvedNode}
        actingModel={actingModel}
        actionTargetLabel={modelActionTargetLabel({
          resolvedNode,
          hasControllerAction: Boolean(resolvedNode),
          reachable: nodeRecord?.reachable !== false,
        })}
        onOpen={() => navigateToPage("gguf-library", {
          search: librarySelectionSearch(name, resolvedNode || "", String(model.file_id || "")),
        })}
        onStart={() => void runModelAction(model, "start")}
        onStop={() => void runModelAction(model, "stop")}
        onChat={() => navigateToPage("chat", {
          search: chatSearch(name, resolvedNode ? `node:${resolvedNode}` : "auto", resolvedNode ? "thread" : "direct", "dashboard"),
        })}
        onBenchmark={() => navigateToPage("benchmarks", {
          search: benchmarkSearch(name, resolvedNode ? `node:${resolvedNode}` : "auto", resolvedNode || "", "dashboard"),
        })}
        onFavorite={() => void toggleFavorite(model)}
        onTransfer={() => openTransfer(model)}
        onLogs={() => openLogs({
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
          <div><span className="label">VRAM</span><strong>{metricPercent(data.health, "vram_percent", "vram") ? percent(metricPercent(data.health, "vram_percent", "vram")) : 'unified'}</strong></div>
          <div>
            <span className="label">Configured</span>
            <strong>{data.health?.configured_models ?? (data.health as { models_configured?: number } | null)?.models_configured ?? data.localModels.length}</strong>
          </div>
        </div>
      </Panel>

      {data.health?.diagnostics?.length ? (
        <Panel className="dashboard-security-alerts" eyebrow="Security Diagnostics" title="Network Exposure">
          {data.health.diagnostics.map((diagnostic) => (
            <p key={`${diagnostic.id}-${diagnostic.evidence}`} className="dashboard-security-alert" role={diagnostic.severity === "error" ? "alert" : "status"}>
              <strong>{diagnostic.message}</strong>
              <span>{diagnostic.evidence}</span>
              <span>{diagnostic.action}</span>
            </p>
          ))}
        </Panel>
      ) : null}

      {isController && (expiredCertNodes.length > 0 || expiringCertNodes.length > 0) ? (
        <Panel className="dashboard-cert-alerts" eyebrow="TLS Alerts" title="Node Certificates">
          {expiredCertNodes.length > 0 ? (
            <p className="dashboard-cert-alert dashboard-cert-alert-danger" role="alert">
              <strong>Expired:</strong> {expiredCertNodes.join(", ")}
            </p>
          ) : null}
          {expiringCertNodes.length > 0 ? (
            <p className="dashboard-cert-alert dashboard-cert-alert-warning">
              <strong>Expiring soon:</strong> {expiringCertNodes.join(", ")}
            </p>
          ) : null}
        </Panel>
      ) : null}

      {mode !== "agent" ? (
        <Panel
          className="dashboard-controller-nodes"
          eyebrow="Controller view"
          title="All Nodes"
          actions={<Button type="button" onClick={() => navigateToPage("nodes")}>Manage Nodes</Button>}
        >
          <div className="controller-node-grid">
            {controllerNodes.length === 0 ? <EmptyState message="No controller nodes reported." /> : null}
            {controllerNodes.map((node, index) => {
              const name = nodeName(node) || "unnamed node";
              const models = node.models || [];
              const nodeStatus = node.reachable === false ? "offline" : node.status || "reachable";
              const nodeTone = node.reachable === false ? "danger" : statusTone(node.status || "reachable");
              const cert = certBadge(node.cert_expires_in_seconds);
              const visibility = nodeVisibilityDetails(node);
              return (
                <NodeCard
                  key={`${name}-${index}`}
                  name={name}
                  statusLabel={nodeStatus}
                  badgeTone={nodeTone}
                  certLabel={cert.label}
                  certTone={cert.tone}
                  modelCount={models.length}
                  details={[
                    visibility.reachability,
                    visibility.heartbeat,
                    visibility.cert,
                    visibility.placement,
                    visibility.actionTarget,
                  ]}
                  onOpenNode={() => navigateToPage("nodes")}
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
          title="Models ready to go"
          actions={<Button type="button" onClick={() => navigateToPage("gguf-library")}>Add Model</Button>}
        >
          {data.localModels.length === 0 ? (
            <EmptyState message="No local models reported." />
          ) : (
            <ModelCarousel
              items={carouselModels}
              slidesPerView={3}
              renderItem={(item, index) =>
                renderModelCard(item as LocalModel, `${modelName(item as LocalModel)}-${index}`)
              }
            />
          )}
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
          <button type="button" className="quick-action" onClick={() => navigateToPage("chat")}><strong>Open Chat</strong><small>Smoke test a route</small></button>
          <button type="button" className="quick-action" onClick={() => navigateToPage("quantization")}><strong>Quantize</strong><small>Fit a model to VRAM</small></button>
          {isController && (<button type="button" className="quick-action" onClick={() => navigateToPage("controller-ops")}><strong>Controller</strong><small>Jobs and nodes</small></button>)}
        </div>
      </Panel>
    </div>
  );
}
