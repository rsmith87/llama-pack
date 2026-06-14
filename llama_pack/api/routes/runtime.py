from __future__ import annotations

import asyncio
import json
from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

import httpx
from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from llama_pack.core.agent_tools.evals import ToolLoopEvaluator, default_tool_loop_eval_cases
from llama_pack.core.agent_tools.live_evals import LiveToolLoopEvaluator, default_live_tool_loop_scenarios
from llama_pack.core.agent_tools.tracing import RuntimeTraceRecorder
from llama_pack.core.runtime.route_preview import RoutePreviewRequest, RoutePreviewService


router = APIRouter(prefix="/runtime")


class ToolLoopNodeChatRequest(BaseModel):
    node: str = Field(min_length=1)
    model: str = Field(min_length=1)
    payload: dict[str, Any] = Field(default_factory=dict)


class ToolLoopRunRequest(BaseModel):
    model: str = Field(min_length=1)
    case_ids: list[str] | None = None


class ToolLoopNodeRunRequest(ToolLoopRunRequest):
    node: str = Field(min_length=1)


@router.get("/overview")
async def runtime_overview(request: Request) -> dict[str, object]:
    config = request.app.state.config
    memory_store = getattr(request.app.state, "memory_store", None)
    orchestrator = getattr(request.app.state, "orchestrator", None)
    thread_service = getattr(request.app.state, "thread_service", None)
    node_registry = getattr(request.app.state, "node_registry", None)
    process_manager = getattr(request.app.state, "process_manager", None)
    download_manager = getattr(request.app.state, "download_manager", None)

    return {
        "mode": config.mode,
        "agent_tools": _agent_tools_summary(config),
        "memory": {
            "configured": bool(config.memory.enabled),
            "available": bool(memory_store is not None and not getattr(memory_store, "disabled", True)),
            "path": str(config.memory.path),
            "auto_inject": bool(config.memory.auto_inject),
            "top_k": config.memory.top_k,
        },
        "jobs": _jobs_summary(config.mode, orchestrator),
        "worker": _worker_summary(config, getattr(request.app.state, "agent_worker", None)),
        "threads": _threads_summary(config.mode, thread_service),
        "nodes": _nodes_summary(config.mode, node_registry),
        "node_runtimes": await _node_runtimes_summary(config.mode, node_registry),
        "running_models": _running_models_summary(process_manager, config.mode),
        "downloads": _downloads_summary(download_manager),
    }


@router.post("/route-preview")
async def route_preview(body: RoutePreviewRequest, request: Request) -> dict[str, object]:
    service = RoutePreviewService(
        config=request.app.state.config,
        node_registry=getattr(request.app.state, "node_registry", None),
        catalog_service=getattr(request.app.state, "model_catalog_service", None),
    )
    return await service.preview(body)


@router.get("/tool-loop-evals/latest")
async def tool_loop_eval_latest(request: Request) -> dict[str, object]:
    config = request.app.state.config
    path = config.log_dir / "tool_loop_eval_latest.json"
    if not path.exists():
        return {
            "available": False,
            "path": str(path),
            "generated_at": None,
            "suite_count": 0,
            "models": [],
            "suites": [],
        }
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        return {
            "available": False,
            "path": str(path),
            "generated_at": None,
            "suite_count": 0,
            "models": [],
            "suites": [],
            "error": str(exc),
        }
    if not isinstance(payload, dict):
        payload = {}
    return {
        "available": True,
        "path": str(path),
        "generated_at": payload.get("generated_at"),
        "suite_count": int(payload.get("suite_count") or 0),
        "models": payload.get("models") if isinstance(payload.get("models"), list) else [],
        "suites": payload.get("suites") if isinstance(payload.get("suites"), list) else [],
    }


@router.get("/tool-loop-evals/presets")
async def tool_loop_eval_presets() -> dict[str, object]:
    groups = [
        _tool_loop_preset_group(
            group_id="synthetic",
            label="Synthetic presets",
            presets=[case for case in default_tool_loop_eval_cases() if case.category == "synthetic"],
        ),
        _tool_loop_preset_group(
            group_id="real_world",
            label="Real-world scenarios",
            presets=[case for case in default_tool_loop_eval_cases() if case.category == "real_world"],
        ),
        _tool_loop_live_preset_group(default_live_tool_loop_scenarios()),
    ]
    return {
        "groups": groups,
        "preset_count": sum(len(group["presets"]) for group in groups),
    }


