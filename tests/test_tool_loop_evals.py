from __future__ import annotations

import pytest

from llama_pack.core.agent_tools.evals import ToolLoopEvalCase, ToolLoopEvaluator, default_tool_loop_eval_cases
from llama_pack.core.agent_tools.tracing import RuntimeTraceRecorder
from llama_pack.core.config import load_config


def _config(tmp_path):
    status = tmp_path / "status.txt"
    details = tmp_path / "details.txt"
    status.write_text("alpha status", encoding="utf-8")
    details.write_text("beta details", encoding="utf-8")
    return load_config(
        {
            "mode": "agent",
            "log_dir": str(tmp_path),
            "agent_tools": {
                "enabled": True,
                "max_iterations": 4,
                "safe_roots": [str(tmp_path)],
                "tools": {
                    "read_status": {
                        "type": "file_read",
                        "description": "Read status.",
                        "path": str(status),
                    },
                    "read_details": {
                        "type": "file_read",
                        "description": "Read details.",
                        "path": str(details),
                    },
                },
            },
        }
    )


class ScriptedToolProxy:
    def __init__(self, tool_names: list[str] | list[tuple[str, str]], final_answer: str):
        self.tool_calls = [
            item if isinstance(item, tuple) else (item, "{}")
            for item in tool_names
        ]
        self.final_answer = final_answer
        self.payloads = []

    async def chat_with_meta(self, model_name, payload):
        self.payloads.append(payload)
        index = len(self.payloads) - 1
        if index < len(self.tool_calls):
            name, arguments = self.tool_calls[index]
            return {
                "choices": [
                    {
                        "message": {
                            "role": "assistant",
                            "content": "",
                            "tool_calls": [
                                    {
                                        "id": f"call-{index}",
                                        "type": "function",
                                        "function": {"name": name, "arguments": arguments},
                                    }
                                ],
                            }
                    }
                ]
            }, {"route": "local"}
        return {
            "choices": [
                {
                    "message": {
                        "role": "assistant",
                        "content": self.final_answer,
                    }
                }
            ]
        }, {"route": "local"}


def test_default_tool_loop_eval_cases_include_harder_presets():
    cases = {case.id: case for case in default_tool_loop_eval_cases()}

    assert [
        "two-step-tool-synthesis",
        "avoid-unneeded-tools",
        "linear-4-step-synthesis",
        "linear-8-step-synthesis",
        "tool-error-recovery",
        "avoid-loop-trap",
        "branching-decision",
        "argument-repair",
        "parallel-fact-gathering",
        "subagent-delegation-simulation",
        "technical-design-doc-draft",
        "collaborative-notes-app-design",
    ] == list(cases)
    assert cases["linear-8-step-synthesis"].max_iterations >= 9
    assert cases["tool-error-recovery"].expected_error_tools == ["unstable_primary"]
    assert cases["avoid-loop-trap"].max_repeated_tool_calls == 1
    assert cases["branching-decision"].scoring_mode == "branch_path"
    assert cases["argument-repair"].required_tool_arguments == {"fetch_ticket": {"ticket_id": "NX-42"}}
    assert cases["parallel-fact-gathering"].scoring_mode == "set_membership"
    assert cases["subagent-delegation-simulation"].scoring_mode == "set_membership"
    assert cases["technical-design-doc-draft"].category == "real_world"
    assert cases["technical-design-doc-draft"].scoring_mode == "set_membership"
    assert cases["technical-design-doc-draft"].max_repeated_tool_calls == 1
    assert cases["technical-design-doc-draft"].request_defaults["max_tokens"] >= 1000
    assert "lookup_unrelated_context" in cases["technical-design-doc-draft"].eval_tools
    assert "lookup_unrelated_context" not in cases["technical-design-doc-draft"].expected_tool_sequence
    assert cases["collaborative-notes-app-design"].category == "real_world"
    assert cases["collaborative-notes-app-design"].scoring_mode == "set_membership"
    assert cases["collaborative-notes-app-design"].max_repeated_tool_calls == 1
    assert cases["collaborative-notes-app-design"].request_defaults["max_tokens"] >= 1000


