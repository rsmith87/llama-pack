from __future__ import annotations

import pytest

from llama_manager.core.agent_tools.evals import ToolLoopEvalCase, ToolLoopEvaluator, default_tool_loop_eval_cases
from llama_manager.core.config import load_config


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
    assert result["checks"] == {
        "completed": True,
        "expected_tool_sequence": True,
        "expected_final_substrings": True,
        "no_tool_errors": True,
    }
    assert result["final_answer"] == "Combined answer: alpha status and beta details."


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
