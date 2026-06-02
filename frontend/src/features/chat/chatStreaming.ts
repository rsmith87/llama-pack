/** Shared SSE stream helpers used by ChatPage and TestChatPage. */

export type { StreamRouteEvent, StreamDeltaEvent, StreamErrorEvent, StreamCallbacks } from "../../types/streaming";
import type { StreamRouteEvent, StreamDeltaEvent, StreamErrorEvent, StreamCallbacks } from "../../types/streaming";

/**
 * Split a raw SSE event block into individual `data:` payload strings,
 * stripping the leading `data:` prefix and filtering empty/DONE entries.
 */
export function parseStreamEvent(event: string): string[] {
  return event
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .filter(Boolean);
}

/**
 * Consume a ReadableStream of SSE bytes and dispatch parsed events to callbacks.
 *
 * - Route events  `{"type":"route","route":{...}}` → `onRoute`
 * - Error events  `{"type":"error","error":"..."}` → `onError`
 * - OpenAI-style delta chunks → `onDelta` with `content` and `reasoning` strings
 * - `[DONE]` terminates the loop silently
 */
export async function readChatStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  callbacks: StreamCallbacks,
): Promise<void> {
  const decoder = new TextDecoder();
  let buffer = "";

  function dispatch(data: string) {
    if (data === "[DONE]") return;
    try {
      const parsed = JSON.parse(data) as Record<string, unknown>;
      if (parsed.type === "route") {
        callbacks.onRoute?.(parsed as StreamRouteEvent);
        return;
      }
      if (parsed.type === "error") {
        callbacks.onError?.(parsed as StreamErrorEvent);
        return;
      }
      const choices = Array.isArray(parsed.choices) ? parsed.choices : [];
      const delta = (choices[0] as { delta?: Record<string, unknown> } | undefined)?.delta || {};
      const content = String(delta.content || "");
      const reasoning = String(
        delta.reasoning_content || delta.reasoning || "",
      );
      if (content || reasoning) {
        callbacks.onDelta?.({ content, reasoning });
      }
    } catch {
      // ignore malformed chunks
    }
  }

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
    const events = buffer.split("\n\n");
    buffer = events.pop() || "";
    for (const event of events) {
      for (const data of parseStreamEvent(event)) {
        dispatch(data);
      }
    }
    if (done) {
      if (buffer.trim()) {
        for (const data of parseStreamEvent(buffer)) {
          dispatch(data);
        }
      }
      break;
    }
  }
}