@router.get("/tool-loop-evals/runs")
async def tool_loop_eval_runs(
    request: Request,
    model: str | None = Query(default=None),
    status: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
) -> dict[str, object]:
    store = _benchmark_store(request)
    return {"runs": store.list_tool_loop_eval_runs(model=model, status=status, limit=limit)}


@router.get("/tool-loop-evals/runs/{run_id}")
async def tool_loop_eval_run_detail(run_id: str, request: Request) -> dict[str, object]:
    store = _benchmark_store(request)
    run = store.get_tool_loop_eval_run(run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Tool-loop eval run not found")
    return run


def _tool_loop_preset_group(*, group_id: str, label: str, presets: list[Any]) -> dict[str, object]:
    return {
        "id": group_id,
        "label": label,
        "presets": [
            {
                "id": preset.id,
                "label": _tool_loop_preset_label(preset.id),
                "category": preset.category,
                "scoring_mode": preset.scoring_mode,
                "expected_tool_count": len(preset.expected_tool_sequence),
                "max_iterations": preset.max_iterations,
            }
            for preset in presets
        ],
    }


def _tool_loop_live_preset_group(presets: list[Any]) -> dict[str, object]:
    return {
        "id": "live_workspace",
        "label": "Live workspace scenarios",
        "presets": [
            {
                "id": preset.id,
                "label": _tool_loop_preset_label(preset.id.removeprefix("live-")),
                "category": "live_workspace",
                "scoring_mode": "set_membership",
                "expected_tool_count": len(preset.expected_tool_sequence),
                "max_iterations": preset.max_iterations,
            }
            for preset in presets
        ],
    }


def _tool_loop_preset_label(preset_id: str) -> str:
    return preset_id.replace("-", " ").capitalize()


@router.post("/tool-loop-evals/node-chat")
async def tool_loop_eval_node_chat(body: ToolLoopNodeChatRequest, request: Request) -> dict[str, object]:
    config = request.app.state.config
    if config.mode != "controller":
        raise HTTPException(status_code=400, detail="tool-loop node chat is only available in controller mode")
    node_registry = getattr(request.app.state, "node_registry", None)
    if node_registry is None:
        raise HTTPException(status_code=503, detail="node registry is not available")
    try:
        node = node_registry.get_node_config(body.node)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    node_url = f"{_node_base_url(body.node, node.url)}/v1/chat/completions"
    payload = {
        **body.payload,
        "model": body.model,
        "tool_runtime": "agent",
        "stream": False,
    }
    return await node_registry._request("POST", node_url, node.api_key, node.verify_tls, payload)


@router.post("/tool-loop-evals/run")
async def tool_loop_eval_run(body: ToolLoopRunRequest, request: Request) -> dict[str, object]:
    config = request.app.state.config
    if config.mode == "controller":
        raise HTTPException(status_code=400, detail="tool-loop local eval run is only available outside controller mode")
    if not config.agent_tools.enabled:
        raise HTTPException(status_code=400, detail="agent tool runtime is not enabled")
    process_manager = getattr(request.app.state, "process_manager", None)
    if process_manager is not None and hasattr(process_manager, "start"):
        try:
            process_manager.start(body.model)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
    cases, live_scenarios = _select_tool_loop_workloads(body.case_ids)
    suites = []
    if cases:
        suites.append(
            await ToolLoopEvaluator(
                config,
                request.app.state.chat_scheduler,
                executor=None,
            ).run_suite(body.model, cases)
        )
    if live_scenarios:
        suites.append(
            await LiveToolLoopEvaluator(
                config,
                request.app.state.chat_scheduler,
            ).run_suite(body.model, live_scenarios)
        )
    suite = _merge_tool_loop_suites(body.model, suites)
    persisted = _persist_tool_loop_suite(
        request,
        suite,
        target_selector=_local_target_selector(config),
        target_node=None,
        target_instance=_local_target_instance(config),
    )
    if persisted is not None:
        suite = {**suite, "persisted_run_id": persisted["id"]}
    return suite


@router.post("/tool-loop-evals/run/stream")
async def tool_loop_eval_run_stream(body: ToolLoopRunRequest, request: Request) -> StreamingResponse:
    config = request.app.state.config
    if config.mode == "controller":
        raise HTTPException(status_code=400, detail="tool-loop local eval run is only available outside controller mode")
    if not config.agent_tools.enabled:
        raise HTTPException(status_code=400, detail="agent tool runtime is not enabled")
    process_manager = getattr(request.app.state, "process_manager", None)
    if process_manager is not None and hasattr(process_manager, "start"):
        try:
            process_manager.start(body.model)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
    cases, live_scenarios = _select_tool_loop_workloads(body.case_ids)
    recorder = RuntimeTraceRecorder(trace_id=str(uuid4()), source="tool_loop_eval", scope="eval_run")

    async def run_and_close() -> None:
        try:
            suites = await _execute_tool_loop_suites(request, body.model, cases, live_scenarios, recorder)
            suite = _merge_tool_loop_suites(body.model, suites)
            persisted = _persist_tool_loop_suite(
                request,
                suite,
                target_selector=_local_target_selector(config),
                target_node=None,
                target_instance=_local_target_instance(config),
            )
            if persisted is not None:
                suite = {**suite, "persisted_run_id": persisted["id"]}
            recorder.emit(
                "run_completed" if suite.get("status") == "passed" else "run_failed",
                status=str(suite.get("status") or "failed"),
                model=body.model,
                title="Tool-loop eval stream completed",
                payload={"suite": suite},
            )
        except Exception as exc:
            recorder.emit(
                "run_failed",
                status="failed",
                model=body.model,
                title="Tool-loop eval stream failed",
                payload={"error": str(exc)},
            )
        finally:
            recorder.close()

    return StreamingResponse(_stream_trace_events(recorder, run_and_close), media_type="text/event-stream")


@router.post("/tool-loop-evals/node-run")
async def tool_loop_eval_node_run(body: ToolLoopNodeRunRequest, request: Request) -> dict[str, object]:
    config = request.app.state.config
    if config.mode != "controller":
        raise HTTPException(status_code=400, detail="tool-loop node eval run is only available in controller mode")
    node_registry = getattr(request.app.state, "node_registry", None)
    if node_registry is None:
        raise HTTPException(status_code=503, detail="node registry is not available")
    try:
        node = node_registry.get_node_config(body.node)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    _node_base_url(body.node, node.url)
    payload: dict[str, object] = {"model": body.model}
    if body.case_ids is not None:
        payload["case_ids"] = body.case_ids
    try:
        suite = await node_registry.request_node(
            body.node,
            "POST",
            "/lm-api/v1/runtime/tool-loop-evals/run",
            payload,
            timeout=None,
        )
    except httpx.HTTPStatusError as exc:
        raise HTTPException(
            status_code=exc.response.status_code,
            detail=f"Node {body.node} tool-loop eval failed: {_node_error_detail(exc.response)}",
        ) from exc
    persisted = _persist_tool_loop_suite(
        request,
        suite,
        target_selector=f"node:{body.node}",
        target_node=body.node,
        target_instance=body.node,
    )
    if persisted is not None and isinstance(suite, dict):
        suite = {**suite, "persisted_run_id": persisted["id"]}
    return suite


@router.post("/tool-loop-evals/node-run/stream")
async def tool_loop_eval_node_run_stream(body: ToolLoopNodeRunRequest, request: Request) -> StreamingResponse:
    config = request.app.state.config
    if config.mode != "controller":
        raise HTTPException(status_code=400, detail="tool-loop node eval run is only available in controller mode")
    node_registry = getattr(request.app.state, "node_registry", None)
    if node_registry is None:
        raise HTTPException(status_code=503, detail="node registry is not available")
    try:
        node = node_registry.get_node_config(body.node)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    _node_base_url(body.node, node.url)
    recorder = RuntimeTraceRecorder(trace_id=str(uuid4()), source="tool_loop_eval", scope="eval_run")

    async def run_and_close() -> None:
        try:
            payload: dict[str, object] = {"model": body.model}
            if body.case_ids is not None:
                payload["case_ids"] = body.case_ids
            if getattr(node_registry, "_uses_default_request", False):
                suite = await _stream_node_tool_loop_eval(node, body.node, payload, recorder)
            else:
                suite = await node_registry.request_node(
                    body.node,
                    "POST",
                    "/lm-api/v1/runtime/tool-loop-evals/run",
                    payload,
                    timeout=None,
                )
                _replay_suite_trace_events(recorder, suite)
            persisted = _persist_tool_loop_suite(
                request,
                suite,
                target_selector=f"node:{body.node}",
                target_node=body.node,
                target_instance=body.node,
            )
            if persisted is not None and isinstance(suite, dict):
                suite = {**suite, "persisted_run_id": persisted["id"]}
            recorder.emit(
                "run_completed" if isinstance(suite, dict) and suite.get("status") == "passed" else "run_failed",
                status=str(suite.get("status") if isinstance(suite, dict) else "failed"),
                model=body.model,
                title="Tool-loop node eval stream completed",
                payload={"suite": suite},
            )
        except httpx.HTTPStatusError as exc:
            recorder.emit(
                "run_failed",
                status="failed",
                model=body.model,
                title="Tool-loop node eval stream failed",
                payload={"error": f"Node {body.node} tool-loop eval failed: {_node_error_detail(exc.response)}"},
            )
        except Exception as exc:
            recorder.emit(
                "run_failed",
                status="failed",
                model=body.model,
                title="Tool-loop node eval stream failed",
                payload={"error": str(exc)},
            )
        finally:
            recorder.close()

    return StreamingResponse(_stream_trace_events(recorder, run_and_close), media_type="text/event-stream")


def _persist_tool_loop_suite(
    request: Request,
    suite: Any,
    *,
    target_selector: str,
    target_node: str | None,
    target_instance: str | None,
) -> dict[str, Any] | None:
    if not isinstance(suite, dict):
        return None
    store = getattr(request.app.state, "benchmark_store", None)
    if store is None:
        return None
    return store.create_tool_loop_eval_run(
        generated_at=datetime.now(UTC).isoformat(),
        target_selector=target_selector,
        target_node=target_node,
        target_instance=target_instance,
        suite=suite,
    )


async def _execute_tool_loop_suites(
    request: Request,
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
                request.app.state.config,
                request.app.state.chat_scheduler,
                executor=None,
                trace_recorder=recorder,
                emit_suite_events=False,
            ).run_suite(model, cases)
        )
    if live_scenarios:
        suites.append(
            await LiveToolLoopEvaluator(
                request.app.state.config,
                request.app.state.chat_scheduler,
                trace_recorder=recorder,
                emit_suite_events=False,
            ).run_suite(model, live_scenarios)
        )
    return suites


