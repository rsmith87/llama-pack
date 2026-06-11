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
    category: str = "synthetic"
    system_prompt: str | None = None
    expected_tool_sequence: list[str] = field(default_factory=list)
    expected_final_substrings: list[str] = field(default_factory=list)
    request_defaults: dict[str, Any] = field(default_factory=dict)
    scoring_mode: str = "strict_sequence"
    eval_tools: list[str] = field(default_factory=lambda: ["read_status", "read_details"])
    max_iterations: int | None = None
    expected_error_tools: list[str] = field(default_factory=list)
    max_repeated_tool_calls: int | None = None
    required_tool_arguments: dict[str, dict[str, Any]] = field(default_factory=dict)


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
                raw_arguments = function.get("arguments")
                observed_tools.append(name)
                arguments = _parse_arguments(raw_arguments)
                result = await self.executor.execute(name, arguments, request_id=request_id, model=model_name)
                expected_error = name in case.expected_error_tools and not bool(result.get("ok"))
                tool_results.append(
                    {
                        "tool_call_id": tool_call.get("id") or name,
                        "tool_name": name,
                        "function": {
                            "name": name,
                            "arguments": raw_arguments if isinstance(raw_arguments, str) else json.dumps(raw_arguments or {}),
                        },
                        "raw_arguments": raw_arguments if isinstance(raw_arguments, str) else json.dumps(raw_arguments or {}),
                        "arguments": arguments,
                        "ok": bool(result.get("ok")),
                        "error": result.get("error") or "",
                        "expected_error": expected_error,
                        "result": result,
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
            "expected_tool_sequence": _sequence_matches(observed_tools, case.expected_tool_sequence, case.scoring_mode),
            "expected_final_substrings": _contains_all(final_answer, case.expected_final_substrings),
            "no_tool_errors": all(result["ok"] or result.get("expected_error") for result in tool_results),
        }
        if case.required_tool_arguments:
            checks["expected_tool_arguments"] = _required_arguments_match(tool_results, case.required_tool_arguments)
        if case.max_repeated_tool_calls is not None:
            checks["no_repeated_calls"] = _max_repeated_calls(observed_tools) <= case.max_repeated_tool_calls
        score = _score(checks)
        return {
            "case_id": case.id,
            "case_category": case.category,
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
            expected_final_substrings=["no more information"],
            eval_tools=["lookup_once"],
            scoring_mode="loop_stop",
            max_iterations=4,
            max_repeated_tool_calls=1,
        ),
        ToolLoopEvalCase(
            id="branching-decision",
            system_prompt=(
                "Use choose_route first. Follow only the route it returns. "
                "Do not inspect unrelated branches."
            ),
            prompt=(
                "Call choose_route. It will choose the correct branch. If it returns infra, "
                "call inspect_infra and answer with the infra finding."
            ),
            expected_tool_sequence=["choose_route", "inspect_infra"],
            expected_final_substrings=["infra", "network restart window"],
            eval_tools=["choose_route", "inspect_infra", "inspect_billing"],
            scoring_mode="branch_path",
            max_iterations=5,
            max_repeated_tool_calls=1,
        ),
        ToolLoopEvalCase(
            id="argument-repair",
            system_prompt=(
                "Extract exact tool arguments from the prompt. If a tool needs an identifier, "
                "call it once with the required identifier instead of guessing."
            ),
            prompt=(
                "Fetch ticket NX-42 by calling fetch_ticket with ticket_id NX-42. "
                "Then answer with the ticket owner and priority."
            ),
            expected_tool_sequence=["fetch_ticket"],
            expected_final_substrings=["NX-42", "Mira", "high"],
            eval_tools=["fetch_ticket"],
            max_iterations=4,
            required_tool_arguments={"fetch_ticket": {"ticket_id": "NX-42"}},
        ),
        ToolLoopEvalCase(
            id="parallel-fact-gathering",
            system_prompt=(
                "Gather all requested independent facts. The order does not matter, but each "
                "source should be called once and the final answer must include every fact."
            ),
            prompt=(
                "Call gather_fact_a, gather_fact_b, gather_fact_c, and gather_fact_d. "
                "Then answer with all four fact tokens."
            ),
            expected_tool_sequence=["gather_fact_a", "gather_fact_b", "gather_fact_c", "gather_fact_d"],
            expected_final_substrings=["redwood", "basalt", "aurora", "delta"],
            eval_tools=["gather_fact_a", "gather_fact_b", "gather_fact_c", "gather_fact_d"],
            scoring_mode="set_membership",
            max_iterations=6,
            max_repeated_tool_calls=1,
        ),
        ToolLoopEvalCase(
            id="subagent-delegation-simulation",
            system_prompt=(
                "Treat each helper as a separate agent node. Call each required helper once, "
                "preserve its role-specific result, and synthesize the final answer."
            ),
            prompt=(
                "Ask the planner, executor, reviewer, and verifier helpers for their outputs. "
                "Then combine their role-specific findings in one final answer."
            ),
            expected_tool_sequence=["ask_planner", "ask_executor", "ask_reviewer", "ask_verifier"],
            expected_final_substrings=["sequence tasks", "patch ready", "risk is low", "checks pass"],
            eval_tools=["ask_planner", "ask_executor", "ask_reviewer", "ask_verifier"],
            scoring_mode="set_membership",
            max_iterations=6,
            max_repeated_tool_calls=1,
        ),
        ToolLoopEvalCase(
            id="technical-design-doc-draft",
            category="real_world",
            system_prompt=(
                "You are drafting a concise technical design document from deterministic project sources. "
                "Use only relevant sources, call each relevant source at most once, avoid unrelated context, "
                "and include the required design sections in the final answer."
            ),
            prompt=(
                "Create a short technical design doc for adding durable tool-loop eval history. "
                "Inspect the design requirements, existing API contract, persistence constraints, "
                "frontend requirements, and rollout risks. Do not inspect unrelated context."
            ),
            expected_tool_sequence=[
                "read_design_requirements",
                "inspect_existing_api_contract",
                "inspect_persistence_constraints",
                "inspect_frontend_requirements",
                "read_rollout_risks",
            ],
            expected_final_substrings=[
                "Overview",
                "Goals",
                "Architecture",
                "Persistence",
                "Frontend",
                "Risk",
                "durable",
                "eval history",
                "controller",
                "node run",
                "benchmark",
                "grouped real-world scenarios",
                "schema churn",
            ],
            request_defaults={"max_tokens": 1200},
            eval_tools=[
                "read_design_requirements",
                "inspect_existing_api_contract",
                "inspect_persistence_constraints",
                "inspect_frontend_requirements",
                "read_rollout_risks",
                "lookup_unrelated_context",
            ],
            scoring_mode="set_membership",
            max_iterations=8,
            max_repeated_tool_calls=1,
        ),
        ToolLoopEvalCase(
            id="collaborative-notes-app-design",
            category="real_world",
            system_prompt=(
                "You are drafting a practical app design from deterministic project sources. "
                "Use only relevant sources, call each relevant source at most once, avoid registration/auth scope creep, "
                "and preserve the requested user_id and note_id relationship constraints."
            ),
            prompt=(
                "Create a concise technical design for a collaborative notes app. "
                "User account information and registration are not needed, but future relationships from notes to users "
                "must use user_id and note_id respectively. Inspect the product brief, data model constraints, "
                "API requirements, frontend requirements, and delivery risks. Do not inspect registration auth requirements."
            ),
            expected_tool_sequence=[
                "read_notes_app_product_brief",
                "inspect_notes_app_data_model",
                "inspect_notes_app_api_requirements",
                "inspect_notes_app_frontend_requirements",
                "read_notes_app_delivery_risks",
            ],
            expected_final_substrings=[
                "Overview",
                "Data model",
                "API",
                "Frontend",
                "Collaboration",
                "Risk",
                "notes",
                "collaborators",
                "user_id",
                "note_id",
                "registration",
                "auth scope creep",
            ],
            request_defaults={"max_tokens": 1200},
            eval_tools=[
                "read_notes_app_product_brief",
                "inspect_notes_app_data_model",
                "inspect_notes_app_api_requirements",
                "inspect_notes_app_frontend_requirements",
                "read_notes_app_delivery_risks",
                "inspect_registration_auth_requirements",
            ],
            scoring_mode="set_membership",
            max_iterations=8,
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
        if name == "choose_route":
            return {
                "ok": True,
                "source": "router",
                "route": "infra",
                "instruction": "Use inspect_infra next. Do not inspect billing.",
            }
        if name == "inspect_infra":
            return {
                "ok": True,
                "source": "infra",
                "fact": "infra route found the network restart window",
            }
        if name == "inspect_billing":
            return {
                "ok": True,
                "source": "billing",
                "fact": "billing route found invoice drift",
            }
        if name == "fetch_ticket":
            if arguments.get("ticket_id") != "NX-42":
                return {
                    "ok": False,
                    "source": "tickets",
                    "error": "fetch_ticket requires ticket_id NX-42",
                }
            return {
                "ok": True,
                "source": "tickets",
                "ticket_id": "NX-42",
                "owner": "Mira",
                "priority": "high",
            }
        if name.startswith("gather_fact_"):
            return _fact_gathering_result(name)
        if name == "ask_planner":
            return {"ok": True, "role": "planner", "finding": "sequence tasks before execution"}
        if name == "ask_executor":
            return {"ok": True, "role": "executor", "finding": "patch ready"}
        if name == "ask_reviewer":
            return {"ok": True, "role": "reviewer", "finding": "risk is low"}
        if name == "ask_verifier":
            return {"ok": True, "role": "verifier", "finding": "checks pass"}
        if name == "read_design_requirements":
            return {
                "ok": True,
                "source": "requirements",
                "problem": "durable eval history",
                "requirement": "Persist comparable run summaries and case details for model comparisons.",
            }
        if name == "inspect_existing_api_contract":
            return {
                "ok": True,
                "source": "api",
                "contract": "Use controller-triggered node runs and preserve existing latest and history endpoints.",
            }
        if name == "inspect_persistence_constraints":
            return {
                "ok": True,
                "source": "persistence",
                "constraint": "Store results in the benchmark database without changing existing run payloads unnecessarily.",
            }
        if name == "inspect_frontend_requirements":
            return {
                "ok": True,
                "source": "frontend",
                "requirement": "Expose grouped real-world scenarios alongside synthetic presets in the run form.",
            }
        if name == "read_rollout_risks":
            return {
                "ok": True,
                "source": "risks",
                "risk": "avoid schema churn and keep old persisted runs readable.",
            }
        if name == "lookup_unrelated_context":
            return {
                "ok": True,
                "source": "unrelated",
                "fact": "unrelated billing migration context should not be used for this design.",
            }
        if name == "read_notes_app_product_brief":
            return {
                "ok": True,
                "source": "product_brief",
                "brief": (
                    "Create a collaborative notes app. User account information and registration are not needed. "
                    "Design for future relationships with user_id and note_id."
                ),
            }
        if name == "inspect_notes_app_data_model":
            return {
                "ok": True,
                "source": "data_model",
                "entities": ["notes", "users", "note_collaborators"],
                "constraint": "Use user_id and note_id as relationship keys for note ownership and collaborators.",
            }
        if name == "inspect_notes_app_api_requirements":
            return {
                "ok": True,
                "source": "api",
                "requirements": [
                    "CRUD notes",
                    "list notes by user_id",
                    "share a note with collaborators",
                    "list collaborators by note_id",
                ],
            }
        if name == "inspect_notes_app_frontend_requirements":
            return {
                "ok": True,
                "source": "frontend",
                "requirements": ["notes list", "note editor", "collaborator panel", "empty and unsaved states"],
            }
        if name == "read_notes_app_delivery_risks":
            return {
                "ok": True,
                "source": "risks",
                "risks": [
                    "avoid auth scope creep",
                    "preserve future user relationships",
                    "handle simple concurrent edit conflicts",
                ],
            }
        if name == "inspect_registration_auth_requirements":
            return {
                "ok": True,
                "source": "registration_auth",
                "fact": "registration and account-management requirements are intentionally out of scope for this app design.",
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
                "parameters": _EVAL_TOOL_PARAMETERS.get(
                    name,
                    {"type": "object", "properties": {}, "additionalProperties": False},
                ),
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


_GATHER_FACTS = {
    "gather_fact_a": "redwood",
    "gather_fact_b": "basalt",
    "gather_fact_c": "aurora",
    "gather_fact_d": "delta",
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
    "choose_route": "Choose the deterministic branch for the branching eval. Always call this before branch inspection.",
    "inspect_infra": "Inspect the infra branch selected by choose_route and return the network restart window fact.",
    "inspect_billing": "Inspect the billing branch. This branch is intentionally not selected by choose_route.",
    "fetch_ticket": "Fetch a deterministic ticket by ticket_id. The argument must be ticket_id NX-42.",
    "gather_fact_a": "Gather independent fact A and return the redwood token.",
    "gather_fact_b": "Gather independent fact B and return the basalt token.",
    "gather_fact_c": "Gather independent fact C and return the aurora token.",
    "gather_fact_d": "Gather independent fact D and return the delta token.",
    "ask_planner": "Ask the planner helper for its role-specific output.",
    "ask_executor": "Ask the executor helper for its role-specific output.",
    "ask_reviewer": "Ask the reviewer helper for its role-specific output.",
    "ask_verifier": "Ask the verifier helper for its role-specific output.",
    "read_design_requirements": "Read the product requirements for the technical design document scenario.",
    "inspect_existing_api_contract": "Inspect the existing API contract relevant to durable tool-loop eval history.",
    "inspect_persistence_constraints": "Inspect persistence constraints for storing comparable eval history.",
    "inspect_frontend_requirements": "Inspect frontend requirements for exposing real-world eval scenarios.",
    "read_rollout_risks": "Read rollout risks that the technical design must address.",
    "lookup_unrelated_context": "Look up unrelated project context. This is intentionally irrelevant to the design-doc scenario.",
    "read_notes_app_product_brief": "Read the product brief for the collaborative notes app design scenario.",
    "inspect_notes_app_data_model": "Inspect data model constraints for notes, users, collaborators, user_id, and note_id.",
    "inspect_notes_app_api_requirements": "Inspect API requirements for note CRUD and collaboration operations.",
    "inspect_notes_app_frontend_requirements": "Inspect frontend requirements for the notes list, editor, and collaborator UI.",
    "read_notes_app_delivery_risks": "Read delivery risks for the collaborative notes app design.",
    "inspect_registration_auth_requirements": "Inspect registration and account auth requirements. This is intentionally out of scope for the notes app scenario.",
}


_EVAL_TOOL_PARAMETERS = {
    "fetch_ticket": {
        "type": "object",
        "properties": {
            "ticket_id": {
                "type": "string",
                "description": "Ticket identifier. Use NX-42 for this eval.",
            }
        },
        "required": ["ticket_id"],
        "additionalProperties": False,
    },
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


def _fact_gathering_result(name: str) -> dict[str, Any]:
    fact = _GATHER_FACTS.get(name)
    if fact is None:
        return {"ok": False, "error": f"Unknown eval fact tool {name!r}"}
    return {
        "ok": True,
        "source": name,
        "fact": fact,
        "summary": f"{name} returned independent fact token {fact}.",
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


def _sequence_matches(observed: list[str], expected: list[str], scoring_mode: str = "strict_sequence") -> bool:
    if not expected:
        return not observed
    if scoring_mode == "set_membership":
        return sorted(observed) == sorted(expected)
    return observed == expected


def _required_arguments_match(
    tool_results: list[dict[str, Any]],
    required_arguments: dict[str, dict[str, Any]],
) -> bool:
    for tool_name, expected_arguments in required_arguments.items():
        matching_results = [result for result in tool_results if result.get("tool_name") == tool_name]
        if not matching_results:
            return False
        if not any(_arguments_include(result.get("arguments"), expected_arguments) for result in matching_results):
            return False
    return True


def _arguments_include(arguments: Any, expected_arguments: dict[str, Any]) -> bool:
    if not isinstance(arguments, dict):
        return False
    return all(arguments.get(key) == value for key, value in expected_arguments.items())


def _contains_all(text: str, expected_substrings: list[str]) -> bool:
    normalized = _normalize_match_text(text)
    return all(_normalize_match_text(substring) in normalized for substring in expected_substrings)


def _normalize_match_text(text: str) -> str:
    return (
        text.lower()
        .replace("\u2010", "-")
        .replace("\u2011", "-")
        .replace("\u2012", "-")
        .replace("\u2013", "-")
        .replace("\u2014", "-")
        .replace("\u2212", "-")
    )


def _score(checks: dict[str, bool]) -> float:
    if not checks:
        return 0.0
    passed = sum(1 for value in checks.values() if value)
    return round(passed / len(checks), 4)


def _max_repeated_calls(observed: list[str]) -> int:
    counts = {name: observed.count(name) for name in set(observed)}
    return max(counts.values(), default=0)
