import { apiAbsolutePost, apiDelete, apiGet, apiPost, apiStream } from "./client";
import type { ChatRequest, ChatResponse, ChatSession, ContextBudget } from "../types/index";

export type ChatCapabilitiesResponse = Record<string, unknown>;
export type ChatInspectResponse = Record<string, unknown> & {
  rendered_prompt_preview?: string;
};
export type KvSlotsResponse = Record<string, unknown>;
export type KvSlotActionResponse = Record<string, unknown>;
export type ChatSessionRecord = ChatSession & Record<string, unknown>;
export type ChatSessionDeleteResponse = {
  deleted?: boolean;
  id?: string;
} & Record<string, unknown>;

function isRecord(payload: unknown): payload is Record<string, unknown> {
  return typeof payload === "object" && payload !== null && !Array.isArray(payload);
}

function requireRecordResponse(endpoint: string, payload: unknown): Record<string, unknown> {
  if (!isRecord(payload)) {
    throw new TypeError(`${endpoint} response must be an object.`);
  }
  return payload;
}

function requireArrayResponse(endpoint: string, payload: unknown, fieldName: string): unknown[] {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (isRecord(payload) && Array.isArray(payload[fieldName])) {
    return payload[fieldName];
  }
  throw new TypeError(`${endpoint} response must be an array or include a ${fieldName} array.`);
}

function requireObjectArray(endpoint: string, payload: unknown, fieldName: string): Record<string, unknown>[] {
  const values = requireArrayResponse(endpoint, payload, fieldName);
  const invalidIndex = values.findIndex((value) => !isRecord(value));
  if (invalidIndex !== -1) {
    throw new TypeError(`${endpoint} ${fieldName}[${invalidIndex}] must be an object.`);
  }
  return values.map((value) => value as Record<string, unknown>);
}

function parseChatSessions(payload: unknown): ChatSessionRecord[] {
  return requireObjectArray("/chat/sessions", payload, "sessions") as ChatSessionRecord[];
}

function parseChatSession(endpoint: string, payload: unknown): ChatSessionRecord {
  return requireRecordResponse(endpoint, payload) as ChatSessionRecord;
}

export function getChatCapabilities(modelName: string): Promise<ChatCapabilitiesResponse> {
  const path = `/chat/capabilities/${encodeURIComponent(modelName)}`;
  return apiGet<unknown>(path).then((payload) => requireRecordResponse(path, payload));
}

export function inspectModel(modelName: string, payload: Record<string, unknown>): Promise<ChatInspectResponse> {
  const path = `/chat/${encodeURIComponent(modelName)}/inspect`;
  return apiPost<unknown>(path, payload).then((response) => requireRecordResponse(path, response) as ChatInspectResponse);
}

export function getContextBudget(modelName: string, payload: Record<string, unknown>, signal: AbortSignal): Promise<ContextBudget> {
  return apiPost<ContextBudget>(`/chat/${encodeURIComponent(modelName)}/context-budget`, payload, { signal });
}

export function listKvSlots(modelName: string, target = "auto"): Promise<KvSlotsResponse> {
  const path = `/chat/${encodeURIComponent(modelName)}/kv/slots?target=${encodeURIComponent(target)}`;
  return apiGet<unknown>(path).then((payload) => requireRecordResponse(path, payload));
}

export function clearKvSlot(modelName: string, slotId: number, target = "auto"): Promise<KvSlotActionResponse> {
  const path = `/chat/${encodeURIComponent(modelName)}/kv/slots/${slotId}`;
  return apiPost<unknown>(path, { action: "clear", target }).then((payload) => requireRecordResponse(path, payload));
}

export function sendChat(modelName: string, payload: ChatRequest): Promise<ChatResponse> {
  return apiPost<ChatResponse>(`/chat/${encodeURIComponent(modelName)}`, payload);
}

export function sendOpenAIChatCompletion(payload: ChatRequest, signal?: AbortSignal): Promise<ChatResponse> {
  return apiAbsolutePost<ChatResponse>("/v1/chat/completions", payload, { signal });
}

export function streamChat(modelName: string, payload: ChatRequest, signal?: AbortSignal): Promise<ReadableStreamDefaultReader<Uint8Array>> {
  return apiStream(`/chat/${encodeURIComponent(modelName)}/stream`, { method: "POST", body: payload, signal });
}

export function listChatSessions(): Promise<ChatSessionRecord[]> {
  return apiGet<unknown>("/chat/sessions").then(parseChatSessions);
}

export function getChatSession(sessionId: string): Promise<ChatSessionRecord> {
  const path = `/chat/sessions/${encodeURIComponent(sessionId)}`;
  return apiGet<unknown>(path).then((payload) => parseChatSession(path, payload));
}

export function saveChatSession(payload: Record<string, unknown>): Promise<ChatSessionRecord> {
  return apiPost<unknown>("/chat/sessions", payload).then((response) => parseChatSession("/chat/sessions", response));
}

export function deleteChatSession(sessionId: string): Promise<ChatSessionDeleteResponse> {
  const path = `/chat/sessions/${encodeURIComponent(sessionId)}`;
  return apiDelete<unknown>(path).then((payload) => requireRecordResponse(path, payload) as ChatSessionDeleteResponse);
}
