import "./styles.css";
import { useMemo, useState } from "react";
import { useAsyncResource } from "../../hooks/useAsyncResource";
import { createGgufTransfer, addGgufModel, deleteConfiguredModel, deleteGguf, listGgufs, updateGgufModel } from "../../api/library";
import { getNodeGgufs, getNodeModels, listNodes } from "../../api/nodes";
import { useAppMode } from "../../features/appMode/appModeContext";
import { Button, EmptyState, ErrorBanner, FormField, Modal, Panel, StatusBadge } from "../../components/ui";
import { IoAdd, IoChatbubbles, IoCamera, IoCheckmarkCircle, IoDocumentText, IoPencil, IoSend, IoTrash } from "react-icons/io5";
import { ModelCard } from "../../components/ModelCard";
import { isActiveModel } from "../../features/models/modelStatus";
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

function MmprojPicker({ files, value, onChange }: { files: GgufFile[]; value: string; onChange: (v: string) => void }) {
  const candidates = files.filter((f) => fileName(f).toLowerCase().includes("mmproj"));
  const inList = candidates.some((f) => f.path === value);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
      {candidates.length > 0 ? (
        <select
          value={inList ? value : ""}
          onChange={(e) => { if (e.target.value) onChange(e.target.value); }}
        >
          <option value="">— pick from library —</option>
          {candidates.map((f) => (
            <option key={f.path} value={f.path}>{fileName(f)}</option>
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
  const [editOpen, setEditOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [nodes, setNodes] = useState<NodeRecord[]>([]);
  const [sourceNode, setSourceNode] = useState("");
  const [destinationNode, setDestinationNode] = useState("");
  const [includeMode, setIncludeMode] = useState("selected_with_sidecars");
  const [transferStatus, setTransferStatus] = useState("");

  const added = useMemo(() => files.filter((file) => Boolean(file.registered) && !isMmproj(file)), [files]);
  const available = useMemo(() => files.filter((file) => !file.registered && !isMmproj(file)), [files]);

  function openDetail(file: GgufFile) {
    setSelected(file);
    setModelName(suggestedGgufModelName(file));
    setPromptTemplate(typeof file.model_prompt_template === "string" ? file.model_prompt_template : suggestedPromptTemplate(file));
    setVision(Boolean(file.vision));
    setMmproj(typeof file.mmproj === "string" ? file.mmproj : "");
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

  function renderCard(file: GgufFile) {
    const badge = receivedBadgeText(file);
    const name = fileName(file);
    const registeredName = String(file.registered_as || suggestedGgufModelName(file));
    const active = isActiveModel(file);
    return (
      <ModelCard
        key={fileId(file)}
        className={active ? "active" : ""}
        title={name}
        onOpen={() => openDetail(file)}
        openLabel={`Open ${name}`}
        badges={(
          <>
            <StatusBadge tone={file.registered ? "success" : "muted"}>
              {file.registered ? <IoCheckmarkCircle /> : <IoDocumentText />}
            </StatusBadge>
            {file.vision ? <StatusBadge tone="muted"><span title="Vision model — has mmproj"><IoCamera /></span></StatusBadge> : null}
            {badge ? <StatusBadge tone="warning">{badge}</StatusBadge> : null}
          </>
        )}
        actions={(
          <>
            {!file.registered ? (
              <Button onClick={() => openDetail(file)} aria-label={`Add ${name}`}>
                <IoAdd /> Add
              </Button>
            ) : null}
            {file.registered ? (
              <Button variant="ghost" onClick={() => openEdit(file)} aria-label={`Edit ${registeredName}`}>
                <IoPencil />
              </Button>
            ) : null}
            {file.registered ? (
              <Button variant="warning" onClick={() => navigate(`/ui/chat?${chatSearch(registeredName)}`)} aria-label={`Chat with ${registeredName}`}>
                <IoChatbubbles />
              </Button>
            ) : null}
            {file.registered && canTransferBetweenNodes ? (
              <Button onClick={() => { setSelected(file); void openTransferModal(); }} aria-label={`Send ${registeredName}`}>
                <IoSend />
              </Button>
            ) : null}
            {file.registered ? (
              <Button variant="danger" onClick={() => void removeFile(file)} aria-label={`Remove ${registeredName}`}>
                <IoTrash />
              </Button>
            ) : null}
          </>
        )}
      >
        <dl className="model-card-detail-grid">
          <div><dt>Size</dt><dd>{sizeLabel(file.size_bytes)}</dd></div>
          {file.registered ? <div><dt>Added as</dt><dd>{registeredName}</dd></div> : null}
          <div><dt>Directory</dt><dd>{compactPath(file.model_dir)}</dd></div>
          <div><dt>Path</dt><dd>{compactPath(file.path)}</dd></div>
          <div><dt>File ID</dt><dd>{fileId(file)}</dd></div>
        </dl>
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
        {appMode !== "controller" && added.length ? (
          <Panel title="Added Models" eyebrow="Configured">
            <div className="library-cards">{added.map(renderCard)}</div>
          </Panel>
        ) : null}
        {appMode !== "controller" ? (
          <Panel title="Available GGUF Files" eyebrow="Discovered">
            <div className="library-cards">{available.length ? available.map(renderCard) : <EmptyState message={loading ? "Loading GGUF files..." : "All discovered files are already added."} />}</div>
          </Panel>
        ) : null}
        {appMode !== "agent" ? (
        <Panel title="Agent Node GGUF Files" eyebrow="Connected Nodes">
          {nodeGgufSnapshots.length === 0 ? (
            <EmptyState message={loading ? "Loading node GGUF files..." : "No agent GGUF files reported."} />
          ) : (
            <div className="node-model-sections">
              {nodeGgufSnapshots.map((node) => {
                const nodeName = String(node.name || "unknown");
                const nodeFiles = Array.isArray(node.files) ? node.files as GgufFile[] : [];
                return (
                  <div key={nodeName} className="node-model-group">
                    <div className="node-model-group-header">
                      <strong>{nodeName}</strong>
                      <StatusBadge tone={node.reachable ? "success" : "muted"}>
                        {node.reachable ? "reachable" : "unreachable"}
                      </StatusBadge>
                    </div>
                    <div className="library-cards">
                      {nodeFiles.length ? nodeFiles.filter((file) => !isMmproj(file)).map((file) => {
                        const name = fileName(file);
                        return (
                          <ModelCard
                            key={`${nodeName}-${fileId(file)}`}
                            title={name}
                            onOpen={() => openNodeGgufDetail(nodeName, file)}
                            openLabel={`Open ${name} on ${nodeName}`}
                            badges={(
                              <>
                                <StatusBadge tone={file.registered ? "success" : "muted"}>
                                  {file.registered ? <IoCheckmarkCircle /> : <IoDocumentText />}
                                </StatusBadge>
                              </>
                            )}
                            actions={(
                              <Button onClick={() => { openNodeGgufDetail(nodeName, file); void openTransferModal(nodeName); }} aria-label={`Transfer ${name} from ${nodeName}`}>
                                <IoSend />
                              </Button>
                            )}
                          >
                            <dl className="model-card-detail-grid">
                              <div><dt>Size</dt><dd>{sizeLabel(file.size_bytes)}</dd></div>
                              {file.registered ? <div><dt>Added as</dt><dd>{String(file.registered_as || suggestedGgufModelName(file))}</dd></div> : null}
                              <div><dt>Node</dt><dd>{nodeName}</dd></div>
                              <div><dt>Path</dt><dd>{compactPath(file.path)}</dd></div>
                              <div><dt>File ID</dt><dd>{fileId(file)}</dd></div>
                            </dl>
                          </ModelCard>
                        );
                      }) : (
                        <EmptyState message={String(node.error || (node.reachable ? "No GGUF files reported." : "Stale heartbeat — no GGUF data."))} />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
        ) : null}
        {appMode !== "agent" ? (
        <Panel title="Agent Node Models" eyebrow="Connected Nodes">
          {nodeSnapshots.length === 0 ? (
            <EmptyState message={loading ? "Loading nodes..." : "No agent nodes connected."} />
          ) : (
            <div className="node-model-sections">
              {nodeSnapshots.map((node) => {
                const nodeName = String(node.name || "unknown");
                const models = Array.isArray(node.models) ? sortModelsForDisplay(node.models) : [];
                return (
                  <div key={nodeName} className="node-model-group">
                    <div className="node-model-group-header">
                      <strong>{nodeName}</strong>
                      <StatusBadge tone={node.reachable ? "success" : "muted"}>
                        {node.reachable ? "reachable" : "unreachable"}
                      </StatusBadge>
                    </div>
                    <div className="node-model-list">
                      {models.length ? models.map((model) => {
                        const name = String(model.name || model.id || "unnamed");
                        return (
                          <div key={name} className={`node-model-item ${isActiveModel(model) ? "active" : ""}`.trim()}>
                            <span className="node-model-name">{name}</span>
                            <StatusBadge tone={isActiveModel(model) ? "success" : "muted"}>
                              {String(model.status || (isActiveModel(model) ? "running" : "available"))}
                            </StatusBadge>
                              <button
                                type="button"
                                onClick={() => navigate(`/ui/chat?${chatSearch(name)}`)}
                                aria-label={`Chat with ${name} on ${nodeName}`}
                              >
                                Chat
                              </button>
                          </div>
                        );
                      }) : (
                        <EmptyState message={String(node.error || (node.reachable ? "No models reported." : "Stale heartbeat — no model data."))} />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
        ) : null}
      </div>

      <Modal title={selected ? fileName(selected) : "Model Detail"} open={Boolean(selected) && !editOpen} onClose={() => setSelected(null)}>
        {selected ? (
          <div className="library-detail">
            <dl className="detail-list">
              <div><dt>Path</dt><dd>{String(selected.path || "-")}</dd></div>
              <div><dt>Directory</dt><dd>{String(selected.model_dir || "-")}</dd></div>
              <div><dt>Size</dt><dd>{sizeLabel(selected.size_bytes)}</dd></div>
              <div><dt>Status</dt><dd>{selected.registered ? `Added as ${selected.registered_as || modelName}` : "Available"}</dd></div>
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
              <FormField label="GPU layers">
                <input value={gpuLayers} onChange={(event) => setGpuLayers(Number(event.target.value || 0))} type="number" />
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
                <input value={gpuLayers} onChange={(e) => setGpuLayers(Number(e.target.value || 0))} type="number" />
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
