import { apiGet, apiPost } from "./client";
import type { ModelProfileCatalog, ModelsResponse } from "../types/index";

export function listModels() { return apiGet<ModelsResponse>("/models"); }
export function getModelProfiles() { return apiGet<ModelProfileCatalog>("/models/profiles"); }
export function startModel(name: string) { return apiPost<Record<string, unknown>>(`/models/${encodeURIComponent(name)}/start`); }
export function stopModel(name: string) { return apiPost<Record<string, unknown>>(`/models/${encodeURIComponent(name)}/stop`); }
export function restartModel(name: string) { return apiPost<Record<string, unknown>>(`/models/${encodeURIComponent(name)}/restart`); }
export function setFavorite(name: string, favorite: boolean) {
  return apiPost<Record<string, unknown>>(`/models/${encodeURIComponent(name)}/favorite`, { favorite });
}
