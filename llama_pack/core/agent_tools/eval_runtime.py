from __future__ import annotations

import asyncio
import json
from datetime import UTC, datetime
from typing import Any

import httpx

from llama_pack.core.agent_tools.evals import ToolLoopEvaluator, default_tool_loop_eval_cases
from llama_pack.core.agent_tools.live_evals import LiveToolLoopEvaluator, default_live_tool_loop_scenarios
from llama_pack.core.agent_tools.tracing import RuntimeTraceRecorder


def tool_loop_preset_group(*, group_id: str, label: str, presets: list[Any]) -> dict[str, object]:
    return {
        "id": group_id,
        "label": label,
        "presets": [
            {
                "id": preset.id,
                "label": tool_loop_preset_label(preset.id),
                "category": preset.category,
                "scoring_mode": preset.scoring_mode,
                "expected_tool_count": len(preset.expected_tool_sequence),
                "max_iterations": preset.max_iterations,
            }
            for preset in presets
        ],
    }


def tool_loop_live_preset_group(presets: list[Any]) -> dict[str, object]:
    return {
        "id": "live_workspace",
        "label": "Live workspace scenarios",
        "presets": [
            {
                "id": preset.id,
                "label": tool_loop_preset_label(preset.id.removeprefix("live-")),
                "category": "live_workspace",
                "scoring_mode": "set_membership",
                "expected_tool_count": len(preset.expected_tool_sequence),
                "max_iterations": preset.max_iterations,
            }
            for preset in presets
        ],
    }


def tool_loop_preset_label(preset_id: str) -> str:
    return preset_id.replace("-", " ").capitalize()




def persist_tool_loop_suite(
    store: Any | None,
    suite: Any,
    *,
    target_selector: str,
    target_node: str | None,
    target_instance: str | None,
) -> dict[str, Any] | None:
    if not isinstance(suite, dict):
        return None
    if store is None:
        return None
    return store.create_tool_loop_eval_run(
        generated_at=datetime.now(UTC).isoformat(),
        target_selector=target_selector,
        target_node=target_node,
        target_instance=target_instance,
        suite=suite,
    )


async def execute_tool_loop_suites(
    config: Any,
    chat_scheduler: Any,
    model: str,
    cases: list[Any],
    live_scenarios: list[Any],
    recorder: RuntimeTraceRecorder | None,
) -> list[dict[str, Any]]:
    suites: list[dict[str, Any]] = []
    if recorder is not None:
        recorder.emit(
            "run_started",
            model=model,
            title="Tool-loop eval run started",
            payload={
                "case_count": len(cases) + len(live_scenarios),
                "case_ids": [case.id for case in cases] + [scenario.id for scenario in live_scenarios],
            },
        )
    if cases:
        suites.append(
            await ToolLoopEvaluator(
                config,
                chat_scheduler,
                executor=None,
                trace_recorder=recorder,
                emit_suite_events=False,
            ).run_suite(model, cases)
        )
    if live_scenarios:
        suites.append(
            await LiveToolLoopEvaluator(
                config,
                chat_scheduler,
                trace_recorder=recorder,
                emit_suite_events=False,
            ).run_suite(model, live_scenarios)
        )
    return suites


async def stream_trace_events(recorder: RuntimeTraceRecorder, runner: Any):
    task = asyncio.create_task(runner())
    try:
        async for event in recorder.stream():
            yield encode_trace_sse(event)
        await task
    finally:
        if not task.done():
            task.cancel()


def encode_trace_sse(event: dict[str, Any]) -> str:
    return (
        f"id: {event['id']}\n"
        f"event: {event['event_type']}\n"
        f"data: {json.dumps(event, separators=(',', ':'))}\n\n"
    )


def replay_suite_trace_events(recorder: RuntimeTraceRecorder, suite: Any) -> None:
    if not isinstance(suite, dict):
        return
    for case in suite.get("cases") or []:
        if not isinstance(case, dict):
            continue
        for event in case.get("trace_events") or []:
            if not isinstance(event, dict):
                continue
            recorder.emit(
                str(event.get("event_type") or "trace_event"),
                status=str(event.get("status") or "running"),
                scope=str(event.get("scope") or "eval_case"),
                case_id=event.get("case_id") if isinstance(event.get("case_id"), str) else case.get("case_id"),
                tool_call_id=event.get("tool_call_id") if isinstance(event.get("tool_call_id"), str) else None,
                model=event.get("model") if isinstance(event.get("model"), str) else suite.get("model"),
                title=str(event.get("title") or ""),
                summary=str(event.get("summary") or ""),
                payload=event.get("payload") if isinstance(event.get("payload"), dict) else {},
            )


