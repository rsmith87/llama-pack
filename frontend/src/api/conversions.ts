import { apiGet, apiPost, apiStream } from "./client";
import type { ConversionsResponse } from "../types/api";

export function listConversions() { return apiGet<ConversionsResponse>("/conversions/models"); }
export function getConversion(name: string) { return apiGet<Record<string, unknown>>(`/conversions/${encodeURIComponent(name)}`); }
export function startConversion(name: string, payload?: Record<string, unknown>) { return apiPost<Record<string, unknown>>(`/conversions/${encodeURIComponent(name)}/start`, payload); }
export function streamConversionLogs(name: string) { return apiStream(`/conversions/${encodeURIComponent(name)}/logs/stream`); }
