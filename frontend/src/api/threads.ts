import { apiGet, apiPost, apiStream } from "./client";
import type { ThreadEventsResponse, ThreadRecord } from "../types/index";
import type { ThreadMessagePayload } from "../types/chat";

export function createThread(payload: Record<string, unknown>) { return apiPost<ThreadRecord>("/threads", payload); }
export function getThreadEvents(threadId: string, query = "") { return apiGet<ThreadEventsResponse>(`/threads/${encodeURIComponent(threadId)}/events${query}`); }
export function postThreadMessage(threadId: string, payload: ThreadMessagePayload) { return apiPost<Record<string, unknown>>(`/threads/${encodeURIComponent(threadId)}/messages`, payload); }
export function streamThreadMessage(threadId: string, payload: ThreadMessagePayload, signal?: AbortSignal) {
  return apiStream(`/threads/${encodeURIComponent(threadId)}/messages/stream`, { method: "POST", body: payload, signal });
}
