import { describe, expect, it } from "vitest";
import { parseTraceStreamChunk } from "../../features/toolLoopEvals/traceStream";

describe("parseTraceStreamChunk", () => {
  it("handles partial chunks and multiple events per chunk", () => {
    let buffer = "";
    const first = parseTraceStreamChunk(
      'event: run_started\ndata: {"event_type":"run_started","sequence":1}\n\n' +
      'event: tool_call_started\ndata: {"event_type":"tool_call_',
      buffer,
    );
    buffer = first.buffer;

    expect(first.events).toEqual([{ event_type: "run_started", sequence: 1 }]);

    const second = parseTraceStreamChunk(
      'started","sequence":2}\n\n' +
      'event: run_completed\ndata: {"event_type":"run_completed","sequence":3}\n\n',
      buffer,
    );

    expect(second.buffer).toBe("");
    expect(second.events).toEqual([
      { event_type: "tool_call_started", sequence: 2 },
      { event_type: "run_completed", sequence: 3 },
    ]);
  });
});