async def _stream_trace_events(recorder: RuntimeTraceRecorder, runner: Any):
    task = asyncio.create_task(runner())
    try:
        async for event in recorder.stream():
            yield _encode_trace_sse(event)
        await task
    finally:
        if not task.done():
            task.cancel()


def _encode_trace_sse(event: dict[str, Any]) -> str:
    return (
        f"id: {event['id']}\n"
        f"event: {event['event_type']}\n"
        f"data: {json.dumps(event, separators=(',', ':'))}\n\n"
    )


def _replay_suite_trace_events(recorder: RuntimeTraceRecorder, suite: Any) -> None:
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


async def _stream_node_tool_loop_eval(node: Any, node_name: str, payload: dict[str, object], recorder: RuntimeTraceRecorder) -> dict[str, Any]:
    base_url = _node_base_url(node_name, node.url)
    headers = {"X-Llama-Manager-Key": node.api_key} if node.api_key else {}
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
                events, buffer = _parse_trace_sse_chunk(buffer + chunk)
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
            events, _buffer = _parse_trace_sse_chunk(buffer + "\n\n")
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


def _parse_trace_sse_chunk(text: str) -> tuple[list[dict[str, Any]], str]:
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


def _node_error_detail(response: httpx.Response) -> str:
    try:
        payload = response.json()
    except ValueError:
        return response.text[:500] or response.reason_phrase
    if isinstance(payload, dict):
        detail = payload.get("detail")
        if isinstance(detail, str) and detail:
            return detail
        if detail is not None:
            return json.dumps(detail)
    return response.text[:500] or response.reason_phrase


