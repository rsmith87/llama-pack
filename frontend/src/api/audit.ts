import { apiGet, apiPost } from "./client";
import type { AuditEventsResponse } from "../types/api";

export function listAuditEvents(query = "") { return apiGet<AuditEventsResponse>(`/audit/events${query}`); }
export function createAuditEvent(payload: Record<string, unknown>) { return apiPost<Record<string, unknown>>("/audit/events", payload); }
