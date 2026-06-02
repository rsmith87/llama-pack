export type StreamRouteEvent = {
  type: "route";
  route: Record<string, string>;
};

export type StreamDeltaEvent = {
  content: string;
  reasoning: string;
};

export type StreamErrorEvent = {
  type: "error";
  error: string;
};

export type StreamCallbacks = {
  onRoute?: (event: StreamRouteEvent) => void;
  onDelta?: (delta: StreamDeltaEvent) => void;
  onError?: (event: StreamErrorEvent) => void;
};

export type Telemetry = {
  promptTokens?: number;
  completionTokens?: number;
  promptMs?: number;
  completionMs?: number;
  tokensPerSecond?: number;
  ttftMs?: number;
  totalMs?: number;
};

export type PendingMessage = {
  startedAtMs?: number;
  firstTokenAtMs?: number;
  content?: string;
  reasoningContent?: string;
  telemetry?: Telemetry;
};

export type TelemetryChunk = {
  usage?: Record<string, unknown>;
  timings?: Record<string, unknown>;
};
