from __future__ import annotations

import json
from pathlib import Path
from typing import TYPE_CHECKING, Any
from uuid import uuid4

from llama_pack.core.agent_tools.answer_verifier import AnswerVerificationReport, AnswerVerifier
from llama_pack.core.agent_tools.executor import ToolExecutor
from llama_pack.core.agent_tools.registry import ToolRegistry
from llama_pack.core.agent_tools.tracing import RuntimeTraceRecorder
from llama_pack.core.code_graph.tools import ProjectGraphToolContext, project_graph_tool_definitions
from llama_pack.core.config.models import AGENT_TOOL_MAX_ITERATIONS_LIMIT, AppConfig

if TYPE_CHECKING:
    from llama_pack.core.memory.store import ChromaMemoryStore
    from llama_pack.core.runtime.process_manager import ProcessManager


class AgentToolLoop:
    def __init__(
        self,
        config: AppConfig,
        proxy: Any,
        process_manager: ProcessManager | None = None,
        memory_store: ChromaMemoryStore | None = None,
        trace_recorder: RuntimeTraceRecorder | None = None,
        project_graph_context: ProjectGraphToolContext | None = None,
    ) -> None:
        self.config = config
        self.proxy = proxy
        runtime_tools = project_graph_tool_definitions() if project_graph_context is not None else []
        self.registry = ToolRegistry(config.agent_tools, runtime_tools=runtime_tools)
        self.trace_recorder = trace_recorder
        self.executor = ToolExecutor(
            config,
            process_manager=process_manager,
            memory_store=memory_store,
            trace_recorder=trace_recorder,
            project_graph_context=project_graph_context,
        )

    async def run(
        self,
        model_name: str,
        payload: dict[str, Any],
        request_id: str | None = None,
    ) -> tuple[dict[str, Any], dict[str, Any]]:
        request_id = request_id or str(uuid4())
        messages = [dict(message) for message in payload.get("messages", [])]
        max_iterations = _request_max_iterations(payload, self.config.agent_tools.max_iterations)
        base_payload = {key: value for key, value in payload.items() if key not in {"messages", "tool_runtime", "agent_tool_max_iterations"}}
        tool_defs = self.registry.openai_tools()
        last_meta: dict[str, Any] = {}
        source_tool_evidence_available = False
        test_source_tool_evidence_available = False

        for iteration in range(max_iterations):
            self._emit(
                "assistant_turn_started",
                model=model_name,
                title=f"Assistant turn {iteration + 1}",
                payload={"iteration": iteration + 1},
            )
            request_payload = {**base_payload, "messages": messages, "tools": tool_defs}
            response, last_meta = await self.proxy.chat_with_meta(model_name, request_payload)
            message = _assistant_message(response)
            tool_calls = _tool_calls(message)
            if not tool_calls:
                if self.executor.project_graph_context is not None and self.config.agent_tools.answer_verification_mode != "off":
                    verifier = AnswerVerifier(self.executor.project_graph_context)
                    retries_used = 0
                    verification_report: AnswerVerificationReport | None = None
                    verification_status = "unavailable"
                    while True:
                        self._emit(
                            "answer_verification_started",
                            model=model_name,
                            title="Reviewing generation",
                            payload={"iteration": iteration + 1, "retry": retries_used},
                        )
                        report = verifier.verify(
                            str(message.get("content") or ""),
                            source_evidence_available=source_tool_evidence_available or retries_used > 0,
                            test_source_evidence_available=test_source_tool_evidence_available,
                        )
                        verification_report = report
                        verification_status = _verification_status(report)
                        if report.ok:
                            break
                        self._emit(
                            "answer_verification_failed",
                            status="failed",
                            model=model_name,
                            title="Answer verification failed",
                            payload={
                                "missing_paths": report.missing_paths,
                                "missing_symbols": report.missing_symbols,
                                "missing_source_evidence": report.missing_source_evidence,
                                "missing_test_source_evidence": report.missing_test_source_evidence,
                                "issues": report.issues,
                            },
                        )
                        if retries_used >= self.config.agent_tools.answer_verification_max_retries:
                            if self.config.agent_tools.answer_verification_mode == "strict":
                                raise RuntimeError("answer verification failed before final assistant response")
                            if not str(message.get("content") or "").strip():
                                response = _replace_assistant_content(response, _unverified_answer_message())
                                message = _assistant_message(response)
                            break
                        messages.append(message)
                        messages.append(
                            {
                                "role": "user",
                                "content": (
                                    "Review this exact draft answer, not conversational memory:\n\n"
                                    f"<draft_answer>\n{message.get('content') or ''}\n</draft_answer>\n\n"
                                    "Your draft contains unverified codebase claims.\n"
                                    f"{report.feedback()}\n\n"
                                    "Revise using only verified file paths and symbols. "
                                    "Do not introduce new paths or symbols unless they are verified by tool evidence. "
                                    "If a detail is not verified, say not verified."
                                ),
                            }
                        )
                        retries_used += 1
                        request_payload = {**base_payload, "messages": messages, "tools": tool_defs}
                        response, last_meta = await self.proxy.chat_with_meta(model_name, request_payload)
                        message = _assistant_message(response)
                    if verification_report is not None:
                        response = _attach_verification_metadata(response, verification_report, verification_status)
                self._emit(
                    "assistant_message_completed",
                    status="passed",
                    model=model_name,
                    title="Assistant answered",
                    payload={"content": message.get("content") or ""},
                )
                return response, last_meta

            messages.append(message)
            for tool_call in tool_calls:
                function = tool_call.get("function") or {}
                name = str(function.get("name") or "")
                tool_call_id = str(tool_call.get("id") or name)
                arguments = _parse_arguments(function.get("arguments"), tool_name=name, tool_call_id=tool_call_id)
                source_tool_evidence_available = True
                result = await self.executor.execute(
                    name,
                    arguments,
                    request_id=request_id,
                    model=model_name,
                    tool_call_id=tool_call_id,
                )
                if bool(result.get("ok")):
                    test_source_tool_evidence_available = test_source_tool_evidence_available or _result_has_test_source_evidence(result)
                messages.append(
                    {
                        "role": "tool",
                        "tool_call_id": tool_call_id,
                        "name": name,
                        "content": json.dumps(result),
                    }
                )

        raise RuntimeError("agent tool loop reached max_iterations before final assistant response")

    def _emit(self, event_type: str, **kwargs: Any) -> dict[str, Any] | None:
        if self.trace_recorder is None:
            return None
        return self.trace_recorder.emit(event_type, **kwargs)


