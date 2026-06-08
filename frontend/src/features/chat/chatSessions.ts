export type { ChatSession, ChatSessionSaveOptions, ChatSessionSavePayload } from "../../types/chat";
import type { ChatSession, ChatSessionSaveOptions, ChatSessionSavePayload } from "../../types/chat";
import { TIMERS } from "../../constants";

export const CHAT_SESSION_MAX_AGE_MS = TIMERS.DAY_MS;

export function buildChatSessionSavePayload({
  name,
  model,
  target = "auto",
  messages = [],
  requestDefaults = {},
  selectedSessionId = "",
  saveAsNew = false,
}: ChatSessionSaveOptions = {}): ChatSessionSavePayload {
  const payload: ChatSessionSavePayload = {
    name,
    model,
    target,
    messages,
    request_defaults: requestDefaults,
  };
  const normalizedSessionId = typeof selectedSessionId === "string" ? selectedSessionId.trim() : "";
  if (!saveAsNew && normalizedSessionId) {
    payload.id = normalizedSessionId;
  }
  return payload;
}

export function nextSelectedChatSessionId({ savedSessionId }: { savedSessionId?: string; saveAsNew?: boolean } = {}) {
  if (typeof savedSessionId !== "string") {
    return "";
  }
  const normalizedSessionId = savedSessionId.trim();
  if (!normalizedSessionId) {
    return "";
  }
  return normalizedSessionId;
}


export function parseChatSessionTimestamp(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }
  const timestampMs = Date.parse(value);
  return Number.isFinite(timestampMs) ? timestampMs : null;
}

export function isChatSessionReusable(session: ChatSession | null | undefined, nowMs = Date.now()) {
  const updatedAtMs = parseChatSessionTimestamp(session?.updated_at);
  if (updatedAtMs == null) {
    return false;
  }
  return nowMs - updatedAtMs < CHAT_SESSION_MAX_AGE_MS;
}

export function chooseChatSessionToResume({
  sessions = [],
  preferredSessionId = "",
  nowMs = Date.now(),
}: {
  sessions?: ChatSession[];
  preferredSessionId?: string;
  nowMs?: number;
} = {}) {
  const normalizedPreferredId =
    typeof preferredSessionId === "string" ? preferredSessionId.trim() : "";
  const preferredSession = normalizedPreferredId
    ? sessions.find((session) => session?.id === normalizedPreferredId)
    : null;
  if (preferredSession && isChatSessionReusable(preferredSession, nowMs)) {
    return preferredSession.id || "";
  }
  const fallbackSession = sessions.find((session) => isChatSessionReusable(session, nowMs));
  return typeof fallbackSession?.id === "string" ? fallbackSession.id : "";
}
