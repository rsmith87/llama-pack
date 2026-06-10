import { apiGet, apiPost } from "./client";
import type { ThreadEventsResponse, ThreadRecord } from "../types/index";

export function createThread(payload: Record<string, unknown>) { return apiPost<ThreadRecord>("/threads", payload); }
export function getThreadEvents(threadId: string, query = "") { return apiGet<ThreadEventsResponse>(`/threads/${encodeURIComponent(threadId)}/events${query}`); }
export function postThreadMessage(threadId: string, payload: Record<string, unknown>) { return apiPost<Record<string, unknown>>(`/threads/${encodeURIComponent(threadId)}/messages`, payload); }
