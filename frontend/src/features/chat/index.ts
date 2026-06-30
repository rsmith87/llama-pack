import { LocalModel } from "../../types";
import { NodeRecord } from "../../types";
import { ModelProfileCatalog, ModelProfileFamily } from "../../types";
import { ChatMessage, ChatDefaults, AdvancedDefaults, ChatContentBlock } from "../../types";
import { ChatSession } from "../../types";
import { Telemetry, TelemetryChunk } from "../../types";
import { isRunnableModelOption, modelName } from "../models";
import { parseStreamEvent } from "./chatStreaming";

export { chatSlashCommands, parseSlashCommand } from "./slashCommands";
export type { ChatSlashCommandDefinition, ChatSlashCommandName, ParsedSlashCommand } from "./slashCommands";

export function asModels(payload: unknown): LocalModel[] {
  if (Array.isArray(payload)) return payload as LocalModel[];
  return (payload as { models?: LocalModel[] } | null)?.models || [];
}

export function asNodes(payload: unknown): NodeRecord[] {
  if (Array.isArray(payload)) return payload as NodeRecord[];
  return (payload as { nodes?: NodeRecord[] } | null)?.nodes || [];
}

export function nodeModelsToChatModels(nodes: NodeRecord[]): LocalModel[] {
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

export function runningChatModelOptions(models: LocalModel[]): LocalModel[] {
  return models.filter((model) => modelName(model) && modelIsLoaded(model) && isRunnableModelOption(model));
}

export function modelTarget(model: LocalModel) {
  return model.node || model.node_name ? `node:${model.node || model.node_name}` : "";
}

export function modelOptionLabel(model: LocalModel) {
  const name = modelName(model);
  const nodeTarget = modelTarget(model);
  return nodeTarget ? `${name} on ${nodeTarget.slice("node:".length)}` : name;
}

export function modelIsLoaded(model: LocalModel) {
  const status = String(model.status || "").toLowerCase();
  return !status || status === "running" || status === "loaded";
}

export function modelSupportsVision(model: LocalModel | undefined) {
  return Boolean(model?.vision || model?.supports?.vision);
}

export function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Failed to read image"));
    reader.readAsDataURL(file);
  });
}

export function telemetryChips(message: ChatMessage) {
  const telemetry = message.telemetry || {};
  return [
    telemetry.tokensPerSecond != null ? `tok/s: ${telemetry.tokensPerSecond.toFixed(2)}` : null,
    telemetry.ttftMs != null ? `ttft: ${telemetry.ttftMs.toFixed(0)}ms` : null,
    telemetry.totalMs != null ? `total: ${telemetry.totalMs.toFixed(0)}ms` : null,
    telemetry.promptTokens != null ? `prompt_toks: ${telemetry.promptTokens}` : null,
    telemetry.completionTokens != null ? `gen_toks: ${telemetry.completionTokens}` : null,
  ].filter(Boolean) as string[];
}

export function completionText(payload: Record<string, unknown>) {
  const choices = Array.isArray(payload.choices) ? payload.choices : [];
  const choice = choices[0] as { message?: { content?: string; role?: string }; text?: string } | undefined;
  return choice?.message?.content || choice?.text || "";
}

export function routeDecisionToMeta(route: Record<string, unknown> | undefined | null): ChatMessage["routeMeta"] {
  if (!route) return { target: "controller" };
  const node = String(route.node || "");
  const meta: ChatMessage["routeMeta"] = {
    model: String(route.model || ""),
    target: node ? `node:${node}` : "controller",
    resolved: node,
    reason: String(route.reason || ""),
  };
  const strategy = String(route.strategy || "");
  const startup = String(route.startup_decision || "");
  const candidates = routeCandidateLabels(route.candidates);
  if (strategy) meta.strategy = strategy;
  if (startup) meta.startup = startup;
  if (candidates.length) meta.candidates = candidates;
  return meta;
}

export function routeExplanationItems(message: Pick<ChatMessage, "route" | "routeMeta">): string[] {
  const items: string[] = [];
  const meta = message.routeMeta;
  if (!meta) return message.route ? [`Resolved route ${message.route}`] : items;
  if (meta.target) items.push(`Target ${meta.target}`);
  if (meta.resolved) items.push(`Resolved agent ${meta.resolved}`);
  if (meta.model) items.push(`Model ${meta.model}`);
  if (meta.strategy) items.push(`Strategy ${meta.strategy}`);
  if (meta.reason) items.push(`Reason ${meta.reason}`);
  if (meta.startup) items.push(`Startup ${meta.startup}`);
  for (const candidate of meta.candidates || []) {
    items.push(`Candidate ${candidate}`);
  }
  if (!items.length && message.route) items.push(`Resolved route ${message.route}`);
  return items;
}

function routeCandidateLabels(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((candidate) => candidate && typeof candidate === "object").map((candidate) => routeCandidateLabel(candidate as Record<string, unknown>));
}

function routeCandidateLabel(candidate: Record<string, unknown>): string {
  const node = String(candidate.node || "-");
  const model = String(candidate.model || "-");
  const details = [
    candidate.priority != null ? `priority ${String(candidate.priority)}` : "",
    candidate.model_running != null ? `running ${candidate.model_running ? "yes" : "no"}` : "",
    candidate.artifact_state ? `artifact ${String(candidate.artifact_state)}` : "",
  ].filter(Boolean);
  return details.length ? `${node}/${model} ${details.join(", ")}` : `${node}/${model}`;
}

export function asChatSessions(payload: unknown): ChatSession[] {
  if (Array.isArray(payload)) return payload as ChatSession[];
  return (payload as { sessions?: ChatSession[] } | null)?.sessions || [];
}

export function asProfileCatalog(payload: unknown): ModelProfileCatalog {
  const families = (payload as { families?: ModelProfileFamily[] } | null)?.families;
  return { families: Array.isArray(families) ? families : [] };
}

export function firstProfileForFamily(catalog: ModelProfileCatalog, family: string) {
  return catalog.families.find((item) => item.family === family)?.profiles[0]?.profile || "";
}

export function familyForModel(catalog: ModelProfileCatalog, model: string) {
  if (!model) return "";
  return catalog.families.find((family) => family.family === model)?.family || "";
}

export function readChatHandoff() {
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

export function sessionLabel(session: ChatSession) {
  const item = session as ChatSession & { name?: string; model?: string };
  return item.name || [item.model, item.updated_at].filter(Boolean).join(" - ") || item.id || "Untitled session";
}

export function sessionMessages(payload: unknown): ChatMessage[] {
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

export function parseStopTokens(value: string) {
  const tokens = value.split(",").map((item) => item.trim()).filter(Boolean);
  if (!tokens.length) return undefined;
  return tokens.length === 1 ? tokens[0] : tokens;
}

export function explainChatError(err: unknown): string {
  const message = err instanceof Error ? err.message : "Chat request failed";
  if (message.includes("401 Unauthorized")) {
    return "Unauthorized. Log in with a valid API key in the header bar, then retry.";
  }
  return message;
}

export function structuredPayload(advanced: AdvancedDefaults): { payload?: Record<string, unknown>; error?: string } {
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

export async function readChatStream(
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