def _local_target_instance(config: Any) -> str:
    return str(getattr(config, "node_name", None) or "").strip() or "standalone"


def _local_target_selector(config: Any) -> str:
    return f"local:{_local_target_instance(config)}"


def _benchmark_store(request: Request) -> Any:
    store = getattr(request.app.state, "benchmark_store", None)
    if store is None:
        raise HTTPException(status_code=503, detail="benchmark store is not available")
    return store


def _agent_tools_summary(config) -> dict[str, object]:
    return {
        "enabled": bool(config.agent_tools.enabled),
        "tool_count": len(config.agent_tools.tools),
        "tools": [
            {
                "name": name,
                "type": tool.type,
                "description": tool.description,
            }
            for name, tool in sorted(config.agent_tools.tools.items())
        ],
        "max_iterations": config.agent_tools.max_iterations,
    }


def _select_tool_loop_cases(case_ids: list[str] | None):
    cases = default_tool_loop_eval_cases()
    if not case_ids:
        return cases
    by_id = {case.id: case for case in cases}
    missing = sorted(set(case_ids) - set(by_id))
    if missing:
        raise HTTPException(status_code=400, detail=f"Unknown tool-loop eval case(s): {', '.join(missing)}")
    return [by_id[case_id] for case_id in case_ids]


