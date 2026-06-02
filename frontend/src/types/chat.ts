import type { Telemetry } from "./streaming";

export type ChatRequest = Record<string, unknown>;
export type ChatResponse = Record<string, unknown>;

export type ChatContentBlock =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export type ChatSession = {
  id?: string;
  updated_at?: string;
};

export type ChatSessionsResponse = { sessions?: ChatSession[] };

export type ChatSessionSaveOptions = {
  name?: string;
  model?: string;
  target?: string;
  messages?: Array<Record<string, unknown>>;
  requestDefaults?: Record<string, unknown>;
  selectedSessionId?: string;
  saveAsNew?: boolean;
};

export type ChatSessionSavePayload = {
  id?: string;
  name?: string;
  model?: string;
  target: string;
  messages: Array<Record<string, unknown>>;
  request_defaults: Record<string, unknown>;
};

/** A chat message in the ChatPage conversation view. */
export type ChatMessage = {
  role: string;
  content: string;
  requestContent?: string | ChatContentBlock[];
  imageName?: string;
  pending?: boolean;
  stopped?: boolean;
  route?: string;
  routeMeta?: { model?: string; target?: string; resolved?: string; reason?: string };
  threadEventType?: string;
  startedAtMs?: number;
  firstTokenAtMs?: number;
  reasoningContent?: string;
  telemetry?: Telemetry;
};

export type ChatDefaults = {
  temperature: number;
  max_tokens: number;
  top_p: number;
};

export type AdvancedDefaults = {
  top_k: number;
  min_p: number;
  repeat_penalty: number;
  seed: number;
  stop: string;
  reasoning: boolean;
  cache_prompt: boolean;
  slot_id: string;
  structuredMode: "none" | "json_schema" | "grammar";
  jsonSchemaText: string;
  grammarText: string;
};

/** Bootstrap info for the TestChatPage. */
export type TestChatBootstrap = {
  enabled: boolean;
  key_hint?: string;
  mode?: string;
  controller_test_chat_url?: string;
};

export type TestChatMessage = {
  role: string;
  content: string;
  routeMeta?: RouteMeta;
  reasoningContent?: string;
  pending?: boolean;
  reasoningCollapsed?: boolean;
};

export type TestChatSession = {
  id: string;
  name?: string;
  model?: string;
  updated_at?: string;
  messages?: TestChatMessage[];
};

export type RouteMeta = {
  node?: string;
  model?: string;
  reason?: string;
};

/** Lightweight model reference used for chat target selection. */
export type ChatModel = {
  name?: string;
  id?: string;
  model?: string;
  node?: string;
  node_name?: string;
};