@pytest.mark.asyncio
async def test_tool_loop_eval_scores_expected_tool_order_and_final_answer(tmp_path):
    class Proxy:
        def __init__(self):
            self.calls = []

        async def chat_with_meta(self, model_name, payload):
            self.calls.append(payload)
            if len(self.calls) == 1:
                return {
                    "choices": [
                        {
                            "message": {
                                "role": "assistant",
                                "content": "",
                                "tool_calls": [
                                    {
                                        "id": "call-1",
                                        "type": "function",
                                        "function": {"name": "read_status", "arguments": "{}"},
                                    }
                                ],
                            }
                        }
                    ]
                }, {"route": "local"}
            if len(self.calls) == 2:
                return {
                    "choices": [
                        {
                            "message": {
                                "role": "assistant",
                                "content": "",
                                "tool_calls": [
                                    {
                                        "id": "call-2",
                                        "type": "function",
                                        "function": {"name": "read_details", "arguments": "{}"},
                                    }
                                ],
                            }
                        }
                    ]
                }, {"route": "local"}
            return {
                "choices": [
                    {
                        "message": {
                            "role": "assistant",
                            "content": "Combined answer: alpha status and beta details.",
                        }
                    }
                ]
            }, {"route": "local"}

    case = ToolLoopEvalCase(
        id="two-step-synthesis",
        prompt="Read status, then details, then combine them.",
        expected_tool_sequence=["read_status", "read_details"],
        expected_final_substrings=["alpha status", "beta details"],
    )

    result = await ToolLoopEvaluator(_config(tmp_path), Proxy()).run_case("gpt-oss-20b", case, request_id="eval-1")

    assert result["case_id"] == "two-step-synthesis"
    assert result["model"] == "gpt-oss-20b"
    assert result["status"] == "passed"
    assert result["score"] == 1.0
    assert result["tool_call_count"] == 2
    assert result["iteration_count"] == 3
    assert result["observed_tool_sequence"] == ["read_status", "read_details"]
    assert result["tool_results"][0]["tool_call_id"] == "call-1"
    assert result["tool_results"][0]["raw_arguments"] == "{}"
    assert result["tool_results"][0]["function"] == {"name": "read_status", "arguments": "{}"}
    assert result["checks"] == {
        "completed": True,
        "expected_tool_sequence": True,
        "expected_final_substrings": True,
        "no_tool_errors": True,
    }
    assert result["final_answer"] == "Combined answer: alpha status and beta details."


@pytest.mark.asyncio
async def test_tool_loop_eval_records_trace_events_for_replay(tmp_path):
    case = ToolLoopEvalCase(
        id="traceable-case",
        prompt="Read status and answer.",
        expected_tool_sequence=["read_status"],
        expected_final_substrings=["alpha status"],
    )
    recorder = RuntimeTraceRecorder(trace_id="eval-trace", source="tool_loop_eval", scope="eval_run")

    result = await ToolLoopEvaluator(_config(tmp_path), ScriptedToolProxy(["read_status"], "alpha status"), trace_recorder=recorder).run_case(
        "gpt-oss-20b",
        case,
        request_id="eval-trace",
    )

    event_types = [event["event_type"] for event in result["trace_events"]]
    assert event_types == [
        "case_started",
        "assistant_turn_started",
        "tool_call_started",
        "tool_call_completed",
        "assistant_turn_started",
        "assistant_message_completed",
        "case_scored",
        "case_completed",
    ]
    assert result["trace_events"][0]["case_id"] == "traceable-case"
    assert result["trace_events"][2]["tool_call_id"] == "call-0"
    assert result["trace_events"][2]["payload"]["arguments"] == {}
    assert result["trace_events"][3]["payload"]["result"]["ok"] is True


@pytest.mark.asyncio
async def test_tool_loop_eval_honors_case_max_iterations_for_long_presets(tmp_path):
    case = next(case for case in default_tool_loop_eval_cases() if case.id == "linear-8-step-synthesis")
    proxy = ScriptedToolProxy(
        case.expected_tool_sequence,
        "Final synthesis: alpha bravo charlie delta echo foxtrot golf hotel.",
    )
    config = _config(tmp_path)
    config.agent_tools.max_iterations = 4

    result = await ToolLoopEvaluator(config, proxy).run_case("gpt-oss-20b", case)

    assert result["status"] == "passed"
    assert result["tool_call_count"] == 8
    assert result["iteration_count"] == 9


@pytest.mark.asyncio
async def test_tool_loop_eval_allows_expected_tool_error_recovery(tmp_path):
    case = next(case for case in default_tool_loop_eval_cases() if case.id == "tool-error-recovery")
    proxy = ScriptedToolProxy(
        ["unstable_primary", "stable_fallback"],
        "Recovered with the fallback channel: amber recovery token.",
    )

    result = await ToolLoopEvaluator(_config(tmp_path), proxy).run_case("gpt-oss-20b", case)

    assert result["status"] == "passed"
    assert result["checks"]["no_tool_errors"] is True
    assert result["tool_results"][0]["ok"] is False
    assert result["tool_results"][0]["expected_error"] is True


