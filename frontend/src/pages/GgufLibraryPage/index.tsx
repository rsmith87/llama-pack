import "./styles.css";
import { useMemo, useState } from "react";
import { useAsyncResource } from "../../hooks/useAsyncResource";
import { createGgufTransfer, addGgufModel, deleteConfiguredModel, deleteGguf, listGgufs, updateGgufAsset, updateGgufModel } from "../../api/library";
import { getNodeGgufs, getNodeModels, listNodes } from "../../api/nodes";
import { useAppMode } from "../../features/appMode/appModeContext";
import { Button, EmptyState, ErrorBanner, FormField, Modal, Panel, StatusBadge } from "../../components/ui";
import { ModelCard } from "../../components/ModelCard";
import { ModelNavigator } from "../../components/ModelNavigator";
import { NodeNavigator, type NodeNavigatorNode } from "../../components/NodeNavigator";
import { isActiveModel } from "../../features/models/modelStatus";
import { buildModelNavigatorLines, type ModelNavigatorQuant } from "../../features/models/modelNavigator";
import { receivedBadgeText, sortModelsForDisplay, suggestedGgufModelName, suggestedPromptTemplate, type NodeRecord } from "../../features/nodes/nodesView";
import { PROMPT_TEMPLATE_OPTIONS } from "../../constants";
import { useNavigate } from "react-router-dom";
import type { GgufFile } from "../../types/index";
import { GgufLibraryData } from "../../types";
import { 
  chatSearch,
  compactPath,
  fileName, 
  asFiles,
  fileId,
  isMmproj,
  sizeLabel,
  asNodes,
  isTransferReachableNode
} from "../../features/ggufLibrary";

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.length > 0) : [];
}

function catalogSummary(file: GgufFile): string | null {
  const catalog = typeof file.model_catalog === "object" && file.model_catalog ? file.model_catalog : null;
  if (!catalog) return null;
  const parts: string[] = [];
  if (typeof catalog.ctx === "number") parts.push(`ctx ${catalog.ctx}`);
  if (typeof catalog.gpu_layers === "number") parts.push(`${catalog.gpu_layers} GPU layers`);
  if (typeof catalog.reasoning === "string" && catalog.reasoning) parts.push(`reasoning ${catalog.reasoning}`);
  if (typeof catalog.prompt_template === "string" && catalog.prompt_template) parts.push(`template ${catalog.prompt_template}`);
  const strengths = asStringArray(catalog.strengths);
  if (strengths.length) parts.push(strengths.join(", "));
  if (typeof catalog.cost_tier === "string" && catalog.cost_tier) parts.push(`tier ${catalog.cost_tier}`);
  return parts.length ? parts.join(" · ") : null;
}

function profileSummary(file: GgufFile): string | null {
  const profiles = Array.isArray(file.model_profiles) ? file.model_profiles : [];
  const labels = profiles
    .map((profile) => (typeof profile.label === "string" && profile.label ? profile.label : typeof profile.profile_key === "string" ? profile.profile_key : ""))
    .filter((label) => label.length > 0);
  return labels.length ? labels.join(", ") : null;
}

function deploymentSummary(file: GgufFile): string | null {
  const deployments = Array.isArray(file.model_deployments) ? file.model_deployments : [];
  const deployment = deployments[0];
  if (!deployment) return null;
  const host = typeof deployment.host === "string" ? deployment.host : "";
  const port = typeof deployment.port === "number" ? deployment.port : null;
  const profileKey = typeof deployment.profile_key === "string" && deployment.profile_key ? deployment.profile_key : null;
  if (!host || port === null) return null;
  return `${host}:${port}${profileKey ? ` (${profileKey})` : ""}`;
}

