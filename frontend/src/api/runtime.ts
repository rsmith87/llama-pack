import { apiGet, apiPost } from "./client";
import type { RoutePreviewRequest, RoutePreviewResponse, RuntimeOverview } from "../types/api";

export function getRuntimeOverview() {
  return apiGet<RuntimeOverview>("/runtime/overview");
}

export function previewRoute(payload: RoutePreviewRequest) {
  return apiPost<RoutePreviewResponse>("/runtime/route-preview", payload);
}