@pytest.mark.asyncio
async def test_tool_loop_eval_penalizes_repeated_calls_in_loop_trap(tmp_path):
    case = next(case for case in default_tool_loop_eval_cases() if case.id == "avoid-loop-trap")
    proxy = ScriptedToolProxy(
        ["lookup_once", "lookup_once"],
        "There is no more information, so I will stop with the available stop-token fact.",
    )

    result = await ToolLoopEvaluator(_config(tmp_path), proxy).run_case("gpt-oss-20b", case)

    assert result["status"] == "failed"
    assert result["checks"]["no_repeated_calls"] is False
    assert result["checks"]["completed"] is True


@pytest.mark.asyncio
async def test_tool_loop_eval_accepts_loop_trap_answer_without_synthetic_token(tmp_path):
    case = next(case for case in default_tool_loop_eval_cases() if case.id == "avoid-loop-trap")
    proxy = ScriptedToolProxy(
        ["lookup_once"],
        "No more information is available.",
    )

    result = await ToolLoopEvaluator(_config(tmp_path), proxy).run_case("gpt-oss-20b", case)

    assert result["status"] == "passed"
    assert result["checks"]["expected_final_substrings"] is True
    assert result["checks"]["no_repeated_calls"] is True


@pytest.mark.asyncio
async def test_tool_loop_eval_scores_branching_decision_path(tmp_path):
    case = next(case for case in default_tool_loop_eval_cases() if case.id == "branching-decision")
    proxy = ScriptedToolProxy(
        ["choose_route", "inspect_infra"],
        "The infra route found the network restart window.",
    )

    result = await ToolLoopEvaluator(_config(tmp_path), proxy).run_case("gpt-oss-20b", case)

    assert result["status"] == "passed"
    assert result["observed_tool_sequence"] == ["choose_route", "inspect_infra"]
    assert result["scoring_mode"] == "branch_path"


@pytest.mark.asyncio
async def test_tool_loop_eval_penalizes_wrong_branch(tmp_path):
    case = next(case for case in default_tool_loop_eval_cases() if case.id == "branching-decision")
    proxy = ScriptedToolProxy(
        ["choose_route", "inspect_billing"],
        "The billing route found invoice drift.",
    )

    result = await ToolLoopEvaluator(_config(tmp_path), proxy).run_case("gpt-oss-20b", case)

    assert result["status"] == "failed"
    assert result["checks"]["expected_tool_sequence"] is False
    assert result["missing_expected_tools"] == ["inspect_infra"]
    assert result["unexpected_tools"] == ["inspect_billing"]


@pytest.mark.asyncio
async def test_tool_loop_eval_scores_required_tool_arguments(tmp_path):
    case = next(case for case in default_tool_loop_eval_cases() if case.id == "argument-repair")
    proxy = ScriptedToolProxy(
        [("fetch_ticket", '{"ticket_id":"NX-42"}')],
        "Ticket NX-42 owner is Mira and priority is high.",
    )

    result = await ToolLoopEvaluator(_config(tmp_path), proxy).run_case("gpt-oss-20b", case)

    assert result["status"] == "passed"
    assert result["checks"]["expected_tool_arguments"] is True
    assert result["tool_results"][0]["arguments"] == {"ticket_id": "NX-42"}


@pytest.mark.asyncio
async def test_tool_loop_eval_penalizes_missing_required_tool_arguments(tmp_path):
    case = next(case for case in default_tool_loop_eval_cases() if case.id == "argument-repair")
    proxy = ScriptedToolProxy(
        [("fetch_ticket", "{}")],
        "Ticket lookup failed.",
    )

    result = await ToolLoopEvaluator(_config(tmp_path), proxy).run_case("gpt-oss-20b", case)

    assert result["status"] == "failed"
    assert result["checks"]["expected_tool_arguments"] is False
    assert result["checks"]["no_tool_errors"] is False


