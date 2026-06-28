import { useState, type Dispatch, type SetStateAction } from "react";
import { deleteChatSession, getChatSession, listChatSessions, saveChatSession } from "../../api/chat";
import { CHAT_CONSTANTS } from "../../constants";
import { asChatSessions, sessionMessages } from "../../features/chat";
import {
  buildChatSessionSavePayload,
  chooseChatSessionToResume,
  nextSelectedChatSessionId,
} from "../../features/chat/chatSessions";
import type { AdvancedDefaults, ChatDefaults, ChatMessage, ChatSession } from "../../types/chat";

type ThreadMetadata = {
  app?: string | null;
  purpose?: string | null;
  priority?: string;
  request_type?: string;
};

type UseChatSessionsArgs = {
  selectedModel: string;
  target: string;
  messages: ChatMessage[];
  requestDefaults: () => Record<string, unknown>;
  selectModel: (model: string) => void;
  setTarget: (target: string) => void;
  setDefaults: Dispatch<SetStateAction<ChatDefaults>>;
  setAdvanced: Dispatch<SetStateAction<AdvancedDefaults>>;
  setSelectedFamily: (family: string) => void;
  setSelectedProfile: (profile: string) => void;
  setActiveConversationId: (conversationId: string) => void;
  setIncludeInternal: (includeInternal: boolean) => void;
  setConversationApp: (app: string) => void;
  setConversationPurpose: (purpose: string) => void;
  setConversationPriority: (priority: string) => void;
  setConversationRequestType: (requestType: string) => void;
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  setLastPrompt: (lastPrompt: string) => void;
  setStatus: (status: string) => void;
  setError: (error: string) => void;
};