class MalformedToolCallArgumentsError(ValueError):
    def __init__(self, tool_name: str, tool_call_id: str, detail: str) -> None:
        super().__init__(f"Malformed arguments for tool call {tool_call_id} ({tool_name}): {detail}")
        self.tool_name = tool_name
        self.tool_call_id = tool_call_id
        self.detail = detail


def _assistant_message(response: dict[str, Any]) -> dict[str, Any]:
    choices = response.get("choices") or []
    if not choices or not isinstance(choices[0], dict):
        return {"role": "assistant", "content": ""}
    message = choices[0].get("message") or {}
    return dict(message) if isinstance(message, dict) else {"role": "assistant", "content": str(message)}


def _replace_assistant_content(response: dict[str, Any], content: str) -> dict[str, Any]:
    choices = response.get("choices") or []
    if not choices or not isinstance(choices[0], dict):
        return {"choices": [{"message": {"role": "assistant", "content": content}}]}
    choice = dict(choices[0])
    message = choice.get("message") or {}
    message_data = dict(message) if isinstance(message, dict) else {"role": "assistant"}
    choice["message"] = {**message_data, "content": content}
    return {**response, "choices": [choice, *choices[1:]]}


def _attach_verification_metadata(
    response: dict[str, Any],
    report: AnswerVerificationReport,
    status: str,
) -> dict[str, Any]:
    existing = response.get("llama_pack")
    metadata = dict(existing) if isinstance(existing, dict) else {}
    metadata["verification"] = {
        "status": status,
        "ok": report.ok,
        "verified_paths": report.verified_paths,
        "missing_paths": report.missing_paths,
        "verified_symbols": report.verified_symbols,
        "missing_symbols": report.missing_symbols,
        "missing_source_evidence": report.missing_source_evidence,
        "missing_test_source_evidence": report.missing_test_source_evidence,
        "issues": report.issues,
    }
    return {**response, "llama_pack": metadata}


def _verification_status(report: AnswerVerificationReport) -> str:
    has_code_claims = bool(
        report.verified_paths
        or report.missing_paths
        or report.verified_symbols
        or report.missing_symbols
    )
    if report.ok and has_code_claims:
        return "verified"
    if report.ok:
        return "no_code_claims"
    return "unverified"


def _unverified_answer_message() -> str:
    return (
        "I could not verify the codebase claims in the generated answer, so I am not returning them as facts. "
        "Please ask again with a narrower codebase query."
    )


def _tool_calls(message: dict[str, Any]) -> list[dict[str, Any]]:
    calls = message.get("tool_calls") or []
    return [call for call in calls if isinstance(call, dict)]


def _parse_arguments(raw: Any, *, tool_name: str, tool_call_id: str) -> dict[str, Any]:
    if isinstance(raw, dict):
        return raw
    if not isinstance(raw, str) or not raw.strip():
        return {}
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise MalformedToolCallArgumentsError(tool_name, tool_call_id, exc.msg) from exc
    if not isinstance(parsed, dict):
        raise MalformedToolCallArgumentsError(tool_name, tool_call_id, "arguments must decode to a JSON object")
    return parsed


def _result_has_test_source_evidence(result: dict[str, Any]) -> bool:
    return any(_is_test_source_path(value) for value in _walk_result_strings(result))


def _walk_result_strings(value: Any) -> list[str]:
    if isinstance(value, str):
        return [value]
    if isinstance(value, list):
        values: list[str] = []
        for item in value:
            values.extend(_walk_result_strings(item))
        return values
    if isinstance(value, dict):
        values: list[str] = []
        for item in value.values():
            values.extend(_walk_result_strings(item))
        return values
    return []


def _is_test_source_path(value: str) -> bool:
    path = value.replace("\\", "/")
    if path.startswith("tests/") and path.endswith(".py"):
        return True
    parts = Path(path).parts
    return "tests" in parts and path.endswith(".py")


def _request_max_iterations(payload: dict[str, Any], configured_max_iterations: int) -> int:
    raw = payload.get("agent_tool_max_iterations")
    if raw is None:
        return configured_max_iterations
    if not isinstance(raw, int):
        raise ValueError(f"agent_tool_max_iterations must be an integer between 1 and {AGENT_TOOL_MAX_ITERATIONS_LIMIT}")
    if raw < 1 or raw > AGENT_TOOL_MAX_ITERATIONS_LIMIT:
        raise ValueError(f"agent_tool_max_iterations must be between 1 and {AGENT_TOOL_MAX_ITERATIONS_LIMIT}")
    return raw
