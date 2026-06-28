import "./styles.css";
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type KeyboardEvent } from "react";
import { clearKvSlot, deleteChatSession, getChatCapabilities, getChatSession, getContextBudget, inspectModel, listChatSessions, listKvSlots, saveChatSession } from "../../api/chat";
import { searchMemory, writeMemory } from "../../api/memory";
import { createThread, getThreadEvents, streamThreadMessage } from "../../api/threads";
import { ErrorBanner, Panel, Button } from "../../components/ui";
import { ChatComposer, ChatSessionsPanel, ChatTranscriptPanel } from "./components";
import { ChatControlsPanel } from "./controls";
import { useChatModelSelection } from "./useChatModelSelection";
import { buildChatSessionSavePayload, chooseChatSessionToResume, nextSelectedChatSessionId } from "../../features/chat/chatSessions";
import type { ChatSession } from "../../types/chat";
import { applyTelemetryFromChunk, finalizeTelemetry } from "../../features/chat/chatTelemetry";
import type { TelemetryChunk } from "../../types/streaming";
import { buildThreadMetadata, threadEventsToChatMessages } from "../../features/chat/chatThreads";
import type { ThreadEvent } from "../../types/threads";
import type { ChatMessage, ChatDefaults, AdvancedDefaults, ChatContentBlock, ContextBudget } from "../../types/chat";
import { CHAT_CONSTANTS } from "../../constants"
import { modelName } from "../../features/models";
import { 
  modelTarget,
  modelSupportsVision,
  readFileAsDataUrl,
  asChatSessions,
  readChatHandoff,
  sessionMessages,
  parseStopTokens,
  explainChatError,
  structuredPayload,
  readChatStream,
  routeDecisionToMeta,
  parseSlashCommand,
} from "../../features/chat";
import { contextBudgetSummary, memoryResultLine } from "../../features/chat/chatView";

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

