import type { TraceEvent } from "../../types";

export function parseTraceStreamChunk(chunk: string, existingBuffer = ""): { events: TraceEvent[]; buffer: string } {
  const combined = `${existingBuffer}${chunk}`;
  const parts = combined.split("\n\n");
  const buffer = parts.pop() || "";
  const events = parts.flatMap((part) => {
    const data = part
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim())
      .join("\n");
    if (!data) return [];
    try {
      return [JSON.parse(data) as TraceEvent];
    } catch {
      return [];
    }
  });
  return { events, buffer };
}

export function finalTraceStreamEvents(buffer: string): TraceEvent[] {
  return parseTraceStreamChunk(buffer.endsWith("\n\n") ? buffer : `${buffer}\n\n`).events;
}
