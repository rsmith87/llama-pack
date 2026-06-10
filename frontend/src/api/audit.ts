import { apiGet } from "./client";
import type { AuditEventsResponse } from "../types/index";

export function listAuditEvents(query = "") { return apiGet<AuditEventsResponse>(`/audit/events${query}`); }