@pytest.mark.asyncio
async def test_tool_loop_eval_allows_parallel_fact_order(tmp_path):
    case = next(case for case in default_tool_loop_eval_cases() if case.id == "parallel-fact-gathering")
    proxy = ScriptedToolProxy(
        ["gather_fact_c", "gather_fact_a", "gather_fact_d", "gather_fact_b"],
        "Facts gathered: redwood, basalt, aurora, delta.",
    )

    result = await ToolLoopEvaluator(_config(tmp_path), proxy).run_case("gpt-oss-20b", case)

    assert result["status"] == "passed"
    assert result["checks"]["expected_tool_sequence"] is True
    assert result["scoring_mode"] == "set_membership"


@pytest.mark.asyncio
async def test_tool_loop_eval_scores_subagent_delegation_simulation(tmp_path):
    case = next(case for case in default_tool_loop_eval_cases() if case.id == "subagent-delegation-simulation")
    proxy = ScriptedToolProxy(
        ["ask_planner", "ask_executor", "ask_reviewer", "ask_verifier"],
        "Plan: sequence tasks. Executor: patch ready. Reviewer: risk is low. Verifier: checks pass.",
    )

    result = await ToolLoopEvaluator(_config(tmp_path), proxy).run_case("gpt-oss-20b", case)

    assert result["status"] == "passed"
    assert result["checks"]["expected_tool_sequence"] is True
    assert result["scoring_mode"] == "set_membership"


@pytest.mark.asyncio
async def test_tool_loop_eval_scores_real_world_design_doc_with_unordered_evidence(tmp_path):
    case = next(case for case in default_tool_loop_eval_cases() if case.id == "technical-design-doc-draft")
    proxy = ScriptedToolProxy(
        [
            "inspect_frontend_requirements",
            "read_design_requirements",
            "inspect_persistence_constraints",
            "read_rollout_risks",
            "inspect_existing_api_contract",
        ],
        (
            "Overview: durable eval history. Goals: persist comparable run summaries. "
            "Architecture: controller-triggered node runs. Persistence: benchmark database. "
            "Frontend: grouped real-world scenarios. Risks: avoid schema churn."
        ),
    )

    result = await ToolLoopEvaluator(_config(tmp_path), proxy).run_case("gpt-oss-20b", case)

    assert result["status"] == "passed"
    assert result["case_category"] == "real_world"
    assert result["checks"]["expected_tool_sequence"] is True
    assert result["checks"]["no_repeated_calls"] is True
    assert result["scoring_mode"] == "set_membership"


@pytest.mark.asyncio
async def test_tool_loop_eval_scores_real_world_design_doc_sectioned_answer(tmp_path):
    case = next(case for case in default_tool_loop_eval_cases() if case.id == "technical-design-doc-draft")
    proxy = ScriptedToolProxy(
        [
            "read_design_requirements",
            "inspect_existing_api_contract",
            "inspect_persistence_constraints",
            "inspect_frontend_requirements",
            "read_rollout_risks",
        ],
        (
            "# Technical Design Document - Durable Tool-Loop Eval History\n"
            "## Overview\n"
            "Users need durable run history for model comparisons.\n"
            "## Goals\n"
            "Persist comparable run summaries and case details.\n"
            "## Architecture\n"
            "The controller triggers node runs through the existing API contract.\n"
            "## Persistence\n"
            "Store results in the benchmark DB without changing existing run payloads unnecessarily.\n"
            "## Frontend\n"
            "Expose grouped real-world scenarios alongside synthetic presets.\n"
            "## Risks\n"
            "Schema churn and backward compatibility are the main rollout risks.\n"
        ),
    )

    result = await ToolLoopEvaluator(_config(tmp_path), proxy).run_case("gpt-oss-20b", case)

    assert result["status"] == "passed"
    assert result["checks"]["expected_final_substrings"] is True


@pytest.mark.asyncio
async def test_tool_loop_eval_scores_real_world_design_doc_typographic_answer(tmp_path):
    case = next(case for case in default_tool_loop_eval_cases() if case.id == "technical-design-doc-draft")
    proxy = ScriptedToolProxy(
        [
            "read_design_requirements",
            "inspect_existing_api_contract",
            "inspect_persistence_constraints",
            "inspect_frontend_requirements",
            "read_rollout_risks",
        ],
        (
            "**Durable Tool‑Loop Eval History - Technical Design Document**\n"
            "| **1. Overview** | Persist comparable run summaries for future model comparisons. |\n"
            "| **2. Goals** | Keep the API contract stable and expose grouped Real‑World Scenarios. |\n"
            "| **3. Architecture** | On each controller-triggered node run, record case details. |\n"
            "| **5. Persistence Constraints** | Store results in the benchmark database. |\n"
            "| **6. Frontend Requirements** | Add real-world scenarios alongside synthetic presets. |\n"
            "| **8. Risk Mitigation** | Schema churn and backward compatibility are rollout risks. |\n"
        ),
    )

    result = await ToolLoopEvaluator(_config(tmp_path), proxy).run_case("gpt-oss-20b", case)

    assert result["status"] == "passed"
    assert result["checks"]["expected_final_substrings"] is True


