import { apiGet, apiPost, apiPut, apiStream } from "./client";
import type { NodesResponse } from "../types/index";

export function listNodes() { return apiGet<NodesResponse>("/nodes"); }
export function getNodeModels() { return apiGet<Record<string, unknown>>("/nodes/models"); }
export function getNodeGgufs() { return apiGet<Record<string, unknown>>("/nodes/ggufs"); }
export function startNodeModel(node: string, name: string) { return apiPost<Record<string, unknown>>(`/nodes/${encodeURIComponent(node)}/models/${encodeURIComponent(name)}/start`); }
export function stopNodeModel(node: string, name: string) { return apiPost<Record<string, unknown>>(`/nodes/${encodeURIComponent(node)}/models/${encodeURIComponent(name)}/stop`); }
export function restartNodeModel(node: string, name: string) { return apiPost<Record<string, unknown>>(`/nodes/${encodeURIComponent(node)}/models/${encodeURIComponent(name)}/restart`); }
export function streamNodeModelLogs(node: string, name: string) { return apiStream(`/nodes/${encodeURIComponent(node)}/logs/${encodeURIComponent(name)}/stream`); }
export function getTransfer(transferId: string) { return apiGet<Record<string, unknown>>(`/transfers/${encodeURIComponent(transferId)}`); }

export function updateNode(node: string, payload: { url: string; api_key?: string; verify_tls: boolean }) { return apiPut<Record<string, unknown>>(`/nodes/${encodeURIComponent(node)}`, payload); }
