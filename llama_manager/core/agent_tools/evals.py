from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any
from uuid import uuid4

from llama_manager.core.agent_tools.executor import ToolExecutor
from llama_manager.core.config.models import AppConfig


@dataclass(frozen=True)
class ToolLoopEvalCase:
    id: str
    prompt: str
    system_prompt: str | None = None
    expected_tool_sequence: list[str] = field(default_factory=list)
    expected_final_substrings: list[str] = field(default_factory=list)
    request_defaults: dict[str, Any] = field(default_factory=dict)
    scoring_mode: str = "strict_sequence"
    eval_tools: list[str] = field(default_factory=lambda: ["read_status", "read_details"])
    max_iterations: int | None = None
    expected_error_tools: list[str] = field(default_factory=list)
    max_repeated_tool_calls: int | None = None


class ToolLoopEvaluator:
    def __init__(self, config: AppConfig, proxy: Any, executor: ToolExecutor | None = None) -> None:
        self.config = config
        self.proxy = proxy
        self.executor = executor or EvalToolExecutor()

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
        tool_defs = eval_tool_definitions(case.eval_tools)
        observed_tools: list[str] = []
        tool_results: list[dict[str, Any]] = []
        iteration_count = 0
        final_answer = ""
        error = ""
        completed = False

        max_iterations = case.max_iterations or self.config.agent_tools.max_iterations
        for _ in range(max_iterations):
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
                expected_error = name in case.expected_error_tools and not bool(result.get("ok"))
                tool_results.append(
                    {
                        "tool_name": name,
                        "ok": bool(result.get("ok")),
                        "error": result.get("error") or "",
                        "expected_error": expected_error,
                    }
                )
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
            "no_tool_errors": all(result["ok"] or result.get("expected_error") for result in tool_results),
        }
        if case.max_repeated_tool_calls is not None:
            checks["no_repeated_calls"] = _max_repeated_calls(observed_tools) <= case.max_repeated_tool_calls
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
            "scoring_mode": case.scoring_mode,
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
            expected_final_substrings=["green", "calibration window"],
        ),
        ToolLoopEvalCase(
            id="avoid-unneeded-tools",
            system_prompt="Answer directly when no tool is needed.",
            prompt="Reply with exactly: tool loop ready",
            expected_final_substrings=["tool loop ready"],
        ),
        ToolLoopEvalCase(
            id="linear-4-step-synthesis",
            system_prompt=(
                "Use the available tools in the requested order. After gathering all facts, "
                "write one concise final answer containing every fact token."
            ),
            prompt=(
                "Call read_step_1, read_step_2, read_step_3, and read_step_4 in order. "
                "Then summarize the four returned fact tokens."
            ),
            expected_tool_sequence=["read_step_1", "read_step_2", "read_step_3", "read_step_4"],
            expected_final_substrings=["alpha", "bravo", "charlie", "delta"],
            eval_tools=["read_step_1", "read_step_2", "read_step_3", "read_step_4"],
            max_iterations=6,
        ),
        ToolLoopEvalCase(
            id="linear-8-step-synthesis",
            system_prompt=(
                "Use the available tools in the requested order. Continue until all eight sources "
                "have been inspected, then stop and write a concise final answer containing every fact token."
            ),
            prompt=(
                "Call read_step_1 through read_step_8 in numeric order. "
                "Then summarize all eight returned fact tokens."
            ),
            expected_tool_sequence=[
                "read_step_1",
                "read_step_2",
                "read_step_3",
                "read_step_4",
                "read_step_5",
                "read_step_6",
                "read_step_7",
                "read_step_8",
            ],
            expected_final_substrings=["alpha", "bravo", "charlie", "delta", "echo", "foxtrot", "golf", "hotel"],
            eval_tools=[
                "read_step_1",
                "read_step_2",
                "read_step_3",
                "read_step_4",
                "read_step_5",
                "read_step_6",
                "read_step_7",
                "read_step_8",
            ],
            max_iterations=10,
        ),
        ToolLoopEvalCase(
            id="tool-error-recovery",
            system_prompt=(
                "If a tool reports an error, use the documented fallback tool once. "
                "Do not retry a failing tool when a fallback is available."
            ),
            prompt=(
                "Call unstable_primary first. If it fails, call stable_fallback and answer with the recovered fact."
            ),
            expected_tool_sequence=["unstable_primary", "stable_fallback"],
            expected_final_substrings=["fallback", "amber recovery token"],
            eval_tools=["unstable_primary", "stable_fallback"],
            scoring_mode="branch_path",
            expected_error_tools=["unstable_primary"],
            max_iterations=5,
            max_repeated_tool_calls=1,
        ),
        ToolLoopEvalCase(
            id="avoid-loop-trap",
            system_prompt=(
                "Stop once a tool says no more information is available. "
                "Do not repeat a lookup that has already answered."
            ),
            prompt=(
                "Call lookup_once. If it says there is no more information, stop and answer with the available fact."
            ),
            expected_tool_sequence=["lookup_once"],
            expected_final_substrings=["no more information", "stop-token"],
            eval_tools=["lookup_once"],
            scoring_mode="loop_stop",
            max_iterations=4,
            max_repeated_tool_calls=1,
        ),
    ]