function MmprojPicker({ files, value, onChange }: { files: GgufFile[]; value: string; onChange: (v: string) => void }) {
  const candidates = files.filter((f) => fileName(f).toLowerCase().includes("mmproj"));
  const inList = candidates.some((f) => f.path === value);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", flexFlow: "column"}}>
      {candidates.length > 0 ? (
        <select
          value={inList ? value : ""}
          onChange={(e) => { if (e.target.value) onChange(e.target.value); }}
        >
          <option value="">— pick from library —</option>
          {candidates.map((f) => (
            <option key={f.path} value={f.path}>
              {`${fileName(f)} - ${compactPath(f.path)}`}
            </option>
          ))}
        </select>
      ) : null}
      <input
        placeholder="Or type a full path to mmproj file…"
        value={inList ? "" : value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function GpuLayersControl({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div style={{ display: "grid", gap: "0.5rem" }}>
      <input
        aria-label="GPU layers slider"
        type="range"
        min={0}
        max={999}
        step={1}
        value={value}
        onChange={(event) => onChange(Number(event.target.value || 0))}
      />
      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
        <input
          aria-label="GPU layers input"
          value={value}
          onChange={(event) => onChange(Number(event.target.value || 0))}
          type="number"
        />
        <Button type="button" variant="ghost" onClick={() => onChange(999)}>Max GPU layers</Button>
        <Button type="button" variant="ghost" onClick={() => onChange(0)}>CPU only</Button>
      </div>
    </div>
  );
}



async function loadGgufLibraryData(appMode: string): Promise<GgufLibraryData> {
  const nodeGgufsPromise = appMode === "controller" ? getNodeGgufs() : Promise.resolve({ nodes: [] });
  const [ggufsResult, nodesResult, nodeGgufsResult] = await Promise.allSettled([listGgufs(), getNodeModels(), nodeGgufsPromise]);
  return {
    files: ggufsResult.status === "fulfilled" ? asFiles(ggufsResult.value) : [],
    nodeSnapshots: nodesResult.status === "fulfilled" ? asNodes(nodesResult.value) : [],
    nodeGgufSnapshots: nodeGgufsResult.status === "fulfilled" ? asNodes(nodeGgufsResult.value) : [],
  };
}

export function GgufLibraryPage() {
  const navigate = useNavigate();
  const appMode = useAppMode();
  const { data, loading, error, refresh, setError } = useAsyncResource<GgufLibraryData>(
    () => loadGgufLibraryData(appMode),
    { files: [], nodeSnapshots: [], nodeGgufSnapshots: [] },
    [appMode],
  );
  const { files, nodeSnapshots, nodeGgufSnapshots } = data;

  const [selected, setSelected] = useState<GgufFile | null>(null);
  const [modelName, setModelName] = useState("");
  const [port, setPort] = useState(8080);
  const [ctx, setCtx] = useState(4096);
  const [gpuLayers, setGpuLayers] = useState(0);
  const [promptTemplate, setPromptTemplate] = useState("");
  const [reasoning, setReasoning] = useState("auto");
  const [reasoningBudget, setReasoningBudget] = useState(2048);
  const [vision, setVision] = useState(false);
  const [mmproj, setMmproj] = useState("");
  const [mtpEnabled, setMtpEnabled] = useState(false);
  const [draftModelPath, setDraftModelPath] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [selectedQuantId, setSelectedQuantId] = useState("");
  const [nodes, setNodes] = useState<NodeRecord[]>([]);
  const [sourceNode, setSourceNode] = useState("");
  const [destinationNode, setDestinationNode] = useState("");
  const [includeMode, setIncludeMode] = useState("selected_with_sidecars");
  const [transferStatus, setTransferStatus] = useState("");

  const localFiles = useMemo(() => files.filter((file) => !isMmproj(file)), [files]);
  const navigatorLines = useMemo(() => buildModelNavigatorLines(localFiles), [localFiles]);
  const nodeNavigatorNodes = useMemo<NodeNavigatorNode<GgufFile>[]>(
    () =>
      nodeGgufSnapshots.map((node) => {
        const nodeName = String(node.name || "unknown");
        const rawFiles = Array.isArray(node.files) ? (node.files as GgufFile[]).filter((file) => !isMmproj(file)) : [];
        const enriched = rawFiles.map((file) => ({ ...file, source_node: nodeName }));
        return {
          name: nodeName,
          reachable: node.reachable,
          lines: buildModelNavigatorLines(enriched),
        };
      }),
    [nodeGgufSnapshots],
  );

  function openDetail(file: GgufFile) {
    setSelected(file);
    setModelName(suggestedGgufModelName(file));
    setPromptTemplate(typeof file.model_prompt_template === "string" ? file.model_prompt_template : suggestedPromptTemplate(file));
    setVision(Boolean(file.vision));
    setMmproj(typeof file.mmproj === "string" ? file.mmproj : "");
    setMtpEnabled(Boolean(file.model_supports_mtp));
    setDraftModelPath(typeof file.model_draft_model_path === "string" ? file.model_draft_model_path : "");
    if (file.registered) {
      if (typeof file.model_port === "number") setPort(file.model_port);
      if (typeof file.model_ctx === "number") setCtx(file.model_ctx);
      if (typeof file.model_gpu_layers === "number") setGpuLayers(file.model_gpu_layers);
      if (typeof file.model_reasoning === "string") setReasoning(file.model_reasoning);
      if (typeof file.model_reasoning_budget === "number") setReasoningBudget(file.model_reasoning_budget);
    }
  }

  function openNodeGgufDetail(nodeName: string, file: GgufFile) {
    setSelected({ ...file, source_node: nodeName });
    setSourceNode(nodeName);
    setDestinationNode("");
    setTransferStatus("");
  }

  function openEdit(file: GgufFile) {
    setSelected(file);
    setPort(typeof file.model_port === "number" ? file.model_port : port);
    setCtx(typeof file.model_ctx === "number" ? file.model_ctx : 4096);
    setGpuLayers(typeof file.model_gpu_layers === "number" ? file.model_gpu_layers : 0);
    setPromptTemplate(typeof file.model_prompt_template === "string" ? file.model_prompt_template : "");
    setReasoning(typeof file.model_reasoning === "string" ? file.model_reasoning : "auto");
    setReasoningBudget(typeof file.model_reasoning_budget === "number" ? file.model_reasoning_budget : 2048);
    setVision(Boolean(file.vision));
    setMmproj(typeof file.mmproj === "string" ? file.mmproj : "");
    setMtpEnabled(Boolean(file.model_supports_mtp));
    setDraftModelPath(typeof file.model_draft_model_path === "string" ? file.model_draft_model_path : "");
    setEditOpen(true);
  }

  async function addSelected() {
    if (!selected) return;
    await addGgufModel(fileId(selected), {
      name: modelName || suggestedGgufModelName(selected),
      port,
      ctx,
      gpu_layers: gpuLayers,
      host: "127.0.0.1",
      reasoning,
      reasoning_budget: reasoningBudget,
      prompt_template: promptTemplate || null,
      vision,
      mmproj: mmproj || null,
      supports_mtp: mtpEnabled,
      draft_model_path: mtpEnabled ? (draftModelPath || null) : null,
    });
    setSelected(null);
    setPort(port + 1);
    await refresh();
  }

  async function saveEdit() {
    if (!selected?.registered_as) return;
    await updateGgufModel(String(selected.registered_as), {
      vision,
      mmproj: mmproj || null,
      ctx,
      gpu_layers: gpuLayers,
      port,
      prompt_template: promptTemplate || null,
      reasoning,
      reasoning_budget: reasoningBudget,
      supports_mtp: mtpEnabled,
      draft_model_path: mtpEnabled ? (draftModelPath || null) : null,
    });
    setEditOpen(false);
    setSelected(null);
    await refresh();
  }

  async function removeSelected() {
    if (!selected?.registered_as) return;
    await deleteConfiguredModel(String(selected.registered_as));
    setSelected(null);
    await refresh();
  }

  async function deleteSelected() {
    if (!selected) return;
    await deleteGguf(fileId(selected));
    setSelected(null);
    await refresh();
  }

  async function openTransferModal(preferredSourceNode?: string) {
    setTransferOpen(true);
    setTransferStatus("");
    setError("");
    try {
      const items = asNodes(await listNodes());
      setNodes(items);
      const reachable = items.filter((node) => node.name && isTransferReachableNode(node));
      const nextSource = preferredSourceNode || sourceNode || String(reachable[0]?.name || "");
      const nextDestination = destinationNode || String(reachable.find((node) => node.name !== nextSource)?.name || "");
      setSourceNode(nextSource);
      setDestinationNode(nextDestination);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load transfer nodes");
    }
  }

  async function startTransfer() {
    if (!selected || !sourceNode || !destinationNode) return;
    setError("");
    try {
      const transfer = await createGgufTransfer(sourceNode, {
        destination_node: destinationNode,
        source_file_id: fileId(selected),
        include: includeMode,
      });
      setTransferStatus(`Transfer ${String(transfer.id || "")} ${String(transfer.status || "queued")}`.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start transfer");
    }
  }

  async function removeFile(file: GgufFile) {
    if (!file.registered_as) return;
    await deleteConfiguredModel(String(file.registered_as));
    await refresh();
  }

  async function reclassifyLine(recordId: string, lineLabel: string) {
    const target = localFiles.find((file) => String(file.asset_id || file.id || file.path) === recordId);
    const assetRef = String(target?.asset_id || recordId);
    await updateGgufAsset(assetRef, { model_line: lineLabel });
    await refresh();
  }

  function selectNavigatorQuant(quant: ModelNavigatorQuant<GgufFile>) {
    setSelectedQuantId(quant.id);
  }

  function renderCard(file: GgufFile) {
    const name = fileName(file);
    const badge = receivedBadgeText(file);
    // Create a model-like object so the unified ModelCard can read status, path, etc.
    const model = {
      ...file,
      status: file.registered ? "added" : "discovered",
    };
    return (
      <ModelCard
        key={fileId(file)}
        model={model}
        onOpen={() => openDetail(file)}
        onAdd={!file.registered ? () => openDetail(file) : undefined}
        onEdit={file.registered ? () => openEdit(file) : undefined}
        onChat={file.registered ? () => navigate(`/ui/chat?${chatSearch(name)}`) : undefined}
        onTransfer={file.registered && canTransferBetweenNodes ? () => { setSelected(file); void openTransferModal(); } : undefined}
        onDelete={file.registered ? () => void removeFile(file) : undefined}
      >
        {badge ? <StatusBadge tone="warning">{badge}</StatusBadge> : null}
      </ModelCard>
    );
  }

  const selectedIsModel = Boolean(selected?.registered);
  const transferActionLabel = selectedIsModel ? "Send Model" : "Transfer GGUF";
  const canTransferBetweenNodes = appMode !== "agent";
  const canManageLocalLibrary = appMode !== "controller";

  return (
    <div className="gguf-library-page-react">
      <div className="page-heading">
        <div><span className="eyebrow">Files</span><h2>GGUF Library</h2></div>
        <Button type="button" onClick={refresh} disabled={loading}>{loading ? "Refreshing" : "Refresh"}</Button>
      </div>
      <ErrorBanner message={error} />
      <div className="library-sections">
        {appMode !== "controller" ? (
          <>
            {localFiles.length ? (
              <ModelNavigator
                lines={navigatorLines}
                selectedQuantId={selectedQuantId}
                onSelectQuant={selectNavigatorQuant}
                onReclassify={(override) => void reclassifyLine(override.recordId, override.lineLabel)}
                renderDetail={({ selectedLine, selectedModel, selectedQuant }) => {
                  if (!selectedQuant) return <EmptyState message="Select a model to see its quants." />;
                  return (
                    <div className="library-detail">
                      <div>
                        <span className="eyebrow">{selectedLine?.label || "Model"}</span>
                        <h3>{selectedModel?.label || fileName(selectedQuant.file)}</h3>
                      </div>
                      {renderCard(selectedQuant.file)}
                    </div>
                  );
                }}
              />
            ) : (
              <EmptyState message={loading ? "Loading GGUF files..." : "No local GGUF files found."} />
            )}
          </>
        ) : null}
        {appMode !== "agent" ? (
        <Panel title="Agent Node GGUF Files" eyebrow="Connected Nodes">
          {nodeNavigatorNodes.length === 0 ? (
            <EmptyState message={loading ? "Loading node GGUF files..." : "No agent GGUF files reported."} />
          ) : (
            <NodeNavigator<GgufFile>
              nodes={nodeNavigatorNodes}
              onSelectQuant={(quant) => {
                const nodeName = String(quant.file.source_node || "");
                selectNavigatorQuant(quant);
              }}
              renderDetail={({ selectedLine, selectedModel, selectedQuant }) => {
                if (!selectedQuant) return <EmptyState message="Select a model to see its quants." />;
                const nodeName = String(selectedQuant.file.source_node || "");
                const nodeGgufModel = { ...selectedQuant.file, status: selectedQuant.file.registered ? "added" : "discovered" };
                return (
                  <div className="library-detail">
                    <div>
                      <span className="eyebrow">{selectedLine?.label || "Model"}</span>
                      <h3>{selectedModel?.label || fileName(selectedQuant.file)}</h3>
                    </div>
                    <ModelCard
                      model={nodeGgufModel}
                      resolvedNode={nodeName}
                      onOpen={() => openNodeGgufDetail(nodeName, selectedQuant.file)}
                      onTransfer={() => { openNodeGgufDetail(nodeName, selectedQuant.file); void openTransferModal(nodeName); }}
                    />
                  </div>
                );
              }}
            />
          )}
        </Panel>
        ) : null}
      </div>

      <Modal title={selected ? fileName(selected) : "Model Detail"} open={Boolean(selected) && !editOpen} onClose={() => setSelected(null)}>
        {selected ? (
          <div className="library-detail">
            <dl className="detail-list">
              <div><dt>Path</dt><dd>{String(selected.path || "-")}</dd></div>
              <div><dt>Size</dt><dd>{sizeLabel(selected.size_bytes)}</dd></div>
              <div><dt>Status</dt><dd>{selected.registered ? `Added as ${selected.registered_as || modelName}` : "Available"}</dd></div>
              {deploymentSummary(selected) ? (
                <div><dt>Deployment</dt><dd>{deploymentSummary(selected)}</dd></div>
              ) : null}
              {profileSummary(selected) ? (
                <div><dt>Profiles</dt><dd>{profileSummary(selected)}</dd></div>
              ) : null}
              {catalogSummary(selected) ? (
                <div><dt>Catalog</dt><dd>{catalogSummary(selected)}</dd></div>
              ) : null}
              {selected.vision ? (
                <div><dt>Vision</dt><dd>{selected.mmproj ? compactPath(selected.mmproj) : "enabled (no mmproj set)"}</dd></div>
              ) : null}
            </dl>
            <div className="library-controls">
              <FormField label="Model name">
                <input value={modelName} onChange={(event) => setModelName(event.target.value)} />
              </FormField>
              <FormField label="Next port">
                <input value={port} onChange={(event) => setPort(Number(event.target.value || 8080))} type="number" />
              </FormField>
              <FormField label="Context">
                <input value={ctx} onChange={(event) => setCtx(Number(event.target.value || 4096))} type="number" />
              </FormField>
              <FormField label="Prompt template">
                <select value={promptTemplate} onChange={(event) => setPromptTemplate(event.target.value)}>{PROMPT_TEMPLATE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
              </FormField>
              <FormField label="Reasoning">
                <select value={reasoning} onChange={(event) => setReasoning(event.target.value)}>
                  <option value="auto">Auto</option>
                  <option value="off">Off</option>
                  <option value="on">On</option>
                </select>
              </FormField>
              <FormField label="Think budget">
                <input value={reasoningBudget} onChange={(event) => setReasoningBudget(Number(event.target.value || 2048))} type="number" /></FormField>
              <FormField label="Vision model" hint="Enables multimodal (image) input.">
                <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <input type="checkbox" checked={vision} onChange={(e) => setVision(e.target.checked)} />
                  Vision
                </label>
              </FormField>
              {vision ? (
                <FormField label="mmproj file" hint="Multimodal projector sidecar (.gguf). Pick a discovered file or type a path.">
                  <MmprojPicker files={files} value={mmproj} onChange={setMmproj} />
                </FormField>
              ) : null}
              <FormField label="GPU layers">
                <GpuLayersControl value={gpuLayers} onChange={setGpuLayers} />
              </FormField>
              <FormField label="MTP" hint="Enable multi-token prediction for models that have a draft sidecar.">
                <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <input
                    aria-label="Enable MTP"
                    type="checkbox"
                    checked={mtpEnabled}
                    onChange={(e) => setMtpEnabled(e.target.checked)}
                  />
                  Enable MTP
                </label>
              </FormField>
              {mtpEnabled ? (
                <FormField label="Draft model path" hint="Optional draft GGUF path for explicit --model-draft wiring.">
                  <input aria-label="Draft model path" value={draftModelPath} onChange={(event) => setDraftModelPath(event.target.value)} />
                </FormField>
              ) : null}
            </div>
            <div className="modal-actions">
              {canManageLocalLibrary ? <Button type="button" onClick={() => void addSelected()} disabled={Boolean(selected.registered)}>Add Model</Button> : null}
              {canManageLocalLibrary ? <Button type="button" onClick={() => void removeSelected()} disabled={!selected.registered}>Remove Model</Button> : null}
              {canTransferBetweenNodes ? <Button type="button" onClick={() => void openTransferModal(String(selected.source_node || ""))}>{transferActionLabel}</Button> : null}
              {canManageLocalLibrary ? <Button variant="danger" type="button" onClick={() => void deleteSelected()}>Delete GGUF</Button> : null}
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal title={transferActionLabel} open={transferOpen} onClose={() => setTransferOpen(false)}>
        {selected ? (
          <div className="library-detail">
            <p className="muted">
              {selectedIsModel ? `Send ${String(selected.registered_as || fileName(selected))}` : `Transfer ${fileName(selected)}`} from one reachable node to another.
            </p>
            <div className="library-controls">
              <FormField label="Source node">
                <select value={sourceNode} onChange={(event) => {
                  setSourceNode(event.target.value);
                  if (destinationNode === event.target.value) setDestinationNode("");
                }}>
                  <option value="">Select source</option>
                  {nodes.filter(isTransferReachableNode).map((node) => <option key={node.name} value={node.name}>{node.name}</option>)}
                </select>
              </FormField>
              <FormField label="Destination node">
                <select value={destinationNode} onChange={(event) => setDestinationNode(event.target.value)}>
                  <option value="">Select destination</option>
                  {nodes.filter(isTransferReachableNode).map((node) => <option key={node.name} value={node.name} disabled={node.name === sourceNode}>{node.name}</option>)}
                </select>
              </FormField>
              <FormField label="Include files">
                <select value={includeMode} onChange={(event) => setIncludeMode(event.target.value)}>
                  <option value="selected_with_sidecars">Selected + sidecars</option>
                  <option value="selected_only">Selected only</option>
                </select>
              </FormField>
            </div>
            {transferStatus ? <StatusBadge tone="success">{transferStatus}</StatusBadge> : null}
            <div className="modal-actions">
              <Button type="button" onClick={() => void startTransfer()} disabled={!sourceNode || !destinationNode || sourceNode === destinationNode}>Start Transfer</Button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal title={selected ? `Edit — ${String(selected.registered_as || fileName(selected))}` : "Edit Model"} open={editOpen} onClose={() => { setEditOpen(false); setSelected(null); }}>
        {selected ? (
          <div className="library-detail">
            <div className="library-controls">
              <FormField label="Port">
                <input value={port} onChange={(e) => setPort(Number(e.target.value || 8080))} type="number" />
              </FormField>
              <FormField label="Context">
                <input value={ctx} onChange={(e) => setCtx(Number(e.target.value || 4096))} type="number" />
              </FormField>
              <FormField label="GPU layers">
                <GpuLayersControl value={gpuLayers} onChange={setGpuLayers} />
              </FormField>
              <FormField label="Prompt template">
                <select value={promptTemplate} onChange={(e) => setPromptTemplate(e.target.value)}>{PROMPT_TEMPLATE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
              </FormField>
              <FormField label="Reasoning">
                <select value={reasoning} onChange={(e) => setReasoning(e.target.value)}>
                  <option value="auto">Auto</option>
                  <option value="off">Off</option>
                  <option value="on">On</option>
                </select>
              </FormField>
              <FormField label="Think budget">
                <input value={reasoningBudget} onChange={(e) => setReasoningBudget(Number(e.target.value || 2048))} type="number" />
              </FormField>
              <FormField label="Vision model" hint="Enables multimodal (image) input.">
                <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <input type="checkbox" checked={vision} onChange={(e) => setVision(e.target.checked)} />
                  Vision
                </label>
              </FormField>
              {vision ? (
                <FormField label="mmproj file" hint="Multimodal projector sidecar (.gguf). Pick a discovered file or type a path.">
                  <MmprojPicker files={files} value={mmproj} onChange={setMmproj} />
                </FormField>
              ) : null}
              <FormField label="MTP" hint="Enable multi-token prediction for models that have a draft sidecar.">
                <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <input
                    aria-label="Enable MTP"
                    type="checkbox"
                    checked={mtpEnabled}
                    onChange={(e) => setMtpEnabled(e.target.checked)}
                  />
                  Enable MTP
                </label>
              </FormField>
              {mtpEnabled ? (
                <FormField label="Draft model path" hint="Optional draft GGUF path for explicit --model-draft wiring.">
                  <input aria-label="Draft model path" value={draftModelPath} onChange={(e) => setDraftModelPath(e.target.value)} />
                </FormField>
              ) : null}
            </div>
            <div className="modal-actions">
              <Button type="button" variant="primary" onClick={() => void saveEdit()}>Save</Button>
              <Button type="button" variant="ghost" onClick={() => { setEditOpen(false); setSelected(null); }}>Cancel</Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
