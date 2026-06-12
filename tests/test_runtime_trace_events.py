from __future__ import annotations

import pytest

from llama_pack.core.agent_tools.tracing import RuntimeTraceRecorder


def test_runtime_trace_recorder_assigns_ordered_events():
    recorder = RuntimeTraceRecorder(trace_id="trace-1", source="tool_loop_eval", scope="eval_run")

    first = recorder.emit("run_started", title="Run started", model="qwen", payload={"case_count": 1})
    second = recorder.emit("case_started", case_id="case-a", title="Case started")

    assert first["id"] == "trace-1-000001"
    assert first["trace_id"] == "trace-1"
    assert first["sequence"] == 1
    assert first["event_type"] == "run_started"
    assert first["source"] == "tool_loop_eval"
    assert first["scope"] == "eval_run"
    assert first["status"] == "running"
    assert first["model"] == "qwen"
    assert first["payload"] == {"case_count": 1}
    assert second["id"] == "trace-1-000002"
    assert second["sequence"] == 2
    assert second["case_id"] == "case-a"
    assert recorder.events == [first, second]


@pytest.mark.asyncio
async def test_runtime_trace_recorder_stream_yields_events_until_closed():
    recorder = RuntimeTraceRecorder(trace_id="trace-stream", source="tool_loop_eval", scope="eval_run")
    first = recorder.emit("run_started")
    second = recorder.emit("run_completed", status="passed")
    recorder.close()

    streamed = []
    async for event in recorder.stream():
      streamed.append(event)

    assert streamed == [first, second]
