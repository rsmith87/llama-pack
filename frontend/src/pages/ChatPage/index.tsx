import "./styles.css";
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type KeyboardEvent } from "react";
import { clearKvSlot, deleteChatSession, getChatCapabilities, getChatSession, inspectModel, listChatSessions, listKvSlots, saveChatSession, sendChat, sendOpenAIChatCompletion } from "../../api/chat";
import { getModelProfiles, listModels } from "../../api/models";
import { getNodeModels } from "../../api/nodes";
import { createThread, getThreadEvents, postThreadMessage } from "../../api/threads";
import { EmptyState, ErrorBanner, FormField, Panel, StatusBadge, Button } from "../../components/ui";
import { buildChatSessionSavePayload, chooseChatSessionToResume, nextSelectedChatSessionId } from "../../features/chat/chatSessions";
import type { ChatSession } from "../../types/chat";
import { applyTelemetryFromChunk, finalizeTelemetry } from "../../features/chat/chatTelemetry";
import type { Telemetry, TelemetryChunk } from "../../types/streaming";
import { parseStreamEvent } from "../../features/chat/chatStreaming";
import { buildThreadMetadata, threadEventsToChatMessages } from "../../features/chat/chatThreads";
import type { ThreadEvent } from "../../types/threads";
import type { NodeRecord } from "../../types/nodes";
import type { LocalModel, ModelProfileCatalog, ModelProfileFamily } from "../../types/models";
import type { ChatMessage, ChatDefaults, AdvancedDefaults, ChatContentBlock } from "../../types/chat";

const CHAT_PRESET_STORAGE_KEY = "lm_chat_preset";
const ACTIVE_CHAT_SESSION_STORAGE_KEY = "lm_active_chat_session_id";
const AUTH_TOKEN_STORAGE_KEY = "lm_ui_token";

const PRESETS: Record<string, ChatDefaults> = {
  balanced: { temperature: 0.7, max_tokens: 1024, top_p: 1 },
  precise: { temperature: 0.2, max_tokens: 768, top_p: 0.9 },
  creative: { temperature: 0.95, max_tokens: 2048, top_p: 0.95 },
};

const ADVANCED_DEFAULTS: AdvancedDefaults = {
  top_k: 40,
  min_p: 0,
  repeat_penalty: 1.1,
  seed: -1,
  stop: "",
  reasoning: false,
  cache_prompt: false,
  slot_id: "",
  structuredMode: "none",
  jsonSchemaText: "",
  grammarText: "",
};

function asModels(payload: unknown): LocalModel[] {
  if (Array.isArray(payload)) return payload as LocalModel[];
  return (payload as { models?: LocalModel[] } | null)?.models || [];
}

function asNodes(payload: unknown): NodeRecord[] {
  if (Array.isArray(payload)) return payload as NodeRecord[];
  return (payload as { nodes?: NodeRecord[] } | null)?.nodes || [];
}

function nodeModelsToChatModels(nodes: NodeRecord[]): LocalModel[] {
  return nodes.flatMap((node) => {
    const nodeName = String(node.name || "");
    if (!nodeName || node.reachable === false || !Array.isArray(node.models)) return [];
    return node.models.map((model) => ({
      ...(model as LocalModel),
      name: modelName(model as LocalModel),
      node: nodeName,
    }));
  }).filter((model) => modelName(model));
}

function modelName(model: LocalModel) {
  return String(model.name || model.id || model.model || "");
}

function modelTarget(model: LocalModel) {
  return model.node || model.node_name ? `node:${model.node || model.node_name}` : "";
}

function modelOptionLabel(model: LocalModel) {
  const name = modelName(model);
  const nodeTarget = modelTarget(model);
  return nodeTarget ? `${name} on ${nodeTarget.slice("node:".length)}` : name;
}

function modelIsLoaded(model: LocalModel) {
  const status = String(model.status || "").toLowerCase();
  return !status || status === "running" || status === "loaded";
}

function modelSupportsVision(model: LocalModel | undefined) {
  return Boolean(model?.vision || model?.supports?.vision);
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Failed to read image"));
    reader.readAsDataURL(file);
  });
}

function telemetryChips(message: ChatMessage) {
  const telemetry = message.telemetry || {};
  return [
    telemetry.tokensPerSecond != null ? `tok/s: ${telemetry.tokensPerSecond.toFixed(2)}` : null,
    telemetry.ttftMs != null ? `ttft: ${telemetry.ttftMs.toFixed(0)}ms` : null,
    telemetry.totalMs != null ? `total: ${telemetry.totalMs.toFixed(0)}ms` : null,
    telemetry.promptTokens != null ? `prompt_toks: ${telemetry.promptTokens}` : null,
    telemetry.completionTokens != null ? `gen_toks: ${telemetry.completionTokens}` : null,
  ].filter(Boolean) as string[];
}

function completionText(payload: Record<string, unknown>) {
  const choices = Array.isArray(payload.choices) ? payload.choices : [];
  const choice = choices[0] as { message?: { content?: string; role?: string }; text?: string } | undefined;
  return choice?.message?.content || choice?.text || "";
}

function asChatSessions(payload: unknown): ChatSession[] {
  if (Array.isArray(payload)) return payload as ChatSession[];
  return (payload as { sessions?: ChatSession[] } | null)?.sessions || [];
}

function asProfileCatalog(payload: unknown): ModelProfileCatalog {
  const families = (payload as { families?: ModelProfileFamily[] } | null)?.families;
  return { families: Array.isArray(families) ? families : [] };
}