class EvalToolExecutor:
    async def execute(self, name: str, arguments: dict[str, Any], request_id: str, model: str) -> dict[str, Any]:
        if name == "read_status":
            return {
                "ok": True,
                "source": "status",
                "status": "green",
                "summary": "The eval status source says the deployment status is green.",
            }
        if name == "read_details":
            return {
                "ok": True,
                "source": "details",
                "detail": "The eval details source says the next action is to confirm the calibration window.",
            }
        if name.startswith("read_step_"):
            return _step_result(name)
        if name == "unstable_primary":
            return {
                "ok": False,
                "source": "primary",
                "error": "deterministic primary channel failure; use stable_fallback",
            }
        if name == "stable_fallback":
            return {
                "ok": True,
                "source": "fallback",
                "fact": "fallback channel returned amber recovery token",
            }
        if name == "lookup_once":
            return {
                "ok": True,
                "source": "lookup",
                "fact": "no more information is available; preserve stop-token and answer now",
            }
        return {"ok": False, "error": f"Unknown eval tool {name!r}"}


def eval_tool_definitions(tool_names: list[str] | None = None) -> list[dict[str, Any]]:
    names = tool_names or list(_EVAL_TOOL_DESCRIPTIONS)
    return [
        {
            "type": "function",
            "function": {
                "name": name,
                "description": _EVAL_TOOL_DESCRIPTIONS[name],
                "parameters": {"type": "object", "properties": {}, "additionalProperties": False},
            },
        }
        for name in names
        if name in _EVAL_TOOL_DESCRIPTIONS
    ]


_STEP_FACTS = {
    "read_step_1": "alpha",
    "read_step_2": "bravo",
    "read_step_3": "charlie",
    "read_step_4": "delta",
    "read_step_5": "echo",
    "read_step_6": "foxtrot",
    "read_step_7": "golf",
    "read_step_8": "hotel",
}


_EVAL_TOOL_DESCRIPTIONS = {
    "read_status": "Read the deterministic eval status source. Use this first when the user asks for status.",
    "read_details": "Read the deterministic eval details source. Use this after read_status when details are requested.",
    "read_step_1": "Read linear synthesis source 1 and return the alpha fact token.",
    "read_step_2": "Read linear synthesis source 2 and return the bravo fact token.",
    "read_step_3": "Read linear synthesis source 3 and return the charlie fact token.",
    "read_step_4": "Read linear synthesis source 4 and return the delta fact token.",
    "read_step_5": "Read linear synthesis source 5 and return the echo fact token.",
    "read_step_6": "Read linear synthesis source 6 and return the foxtrot fact token.",
    "read_step_7": "Read linear synthesis source 7 and return the golf fact token.",
    "read_step_8": "Read linear synthesis source 8 and return the hotel fact token.",
    "unstable_primary": "Primary recovery source. This tool deterministically fails and instructs use of stable_fallback.",
    "stable_fallback": "Fallback recovery source. Use this after unstable_primary reports its deterministic failure.",
    "lookup_once": "Single lookup source. It returns the available fact and says no more information exists.",
}


def _step_result(name: str) -> dict[str, Any]:
    fact = _STEP_FACTS.get(name)
    if fact is None:
        return {"ok": False, "error": f"Unknown eval step tool {name!r}"}
    return {
        "ok": True,
        "source": name,
        "fact": fact,
        "summary": f"{name} returned fact token {fact}.",
    }


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


def _max_repeated_calls(observed: list[str]) -> int:
    counts = {name: observed.count(name) for name in set(observed)}
    return max(counts.values(), default=0)