export function useChatSessions({
  selectedModel,
  target,
  messages,
  requestDefaults,
  selectModel,
  setTarget,
  setDefaults,
  setAdvanced,
  setSelectedFamily,
  setSelectedProfile,
  setActiveConversationId,
  setIncludeInternal,
  setConversationApp,
  setConversationPurpose,
  setConversationPriority,
  setConversationRequestType,
  setMessages,
  setLastPrompt,
  setStatus,
  setError,
}: UseChatSessionsArgs) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState(() => localStorage.getItem(CHAT_CONSTANTS.ACTIVE_CHAT_SESSION_STORAGE_KEY) || "");
  const [sessionName, setSessionName] = useState("");

  async function refreshSessions() {
    setError("");
    try {
      const items = asChatSessions(await listChatSessions());
      setSessions(items);
      setSelectedSessionId((current) => current || localStorage.getItem(CHAT_CONSTANTS.ACTIVE_CHAT_SESSION_STORAGE_KEY) || items[0]?.id || "");
      setStatus("Sessions refreshed");
      return items;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load chat sessions");
      return [];
    }
  }

  function applySession(payload: Record<string, unknown>) {
    const sessionId = String(payload.id || "");
    const model = typeof payload.model === "string" ? payload.model : "";
    const targetSelector = typeof payload.target_selector === "string" ? payload.target_selector : "auto";
    const defaults = (payload.request_defaults || {}) as Partial<ChatDefaults> & {
      advanced?: Partial<AdvancedDefaults>;
      model_family?: string;
      context_profile?: string;
      thread_id?: string;
      thread_metadata?: ThreadMetadata;
      include_internal?: boolean;
    };
    if (model) selectModel(model);
    setTarget(targetSelector || "auto");
    setDefaults((current) => ({
      ...current,
      ...(typeof defaults.temperature === "number" ? { temperature: defaults.temperature } : {}),
      ...(typeof defaults.max_tokens === "number" ? { max_tokens: defaults.max_tokens } : {}),
      ...(typeof defaults.top_p === "number" ? { top_p: defaults.top_p } : {}),
    }));
    if (defaults.advanced && typeof defaults.advanced === "object") {
      setAdvanced((current) => ({ ...current, ...defaults.advanced }));
    }
    if (typeof defaults.model_family === "string") setSelectedFamily(defaults.model_family);
    if (typeof defaults.context_profile === "string") setSelectedProfile(defaults.context_profile);
    if (typeof defaults.thread_id === "string") setActiveConversationId(defaults.thread_id);
    if (typeof defaults.include_internal === "boolean") setIncludeInternal(defaults.include_internal);
    const threadMetadata = defaults.thread_metadata;
    if (threadMetadata && typeof threadMetadata === "object") {
      setConversationApp(String(threadMetadata.app || "ui"));
      setConversationPurpose(String(threadMetadata.purpose || "chat"));
      setConversationPriority(threadMetadata.priority || "medium");
      setConversationRequestType(threadMetadata.request_type || "general");
    }
    setMessages(sessionMessages(payload));
    setSessionName(String(payload.name || ""));
    setLastPrompt("");
    if (sessionId) {
      setSelectedSessionId(sessionId);
      localStorage.setItem(CHAT_CONSTANTS.ACTIVE_CHAT_SESSION_STORAGE_KEY, sessionId);
    }
    setStatus("Session loaded");
  }

  async function loadSelectedSession(sessionId = selectedSessionId) {
    const normalizedSessionId = sessionId.trim();
    if (!normalizedSessionId) return;
    setError("");
    try {
      applySession(await getChatSession(normalizedSessionId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load chat session");
    }
  }

  async function saveCurrentSession(saveAsNew = false) {
    setError("");
    try {
      const payload = buildChatSessionSavePayload({
        name: sessionName.trim() || `Chat ${new Date().toLocaleString()}`,
        model: selectedModel,
        target,
        messages: messages.filter((message) => !message.pending).map(serializeSessionMessage),
        requestDefaults: requestDefaults(),
        selectedSessionId,
        saveAsNew,
      });
      const saved = await saveChatSession(payload);
      const nextId = nextSelectedChatSessionId({ savedSessionId: String(saved.id || ""), saveAsNew });
      if (nextId) {
        setSelectedSessionId(nextId);
        localStorage.setItem(CHAT_CONSTANTS.ACTIVE_CHAT_SESSION_STORAGE_KEY, nextId);
      }
      setSessionName(String(saved.name || payload.name || ""));
      setSessions((current) => {
        const savedSession = saved as ChatSession;
        return current.some((session) => session.id === savedSession.id)
          ? current.map((session) => session.id === savedSession.id ? savedSession : session)
          : [savedSession, ...current];
      });
      setStatus("Session saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save chat session");
    }
  }

  async function deleteSelectedSession() {
    const normalizedSessionId = selectedSessionId.trim();
    if (!normalizedSessionId) return;
    setError("");
    try {
      await deleteChatSession(normalizedSessionId);
      setSessions((current) => current.filter((session) => session.id !== normalizedSessionId));
      setSelectedSessionId("");
      localStorage.setItem(CHAT_CONSTANTS.ACTIVE_CHAT_SESSION_STORAGE_KEY, "");
      setStatus("Session deleted");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete chat session");
    }
  }

  async function resumeRecentSession() {
    const items = await refreshSessions();
    const reusableSessionId = chooseChatSessionToResume({
      sessions: items,
      preferredSessionId: localStorage.getItem(CHAT_CONSTANTS.ACTIVE_CHAT_SESSION_STORAGE_KEY) || selectedSessionId,
    });
    if (!reusableSessionId) {
      setStatus("No reusable session");
      return;
    }
    await loadSelectedSession(reusableSessionId);
  }

  return {
    sessions,
    selectedSessionId,
    sessionName,
    setSelectedSessionId,
    setSessionName,
    refreshSessions,
    loadSelectedSession,
    saveCurrentSession,
    deleteSelectedSession,
    resumeRecentSession,
  };
}

function serializeSessionMessage(message: ChatMessage) {
  const item: Record<string, unknown> = { role: message.role, content: message.content };
  if (message.route) item.route = message.route;
  if (message.routeMeta) item.route_meta = message.routeMeta;
  if (message.threadEventType) item.thread_event_type = message.threadEventType;
  if (message.reasoningContent) item.reasoning_content = message.reasoningContent;
  if (message.stopped) item.stopped = message.stopped;
  if (message.telemetry) item.telemetry = message.telemetry;
  return item;
}
