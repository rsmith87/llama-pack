import { apiGet, apiPost } from "./client";
import type { ConversionsResponse } from "../types/index";

export function listConversions() { return apiGet<ConversionsResponse>("/conversions/models"); }
export function startConversion(name: string, payload?: Record<string, unknown>) { return apiPost<Record<string, unknown>>(`/conversions/${encodeURIComponent(name)}/start`, payload); }
