import { apiAbsolutePost, apiDelete, apiGet, apiPost, apiStream } from "./client";
import type { ChatRequest, ChatResponse, ChatSessionsResponse } from "../types/api";

export function getChatCapabilities(modelName: string) { return apiGet<Record<string, unknown>>(`/chat/capabilities/${encodeURIComponent(modelName)}`); }
export function inspectModel(modelName: string, payload: Record<string, unknown>) { return apiPost<Record<string, unknown>>(`/chat/${encodeURIComponent(modelName)}/inspect`, payload); }
export function listKvSlots(modelName: string, target = "auto") { return apiGet<Record<string, unknown>>(`/chat/${encodeURIComponent(modelName)}/kv/slots?target=${encodeURIComponent(target)}`); }
export function clearKvSlot(modelName: string, slotId: number, target = "auto") { return apiPost<Record<string, unknown>>(`/chat/${encodeURIComponent(modelName)}/kv/slots/${slotId}`, { action: "clear", target }); }
export function sendChat(modelName: string, payload: ChatRequest) { return apiPost<ChatResponse>(`/chat/${encodeURIComponent(modelName)}`, payload); }
export function sendOpenAIChatCompletion(payload: ChatRequest, signal?: AbortSignal) { return apiAbsolutePost<ChatResponse>("/v1/chat/completions", payload, { signal }); }
export function streamChat(modelName: string, payload: ChatRequest, signal?: AbortSignal) { return apiStream(`/chat/${encodeURIComponent(modelName)}/stream`, { method: "POST", body: payload, signal }); }
export function listChatSessions() { return apiGet<ChatSessionsResponse>("/chat/sessions"); }
export function getChatSession(sessionId: string) { return apiGet<Record<string, unknown>>(`/chat/sessions/${encodeURIComponent(sessionId)}`); }
export function saveChatSession(payload: Record<string, unknown>) { return apiPost<Record<string, unknown>>("/chat/sessions", payload); }
export function deleteChatSession(sessionId: string) { return apiDelete<Record<string, unknown>>(`/chat/sessions/${encodeURIComponent(sessionId)}`); }