async def stream_node_tool_loop_eval(node: Any, node_name: str, payload: dict[str, object], recorder: RuntimeTraceRecorder) -> dict[str, Any]:
    base_url = node_base_url(node_name, node.url)
    headers = {"X-Llama-Pack-Key": node.api_key} if node.api_key else {}
    suite: dict[str, Any] | None = None
    async with httpx.AsyncClient(timeout=None, verify=node.verify_tls) as client:
        async with client.stream(
            "POST",
            f"{base_url}/lm-api/v1/runtime/tool-loop-evals/run/stream",
            json=payload,
            headers=headers,
        ) as response:
            response.raise_for_status()
            buffer = ""
            async for chunk in response.aiter_text():
                events, buffer = parse_trace_sse_chunk(buffer + chunk)
                for event in events:
                    recorder.emit(
                        str(event.get("event_type") or "trace_event"),
                        status=str(event.get("status") or "running"),
                        scope=str(event.get("scope") or "eval_case"),
                        case_id=event.get("case_id") if isinstance(event.get("case_id"), str) else None,
                        tool_call_id=event.get("tool_call_id") if isinstance(event.get("tool_call_id"), str) else None,
                        model=event.get("model") if isinstance(event.get("model"), str) else None,
                        title=str(event.get("title") or ""),
                        summary=str(event.get("summary") or ""),
                        payload=event.get("payload") if isinstance(event.get("payload"), dict) else {},
                    )
                    maybe_suite = event.get("payload", {}).get("suite") if isinstance(event.get("payload"), dict) else None
                    if isinstance(maybe_suite, dict):
                        suite = maybe_suite
            events, _buffer = parse_trace_sse_chunk(buffer + "\n\n")
            for event in events:
                recorder.emit(
                    str(event.get("event_type") or "trace_event"),
                    status=str(event.get("status") or "running"),
                    scope=str(event.get("scope") or "eval_case"),
                    case_id=event.get("case_id") if isinstance(event.get("case_id"), str) else None,
                    tool_call_id=event.get("tool_call_id") if isinstance(event.get("tool_call_id"), str) else None,
                    model=event.get("model") if isinstance(event.get("model"), str) else None,
                    title=str(event.get("title") or ""),
                    summary=str(event.get("summary") or ""),
                    payload=event.get("payload") if isinstance(event.get("payload"), dict) else {},
                )
                maybe_suite = event.get("payload", {}).get("suite") if isinstance(event.get("payload"), dict) else None
                if isinstance(maybe_suite, dict):
                    suite = maybe_suite
    if suite is None:
        raise RuntimeError("Node tool-loop eval stream ended without a final suite")
    return suite


def parse_trace_sse_chunk(text: str) -> tuple[list[dict[str, Any]], str]:
    parts = text.split("\n\n")
    buffer = parts.pop() or ""
    events: list[dict[str, Any]] = []
    for part in parts:
        data_lines = [line.removeprefix("data:").strip() for line in part.splitlines() if line.startswith("data:")]
        if not data_lines:
            continue
        try:
            parsed = json.loads("\n".join(data_lines))
        except ValueError:
            continue
        if isinstance(parsed, dict):
            events.append(parsed)
    return events, buffer




def local_target_instance(config: Any) -> str:
    return str(getattr(config, "node_name", None) or "").strip() or "standalone"


def local_target_selector(config: Any) -> str:
    return f"local:{local_target_instance(config)}"




def select_tool_loop_cases(case_ids: list[str] | None):
    cases = default_tool_loop_eval_cases()
    if not case_ids:
        return cases
    by_id = {case.id: case for case in cases}
    missing = sorted(set(case_ids) - set(by_id))
    if missing:
        raise ValueError(f"Unknown tool-loop eval case(s): {', '.join(missing)}")
    return [by_id[case_id] for case_id in case_ids]


def select_tool_loop_workloads(case_ids: list[str] | None):
    cases = default_tool_loop_eval_cases()
    live_scenarios = default_live_tool_loop_scenarios()
    if not case_ids:
        return cases, []
    by_id = {case.id: case for case in cases}
    live_by_id = {scenario.id: scenario for scenario in live_scenarios}
    missing = sorted(set(case_ids) - set(by_id) - set(live_by_id))
    if missing:
        raise ValueError(f"Unknown tool-loop eval case(s): {', '.join(missing)}")
    return [by_id[case_id] for case_id in case_ids if case_id in by_id], [
        live_by_id[case_id] for case_id in case_ids if case_id in live_by_id
    ]


def merge_tool_loop_suites(model: str, suites: list[dict[str, Any]]) -> dict[str, Any]:
    cases = [case for suite in suites for case in suite.get("cases", []) if isinstance(case, dict)]
    passed_count = sum(1 for case in cases if case.get("status") == "passed")
    partial_count = sum(1 for case in cases if case.get("status") == "partial")
    failed_count = len(cases) - passed_count - partial_count
    average_score = round(sum(float(case.get("score") or 0.0) for case in cases) / len(cases), 4) if cases else 0.0
    return {
        "model": model,
        "status": "failed" if failed_count else "partial" if partial_count else "passed",
        "case_count": len(cases),
        "passed_count": passed_count,
        "partial_count": partial_count,
        "failed_count": failed_count,
        "average_score": average_score,
        "cases": cases,
    }


def node_base_url(node_name: str, url: str) -> str:
    if not (url.startswith("http://") or url.startswith("https://")):
        raise ValueError(f"nodes.{node_name}.url must start with http:// or https://")
    return url.rstrip("/")