export function ChatPage() {
  const [handoff] = useState(readChatHandoff);
  const [activeConversationId, setActiveConversationId] = useState("");
  const [conversationApp, setConversationApp] = useState(handoff.source || "ui");
  const [conversationPurpose, setConversationPurpose] = useState("chat");
  const [conversationPriority, setConversationPriority] = useState("medium");
  const [conversationRequestType, setConversationRequestType] = useState("general");
  const [includeInternal, setIncludeInternal] = useState(false);
  const [enterToSend, setEnterToSend] = useState(false);
  const [threadRouteDetail, setThreadRouteDetail] = useState("No conversation created.");
  const [prompt, setPrompt] = useState("");
  const [selectedImage, setSelectedImage] = useState<{ name: string; dataUrl: string } | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState("Ready");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [chatBootstrapLoaded, setChatBootstrapLoaded] = useState(false);
  const [controllerChatUrl, setControllerChatUrl] = useState("");
  const [lastPrompt, setLastPrompt] = useState("");
  const [preset, setPreset] = useState(() => localStorage.getItem(CHAT_CONSTANTS.CHAT_PRESET_STORAGE_KEY) || "balanced");
  const [defaults, setDefaults] = useState<ChatDefaults>(() => PRESETS[localStorage.getItem(CHAT_CONSTANTS.CHAT_PRESET_STORAGE_KEY) || "balanced"] || PRESETS.balanced);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [advanced, setAdvanced] = useState<AdvancedDefaults>(ADVANCED_DEFAULTS);
  const [capabilities, setCapabilities] = useState<Record<string, unknown> | null>(null);
  const [contextBudget, setContextBudget] = useState<ContextBudget | null>(null);
  const [contextBudgetError, setContextBudgetError] = useState("");
  const [capabilityDetail, setCapabilityDetail] = useState("Capabilities unavailable.");
  const [inspectDetail, setInspectDetail] = useState("No prompt inspection yet.");
  const [kvDetail, setKvDetail] = useState("No KV slot data loaded.");
  const [kvSlotActionId, setKvSlotActionId] = useState("");
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState(() => localStorage.getItem(CHAT_CONSTANTS.ACTIVE_CHAT_SESSION_STORAGE_KEY) || "");
  const [sessionName, setSessionName] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const {
    profileCatalog,
    selectedFamily,
    selectedProfile,
    selectedModel,
    target,
    runningModels,
    noModelLoaded,
    selectedRunningModel,
    profileFamilies,
    selectedProfileFamily,
    targetOptions,
    refreshModels,
    refreshProfileCatalog,
    selectModel,
    setSelectedFamily,
    setSelectedProfile,
    setTarget,
  } = useChatModelSelection({
    initialModel: handoff.model,
    initialTarget: handoff.target,
    onError: setError,
  });

  useEffect(() => {
    void refreshChatBootstrap();
    void refreshModels();
    const profileTimer = window.setTimeout(() => void refreshProfileCatalog(), 300);
    return () => {
      window.clearTimeout(profileTimer);
      abortRef.current?.abort();
    };
  }, []);

  async function refreshChatBootstrap() {
    try {
      const response = await fetch("/lm-api/v1/chat/bootstrap", { credentials: "same-origin", headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${await response.text()}`);
      const bootstrap = await response.json() as { mode?: string; controller_chat_url?: string };
      if (bootstrap.mode === "agent" && bootstrap.controller_chat_url) {
        setControllerChatUrl(bootstrap.controller_chat_url);
        setStatus("Controller mode required");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load chat bootstrap");
    } finally {
      setChatBootstrapLoaded(true);
    }
  }

  useEffect(() => {
    const el = transcriptRef.current;
    if (!el) return;
    if (typeof el.scrollTo === "function") {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }
  }, [messages]);

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
    localStorage.setItem(CHAT_CONSTANTS.CHAT_PRESET_STORAGE_KEY, nextPreset);
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
    const requestDefaults = (payload.request_defaults || {}) as Partial<ChatDefaults> & {
      advanced?: Partial<AdvancedDefaults>;
      model_family?: string;
      context_profile?: string;
      thread_id?: string;
      thread_metadata?: { app?: string | null; purpose?: string | null; priority?: string; request_type?: string };
      include_internal?: boolean;
    };
    if (model) selectModel(model);
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
    if (typeof requestDefaults.model_family === "string") setSelectedFamily(requestDefaults.model_family);
    if (typeof requestDefaults.context_profile === "string") setSelectedProfile(requestDefaults.context_profile);
    if (typeof requestDefaults.thread_id === "string") setActiveConversationId(requestDefaults.thread_id);
    if (typeof requestDefaults.include_internal === "boolean") setIncludeInternal(requestDefaults.include_internal);
    const threadMetadata = requestDefaults.thread_metadata;
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
        requestDefaults: sessionRequestDefaults(),
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

  function finalizeAssistant(index: number) {
    setMessages((current) => current.map((message, messageIndex) => {
      if (messageIndex !== index) return message;
      const next = { ...message };
      finalizeTelemetry(next);
      return next;
    }));
  }

  function currentConversationMetadata() {
    return buildThreadMetadata({ app: conversationApp, purpose: conversationPurpose, priority: conversationPriority, requestType: conversationRequestType });
  }

  function sessionRequestDefaults() {
    return {
      ...defaults,
      advanced,
      thread_id: activeConversationId,
      thread_metadata: currentConversationMetadata(),
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

  function threadMessagesFromEvents(events: unknown): ChatMessage[] {
    const eventList = Array.isArray(events) ? events : (events as { events?: ThreadEvent[] } | null)?.events || [];
    return threadEventsToChatMessages(eventList as ThreadEvent[]) as ChatMessage[];
  }

  function renderThreadRouteDetail(events: unknown, activeConversation = activeConversationId) {
    const eventList = Array.isArray(events) ? events : (events as { events?: ThreadEvent[] } | null)?.events || [];
    const lastRouted = [...eventList].reverse().find((event) => event.route || event.event_type === "routing_decision");
    if (!lastRouted) {
      setThreadRouteDetail(activeConversation ? `Conversation ${activeConversation}` : "No conversation created.");
      return;
    }
    setThreadRouteDetail(JSON.stringify({
      conversation_id: activeConversation,
      thread_id: activeConversation,
      event_type: lastRouted.event_type,
      route: lastRouted.route,
      node: lastRouted.agent_node,
      model: lastRouted.model,
    }, null, 2));
  }

  async function createConversationFromUi() {
    if (pending) return "";
    const thread = await createThread({
      title: sessionName.trim() || null,
      default_model: selectedModel || null,
      metadata: currentConversationMetadata(),
    });
    const id = String(thread.id || "");
    setActiveConversationId(id);
    setMessages([]);
    setStatus("Conversation ready");
    setThreadRouteDetail(JSON.stringify({ conversation_id: id, thread_id: id, metadata: thread.metadata, default_model: thread.default_model }, null, 2));
    return id;
  }

  async function refreshConversationEvents(activeConversation = activeConversationId, replaceMessages = true) {
    if (!activeConversation) return;
    const query = includeInternal ? "?include_internal=true" : "";
    const payload = await getThreadEvents(activeConversation, query);
    if (replaceMessages) setMessages(threadMessagesFromEvents(payload));
    renderThreadRouteDetail(payload, activeConversation);
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
    if (!selectedImage || !selectedModelSupportsVision) return trimmed;
    return [
      { type: "text", text: trimmed },
      { type: "image_url", image_url: { url: selectedImage.dataUrl } },
    ];
  }

  function buildConversationMessagePayload(content: string) {
    const requestContent = buildUserMessageContent(content);
    const userMessage: ChatMessage = { role: "user", content, requestContent };
    const built = buildChatPayload([...messages, userMessage]);
    if (built.error) return { error: built.error };
    return {
      payload: {
        ...(built.payload || {}),
        role: "user",
        content: requestContent,
        model: selectedModel || null,
        model_family: selectedFamily || undefined,
        context_profile: selectedProfile || undefined,
        target,
        metadata: currentConversationMetadata(),
      },
    };
  }

  async function requestConversationCompletion(activeConversation: string, payload: Record<string, unknown>, assistantIndex: number, controller: AbortController) {
    const reader = await streamThreadMessage(activeConversation, payload, controller.signal);
    await readChatStream(reader, (delta, chunk, reasoningDelta) => {
      if ((chunk as { type?: string } | undefined)?.type === "route") {
        updateAssistant(assistantIndex, { routeMeta: routeDecisionToMeta((chunk as { route?: Record<string, unknown> }).route) });
        return;
      }
      appendAssistant(assistantIndex, delta, chunk, reasoningDelta);
    });
    finalizeAssistant(assistantIndex);
  }

  async function submitPrompt(content: string) {
    const trimmed = content.trim();
    if (pending || !trimmed) return;
    if (!chatBootstrapLoaded) return;
    if (controllerChatUrl) {
      window.location.assign(controllerChatUrl);
      return;
    }
    const command = parseSlashCommand(trimmed);
    if (command?.name === "remember") {
      await submitRememberCommand(command.args);
      return;
    }
    if (command?.name === "recall") {
      await submitMemorySearchCommand("recall", command.args);
      return;
    }
    if (command?.name === "forget") {
      await submitMemorySearchCommand("forget", command.args);
      return;
    }
    if (command?.name === "context") {
      await submitContextCommand();
      return;
    }
    if (command?.name === "use") {
      submitUseCommand(command.args);
      return;
    }
    if (!selectedModel) return;
    const built = buildConversationMessagePayload(trimmed);
    if (built.error) {
      setError(built.error);
      return;
    }
    setError("");
    const activeConversation = activeConversationId || await createConversationFromUi();
    if (!activeConversation) return;
    const requestContent = buildUserMessageContent(trimmed);
    const userMessage: ChatMessage = {
      role: "user",
      content: trimmed,
      requestContent,
      imageName: selectedModelSupportsVision ? selectedImage?.name : undefined,
    };
    const assistantMessage: ChatMessage = { role: "assistant", content: "", pending: true, startedAtMs: performance.now() };
    const nextMessages = [...messages, userMessage, assistantMessage];
    const assistantIndex = nextMessages.length - 1;
    setMessages(nextMessages);
    setPrompt("");
    setSelectedImage(null);
    setLastPrompt(trimmed);
    setPending(true);
    setStatus("Streaming response...");
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      await requestConversationCompletion(activeConversation, built.payload || {}, assistantIndex, controller);
      updateAssistant(assistantIndex, { pending: false });
      await refreshConversationEvents(activeConversation, false);
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
      setStatus(activeConversation ? `Conversation ${activeConversation.slice(0, 8)}` : "Ready");
    }
  }

  async function submitRememberCommand(memoryText: string) {
    if (!memoryText) {
      setError("Use /remember followed by the text to save.");
      return;
    }
    setError("");
    setPending(true);
    setStatus("Saving memory...");
    try {
      const response = await writeMemory({
        text: memoryText,
        tier: "durable",
        topic: "chat",
        tags: ["chat-command"],
      });
      const savedId = response.id ? ` (${response.id})` : "";
      const commandMessage: ChatMessage = { role: "user", content: `/remember ${memoryText}` };
      const confirmationMessage: ChatMessage = { role: "system", content: `Saved to controller memory${savedId}.` };
      setMessages((current) => [...current, commandMessage, confirmationMessage]);
      setPrompt("");
      setSelectedImage(null);
      setLastPrompt("");
      setStatus("Memory saved");
    } catch (err) {
      const detail = err instanceof Error ? err.message : "Failed to save memory.";
      const commandMessage: ChatMessage = { role: "user", content: `/remember ${memoryText}` };
      const errorMessage: ChatMessage = { role: "error", content: `Memory save failed: ${detail}` };
      setMessages((current) => [...current, commandMessage, errorMessage]);
      setError(`Memory save failed: ${detail}`);
      setStatus("Ready");
    } finally {
      setPending(false);
    }
  }

  async function submitMemorySearchCommand(kind: "recall" | "forget", query: string) {
    if (!query.trim()) {
      setError(`Use /${kind} followed by a memory search query.`);
      return;
    }
    setError("");
    setPending(true);
    setStatus(kind === "recall" ? "Searching memory..." : "Previewing memory matches...");
    const commandMessage: ChatMessage = { role: "user", content: `/${kind} ${query}` };
    try {
      const response = await searchMemory({ query: query.trim(), top_k: 5 });
      const lines = (response.results || []).map(memoryResultLine);
      const prefix = kind === "recall"
        ? `Memory recall found ${response.count} result${response.count === 1 ? "" : "s"}.`
        : `Forget preview found ${response.count} candidate${response.count === 1 ? "" : "s"}. No memories were deleted.`;
      const content = lines.length ? `${prefix}\n${lines.join("\n")}` : prefix;
      setMessages((current) => [...current, commandMessage, { role: "system", content }]);
      setPrompt("");
      setSelectedImage(null);
      setLastPrompt("");
      setStatus(kind === "recall" ? "Memory recalled" : "Forget preview ready");
    } catch (err) {
      const detail = err instanceof Error ? err.message : `/${kind} failed.`;
      setMessages((current) => [...current, commandMessage, { role: "error", content: `Memory search failed: ${detail}` }]);
      setError(`Memory search failed: ${detail}`);
      setStatus("Ready");
    } finally {
      setPending(false);
    }
  }

  async function submitContextCommand() {
    if (!selectedModel) {
      setError("Select a model before using /context.");
      return;
    }
    setError("");
    setPending(true);
    setStatus("Checking context...");
    const commandMessage: ChatMessage = { role: "user", content: "/context" };
    try {
      const draftMessages = messages.filter((message) => !message.pending && message.role !== "error");
      const built = buildChatPayload(draftMessages);
      if (built.error) throw new Error(built.error);
      const budget = await getContextBudget(selectedModel, built.payload || {}, new AbortController().signal);
      const content = [
        contextBudgetSummary(budget),
        `Model ${selectedModel}`,
        `Target ${target}`,
        selectedFamily ? `Family ${selectedFamily}` : "",
        selectedProfile ? `Profile ${selectedProfile}` : "",
      ].filter(Boolean).join("\n");
      setMessages((current) => [...current, commandMessage, { role: "system", content }]);
      setPrompt("");
      setSelectedImage(null);
      setLastPrompt("");
      setContextBudget(budget);
      setContextBudgetError("");
      setStatus("Context ready");
    } catch (err) {
      const detail = err instanceof Error ? err.message : "Context unavailable.";
      setMessages((current) => [...current, commandMessage, { role: "error", content: `Context unavailable: ${detail}` }]);
      setError(`Context unavailable: ${detail}`);
      setStatus("Ready");
    } finally {
      setPending(false);
    }
  }

  function submitUseCommand(value: string) {
    const wanted = value.trim();
    if (!wanted) {
      setError("Use /use followed by a model name or target.");
      return;
    }
    setError("");
    const commandMessage: ChatMessage = { role: "user", content: `/use ${wanted}` };
    if (wanted === "auto" || wanted === "local" || wanted.startsWith("node:")) {
      const knownTarget = targetOptions.includes(wanted) || wanted === "auto" || wanted === "local";
      if (!knownTarget) {
        setMessages((current) => [...current, commandMessage, { role: "error", content: `Unknown target ${wanted}.` }]);
        setError(`Unknown target ${wanted}.`);
        return;
      }
      setTarget(wanted);
      setMessages((current) => [...current, commandMessage, { role: "system", content: `Using target ${wanted}.` }]);
      setPrompt("");
      setSelectedImage(null);
      setLastPrompt("");
      setStatus(`Target ${wanted}`);
      return;
    }

    const match = runningModels.find((model) => modelName(model) === wanted);
    if (!match) {
      setMessages((current) => [...current, commandMessage, { role: "error", content: `Unknown model ${wanted}.` }]);
      setError(`Unknown model ${wanted}.`);
      return;
    }
    selectModel(wanted);
    if (modelTarget(match)) setTarget(modelTarget(match));
    setMessages((current) => [...current, commandMessage, { role: "system", content: `Using model ${wanted}.` }]);
    setPrompt("");
    setSelectedImage(null);
    setLastPrompt("");
    setStatus(`Model ${wanted}`);
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
    localStorage.setItem(CHAT_CONSTANTS.ACTIVE_CHAT_SESSION_STORAGE_KEY, localStorage.getItem(CHAT_CONSTANTS.ACTIVE_CHAT_SESSION_STORAGE_KEY) || "");
  }

  const selectedModelSupportsVision = modelSupportsVision(selectedRunningModel);
  const showImageUpload = selectedModelSupportsVision;
  const parsedCommand = parseSlashCommand(prompt);
  const canSendCommand = Boolean(chatBootstrapLoaded && parsedCommand && prompt.trim() && !pending);
  const canSendChat = Boolean(chatBootstrapLoaded && !controllerChatUrl && !noModelLoaded && selectedModel && prompt.trim() && !pending);
  const canSend = canSendCommand || canSendChat;

  useEffect(() => {
    if (!selectedModel || noModelLoaded || pending || parseSlashCommand(prompt.trim()) || (!messages.length && !prompt.trim())) {
      setContextBudget(null);
      setContextBudgetError("");
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      const draftMessages = prompt.trim()
        ? [...messages, { role: "user", content: prompt.trim(), requestContent: buildUserMessageContent(prompt.trim()) }]
        : messages;
      const built = buildChatPayload(draftMessages);
      if (built.error) {
        setContextBudget(null);
        setContextBudgetError(built.error);
        return;
      }
      getContextBudget(selectedModel, built.payload || {}, controller.signal)
        .then((budget) => {
          setContextBudget(budget);
          setContextBudgetError("");
        })
        .catch((err) => {
          if ((err as Error).name === "AbortError") return;
          setContextBudget(null);
          setContextBudgetError(err instanceof Error ? err.message : "Context budget unavailable.");
        });
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [selectedModel, noModelLoaded, pending, messages, prompt, selectedImage, selectedModelSupportsVision, defaults, advanced, target, selectedFamily, selectedProfile]);

  return (
    <div className="chat-page-react">
      <div className="page-heading">
        <div><span className="eyebrow">Conversation</span><h2>Chat</h2></div>
        <Button type="button" onClick={refreshModels}>Refresh Models</Button>
      </div>
      <ErrorBanner message={error} />
      <div className="chat-layout">
        <div className="chat-main-column">
          <ChatSessionsPanel
            sessionName={sessionName}
            selectedSessionId={selectedSessionId}
            sessions={sessions}
            messages={messages}
            onSessionNameChange={setSessionName}
            onSelectedSessionIdChange={setSelectedSessionId}
            onRefreshSessions={() => void refreshSessions()}
            onLoadSession={() => void loadSelectedSession()}
            onSaveSession={() => void saveCurrentSession(false)}
            onSaveAsNewSession={() => void saveCurrentSession(true)}
            onDeleteSession={() => void deleteSelectedSession()}
            onResumeRecentSession={() => void resumeRecentSession()}
          />

          <Panel title="Transcript" eyebrow="Streaming response" className="chat-workbench-panel">
            <ChatTranscriptPanel transcriptRef={transcriptRef} controllerChatUrl={controllerChatUrl} messages={messages} />
            <ChatComposer
              prompt={prompt}
              pending={pending}
              enterToSend={enterToSend}
              canSend={canSend}
              lastPrompt={lastPrompt}
              showImageUpload={showImageUpload}
              selectedImage={selectedImage}
              onSubmit={onSubmit}
              onPromptChange={setPrompt}
              onPromptKeyDown={onPromptKeyDown}
              onImageChange={onImageChange}
              onRemoveImage={() => setSelectedImage(null)}
              onEnterToSendChange={setEnterToSend}
              onStop={stop}
              onRegenerate={() => void submitPrompt(lastPrompt)}
              onClear={clear}
            />
          </Panel>
        </div>

        <ChatControlsPanel
          noModelLoaded={noModelLoaded}
          selectedModel={selectedModel}
          runningModels={runningModels}
          profileFamilies={profileFamilies}
          selectedFamily={selectedFamily}
          selectedProfile={selectedProfile}
          selectedProfileFamily={selectedProfileFamily}
          profileCatalog={profileCatalog}
          target={target}
          targetOptions={targetOptions}
          preset={preset}
          defaults={defaults}
          advanced={advanced}
          advancedOpen={advancedOpen}
          pending={pending}
          status={status}
          capabilities={capabilities}
          capabilityDetail={capabilityDetail}
          inspectDetail={inspectDetail}
          kvDetail={kvDetail}
          kvSlotActionId={kvSlotActionId}
          contextBudget={contextBudget}
          contextBudgetError={contextBudgetError}
          activeConversationId={activeConversationId}
          conversationApp={conversationApp}
          conversationPurpose={conversationPurpose}
          conversationPriority={conversationPriority}
          conversationRequestType={conversationRequestType}
          includeInternal={includeInternal}
          threadRouteDetail={threadRouteDetail}
          chatBootstrapLoaded={chatBootstrapLoaded}
          controllerChatUrl={controllerChatUrl}
          onSelectModel={selectModel}
          onTargetChange={setTarget}
          onSelectedFamilyChange={setSelectedFamily}
          onSelectedProfileChange={setSelectedProfile}
          onPresetChange={applyPreset}
          onDefaultsChange={(patch) => setDefaults((current) => ({ ...current, ...patch }))}
          onAdvancedChange={updateAdvanced}
          onToggleAdvanced={toggleAdvanced}
          onRefreshCapabilities={() => void refreshCapabilities()}
          onCopyCapabilitiesJson={() => void copyCapabilitiesJson()}
          onInspectPrompt={() => void inspectPrompt()}
          onRefreshKvSlots={() => void refreshKvSlots()}
          onKvSlotActionIdChange={setKvSlotActionId}
          onClearSelectedKvSlot={() => void clearSelectedKvSlot()}
          onActiveConversationIdChange={setActiveConversationId}
          onConversationAppChange={setConversationApp}
          onConversationPurposeChange={setConversationPurpose}
          onConversationPriorityChange={setConversationPriority}
          onConversationRequestTypeChange={setConversationRequestType}
          onIncludeInternalChange={setIncludeInternal}
          onCreateConversation={() => void createConversationFromUi()}
          onRefreshConversation={() => void refreshConversationEvents()}
        />
      </div>
    </div>
  );
}
