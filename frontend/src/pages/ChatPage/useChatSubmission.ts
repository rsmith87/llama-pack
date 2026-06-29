import { useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import { getContextBudget } from "../../api/chat";
import { searchMemory, writeMemory } from "../../api/memory";
import { streamThreadMessage } from "../../api/threads";
import { modelName } from "../../features/models";
import {
  explainChatError,
  modelTarget,
  parseSlashCommand,
  readChatStream,
  routeDecisionToMeta,
} from "../../features/chat";
import { applyTelemetryFromChunk, finalizeTelemetry } from "../../features/chat/chatTelemetry";
import { contextBudgetSummary, memoryResultLine } from "../../features/chat/chatView";
import { CHAT_CONSTANTS } from "../../constants";
import type { ChatContentBlock, ChatMessage, ContextBudget, DocumentCitation, ThreadMessagePayload } from "../../types/chat";
import type { LocalModel } from "../../types";
import type { TelemetryChunk } from "../../types/streaming";

type ChatPayloadResult = {
  payload?: Record<string, unknown> | ThreadMessagePayload;
  error?: string;
};

type UseChatSubmissionArgs = {
  pending: boolean;
  chatBootstrapLoaded: boolean;
  controllerChatUrl: string;
  selectedModel: string;
  selectedFamily: string;
  selectedProfile: string;
  selectedImage: { name: string; dataUrl: string } | null;
  selectedModelSupportsVision: boolean;
  activeConversationId: string;
  messages: ChatMessage[];
  target: string;
  targetOptions: string[];
  runningModels: LocalModel[];
  buildChatPayload: (requestMessages: ChatMessage[]) => ChatPayloadResult;
  buildUserMessageContent: (content: string) => string | ChatContentBlock[];
  buildConversationMessagePayload: (content: string) => ChatPayloadResult;
  createConversationFromUi: () => Promise<string>;
  refreshConversationEvents: (activeConversation: string, replaceMessages: boolean) => Promise<void>;
  selectModel: (model: string) => void;
  setTarget: (target: string) => void;
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  setPrompt: (value: string) => void;
  setSelectedImage: (value: { name: string; dataUrl: string } | null) => void;
  setLastPrompt: (value: string) => void;
  setPending: (value: boolean) => void;
  setStatus: (value: string) => void;
  setError: (value: string) => void;
  setContextBudget: (value: ContextBudget | null) => void;
  setContextBudgetError: (value: string) => void;
};

export function useChatSubmission({
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
}: UseChatSubmissionArgs) {
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

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

  function finalizeAssistant(index: number) {
    setMessages((current) => current.map((message, messageIndex) => {
      if (messageIndex !== index) return message;
      const next = { ...message };
      finalizeTelemetry(next);
      return next;
    }));
  }

  async function requestConversationCompletion(activeConversation: string, payload: ThreadMessagePayload, assistantIndex: number, controller: AbortController) {
    const reader = await streamThreadMessage(activeConversation, payload, controller.signal);
    await readChatStream(reader, (delta, chunk, reasoningDelta) => {
      if ((chunk as { type?: string } | undefined)?.type === "route") {
        updateAssistant(assistantIndex, { routeMeta: routeDecisionToMeta((chunk as { route?: Record<string, unknown> }).route) });
        return;
      }
      if ((chunk as { type?: string } | undefined)?.type === "document_citations") {
        const citations = (chunk as { citations?: DocumentCitation[] }).citations;
        updateAssistant(assistantIndex, { documentCitations: Array.isArray(citations) ? citations : [] });
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
      await requestConversationCompletion(activeConversation, built.payload as ThreadMessagePayload, assistantIndex, controller);
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

  return { submitPrompt, stop, clear };
}
