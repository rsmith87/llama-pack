import { apiDelete, apiGet, apiPatch, apiPost } from "./client";
import type { GgufLibraryResponse } from "../types/api";

export type AddModelPayload = {
  name: string;
  port: number;
  ctx: number;
  gpu_layers: number;
  host: string;
  reasoning?: string | null;
  reasoning_budget?: number | null;
  prompt_template?: string | null;
  vision?: boolean;
  mmproj?: string | null;
};

export type UpdateModelPayload = {
  vision?: boolean | null;
  mmproj?: string | null;
  ctx?: number | null;
  gpu_layers?: number | null;
  port?: number | null;
  prompt_template?: string | null;
  reasoning?: string | null;
  reasoning_budget?: number | null;
};

export function listGgufs() { return apiGet<GgufLibraryResponse>("/library/ggufs"); }
export function addGgufModel(fileId: string, payload: AddModelPayload) { return apiPost<Record<string, unknown>>(`/library/ggufs/${encodeURIComponent(fileId)}/add-model`, payload); }
export function updateGgufModel(name: string, payload: UpdateModelPayload) { return apiPatch<Record<string, unknown>>(`/library/models/${encodeURIComponent(name)}`, payload); }
export function deleteGguf(fileId: string) { return apiDelete<Record<string, unknown>>(`/library/ggufs/${encodeURIComponent(fileId)}`); }
export function deleteConfiguredModel(name: string) { return apiDelete<Record<string, unknown>>(`/library/models/${encodeURIComponent(name)}`); }
export function createGgufTransfer(sourceNode: string, payload: Record<string, unknown>) { return apiPost<Record<string, unknown>>(`/nodes/${encodeURIComponent(sourceNode)}/transfers`, payload); }
