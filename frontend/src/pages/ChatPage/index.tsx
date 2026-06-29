import "./styles.css";
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type KeyboardEvent } from "react";
import { clearKvSlot, getChatCapabilities, getContextBudget, inspectModel, listKvSlots } from "../../api/chat";
import { listDocumentCollections, type DocumentCollectionRecord } from "../../api/documentCollections";
import { createThread, getThreadEvents } from "../../api/threads";
import { ErrorBanner, Panel, Button } from "../../components/ui";
import { ChatComposer, ChatSessionsPanel, ChatTranscriptPanel } from "./components";
import { ChatControlsPanel } from "./controls";
import { useChatModelSelection } from "./useChatModelSelection";
import { useChatSubmission } from "./useChatSubmission";
import { useChatSessions } from "./useChatSessions";
import { buildThreadMetadata, threadEventsToChatMessages } from "../../features/chat/chatThreads";
import type { ThreadEvent } from "../../types/threads";
import type { ChatMessage, ChatDefaults, AdvancedDefaults, ChatContentBlock, ContextBudget, ThreadMessagePayload } from "../../types/chat";
import { CHAT_CONSTANTS } from "../../constants"
import { 
  modelSupportsVision,
  readFileAsDataUrl,
  readChatHandoff,
  parseStopTokens,
  structuredPayload,
  parseSlashCommand,
} from "../../features/chat";

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
  const [documentCollections, setDocumentCollections] = useState<DocumentCollectionRecord[]>([]);
  const [selectedDocumentCollectionIds, setSelectedDocumentCollectionIds] = useState<string[]>([]);
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
    void refreshDocumentCollections();
    const profileTimer = window.setTimeout(() => void refreshProfileCatalog(), 300);
    return () => {
      window.clearTimeout(profileTimer);
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

  async function refreshDocumentCollections() {
    try {
      const payload = await listDocumentCollections(false);
      setDocumentCollections(Array.isArray(payload.collections) ? payload.collections : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load document collections");
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
      document_collection_ids: selectedDocumentCollectionIds,
    };
  }

  const {
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
  } = useChatSessions({
    selectedModel,
    target,
    messages,
    requestDefaults: sessionRequestDefaults,
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
  });

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
    const payload: ThreadMessagePayload = {
        ...(built.payload || {}),
        role: "user",
        content: requestContent,
        model: selectedModel || null,
        model_family: selectedFamily || undefined,
        context_profile: selectedProfile || undefined,
        target,
        metadata: currentConversationMetadata(),
        ...(selectedDocumentCollectionIds.length ? { document_collection_ids: selectedDocumentCollectionIds } : {}),
    };
    return {
      payload,
    };
  }

  function toggleDocumentCollection(collectionId: string, selected: boolean) {
    setSelectedDocumentCollectionIds((current) => {
      if (selected) return current.includes(collectionId) ? current : [...current, collectionId];
      return current.filter((id) => id !== collectionId);
    });
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

  const selectedModelSupportsVision = modelSupportsVision(selectedRunningModel);
  const showImageUpload = selectedModelSupportsVision;
  const { submitPrompt, stop, clear } = useChatSubmission({
    pending,
    chatBootstrapLoaded,
    controllerChatUrl,
    selectedModel,
    selectedFamily,
    selectedProfile,
    selectedImage,
    selectedModelSupportsVision,
    activeConversationId,
    messages,
    target,
    targetOptions,
    runningModels,
    buildChatPayload,
    buildUserMessageContent,
    buildConversationMessagePayload,
    createConversationFromUi,
    refreshConversationEvents,
    selectModel,
    setTarget,
    setMessages,
    setPrompt,
    setSelectedImage,
    setLastPrompt,
    setPending,
    setStatus,
    setError,
    setContextBudget,
    setContextBudgetError,
  });
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
              documentCollections={documentCollections}
              selectedDocumentCollectionIds={selectedDocumentCollectionIds}
              onSubmit={onSubmit}
              onPromptChange={setPrompt}
              onPromptKeyDown={onPromptKeyDown}
              onImageChange={onImageChange}
              onRemoveImage={() => setSelectedImage(null)}
              onDocumentCollectionToggle={toggleDocumentCollection}
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
