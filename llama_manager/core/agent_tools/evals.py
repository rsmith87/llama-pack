from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any
from uuid import uuid4

from llama_manager.core.agent_tools.executor import ToolExecutor
from llama_manager.core.agent_tools.registry import ToolRegistry
from llama_manager.core.config.models import AppConfig


@dataclass(frozen=True)
class ToolLoopEvalCase:
    id: str
    prompt: str
    system_prompt: str | None = None
    expected_tool_sequence: list[str] = field(default_factory=list)
    expected_final_substrings: list[str] = field(default_factory=list)
    request_defaults: dict[str, Any] = field(default_factory=dict)


class ToolLoopEvaluator:
    def __init__(self, config: AppConfig, proxy: Any, executor: ToolExecutor | None = None) -> None:
        self.config = config
        self.proxy = proxy
        self.registry = ToolRegistry(config.agent_tools)
        self.executor = executor or ToolExecutor(config)

    async def run_case(self, model_name: str, case: ToolLoopEvalCase, request_id: str | None = None) -> dict[str, Any]:
        request_id = request_id or str(uuid4())
        messages = _case_messages(case)
        base_payload = {
            "temperature": 0.0,
            "max_tokens": 512,
            **case.request_defaults,
        }
        if self.config.mode == "agent":
            base_payload["target"] = "local"
        tool_defs = self.registry.openai_tools()
        observed_tools: list[str] = []
        tool_results: list[dict[str, Any]] = []
        iteration_count = 0
        final_answer = ""
        error = ""
        completed = False

        for _ in range(self.config.agent_tools.max_iterations):
            iteration_count += 1
            request_payload = {**base_payload, "messages": messages, "tools": tool_defs}
            response, _meta = await self.proxy.chat_with_meta(model_name, request_payload)
            message = _assistant_message(response)
            tool_calls = _tool_calls(message)
            if not tool_calls:
                final_answer = _message_content(message)
                completed = True
                break

            messages.append(message)
            for tool_call in tool_calls:
                function = tool_call.get("function") or {}
                name = str(function.get("name") or "")
                observed_tools.append(name)
                arguments = _parse_arguments(function.get("arguments"))
                result = await self.executor.execute(name, arguments, request_id=request_id, model=model_name)
                tool_results.append({"tool_name": name, "ok": bool(result.get("ok")), "error": result.get("error") or ""})
                messages.append(
                    {
                        "role": "tool",
                        "tool_call_id": tool_call.get("id") or name,
                        "name": name,
                        "content": json.dumps(result),
                    }
                )
        else:
            error = "agent tool loop reached max_iterations before final assistant response"

        checks = {
            "completed": completed,
            "expected_tool_sequence": _sequence_matches(observed_tools, case.expected_tool_sequence),
            "expected_final_substrings": _contains_all(final_answer, case.expected_final_substrings),
            "no_tool_errors": all(result["ok"] for result in tool_results),
        }
        score = _score(checks)
        return {
            "case_id": case.id,
            "model": model_name,
            "status": "passed" if score == 1.0 else "failed",
            "score": score,
            "checks": checks,
            "error": error,
            "iteration_count": iteration_count,
            "tool_call_count": len(observed_tools),
            "observed_tool_sequence": observed_tools,
            "expected_tool_sequence": list(case.expected_tool_sequence),
            "tool_results": tool_results,
            "final_answer": final_answer,
        }

    async def run_suite(self, model_name: str, cases: list[ToolLoopEvalCase]) -> dict[str, Any]:
        results = [await self.run_case(model_name, case) for case in cases]
        passed_count = sum(1 for result in results if result["status"] == "passed")
        failed_count = len(results) - passed_count
        average_score = round(
            sum(float(result["score"]) for result in results) / len(results),
            4,
        ) if results else 0.0
        return {
            "model": model_name,
            "status": "passed" if failed_count == 0 else "failed",
            "case_count": len(results),
            "passed_count": passed_count,
            "failed_count": failed_count,
            "average_score": average_score,
            "cases": results,
        }


def default_tool_loop_eval_cases() -> list[ToolLoopEvalCase]:
    return [
        ToolLoopEvalCase(
            id="two-step-tool-synthesis",
            system_prompt=(
                "Use the available tools when they are relevant. After gathering the requested facts, "
                "write a concise final answer that cites the facts you found."
            ),
            prompt=(
                "First inspect the status source, then inspect the details source, then combine both "
                "findings into one final answer."
            ),
            expected_tool_sequence=["read_status", "read_details"],
        ),
        ToolLoopEvalCase(
            id="avoid-unneeded-tools",
            system_prompt="Answer directly when no tool is needed.",
            prompt="Reply with exactly: tool loop ready",
            expected_final_substrings=["tool loop ready"],
        ),
    ]


def _case_messages(case: ToolLoopEvalCase) -> list[dict[str, str]]:
    messages: list[dict[str, str]] = []
    if case.system_prompt:
        messages.append({"role": "system", "content": case.system_prompt})
    messages.append({"role": "user", "content": case.prompt})
    return messages


def _assistant_message(response: dict[str, Any]) -> dict[str, Any]:
    choices = response.get("choices") or []
    if not choices or not isinstance(choices[0], dict):
        return {"role": "assistant", "content": ""}
    message = choices[0].get("message") or {}
    return dict(message) if isinstance(message, dict) else {"role": "assistant", "content": str(message)}


def _tool_calls(message: dict[str, Any]) -> list[dict[str, Any]]:
    calls = message.get("tool_calls") or []
    return [call for call in calls if isinstance(call, dict)]


def _parse_arguments(raw: Any) -> dict[str, Any]:
    if isinstance(raw, dict):
        return raw
    if not isinstance(raw, str) or not raw.strip():
        return {}
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return {}
    return parsed if isinstance(parsed, dict) else {}


def _message_content(message: dict[str, Any]) -> str:
    content = message.get("content")
    if isinstance(content, str):
        return content
    if content is None:
        return ""
    return str(content)


def _sequence_matches(observed: list[str], expected: list[str]) -> bool:
    return not expected or observed == expected


def _contains_all(text: str, expected_substrings: list[str]) -> bool:
    normalized = text.lower()
    return all(substring.lower() in normalized for substring in expected_substrings)


def _score(checks: dict[str, bool]) -> float:
    if not checks:
        return 0.0
    passed = sum(1 for value in checks.values() if value)
    return round(passed / len(checks), 4)