def _select_tool_loop_workloads(case_ids: list[str] | None):
    cases = default_tool_loop_eval_cases()
    live_scenarios = default_live_tool_loop_scenarios()
    if not case_ids:
        return cases, []
    by_id = {case.id: case for case in cases}
    live_by_id = {scenario.id: scenario for scenario in live_scenarios}
    missing = sorted(set(case_ids) - set(by_id) - set(live_by_id))
    if missing:
        raise HTTPException(status_code=400, detail=f"Unknown tool-loop eval case(s): {', '.join(missing)}")
    return [by_id[case_id] for case_id in case_ids if case_id in by_id], [
        live_by_id[case_id] for case_id in case_ids if case_id in live_by_id
    ]


def _merge_tool_loop_suites(model: str, suites: list[dict[str, Any]]) -> dict[str, Any]:
    cases = [case for suite in suites for case in suite.get("cases", []) if isinstance(case, dict)]
    passed_count = sum(1 for case in cases if case.get("status") == "passed")
    failed_count = len(cases) - passed_count
    average_score = round(sum(float(case.get("score") or 0.0) for case in cases) / len(cases), 4) if cases else 0.0
    return {
        "model": model,
        "status": "passed" if failed_count == 0 else "failed",
        "case_count": len(cases),
        "passed_count": passed_count,
        "failed_count": failed_count,
        "average_score": average_score,
        "cases": cases,
    }


def _node_base_url(node_name: str, url: str) -> str:
    if not (url.startswith("http://") or url.startswith("https://")):
        raise HTTPException(status_code=400, detail=f"nodes.{node_name}.url must start with http:// or https://")
    return url.rstrip("/")


def _jobs_summary(mode: str, orchestrator) -> dict[str, object]:
    if mode != "controller" or orchestrator is None:
        return {"available": False, "counts": {}}
    return {"available": True, "counts": orchestrator.controller_stats().get("job_counts", {})}


def _worker_summary(config, worker) -> dict[str, object]:
    claim_url = None
    if config.controller_url and config.node_name:
        base = str(config.controller_url).rstrip("/")
        if not base.endswith("/lm-api/v1"):
            base = f"{base}/lm-api/v1"
        claim_url = f"{base}/nodes/{config.node_name}/work/claim"
    return {
        "enabled": bool(worker is not None and getattr(worker, "enabled", False)),
        "running": bool(worker is not None and getattr(worker, "running", False)),
        "configured_enabled": bool(config.agent_worker_enabled),
        "controller_url": config.controller_url,
        "node_name": config.node_name,
        "poll_interval_seconds": config.agent_worker_poll_interval_seconds,
        "max_jobs": config.agent_worker_max_jobs,
        "claim_url": claim_url,
        "labels": dict(config.agent_worker_labels),
        "capacity": dict(config.agent_worker_capacity),
        "executors": {
            "chat": bool(worker is not None and getattr(worker, "_chat", None) is not None),
            "embeddings": bool(worker is not None and getattr(worker, "_embeddings", None) is not None),
            "model_transfer": bool(worker is not None and getattr(worker, "_transfer_stream", None) is not None),
            "model_download": bool(worker is not None and getattr(worker, "_download_manager", None) is not None),
            "model_install": bool(
                worker is not None
                and getattr(worker, "_download_manager", None) is not None
                and getattr(worker, "_gguf_library", None) is not None
                and getattr(worker, "_process_manager", None) is not None
            ),
        },
    }


