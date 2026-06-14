import { GgufFile, GgufLibraryData, NodeRecord } from "../../types";
import { getNodeGgufs, getNodeModels } from "../../api/nodes";
import { listGgufs } from "../../api/library";

type GgufLibraryHandoff = {
  source: string;
  model: string;
  node: string;
  fileId: string;
};

function asFiles(payload: unknown): GgufFile[] {
  if (Array.isArray(payload)) return payload as GgufFile[];
  const value = payload as { files?: GgufFile[]; ggufs?: GgufFile[] } | null;
  return value?.files || value?.ggufs || [];
}

function fileName(file: GgufFile) {
  return String(file.filename || file.name || file.path || "model.gguf");
}

function isMmproj(file: GgufFile) {
  return fileName(file).toLowerCase().includes("mmproj");
}

function fileId(file: GgufFile) {
  return String(file.id || file.file_id || fileName(file));
}

function sizeLabel(value: unknown) {
  const bytes = typeof value === "number" ? value : Number(value || 0);
  if (!Number.isFinite(bytes) || bytes <= 0) return "unknown size";
  if (bytes > 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes > 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${bytes} B`;
}

function compactPath(value: unknown) {
  const path = String(value || "-");
  if (path.length <= 78) return path;
  return `...${path.slice(-75)}`;
}

function asNodes(payload: unknown): NodeRecord[] {
  if (Array.isArray(payload)) return payload as NodeRecord[];
  return (payload as { nodes?: NodeRecord[] } | null)?.nodes || [];
}

function isTransferReachableNode(node: NodeRecord) {
  return Boolean(node.reachable || node.heartbeat_fresh);
}

function chatSearch(model: string): string {
  const params = new URLSearchParams();
  params.set("model", model);
  params.set("target", "auto");
  params.set("mode", "direct");
  params.set("source", "gguf-library");
  return params.toString();
}

function librarySelectionSearch(model: string, node = "", fileIdValue = ""): string {
  const params = new URLSearchParams();
  params.set("source", "dashboard");
  params.set("model", model);
  if (node) params.set("node", node);
  if (fileIdValue) params.set("file_id", fileIdValue);
  return params.toString();
}

function readGgufLibraryHandoff(search = window.location.search): GgufLibraryHandoff {
  const params = new URLSearchParams(search);
  return {
    source: params.get("source") || "",
    model: params.get("model") || "",
    node: params.get("node") || "",
    fileId: params.get("file_id") || "",
  };
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

export {
    asFiles,
    asNodes,
    fileName,
    isMmproj,
    fileId,
    sizeLabel,
    compactPath,
    isTransferReachableNode,
    chatSearch,
    librarySelectionSearch,
    readGgufLibraryHandoff,
    loadGgufLibraryData
}