function firstProfileForFamily(catalog: ModelProfileCatalog, family: string) {
  return catalog.families.find((item) => item.family === family)?.profiles[0]?.profile || "";
}

function familyForModel(catalog: ModelProfileCatalog, model: string) {
  if (!model) return "";
  return catalog.families.find((family) => family.family === model)?.family || "";
}

function readChatHandoff() {
  const params = new URLSearchParams(window.location.search);
  const model = params.get("model")?.trim() || "";
  const target = params.get("target")?.trim() || "";
  const mode = params.get("mode")?.trim() || "";
  const source = params.get("source")?.trim() || "";
  return {
    model,
    target,
    chatMode: mode === "thread" ? "thread" : mode === "direct" ? "direct" : "",
    source,
  };
}

function sessionLabel(session: ChatSession) {
  const item = session as ChatSession & { name?: string; model?: string };
  return item.name || [item.model, item.updated_at].filter(Boolean).join(" - ") || item.id || "Untitled session";
}

function sessionMessages(payload: unknown): ChatMessage[] {
  const messages = (payload as { messages?: Array<Record<string, unknown>> } | null)?.messages || [];
  return messages
    .filter((message) => typeof message.role === "string" && typeof message.content === "string")
    .map((message) => {
      const chatMessage: ChatMessage = { role: String(message.role), content: String(message.content) };
      if (typeof message.route === "string") chatMessage.route = message.route;
      if (typeof message.threadEventType === "string") chatMessage.threadEventType = message.threadEventType;
      if (typeof message.thread_event_type === "string") chatMessage.threadEventType = message.thread_event_type;
      if (typeof message.reasoningContent === "string") chatMessage.reasoningContent = message.reasoningContent;
      if (typeof message.reasoning_content === "string") chatMessage.reasoningContent = message.reasoning_content;
      if (typeof message.stopped === "boolean") chatMessage.stopped = message.stopped;
      if (message.routeMeta && typeof message.routeMeta === "object") chatMessage.routeMeta = message.routeMeta as ChatMessage["routeMeta"];
      if (message.route_meta && typeof message.route_meta === "object") chatMessage.routeMeta = message.route_meta as ChatMessage["routeMeta"];
      if (message.telemetry && typeof message.telemetry === "object") chatMessage.telemetry = message.telemetry as Telemetry;
      return chatMessage;
    });
}

function parseStopTokens(value: string) {
  const tokens = value.split(",").map((item) => item.trim()).filter(Boolean);
  if (!tokens.length) return undefined;
  return tokens.length === 1 ? tokens[0] : tokens;
}

function explainChatError(err: unknown): string {
  const message = err instanceof Error ? err.message : "Chat request failed";
  if (message.includes("401 Unauthorized")) {
    return "Unauthorized. Log in with a valid API key in the header bar, then retry.";
  }
  return message;
}

function structuredPayload(advanced: AdvancedDefaults): { payload?: Record<string, unknown>; error?: string } {
  if (advanced.structuredMode === "none") return { payload: {} };
  if (advanced.structuredMode === "json_schema") {
    if (!advanced.jsonSchemaText.trim()) return { error: "Structured mode is JSON Schema but schema is empty." };
    try {
      return { payload: { json_schema: JSON.parse(advanced.jsonSchemaText) } };
    } catch {
      return { error: "JSON schema is not valid JSON." };
    }
  }
  if (!advanced.grammarText.trim()) return { error: "Structured mode is Grammar but grammar is empty." };
  return { payload: { grammar: advanced.grammarText.trim() } };
}

async function readChatStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  onDelta: (delta: string, chunk?: TelemetryChunk, reasoningDelta?: string) => void,
) {
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
    const events = buffer.split("\n\n");
    buffer = events.pop() || "";
    for (const event of events) {
      for (const data of parseStreamEvent(event)) {
        if (data === "[DONE]") continue;
        try {
          const chunk = JSON.parse(data);
          const choice = chunk.choices?.[0] || {};
          const delta = choice.delta?.content || choice.text || "";
          const reasoningDelta = choice.delta?.reasoning_content || choice.delta?.reasoning || "";
          onDelta(delta, chunk, reasoningDelta);
        } catch {
          onDelta(data);
        }
      }
    }
    if (done) {
      if (buffer.trim()) {
        for (const data of parseStreamEvent(buffer)) {
          if (data !== "[DONE]") onDelta(data);
        }
      }
      break;
    }
  }
}

