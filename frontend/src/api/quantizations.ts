import { apiGet, apiPost, apiStream } from "./client";
import type { QuantizationFilesResponse } from "../types/api";

export function listQuantizationFiles() { return apiGet<QuantizationFilesResponse>("/quantizations/files"); }
export function getQuantizationFile(fileId: string) { return apiGet<Record<string, unknown>>(`/quantizations/${encodeURIComponent(fileId)}`); }
export function startQuantization(fileId: string, payload: Record<string, unknown>) { return apiPost<Record<string, unknown>>(`/quantizations/${encodeURIComponent(fileId)}/start`, payload); }
export function streamQuantizationLogs(fileId: string) { return apiStream(`/quantizations/${encodeURIComponent(fileId)}/logs/stream`); }