@pytest.mark.asyncio
async def test_tool_loop_eval_penalizes_real_world_design_doc_irrelevant_tool_use(tmp_path):
    case = next(case for case in default_tool_loop_eval_cases() if case.id == "technical-design-doc-draft")
    proxy = ScriptedToolProxy(
        [
            "read_design_requirements",
            "inspect_existing_api_contract",
            "inspect_persistence_constraints",
            "inspect_frontend_requirements",
            "read_rollout_risks",
            "lookup_unrelated_context",
        ],
        (
            "Overview: durable eval history. Goals: persist comparable run summaries. "
            "Architecture: controller-triggered node runs. Persistence: benchmark database. "
            "Frontend: grouped real-world scenarios. Risks: avoid schema churn."
        ),
    )

    result = await ToolLoopEvaluator(_config(tmp_path), proxy).run_case("gpt-oss-20b", case)

    assert result["status"] == "failed"
    assert result["checks"]["expected_tool_sequence"] is False


@pytest.mark.asyncio
async def test_tool_loop_eval_scores_collaborative_notes_app_design(tmp_path):
    case = next(case for case in default_tool_loop_eval_cases() if case.id == "collaborative-notes-app-design")
    proxy = ScriptedToolProxy(
        [
            "read_notes_app_product_brief",
            "inspect_notes_app_data_model",
            "inspect_notes_app_api_requirements",
            "inspect_notes_app_frontend_requirements",
            "read_notes_app_delivery_risks",
        ],
        (
            "Overview: collaborative notes app without registration. "
            "Data model: notes, users, note_collaborators, user_id, note_id. "
            "API: CRUD notes, share collaborators, list by user. "
            "Frontend: notes list, editor, collaborator panel. "
            "Collaboration: note sharing and simple conflict handling. "
            "Risks: avoid auth scope creep and preserve future user relationships."
        ),
    )

    result = await ToolLoopEvaluator(_config(tmp_path), proxy).run_case("gpt-oss-20b", case)

    assert result["status"] == "passed"
    assert result["case_category"] == "real_world"
    assert result["checks"]["expected_tool_sequence"] is True
    assert result["checks"]["expected_final_substrings"] is True
    assert result["checks"]["no_repeated_calls"] is True


@pytest.mark.asyncio
async def test_tool_loop_eval_penalizes_collaborative_notes_app_unrelated_auth_scope(tmp_path):
    case = next(case for case in default_tool_loop_eval_cases() if case.id == "collaborative-notes-app-design")
    proxy = ScriptedToolProxy(
        [
            "read_notes_app_product_brief",
            "inspect_notes_app_data_model",
            "inspect_notes_app_api_requirements",
            "inspect_notes_app_frontend_requirements",
            "read_notes_app_delivery_risks",
            "inspect_registration_auth_requirements",
        ],
        (
            "Overview: collaborative notes app without registration. "
            "Data model: notes, users, user_id, note_id. "
            "API: CRUD notes. Frontend: editor. Collaboration: sharing. Risks: auth scope creep."
        ),
    )

    result = await ToolLoopEvaluator(_config(tmp_path), proxy).run_case("gpt-oss-20b", case)

    assert result["status"] == "failed"
    assert result["checks"]["expected_tool_sequence"] is False


@pytest.mark.asyncio
async def test_tool_loop_eval_forces_agent_runs_to_local_target(tmp_path):
    class Proxy:
        def __init__(self):
            self.payloads = []

        async def chat_with_meta(self, model_name, payload):
            self.payloads.append(payload)
            return {
                "choices": [
                    {
                        "message": {
                            "role": "assistant",
                            "content": "done",
                        }
                    }
                ]
            }, {"route": "local"}

    proxy = Proxy()
    case = ToolLoopEvalCase(
        id="agent-local-target",
        prompt="Answer directly.",
        request_defaults={"target": "node:mac-mini"},
    )

    result = await ToolLoopEvaluator(_config(tmp_path), proxy).run_case("gpt-oss-20b", case)

    assert result["status"] == "passed"
    assert proxy.payloads[0]["target"] == "local"