export function ChatPage() {
  const [handoff] = useState(readChatHandoff);
  const [models, setModels] = useState<LocalModel[]>([]);
  const [profileCatalog, setProfileCatalog] = useState<ModelProfileCatalog>({ families: [] });
  const [selectedFamily, setSelectedFamily] = useState("");
  const [selectedProfile, setSelectedProfile] = useState("");
  const [selectedModel, setSelectedModel] = useState(handoff.model);
  const [target, setTarget] = useState(handoff.target || "auto");
  const [chatMode, setChatMode] = useState(handoff.chatMode || "direct");
  const [threadId, setThreadId] = useState("");
  const [threadApp, setThreadApp] = useState(handoff.source || "ui");
  const [threadPurpose, setThreadPurpose] = useState("chat");
  const [threadPriority, setThreadPriority] = useState("medium");
  const [threadRequestType, setThreadRequestType] = useState("general");
  const [includeInternal, setIncludeInternal] = useState(false);
  const [enterToSend, setEnterToSend] = useState(false);
  const [agentToolsEnabled, setAgentToolsEnabled] = useState(false);
  const [threadRouteDetail, setThreadRouteDetail] = useState("No thread created.");
  const [prompt, setPrompt] = useState("");
  const [selectedImage, setSelectedImage] = useState<{ name: string; dataUrl: string } | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState("Ready");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [lastPrompt, setLastPrompt] = useState("");
  const [preset, setPreset] = useState(() => localStorage.getItem(CHAT_PRESET_STORAGE_KEY) || "balanced");
  const [defaults, setDefaults] = useState<ChatDefaults>(() => PRESETS[localStorage.getItem(CHAT_PRESET_STORAGE_KEY) || "balanced"] || PRESETS.balanced);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [advanced, setAdvanced] = useState<AdvancedDefaults>(ADVANCED_DEFAULTS);
  const [capabilities, setCapabilities] = useState<Record<string, unknown> | null>(null);
  const [capabilityDetail, setCapabilityDetail] = useState("Capabilities unavailable.");
  const [inspectDetail, setInspectDetail] = useState("No prompt inspection yet.");
  const [kvDetail, setKvDetail] = useState("No KV slot data loaded.");
  const [kvSlotActionId, setKvSlotActionId] = useState("");
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState(() => localStorage.getItem(ACTIVE_CHAT_SESSION_STORAGE_KEY) || "");
  const [sessionName, setSessionName] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  async function refreshModels() {
    setError("");
    try {
      let items = asModels(await listModels());
      if (!items.length) {
        items = nodeModelsToChatModels(asNodes(await getNodeModels()));
      }
      const loadedItems = items.filter((model) => modelName(model) && modelIsLoaded(model));
      setModels(items);
      setSelectedModel((current) => loadedItems.some((model) => modelName(model) === current) ? current : modelName(loadedItems[0] || {}));
      setTarget((current) => current === "auto" && modelTarget(loadedItems[0] || {}) ? modelTarget(loadedItems[0] || {}) : current);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load chat models");
    }
  }

  async function refreshProfileCatalog() {
    try {
      const catalog = asProfileCatalog(await getModelProfiles());
      setProfileCatalog(catalog);
      const preferredFamily = familyForModel(catalog, selectedModel) || catalog.families[0]?.family || "";
      setSelectedFamily((current) => current || preferredFamily);
      setSelectedProfile((current) => current || firstProfileForFamily(catalog, preferredFamily));
    } catch {
      setProfileCatalog({ families: [] });
    }
  }

  function selectModel(model: string) {
    setSelectedModel(model);
    const family = familyForModel(profileCatalog, model);
    if (family) {
      setSelectedFamily(family);
      setSelectedProfile(firstProfileForFamily(profileCatalog, family));
    }
  }

  useEffect(() => {
    void refreshModels();
    const profileTimer = window.setTimeout(() => void refreshProfileCatalog(), 300);
    return () => {
      window.clearTimeout(profileTimer);
      abortRef.current?.abort();
    };
  }, []);

  function updateAdvanced<K extends keyof AdvancedDefaults>(key: K, value: AdvancedDefaults[K]) {
    setAdvanced((current) => ({ ...current, [key]: value }));
  }

  async function refreshCapabilities(model = selectedModel) {
    if (!model) return;
    try {
      const payload = await getChatCapabilities(model);
      setCapabilities(payload);
      setCapabilityDetail(JSON.stringify(payload, null, 2));
    } catch (err) {
      setCapabilities(null);
      setCapabilityDetail(err instanceof Error ? err.message : "Capabilities unavailable.");
    }
  }

  function toggleAdvanced() {
    setAdvancedOpen((open) => {
      const nextOpen = !open;
      if (nextOpen) void refreshCapabilities();
      return nextOpen;
    });
  }

  function applyPreset(nextPreset: string) {
    setPreset(nextPreset);
    localStorage.setItem(CHAT_PRESET_STORAGE_KEY, nextPreset);
    setDefaults(PRESETS[nextPreset] || PRESETS.balanced);
  }

  function updateAssistant(index: number, patch: Partial<ChatMessage>) {
    setMessages((current) => current.map((message, messageIndex) => messageIndex === index ? { ...message, ...patch } : message));
  }

  function appendAssistant(index: number, delta: string, chunk?: TelemetryChunk, reasoningDelta = "") {
    setMessages((current) => current.map((message, messageIndex) => {
      if (messageIndex !== index) return message;
      const next = {
        ...message,
        content: `${message.content}${delta}`,
        reasoningContent: `${message.reasoningContent || ""}${reasoningDelta}`,
      };
      if (!next.firstTokenAtMs && (delta || reasoningDelta)) next.firstTokenAtMs = performance.now();
      if (chunk) applyTelemetryFromChunk(chunk, next);
      return next;
    }));
  }

  function buildChatPayload(requestMessages: ChatMessage[]) {
    const structured = structuredPayload(advanced);
    if (structured.error) return { error: structured.error };
    const payload: Record<string, unknown> = {
      messages: requestMessages.filter((message) => message.role !== "error" && !message.pending).map((message) => ({
        role: message.role,
        content: message.requestContent || message.content,
      })),
      ...defaults,
      target,
      top_k: advanced.top_k,
      min_p: advanced.min_p,
      repeat_penalty: advanced.repeat_penalty,
      seed: advanced.seed,
      reasoning: advanced.reasoning,
      cache_prompt: advanced.cache_prompt,
      ...(selectedFamily && selectedProfile ? { model_family: selectedFamily, context_profile: selectedProfile } : {}),
      ...(structured.payload || {}),
    };
    const stop = parseStopTokens(advanced.stop);
    if (stop) payload.stop = stop;
    const slotId = advanced.slot_id.trim();
    if (slotId) payload.slot_id = Number(slotId);
    return { payload };
  }

  async function copyCapabilitiesJson() {
    if (!capabilities) return;
    await window.navigator.clipboard?.writeText(JSON.stringify(capabilities, null, 2));
    setStatus("Capabilities copied");
  }

  async function inspectPrompt() {
    if (!selectedModel) return;
    const built = buildChatPayload(prompt.trim() ? [{ role: "user", content: prompt.trim() }] : [{ role: "user", content: "" }]);
    if (built.error) {
      setError(built.error);
      return;
    }
    const payload = await inspectModel(selectedModel, built.payload || {});
    setInspectDetail(String(payload.rendered_prompt_preview || JSON.stringify(payload, null, 2)));
  }

  async function refreshKvSlots() {
    if (!selectedModel) return;
    const payload = await listKvSlots(selectedModel, target);
    setKvDetail(JSON.stringify(payload, null, 2));
  }

  async function clearSelectedKvSlot() {
    if (!selectedModel || !kvSlotActionId.trim()) return;
    const payload = await clearKvSlot(selectedModel, Number(kvSlotActionId), target);
    setKvDetail(JSON.stringify(payload, null, 2));
  }

  async function refreshSessions() {
    setError("");
    try {
      const items = asChatSessions(await listChatSessions());
      setSessions(items);
      setSelectedSessionId((current) => current || localStorage.getItem(ACTIVE_CHAT_SESSION_STORAGE_KEY) || items[0]?.id || "");
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
    const requestDefaults = (payload.request_defaults || {}) as Partial<ChatDefaults> & {
      advanced?: Partial<AdvancedDefaults>;
      chat_mode?: string;
      model_family?: string;
      context_profile?: string;
      thread_id?: string;
      thread_metadata?: { app?: string | null; purpose?: string | null; priority?: string; request_type?: string };
      include_internal?: boolean;
    };
    if (model) setSelectedModel(model);
    setTarget(targetSelector || "auto");
    setDefaults((current) => ({
      ...current,
      ...(typeof requestDefaults.temperature === "number" ? { temperature: requestDefaults.temperature } : {}),
      ...(typeof requestDefaults.max_tokens === "number" ? { max_tokens: requestDefaults.max_tokens } : {}),
      ...(typeof requestDefaults.top_p === "number" ? { top_p: requestDefaults.top_p } : {}),
    }));
    if (requestDefaults.advanced && typeof requestDefaults.advanced === "object") {
      setAdvanced((current) => ({ ...current, ...requestDefaults.advanced }));
    }
    if (requestDefaults.chat_mode === "direct" || requestDefaults.chat_mode === "thread") {
      setChatMode(requestDefaults.chat_mode);
    }
    if (typeof requestDefaults.model_family === "string") setSelectedFamily(requestDefaults.model_family);
    if (typeof requestDefaults.context_profile === "string") setSelectedProfile(requestDefaults.context_profile);
    if (typeof requestDefaults.thread_id === "string") setThreadId(requestDefaults.thread_id);
    if (typeof requestDefaults.include_internal === "boolean") setIncludeInternal(requestDefaults.include_internal);
    const threadMetadata = requestDefaults.thread_metadata;
    if (threadMetadata && typeof threadMetadata === "object") {
      setThreadApp(String(threadMetadata.app || "ui"));
      setThreadPurpose(String(threadMetadata.purpose || "chat"));
      setThreadPriority(threadMetadata.priority || "medium");
      setThreadRequestType(threadMetadata.request_type || "general");
    }
    setMessages(sessionMessages(payload));
    setSessionName(String(payload.name || ""));
    setLastPrompt("");
    if (sessionId) {
      setSelectedSessionId(sessionId);
      localStorage.setItem(ACTIVE_CHAT_SESSION_STORAGE_KEY, sessionId);
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
        requestDefaults: sessionRequestDefaults(),
        selectedSessionId,
        saveAsNew,
      });
      const saved = await saveChatSession(payload);
      const nextId = nextSelectedChatSessionId({ savedSessionId: String(saved.id || ""), saveAsNew });
      if (nextId) {
        setSelectedSessionId(nextId);
        localStorage.setItem(ACTIVE_CHAT_SESSION_STORAGE_KEY, nextId);
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
      localStorage.setItem(ACTIVE_CHAT_SESSION_STORAGE_KEY, "");
      setStatus("Session deleted");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete chat session");
    }
  }

  async function resumeRecentSession() {
    const items = await refreshSessions();
    const reusableSessionId = chooseChatSessionToResume({
      sessions: items,
      preferredSessionId: localStorage.getItem(ACTIVE_CHAT_SESSION_STORAGE_KEY) || selectedSessionId,
    });
    if (!reusableSessionId) {
      setStatus("No reusable session");
      return;
    }
    await loadSelectedSession(reusableSessionId);
  }

  function finalizeAssistant(index: number) {
    setMessages((current) => current.map((message, messageIndex) => {
      if (messageIndex !== index) return message;
      const next = { ...message };
      finalizeTelemetry(next);
      return next;
    }));
  }

  function currentThreadMetadata() {
    return buildThreadMetadata({ app: threadApp, purpose: threadPurpose, priority: threadPriority, requestType: threadRequestType });
  }

  function sessionRequestDefaults() {
    return {
      ...defaults,
      advanced,
      chat_mode: chatMode,
      thread_id: threadId,
      thread_metadata: currentThreadMetadata(),
      include_internal: includeInternal,
      model_family: selectedFamily || undefined,
      context_profile: selectedProfile || undefined,
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

  function routeDecisionToMeta(route: Record<string, unknown> | undefined | null) {
    if (!route) return { target: "controller" };
    return {
      model: String(route.model || ""),
      target: route.node ? `node:${String(route.node)}` : "controller",
      resolved: String(route.node || ""),
      reason: String(route.reason || ""),
    };
  }

  function threadMessagesFromEvents(events: unknown): ChatMessage[] {
    const eventList = Array.isArray(events) ? events : (events as { events?: ThreadEvent[] } | null)?.events || [];
    return threadEventsToChatMessages(eventList as ThreadEvent[]) as ChatMessage[];
  }

  function renderThreadRouteDetail(events: unknown, activeThreadId = threadId) {
    const eventList = Array.isArray(events) ? events : (events as { events?: ThreadEvent[] } | null)?.events || [];
    const lastRouted = [...eventList].reverse().find((event) => event.route || event.event_type === "routing_decision");
    if (!lastRouted) {
      setThreadRouteDetail(activeThreadId ? `Thread ${activeThreadId}` : "No thread created.");
      return;
    }
    setThreadRouteDetail(JSON.stringify({
      thread_id: activeThreadId,
      event_type: lastRouted.event_type,
      route: lastRouted.route,
      node: lastRouted.agent_node,
      model: lastRouted.model,
    }, null, 2));
  }

  async function createThreadFromUi() {
    if (pending) return "";
    const thread = await createThread({
      title: null,
      default_model: selectedModel || null,
      metadata: currentThreadMetadata(),
    });
    const id = String(thread.id || "");
    setThreadId(id);
    setMessages([]);
    setStatus("Thread ready");
    setThreadRouteDetail(JSON.stringify({ id, metadata: thread.metadata, default_model: thread.default_model }, null, 2));
    return id;
  }

  async function refreshThreadEvents(activeThreadId = threadId) {
    if (!activeThreadId) return;
    const query = includeInternal ? "?include_internal=true" : "";
    const payload = await getThreadEvents(activeThreadId, query);
    setMessages(threadMessagesFromEvents(payload));
    renderThreadRouteDetail(payload, activeThreadId);
  }

  async function submitThreadPrompt(content: string) {
    const trimmed = content.trim();
    if (pending || !trimmed) return;
    const activeThreadId = threadId || await createThreadFromUi();
    if (!activeThreadId) return;
    const userMessage: ChatMessage = { role: "user", content: trimmed, threadEventType: "user_message" };
    const assistantMessage: ChatMessage = { role: "assistant", content: "", pending: true, routeMeta: { target: "controller" } };
    setMessages((current) => [...current, userMessage, assistantMessage]);
    setPrompt("");
    setLastPrompt(trimmed);
    setPending(true);
    setStatus("Routing through controller...");
    try {
      const response = await postThreadMessage(activeThreadId, {
        role: "user",
        content: trimmed,
        model: selectedModel || null,
        model_family: selectedFamily || undefined,
        context_profile: selectedProfile || undefined,
        target,
        metadata: currentThreadMetadata(),
      });
      const routeMeta = routeDecisionToMeta(response.route as Record<string, unknown> | undefined);
      setMessages((current) => current.map((message) => message.pending ? { ...message, content: String((response.message as { content?: string } | undefined)?.content || "(empty response)"), pending: false, routeMeta } : message));
      await refreshThreadEvents(activeThreadId);
    } catch (err) {
      const friendlyError = explainChatError(err);
      setMessages((current) => current.map((message) => message.pending ? { ...message, role: "error", content: friendlyError, pending: false } : message));
      setError(friendlyError);
    } finally {
      setPending(false);
      setStatus(activeThreadId ? `Thread ${activeThreadId.slice(0, 8)}` : "Ready");
    }
  }

  async function onImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Choose an image file.");
      return;
    }
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setSelectedImage({ name: file.name, dataUrl });
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to read image");
    }
  }

  function buildUserMessageContent(content: string): string | ChatContentBlock[] {
    const trimmed = content.trim();
    if (!selectedImage || !selectedModelSupportsVision || isThreadMode) return trimmed;
    return [
      { type: "text", text: trimmed },
      { type: "image_url", image_url: { url: selectedImage.dataUrl } },
    ];
  }

  async function requestCompletion(model: string, requestMessages: ChatMessage[], assistantIndex: number, controller: AbortController) {
    const built = buildChatPayload(requestMessages);
    if (built.error) throw new Error(built.error);
    const payload = built.payload || {};
    if (agentToolsEnabled) {
      setStatus("Running agent tools...");
      const body = await sendOpenAIChatCompletion(
        {
          ...payload,
          model,
          tool_runtime: "agent",
          stream: false,
        },
        controller.signal,
      );
      const patch: ChatMessage = { role: "assistant", content: completionText(body), pending: false };
      applyTelemetryFromChunk(body as TelemetryChunk, patch);
      finalizeTelemetry(patch);
      updateAssistant(assistantIndex, patch);
      return;
    }
    const authToken = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY) || "";
    const response = await fetch(`/lm-api/v1/chat/${encodeURIComponent(model)}/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
        ...(authToken ? { "X-UI-Session": authToken } : {}),
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!response.ok) {
      if (response.status !== 404) throw new Error(`${response.status} ${response.statusText}: ${await response.text()}`);
      setStatus("Streaming unavailable; using standard response...");
      const body = await sendChat(model, payload);
      const patch: ChatMessage = { role: "assistant", content: completionText(body), pending: false };
      applyTelemetryFromChunk(body as TelemetryChunk, patch);
      finalizeTelemetry(patch);
      updateAssistant(assistantIndex, patch);
      return;
    }
    const route = response.headers.get("X-Llama-Manager-Route");
    if (route) updateAssistant(assistantIndex, { route });
    if (!response.body) throw new Error("Response did not include a readable stream");
    await readChatStream(response.body.getReader(), (delta, chunk, reasoningDelta) => appendAssistant(assistantIndex, delta, chunk, reasoningDelta));
    finalizeAssistant(assistantIndex);
  }

  async function submitPrompt(content: string) {
    if (chatMode === "thread") {
      await submitThreadPrompt(content);
      return;
    }
    const trimmed = content.trim();
    if (pending || !trimmed || !selectedModel) return;
    const requestContent = buildUserMessageContent(trimmed);
    const userMessage: ChatMessage = {
      role: "user",
      content: trimmed,
      requestContent,
      imageName: selectedModelSupportsVision && !isThreadMode ? selectedImage?.name : undefined,
    };
    const validation = buildChatPayload([...messages, userMessage]);
    if (validation.error) {
      setError(validation.error);
      return;
    }
    setError("");
    const assistantMessage: ChatMessage = { role: "assistant", content: "", pending: true, startedAtMs: performance.now() };
    const nextMessages = [...messages, userMessage, assistantMessage];
    const assistantIndex = nextMessages.length - 1;
    setMessages(nextMessages);
    setPrompt("");
    setSelectedImage(null);
    setLastPrompt(trimmed);
    setPending(true);
    setStatus(agentToolsEnabled ? "Running agent tools..." : "Streaming response...");
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      await requestCompletion(selectedModel, nextMessages, assistantIndex, controller);
      updateAssistant(assistantIndex, { pending: false });
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        updateAssistant(assistantIndex, { content: "(stopped)", pending: false, stopped: true });
      } else {
        const friendlyError = explainChatError(err);
        updateAssistant(assistantIndex, { role: "error", content: friendlyError, pending: false });
        setError(friendlyError);
      }
    } finally {
      abortRef.current = null;
      setPending(false);
      setStatus("Ready");
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void submitPrompt(prompt);
  }

  function onPromptKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (!enterToSend || event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    void submitPrompt(prompt);
  }

  function stop() {
    abortRef.current?.abort();
    setMessages((current) => current.map((message) => message.pending ? { ...message, content: message.content || "(stopped)", pending: false, stopped: true } : message));
    setPending(false);
    setStatus("Ready");
  }

  function clear() {
    if (pending) return;
    setMessages([]);
    setPrompt("");
    setSelectedImage(null);
    setLastPrompt("");
    localStorage.setItem(ACTIVE_CHAT_SESSION_STORAGE_KEY, localStorage.getItem(ACTIVE_CHAT_SESSION_STORAGE_KEY) || "");
  }

  const runningModels = models.filter((model) => modelName(model) && modelIsLoaded(model));
  const noModelLoaded = runningModels.length === 0;
  const selectedRunningModel = runningModels.find((model) => modelName(model) === selectedModel);
  const selectedModelSupportsVision = modelSupportsVision(selectedRunningModel);
  const isThreadMode = chatMode === "thread";
  const showImageUpload = selectedModelSupportsVision && !isThreadMode;
  const canSend = Boolean(!noModelLoaded && selectedModel && prompt.trim() && !pending);
  const canSendThread = Boolean(!noModelLoaded && prompt.trim() && !pending);
  const profileFamilies = profileCatalog.families.filter((family) => family.family && family.profiles.length);
  const selectedProfileFamily = profileFamilies.find((family) => family.family === selectedFamily);
  const targetOptions = ["auto", "local", target, ...runningModels.map(modelTarget)].filter((item, index, items) => item && items.indexOf(item) === index);

  return (
    <div className="chat-page-react">
      <div className="page-heading">
        <div><span className="eyebrow">{isThreadMode ? "Thread mode" : "Direct mode"}</span><h2>Chat</h2></div>
        <Button type="button" onClick={refreshModels}>Refresh Models</Button>
      </div>
      <ErrorBanner message={error} />
      <div className="chat-layout">
        <div className="chat-main-column">
          <Panel title="Sessions" eyebrow="Save and resume" className="chat-sessions-panel">
            <div className="chat-session-panel chat-session-panel-top">
              <FormField label="Session name"><input value={sessionName} onChange={(event) => setSessionName(event.target.value)} placeholder="Session name" /></FormField>
              <FormField label="Saved sessions">
                <select value={selectedSessionId} onChange={(event) => setSelectedSessionId(event.target.value)}>
                  <option value="">Select a session</option>
                  {sessions.map((session) => <option key={session.id} value={session.id}>{sessionLabel(session)}</option>)}
                </select>
              </FormField>
              <div className="modal-actions">
                <Button type="button" onClick={() => void refreshSessions()}>Refresh Sessions</Button>
                <Button type="button" onClick={() => void loadSelectedSession()} disabled={!selectedSessionId.trim()}>Load Session</Button>
                <Button type="button" onClick={() => void saveCurrentSession(false)} disabled={!messages.length}>Save Session</Button>
                <Button type="button" onClick={() => void saveCurrentSession(true)} disabled={!messages.length}>Save As New</Button>
                <Button type="button" onClick={() => void deleteSelectedSession()} disabled={!selectedSessionId.trim()}>Delete Session</Button>
                <Button type="button" onClick={() => void resumeRecentSession()}>Resume Recent</Button>
              </div>
            </div>
          </Panel>

          <Panel title="Transcript" eyebrow="Streaming response" className="chat-workbench-panel">
            <div className="chat-transcript" aria-live="polite">
              {messages.length ? messages.map((message, index) => (
                <article className={`chat-bubble chat-bubble-${message.role}`} key={`${message.role}-${index}`}>
                  <span className="chat-role">{message.role}</span>
                  {telemetryChips(message).length ? (
                    <div className="chat-chips">
                      {telemetryChips(message).map((chip) => <span className="chat-chip" key={chip}>{chip}</span>)}
                    </div>
                  ) : null}
                  {message.reasoningContent ? (
                    <details className="chat-reasoning" open={message.pending ? true : undefined}>
                      <summary>{message.pending ? "Reasoning (streaming...)" : "Reasoning"}</summary>
                      <pre>{message.reasoningContent}</pre>
                    </details>
                  ) : null}
                  <p>{message.content || (message.pending ? "..." : "(empty response)")}</p>
                  {message.imageName ? <small>image: {message.imageName}</small> : null}
                  {message.route ? <small>resolved: {message.route}</small> : null}
                  {message.routeMeta?.resolved ? <small>resolved: {message.routeMeta.resolved}</small> : null}
                  {message.routeMeta?.reason ? <small>reason: {message.routeMeta.reason}</small> : null}
                  {message.stopped ? <small>stopped</small> : null}
                </article>
              )) : <EmptyState message="Start a running model, choose it here, and send a test prompt." />}
            </div>
            <form className="chat-composer" onSubmit={onSubmit}>
              <FormField label="Prompt">
                <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} onKeyDown={onPromptKeyDown} rows={4} disabled={noModelLoaded} />
              </FormField>
              {showImageUpload ? (
                <div className="chat-image-upload">
                  <FormField label="Image">
                    <input type="file" accept="image/*" onChange={onImageChange} disabled={pending} />
                  </FormField>
                  {selectedImage ? (
                    <div className="chat-image-preview">
                      <img src={selectedImage.dataUrl} alt="" />
                      <span>{selectedImage.name}</span>
                      <Button type="button" onClick={() => setSelectedImage(null)} disabled={pending}>Remove</Button>
                    </div>
                  ) : null}
                </div>
              ) : null}
              <div className="modal-actions">
                <label className="checkbox-label"><input type="checkbox" checked={enterToSend} onChange={(event) => setEnterToSend(event.target.checked)} />Enter to send</label>
                <Button type="submit" disabled={isThreadMode ? !canSendThread : !canSend}>Send</Button>
                <Button type="button" onClick={stop} disabled={!pending}>Stop</Button>
                <Button type="button" onClick={() => void submitPrompt(lastPrompt)} disabled={pending || !lastPrompt}>Regenerate</Button>
                <Button type="button" onClick={clear} disabled={pending}>Clear</Button>
              </div>
            </form>
          </Panel>
        </div>

        <Panel title="Controls" eyebrow="Route and defaults" className={`side-panel${noModelLoaded ? " chat-controls-unavailable" : ""}`}>
          {noModelLoaded ? <p className="chat-controls-warning" role="status">Load a model before using chat controls.</p> : null}
          <fieldset className="stacked-controls chat-controls-fieldset" disabled={noModelLoaded} aria-disabled={noModelLoaded}>
            <FormField label="Model"><select value={selectedModel} onChange={(event) => {
              const nextModel = runningModels.find((model) => modelName(model) === event.target.value);
              selectModel(event.target.value);
              if (nextModel && modelTarget(nextModel)) setTarget(modelTarget(nextModel));
            }}>{runningModels.length ? runningModels.map((model) => <option key={`${modelName(model)}-${modelTarget(model) || "local"}`} value={modelName(model)}>{modelOptionLabel(model)}</option>) : <option value="">No loaded models</option>}</select></FormField>
            {profileFamilies.length ? (
              <>
                <FormField label="Model Family"><select value={selectedFamily} onChange={(event) => {
                  const family = event.target.value;
                  setSelectedFamily(family);
                  setSelectedProfile(firstProfileForFamily(profileCatalog, family));
                }}>{profileFamilies.map((family) => <option key={family.family} value={family.family}>{family.family}</option>)}</select></FormField>
                <FormField label="Context Profile"><select value={selectedProfile} onChange={(event) => setSelectedProfile(event.target.value)}>
                  {(selectedProfileFamily?.profiles || []).map((profile) => <option key={profile.profile} value={profile.profile}>{profile.label || profile.profile}</option>)}
                </select></FormField>
              </>
            ) : null}
            <FormField label="Target"><select value={target} onChange={(event) => setTarget(event.target.value)}>{targetOptions.map((option) => <option key={option} value={option}>{option === "auto" ? "Auto" : option === "local" ? "Local" : option}</option>)}</select></FormField>
            <FormField label="Chat Mode"><select value={chatMode} onChange={(event) => setChatMode(event.target.value)}><option value="direct">Direct</option><option value="thread">Thread</option></select></FormField>
            {!isThreadMode ? <label className="checkbox-label"><input type="checkbox" checked={agentToolsEnabled} onChange={(event) => setAgentToolsEnabled(event.target.checked)} />Agent tools</label> : null}
            <FormField label="Preset"><select value={preset} onChange={(event) => applyPreset(event.target.value)}><option value="balanced">Balanced</option><option value="precise">Precise</option><option value="creative">Creative</option></select></FormField>
            <FormField label="Temperature"><input type="number" step="0.05" value={defaults.temperature} onChange={(event) => setDefaults((current) => ({ ...current, temperature: Number(event.target.value || 0) }))} /></FormField>
            <FormField label="Max tokens"><input type="number" value={defaults.max_tokens} onChange={(event) => setDefaults((current) => ({ ...current, max_tokens: Number(event.target.value || 0) }))} /></FormField>
            <FormField label="Top P"><input type="number" step="0.05" value={defaults.top_p} onChange={(event) => setDefaults((current) => ({ ...current, top_p: Number(event.target.value || 0) }))} /></FormField>
            <Button type="button" onClick={toggleAdvanced}>Advanced</Button>
            {advancedOpen ? (
              <div className="advanced-chat-panel">
                <FormField label="Top K"><input type="number" value={advanced.top_k} onChange={(event) => updateAdvanced("top_k", Number(event.target.value || 0))} /></FormField>
                <FormField label="Min P"><input type="number" step="0.01" value={advanced.min_p} onChange={(event) => updateAdvanced("min_p", Number(event.target.value || 0))} /></FormField>
                <FormField label="Repeat penalty"><input type="number" step="0.01" value={advanced.repeat_penalty} onChange={(event) => updateAdvanced("repeat_penalty", Number(event.target.value || 0))} /></FormField>
                <FormField label="Seed"><input type="number" value={advanced.seed} onChange={(event) => updateAdvanced("seed", Number(event.target.value || 0))} /></FormField>
                <FormField label="Stop tokens"><input value={advanced.stop} onChange={(event) => updateAdvanced("stop", event.target.value)} placeholder="</s>, User:" /></FormField>
                <label className="checkbox-label"><input type="checkbox" checked={advanced.reasoning} onChange={(event) => updateAdvanced("reasoning", event.target.checked)} />Reasoning</label>
                <label className="checkbox-label"><input type="checkbox" checked={advanced.cache_prompt} onChange={(event) => updateAdvanced("cache_prompt", event.target.checked)} />Cache prompt</label>
                <FormField label="KV slot"><input type="number" value={advanced.slot_id} onChange={(event) => updateAdvanced("slot_id", event.target.value)} placeholder="auto" /></FormField>
                <FormField label="Structured mode"><select value={advanced.structuredMode} onChange={(event) => updateAdvanced("structuredMode", event.target.value as AdvancedDefaults["structuredMode"])}><option value="none">None</option><option value="json_schema">JSON Schema</option><option value="grammar">Grammar</option></select></FormField>
                <FormField label="JSON schema"><textarea value={advanced.jsonSchemaText} disabled={advanced.structuredMode !== "json_schema"} onChange={(event) => updateAdvanced("jsonSchemaText", event.target.value)} rows={4} /></FormField>
                <FormField label="Grammar"><textarea value={advanced.grammarText} disabled={advanced.structuredMode !== "grammar"} onChange={(event) => updateAdvanced("grammarText", event.target.value)} rows={4} /></FormField>
                <div className="modal-actions">
                  <Button type="button" onClick={() => void refreshCapabilities()}>Refresh Capabilities</Button>
                  <Button type="button" onClick={() => void copyCapabilitiesJson()} disabled={!capabilities}>Copy Capabilities JSON</Button>
                  <Button type="button" onClick={() => void inspectPrompt()}>Inspect prompt/template</Button>
                  <Button type="button" onClick={() => void refreshKvSlots()}>Refresh KV slots</Button>
                </div>
                <div className="modal-actions">
                  <FormField label="KV slot action id"><input type="number" value={kvSlotActionId} onChange={(event) => setKvSlotActionId(event.target.value)} placeholder="slot id" /></FormField>
                  <Button type="button" onClick={() => void clearSelectedKvSlot()} disabled={!kvSlotActionId.trim()}>Clear slot</Button>
                </div>
                <p className="muted">Structured output: {advanced.structuredMode === "none" ? "disabled" : advanced.structuredMode}</p>
                <pre className="detail-json compact-json">{capabilityDetail}</pre>
                <pre className="detail-json compact-json">{inspectDetail}</pre>
                <pre className="detail-json compact-json">{kvDetail}</pre>
              </div>
            ) : null}
            <StatusBadge tone={pending ? "warning" : "success"}>{status}</StatusBadge>
            {isThreadMode ? (
              <div className="thread-controls">
                <FormField label="Thread ID"><input value={threadId} onChange={(event) => setThreadId(event.target.value)} placeholder="thread id" /></FormField>
                <FormField label="Thread App"><input value={threadApp} onChange={(event) => setThreadApp(event.target.value)} /></FormField>
                <FormField label="Thread Purpose"><input value={threadPurpose} onChange={(event) => setThreadPurpose(event.target.value)} /></FormField>
                <FormField label="Thread Priority"><select value={threadPriority} onChange={(event) => setThreadPriority(event.target.value)}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></FormField>
                <FormField label="Thread Request Type"><select value={threadRequestType} onChange={(event) => setThreadRequestType(event.target.value)}><option value="general">General</option><option value="coding">Coding</option><option value="analysis">Analysis</option></select></FormField>
                <label className="checkbox-label"><input type="checkbox" checked={includeInternal} onChange={(event) => setIncludeInternal(event.target.checked)} />Include internal events</label>
                <div className="modal-actions">
                  <Button type="button" onClick={() => void createThreadFromUi()} disabled={pending}>New Thread</Button>
                  <Button type="button" onClick={() => void refreshThreadEvents()} disabled={pending || !threadId}>Refresh Thread</Button>
                </div>
                <pre className="detail-json">{threadRouteDetail}</pre>
              </div>
            ) : null}
          </fieldset>
        </Panel>
      </div>
    </div>
  );
}
