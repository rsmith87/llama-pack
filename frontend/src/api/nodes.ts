import { apiGet, apiPost, apiPut, apiStream } from "./client";
import type { NodeRecord, NodeSummary } from "../types/index";

export type NodeActionResponse = Record<string, unknown>;

export type TransferRecord = Record<string, unknown> & {
  id?: string;
  status?: string;
  source_node?: string;
  destination_node?: string;
  source_file_id?: string;
  include?: string;
  files_total?: number | null;
  files_copied?: number | null;
  files_skipped?: number | null;
};

export type UpdateNodePayload = {
  url: string;
  api_key?: string;
  verify_tls: boolean;
};

let nodeModelsRequest: Promise<NodeRecord[]> | null = null;
let nodeModelsCache: NodeRecord[] | null = null;

function isRecord(payload: unknown): payload is Record<string, unknown> {
  return typeof payload === "object" && payload !== null && !Array.isArray(payload);
}

function requireArrayResponse(endpoint: string, payload: unknown, fieldName: string): unknown[] {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (isRecord(payload) && Array.isArray(payload[fieldName])) {
    return payload[fieldName];
  }
  throw new TypeError(`${endpoint} response must be an array or include a ${fieldName} array.`);
}

function requireObjectArray(endpoint: string, payload: unknown, fieldName: string): Record<string, unknown>[] {
  const values = requireArrayResponse(endpoint, payload, fieldName);
  const invalidIndex = values.findIndex((value) => !isRecord(value));
  if (invalidIndex !== -1) {
    throw new TypeError(`${endpoint} ${fieldName}[${invalidIndex}] must be an object.`);
  }
  return values.map((value) => value as Record<string, unknown>);
}

function requireRecordResponse(endpoint: string, payload: unknown): Record<string, unknown> {
  if (!isRecord(payload)) {
    throw new TypeError(`${endpoint} response must be an object.`);
  }
  return payload;
}

function parseNodeArray(endpoint: string, payload: unknown): NodeRecord[] {
  return requireObjectArray(endpoint, payload, "nodes") as NodeRecord[];
}

function parseNodeAction(endpoint: string, payload: unknown): NodeActionResponse {
  return requireRecordResponse(endpoint, payload);
}

function parseTransferRecord(payload: unknown): TransferRecord {
  return requireRecordResponse("/transfers/{transfer_id}", payload) as TransferRecord;
}

export function listNodes(): Promise<NodeRecord[]> {
  return apiGet<unknown>("/nodes").then((payload) => parseNodeArray("/nodes", payload));
}

export function listNodeSummaries(): Promise<NodeSummary[]> {
  return apiGet<unknown>("/nodes/summary").then((payload) => parseNodeArray("/nodes/summary", payload) as NodeSummary[]);
}

export function getNodeModels(): Promise<NodeRecord[]> {
  if (nodeModelsRequest) {
    return nodeModelsRequest;
  }
  nodeModelsRequest = apiGet<unknown>("/nodes/models")
    .then((payload) => parseNodeArray("/nodes/models", payload))
    .then((nodes) => {
      nodeModelsCache = nodes;
      return nodes;
    })
    .finally(() => {
      nodeModelsRequest = null;
    });
  return nodeModelsRequest;
}

export function getCachedNodeModels(): NodeRecord[] | null {
  return nodeModelsCache ? nodeModelsCache.map((node) => ({ ...node })) : null;
}

export function invalidateNodeModelsCache(): void {
  nodeModelsCache = null;
  nodeModelsRequest = null;
}

export function getNodeGgufs(): Promise<NodeRecord[]> {
  return apiGet<unknown>("/nodes/ggufs").then((payload) => parseNodeArray("/nodes/ggufs", payload));
}

export function startNodeModel(node: string, name: string): Promise<NodeActionResponse> {
  const path = `/nodes/${encodeURIComponent(node)}/models/${encodeURIComponent(name)}/start`;
  return apiPost<unknown>(path).then((payload) => {
    invalidateNodeModelsCache();
    return parseNodeAction(path, payload);
  });
}

export function stopNodeModel(node: string, name: string): Promise<NodeActionResponse> {
  const path = `/nodes/${encodeURIComponent(node)}/models/${encodeURIComponent(name)}/stop`;
  return apiPost<unknown>(path).then((payload) => {
    invalidateNodeModelsCache();
    return parseNodeAction(path, payload);
  });
}

export function restartNodeModel(node: string, name: string): Promise<NodeActionResponse> {
  const path = `/nodes/${encodeURIComponent(node)}/models/${encodeURIComponent(name)}/restart`;
  return apiPost<unknown>(path).then((payload) => {
    invalidateNodeModelsCache();
    return parseNodeAction(path, payload);
  });
}

export function streamNodeModelLogs(node: string, name: string): Promise<ReadableStreamDefaultReader<Uint8Array>> {
  return apiStream(`/nodes/${encodeURIComponent(node)}/logs/${encodeURIComponent(name)}/stream`);
}

export function getTransfer(transferId: string): Promise<TransferRecord> {
  return apiGet<unknown>(`/transfers/${encodeURIComponent(transferId)}`).then(parseTransferRecord);
}

export function updateNode(node: string, payload: UpdateNodePayload): Promise<NodeRecord> {
  const path = `/nodes/${encodeURIComponent(node)}`;
  return apiPut<unknown>(path, payload).then((response) => {
    invalidateNodeModelsCache();
    return requireRecordResponse(path, response) as NodeRecord;
  });
}
