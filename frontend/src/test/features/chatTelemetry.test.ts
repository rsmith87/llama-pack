import { describe, it, expect } from "vitest";
import {
  applyTelemetryFromChunk,
  finalizeTelemetry,
  parseSseDataLines,
  parseSseEvents,
} from "../../features/chat/chatTelemetry";

describe("chat telemetry", () => {
  it("computes tokens/sec from timings.predicted fields", () => {
    const message: any = {};
    applyTelemetryFromChunk(
      {
        usage: { prompt_tokens: 10, completion_tokens: 20 },
        timings: { prompt_ms: 12, predicted_ms: 250, predicted_n: 50 },
      },
      message
    );
    expect(message.telemetry.promptTokens).toBe(10);
    expect(message.telemetry.completionTokens).toBe(20);
    expect(message.telemetry.promptMs).toBe(12);
    expect(message.telemetry.completionMs).toBe(250);
    expect(message.telemetry.tokensPerSecond).toBe(200);
  });

  it("falls back to usage.completion_time_ms for tokens/sec", () => {
    const message: any = {};
    applyTelemetryFromChunk(
      {
        usage: { completion_tokens: 30, completion_time_ms: 600 },
      },
      message
    );
    expect(message.telemetry.completionMs).toBe(600);
    expect(message.telemetry.tokensPerSecond).toBe(50);
  });

  it("finalizeTelemetry computes ttft from first token", () => {
    const message: any = {
      startedAtMs: 100,
      firstTokenAtMs: 220,
      content: "hello",
      telemetry: { tokensPerSecond: 60 },
    };
    finalizeTelemetry(message, 500);
    expect(message.telemetry.ttftMs).toBe(120);
    expect(message.telemetry.totalMs).toBe(400);
    expect(message.telemetry.tokensPerSecond).toBe(60);
  });

  it("keeps ttft absent when no streamed first token was observed", () => {
    const message: any = {
      startedAtMs: 100,
      content: "hello",
    };
    finalizeTelemetry(message, 450);
    expect(message.telemetry.ttftMs).toBeUndefined();
    expect(message.telemetry.totalMs).toBe(350);
  });

  it("keeps ttft absent when no output exists", () => {
    const message: any = { startedAtMs: 100, content: "", reasoningContent: "" };
    finalizeTelemetry(message, 300);
    expect(message.telemetry.ttftMs).toBeUndefined();
    expect(message.telemetry.totalMs).toBe(200);
  });
});

describe("SSE parsing", () => {
  it("splits complete events and preserves remainder", () => {
    const input = "data: {\"a\":1}\n\n" + "data: {\"b\":2}";
    const { events, remainder } = parseSseEvents(input);
    expect(events).toEqual(["data: {\"a\":1}"]);
    expect(remainder).toBe("data: {\"b\":2}");
  });

  it("extracts only data lines from one event", () => {
    const event = "event: message\n" + "data: {\"x\":1}\n" + "id: 10\n" + "data: [DONE]";
    expect(parseSseDataLines(event)).toEqual(["{\"x\":1}", "[DONE]"]);
  });
});