def _threads_summary(mode: str, thread_service) -> dict[str, object]:
    if mode != "controller" or thread_service is None:
        return {"available": False, "count": 0}
    store = getattr(thread_service, "store", None)
    count = store.count_threads() if store is not None and hasattr(store, "count_threads") else 0
    return {"available": True, "count": count}


def _nodes_summary(mode: str, node_registry) -> dict[str, object]:
    if mode != "controller" or node_registry is None:
        return {"available": False, "count": 0, "items": []}
    nodes = node_registry.list_nodes()
    return {
        "available": True,
        "count": len(nodes),
        "items": [
            {
                "name": node.get("name"),
                "url": node.get("url"),
                "heartbeat_fresh": node.get("heartbeat_fresh"),
                "heartbeat_age_seconds": node.get("heartbeat_age_seconds"),
                "registration": node.get("registration"),
                "request_types": sorted((node.get("request_types") or {}).keys()),
                "default_model": node.get("default_model"),
            }
            for node in nodes
        ],
    }


async def _node_runtimes_summary(mode: str, node_registry) -> dict[str, object]:
    if mode != "controller" or node_registry is None:
        return {"available": False, "items": []}
    items = []
    for node in node_registry.list_nodes():
        name = node.get("name")
        if not name or not node.get("heartbeat_fresh"):
            items.append(
                {
                    "name": name,
                    "reachable": False,
                    "tools_enabled": False,
                    "tool_count": 0,
                    "memory_configured": False,
                    "memory_available": False,
                }
            )
            continue
        try:
            overview = await node_registry.request_node(str(name), "GET", "/lm-api/v1/runtime/overview")
            agent_tools = overview.get("agent_tools") if isinstance(overview, dict) else {}
            memory = overview.get("memory") if isinstance(overview, dict) else {}
            worker = overview.get("worker") if isinstance(overview, dict) else {}
            items.append(
                {
                    "name": name,
                    "reachable": True,
                    "tools_enabled": bool(agent_tools.get("enabled")) if isinstance(agent_tools, dict) else False,
                    "tool_count": int(agent_tools.get("tool_count") or 0) if isinstance(agent_tools, dict) else 0,
                    "tools": agent_tools.get("tools") if isinstance(agent_tools, dict) and isinstance(agent_tools.get("tools"), list) else [],
                    "memory_configured": bool(memory.get("configured")) if isinstance(memory, dict) else False,
                    "memory_available": bool(memory.get("available")) if isinstance(memory, dict) else False,
                    "worker_enabled": bool(worker.get("enabled")) if isinstance(worker, dict) else False,
                    "worker_running": bool(worker.get("running")) if isinstance(worker, dict) else False,
                    "worker_node_name": worker.get("node_name") if isinstance(worker, dict) else None,
                    "worker_max_jobs": worker.get("max_jobs") if isinstance(worker, dict) else None,
                    "worker_labels": worker.get("labels") if isinstance(worker, dict) else {},
                    "worker_capacity": worker.get("capacity") if isinstance(worker, dict) else {},
                    "worker_executors": worker.get("executors") if isinstance(worker, dict) else {},
                }
            )
        except Exception:
            items.append(
                {
                    "name": name,
                    "reachable": False,
                    "tools_enabled": False,
                    "tool_count": 0,
                    "memory_configured": False,
                    "memory_available": False,
                }
            )
    return {"available": True, "items": items}


def _running_models_summary(process_manager, mode: str) -> dict[str, object]:
    if mode != "agent" or process_manager is None:
        return {"available": False, "count": 0, "items": []}
    try:
        statuses = process_manager.list_statuses()
    except Exception:
        return {"available": False, "count": 0, "items": []}
    running = [s for s in statuses if s.get("running")]
    return {
        "available": True,
        "count": len(running),
        "items": [
            {
                "name": s.get("name"),
                "port": s.get("port"),
                "profile_label": s.get("profile_label"),
                "profile_kind": s.get("profile_kind"),
                "resource_tier": s.get("resource_tier"),
            }
            for s in running
        ],
    }


def _downloads_summary(download_manager) -> dict[str, object]:
    if download_manager is None:
        return {"available": False, "active_count": 0}
    try:
        active = download_manager.history(status="running", limit=100)
    except Exception:
        active = []
    return {
        "available": True,
        "active_count": len(active),
    }