@pytest.mark.asyncio
async def test_tool_loop_eval_uses_deterministic_eval_tools_instead_of_configured_tools(tmp_path):
    class Proxy:
        def __init__(self):
            self.payloads = []

        async def chat_with_meta(self, model_name, payload):
            self.payloads.append(payload)
            if len(self.payloads) == 1:
                return {
                    "choices": [
                        {
                            "message": {
                                "role": "assistant",
                                "content": "",
                                "tool_calls": [
                                    {
                                        "id": "call-status",
                                        "type": "function",
                                        "function": {"name": "read_status", "arguments": "{}"},
                                    }
                                ],
                            }
                        }
                    ]
                }, {"route": "local"}
            if len(self.payloads) == 2:
                return {
                    "choices": [
                        {
                            "message": {
                                "role": "assistant",
                                "content": "",
                                "tool_calls": [
                                    {
                                        "id": "call-details",
                                        "type": "function",
                                        "function": {"name": "read_details", "arguments": "{}"},
                                    }
                                ],
                            }
                        }
                    ]
                }, {"route": "local"}
            return {
                "choices": [
                    {
                        "message": {
                            "role": "assistant",
                            "content": "Status is green and the next action is the calibration window.",
                        }
                    }
                ]
            }, {"route": "local"}

    config = load_config(
        {
            "mode": "agent",
            "log_dir": str(tmp_path),
            "agent_tools": {
                "enabled": True,
                "tools": {
                    "search_project_code": {
                        "type": "shell",
                        "description": "Search project code.",
                        "command": ["printf", "unused"],
                    }
                },
            },
        }
    )
    proxy = Proxy()

    result = await ToolLoopEvaluator(config, proxy).run_case(
        "gpt-oss-20b",
        default_tool_loop_eval_cases()[0],
    )

    tool_names = [tool["function"]["name"] for tool in proxy.payloads[0]["tools"]]
    assert tool_names == ["read_status", "read_details"]
    assert "search_project_code" not in tool_names
    assert result["status"] == "passed"
    assert result["observed_tool_sequence"] == ["read_status", "read_details"]


@pytest.mark.asyncio
async def test_tool_loop_eval_records_max_iteration_failures(tmp_path):
    class Proxy:
        async def chat_with_meta(self, model_name, payload):
            return {
                "choices": [
                    {
                        "message": {
                            "role": "assistant",
                            "content": "",
                            "tool_calls": [
                                {
                                    "id": "call-loop",
                                    "type": "function",
                                    "function": {"name": "read_status", "arguments": "{}"},
                                }
                            ],
                        }
                    }
                ]
            }, {"route": "local"}

    config = _config(tmp_path)
    config.agent_tools.max_iterations = 2
    case = ToolLoopEvalCase(
        id="runaway-loop",
        prompt="Keep checking until done.",
        expected_tool_sequence=["read_status"],
    )

    result = await ToolLoopEvaluator(config, Proxy()).run_case("gpt-oss-20b", case, request_id="eval-2")

    assert result["status"] == "failed"
    assert result["checks"]["completed"] is False
    assert result["error"] == "agent tool loop reached max_iterations before final assistant response"
    assert result["tool_call_count"] == 2
    assert result["observed_tool_sequence"] == ["read_status", "read_status"]
    assert result["score"] < 1.0


@pytest.mark.asyncio
async def test_tool_loop_eval_suite_returns_app_ready_summary(tmp_path):
    class Proxy:
        async def chat_with_meta(self, model_name, payload):
            return {
                "choices": [
                    {
                        "message": {
                            "role": "assistant",
                            "content": "alpha status",
                            "tool_calls": [],
                        }
                    }
                ]
            }, {"route": "local"}

    cases = [
        ToolLoopEvalCase(id="final-only", prompt="Answer directly.", expected_final_substrings=["alpha"]),
        ToolLoopEvalCase(id="missing-detail", prompt="Answer directly.", expected_final_substrings=["beta"]),
    ]

    suite = await ToolLoopEvaluator(_config(tmp_path), Proxy()).run_suite("gpt-oss-20b", cases)

    assert suite["model"] == "gpt-oss-20b"
    assert suite["case_count"] == 2
    assert suite["passed_count"] == 1
    assert suite["failed_count"] == 1
    assert suite["average_score"] == 0.875
    assert [case["case_id"] for case in suite["cases"]] == ["final-only", "missing-detail"]
    assert suite["status"] == "failed"
