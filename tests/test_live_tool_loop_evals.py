from __future__ import annotations

import json

import httpx
import pytest

from llama_pack.core.agent_tools.live_evals import LiveToolLoopEvaluator, default_live_tool_loop_scenarios
from llama_pack.core.config import load_config


class ScriptedLiveProxy:
    def __init__(self, tool_calls: list[tuple[str, dict]], final_answer: str = "Created notes app design."):
        self.tool_calls = tool_calls
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
                                    "id": f"live-call-{index + 1}",
                                    "type": "function",
                                    "function": {"name": name, "arguments": json.dumps(arguments)},
                                }
                            ],
                        }
                    }
                ]
            }, {"route": "local"}
        return {"choices": [{"message": {"role": "assistant", "content": self.final_answer}}]}, {"route": "local"}


def _config(tmp_path):
    return load_config({"mode": "agent", "log_dir": str(tmp_path), "agent_tools": {"enabled": True}})


def test_live_collaborative_notes_design_instructs_required_workspace_search():
    scenario = default_live_tool_loop_scenarios()[0]

    assert "search_workspace" in scenario.prompt
    assert "user_id" in scenario.prompt
    assert "before writing" in scenario.prompt.lower()


def test_default_live_tool_loop_scenarios_include_coding_agent_presets():
    scenarios = {scenario.id: scenario for scenario in default_live_tool_loop_scenarios()}

    expected_ids = {
        "live-collaborative-notes-design",
        "live-ci-failure-triage",
        "live-config-migration-plan",
        "live-targeted-bugfix-plan",
        "live-pr-review-findings",
    }

    assert expected_ids.issubset(scenarios)
    assert scenarios["live-ci-failure-triage"].expected_artifacts == ["docs/ci-triage.md"]
    assert scenarios["live-ci-failure-triage"].max_repeated_tool_calls == 1
    assert "write_ci_triage_report" in scenarios["live-ci-failure-triage"].expected_tool_sequence


@pytest.mark.asyncio
async def test_live_collaborative_notes_design_uses_real_workspace_tools(tmp_path):
    scenario = default_live_tool_loop_scenarios()[0]
    design = (
        "## Overview\nCollaborative notes app with no registration scope.\n"
        "## Data model\nnotes, users, note_collaborators use user_id and note_id for collaborators.\n"
        "## API\nCRUD notes, share collaborators, list notes by user_id.\n"
        "## Frontend\nNotes list, editor, collaborator panel.\n"
        "## Collaboration\nShare notes and handle simple conflicts.\n"
        "## Risk\nAvoid auth scope creep while preserving future relationships.\n"
    )
    proxy = ScriptedLiveProxy(
        [
            ("list_workspace", {}),
            ("read_workspace_file", {"path": "README.md"}),
            ("search_workspace", {"query": "user_id"}),
            ("write_notes_app_design", {"content": design}),
        ]
    )

    result = await LiveToolLoopEvaluator(_config(tmp_path), proxy).run_case("gpt-oss-20b", scenario)

    assert result["status"] == "passed"
    assert result["case_category"] == "live_workspace"
    assert result["observed_tool_sequence"] == [
        "list_workspace",
        "read_workspace_file",
        "search_workspace",
        "write_notes_app_design",
    ]
    assert result["checks"]["expected_artifacts"] is True
    assert result["checks"]["expected_artifact_substrings"] is True
    assert result["checks"]["no_forbidden_artifact_substrings"] is True
    assert result["tool_results"][1]["result"]["content"].startswith("# Collaborative Notes App")
    assert result["tool_results"][3]["result"]["ok"] is True
    assert result["artifacts"][0]["path"] == "docs/notes-app-design.md"
    assert "user_id" in result["artifacts"][0]["content"]


@pytest.mark.asyncio
async def test_live_collaborative_notes_design_penalizes_forbidden_auth_artifact_content(tmp_path):
    scenario = default_live_tool_loop_scenarios()[0]
    proxy = ScriptedLiveProxy(
        [
            ("list_workspace", {}),
            ("read_workspace_file", {"path": "README.md"}),
            ("search_workspace", {"query": "user_id"}),
            (
                "write_notes_app_design",
                {
                    "content": (
                        "Overview Data model API Frontend Collaboration Risk notes collaborators user_id note_id registration "
                        "Add a password login form and signup flow."
                    )
                },
            ),
        ]
    )

    result = await LiveToolLoopEvaluator(_config(tmp_path), proxy).run_case("gpt-oss-20b", scenario)

    assert result["status"] == "failed"
    assert result["checks"]["no_forbidden_artifact_substrings"] is False
    assert result["forbidden_artifact_substrings_found"] == {
        "docs/notes-app-design.md": ["password", "login form", "signup"]
    }


@pytest.mark.asyncio
async def test_live_collaborative_notes_design_allows_negated_password_language(tmp_path):
    scenario = default_live_tool_loop_scenarios()[0]
    proxy = ScriptedLiveProxy(
        [
            ("list_workspace", {}),
            ("read_workspace_file", {"path": "README.md"}),
            ("search_workspace", {"query": "user_id"}),
            (
                "write_notes_app_design",
                {
                    "content": (
                        "Overview Data model API Frontend Collaboration Risk notes collaborators user_id note_id registration "
                        "The users table stores minimal profile fields and no password."
                    )
                },
            ),
        ]
    )

    result = await LiveToolLoopEvaluator(_config(tmp_path), proxy).run_case("gpt-oss-20b", scenario)

    assert result["checks"]["no_forbidden_artifact_substrings"] is True


@pytest.mark.asyncio
async def test_live_config_migration_allows_negated_stale_field_language(tmp_path):
    scenario = next(scenario for scenario in default_live_tool_loop_scenarios() if scenario.id == "live-config-migration-plan")
    plan = (
        "Current state Migration steps Compatibility Verification "
        "controller_db_url auth_db_url agent_tools "
        "uv run pytest tests/test_persistence_db_infra.py tests/test_alembic_config.py -v "
        "Ensure legacy_model_path is not present in the final configuration."
    )
    proxy = ScriptedLiveProxy(
        [
            ("list_workspace", {}),
            ("search_workspace", {"query": "controller_db_url"}),
            ("read_workspace_file", {"path": "fixtures/migration-task7-existing-config.yaml"}),
            ("read_workspace_file", {"path": "fixtures/migration-task7-config.yaml"}),
            ("read_workspace_file", {"path": "docs/migration-notes.md"}),
            ("write_config_migration_plan", {"content": plan}),
        ],
        final_answer="Migration plan written.",
    )

    result = await LiveToolLoopEvaluator(_config(tmp_path), proxy).run_case("gpt-oss-20b", scenario)

    assert result["checks"]["no_forbidden_artifact_substrings"] is True


@pytest.mark.asyncio
async def test_live_collaborative_notes_design_reports_missing_artifact_substrings(tmp_path):
    scenario = default_live_tool_loop_scenarios()[0]
    proxy = ScriptedLiveProxy(
        [
            ("list_workspace", {}),
            ("read_workspace_file", {"path": "README.md"}),
            ("search_workspace", {"query": "user_id"}),
            (
                "write_notes_app_design",
                {
                    "content": (
                        "Overview Data model API Frontend Collaboration Risk notes collaborators "
                        "user_id"
                    )
                },
            ),
        ]
    )

    result = await LiveToolLoopEvaluator(_config(tmp_path), proxy).run_case("gpt-oss-20b", scenario)

    assert result["status"] == "partial"
    assert result["checks"]["expected_artifact_substrings"] is False
    assert result["missing_artifact_substrings"] == {
        "docs/notes-app-design.md": ["note_id", "registration"]
    }


@pytest.mark.asyncio
async def test_live_collaborative_notes_design_allows_distinct_repeated_tool_reads(tmp_path):
    scenario = default_live_tool_loop_scenarios()[0]
    design = (
        "Overview Data model API Frontend Collaboration Risk notes collaborators user_id note_id registration"
    )
    proxy = ScriptedLiveProxy(
        [
            ("list_workspace", {}),
            ("read_workspace_file", {"path": "README.md"}),
            ("read_workspace_file", {"path": "schema-notes.md"}),
            ("search_workspace", {"query": "user_id"}),
            ("write_notes_app_design", {"content": design}),
        ]
    )

    result = await LiveToolLoopEvaluator(_config(tmp_path), proxy).run_case("gpt-oss-20b", scenario)

    assert result["status"] == "passed"
    assert result["checks"]["expected_tool_sequence"] is True
    assert result["checks"]["no_repeated_calls"] is True


@pytest.mark.asyncio
async def test_live_collaborative_notes_design_reports_missing_expected_tools(tmp_path):
    scenario = default_live_tool_loop_scenarios()[0]
    proxy = ScriptedLiveProxy(
        [
            ("list_workspace", {}),
            ("read_workspace_file", {"path": "README.md"}),
            (
                "write_notes_app_design",
                {
                    "content": (
                        "Overview Data model API Frontend Collaboration Risk notes collaborators "
                        "user_id note_id registration"
                    )
                },
            ),
        ]
    )

    result = await LiveToolLoopEvaluator(_config(tmp_path), proxy).run_case("gpt-oss-20b", scenario)

    assert result["checks"]["expected_tool_sequence"] is False
    assert result["missing_expected_tools"] == ["search_workspace"]
    assert result["unexpected_tools"] == []


@pytest.mark.asyncio
async def test_live_collaborative_notes_design_penalizes_duplicate_identical_tool_calls(tmp_path):
    scenario = default_live_tool_loop_scenarios()[0]
    design = (
        "Overview Data model API Frontend Collaboration Risk notes collaborators user_id note_id registration"
    )
    proxy = ScriptedLiveProxy(
        [
            ("list_workspace", {}),
            ("read_workspace_file", {"path": "README.md"}),
            ("read_workspace_file", {"path": "README.md"}),
            ("search_workspace", {"query": "user_id"}),
            ("write_notes_app_design", {"content": design}),
        ]
    )

    result = await LiveToolLoopEvaluator(_config(tmp_path), proxy).run_case("gpt-oss-20b", scenario)

    assert result["checks"]["no_repeated_calls"] is False


@pytest.mark.asyncio
async def test_live_collaborative_notes_design_returns_failed_case_when_model_call_errors(tmp_path):
    scenario = default_live_tool_loop_scenarios()[0]

    class FailingProxy:
        async def chat_with_meta(self, model_name, payload):
            request = httpx.Request("POST", "http://127.0.0.1:8091/v1/chat/completions")
            response = httpx.Response(500, request=request, text="llama-server failed")
            raise httpx.HTTPStatusError("server error", request=request, response=response)

    result = await LiveToolLoopEvaluator(_config(tmp_path), FailingProxy()).run_case("gpt-oss-20b", scenario)

    assert result["status"] == "failed"
    assert result["score"] == 0.0
    assert result["checks"]["completed"] is False
    assert result["error"] == "model chat request failed with HTTP 500: llama-server failed"


@pytest.mark.asyncio
async def test_live_collaborative_notes_design_stops_on_malformed_tool_arguments(tmp_path):
    scenario = default_live_tool_loop_scenarios()[0]

    class MalformedToolCallProxy:
        def __init__(self):
            self.payloads = []

        async def chat_with_meta(self, model_name, payload):
            self.payloads.append(payload)
            if len(self.payloads) > 1:
                raise AssertionError("malformed tool call should not be sent back into chat history")
            return {
                "choices": [
                    {
                        "message": {
                            "role": "assistant",
                            "content": "",
                            "tool_calls": [
                                {
                                    "id": "bad-json",
                                    "type": "function",
                                    "function": {
                                        "name": "write_notes_app_design",
                                        "arguments": "{\"content\":\"unterminated",
                                    },
                                }
                            ],
                        }
                    }
                ]
            }, {"route": "local"}

    proxy = MalformedToolCallProxy()

    result = await LiveToolLoopEvaluator(_config(tmp_path), proxy).run_case("gpt-oss-20b", scenario)

    assert len(proxy.payloads) == 1
    assert result["status"] == "failed"
    assert result["error"] == "invalid tool arguments for write_notes_app_design"
    assert result["tool_results"][0]["ok"] is False
    assert result["tool_results"][0]["error"].startswith("invalid JSON arguments")


@pytest.mark.asyncio
async def test_live_ci_failure_triage_uses_real_workspace_tools(tmp_path):
    scenario = next(scenario for scenario in default_live_tool_loop_scenarios() if scenario.id == "live-ci-failure-triage")
    report = (
        "## Root cause\n"
        "The failing test is tests/test_api.py::test_create_run_requires_model because "
        "llama_pack/api/routes/runs.py now returns 200 when model is missing.\n"
        "## Minimal fix\n"
        "Restore request validation in llama_pack/api/routes/runs.py for the model field.\n"
        "## Verification\n"
        "Run uv run pytest tests/test_api.py -v after the patch.\n"
    )
    proxy = ScriptedLiveProxy(
        [
            ("list_workspace", {}),
            ("search_workspace", {"query": "test_create_run_requires_model"}),
            ("read_workspace_file", {"path": "logs/ci-failure.log"}),
            ("read_workspace_file", {"path": "llama_pack/api/routes/runs.py"}),
            ("read_workspace_file", {"path": "tests/test_api.py"}),
            ("write_ci_triage_report", {"content": report}),
        ],
        final_answer="Created CI triage report.",
    )

    result = await LiveToolLoopEvaluator(_config(tmp_path), proxy).run_case("gpt-oss-20b", scenario)

    assert result["status"] == "passed"
    assert result["checks"]["expected_tool_sequence"] is True
    assert result["checks"]["expected_artifacts"] is True
    assert result["checks"]["expected_artifact_substrings"] is True
    assert result["artifacts"][0]["path"] == "docs/ci-triage.md"
    assert "test_create_run_requires_model" in result["artifacts"][0]["content"]


@pytest.mark.asyncio
async def test_live_ci_failure_triage_uses_scenario_specific_final_answer_check(tmp_path):
    scenario = next(scenario for scenario in default_live_tool_loop_scenarios() if scenario.id == "live-ci-failure-triage")
    report = (
        "Root cause Minimal fix Verification "
        "tests/test_api.py::test_create_run_requires_model "
        "llama_pack/api/routes/runs.py "
        "uv run pytest tests/test_api.py -v"
    )
    proxy = ScriptedLiveProxy(
        [
            ("list_workspace", {}),
            ("search_workspace", {"query": "test_create_run_requires_model"}),
            ("read_workspace_file", {"path": "logs/ci-failure.log"}),
            ("read_workspace_file", {"path": "llama_pack/api/routes/runs.py"}),
            ("write_ci_triage_report", {"content": report}),
        ],
        final_answer="Triage report written.",
    )

    result = await LiveToolLoopEvaluator(_config(tmp_path), proxy).run_case("gpt-oss-20b", scenario)

    assert result["checks"]["expected_final_substrings"] is True


@pytest.mark.asyncio
async def test_live_tool_loop_suite_reports_partial_when_only_content_precision_misses(tmp_path):
    scenario = next(scenario for scenario in default_live_tool_loop_scenarios() if scenario.id == "live-ci-failure-triage")
    report = (
        "Root cause Minimal fix Verification "
        "tests/test_api.py::test_create_run_requires_model "
        "llama_pack/api/routes/runs.py"
    )
    proxy = ScriptedLiveProxy(
        [
            ("list_workspace", {}),
            ("search_workspace", {"query": "test_create_run_requires_model"}),
            ("read_workspace_file", {"path": "logs/ci-failure.log"}),
            ("read_workspace_file", {"path": "llama_pack/api/routes/runs.py"}),
            ("write_ci_triage_report", {"content": report}),
        ],
        final_answer="Triage report written.",
    )

    suite = await LiveToolLoopEvaluator(_config(tmp_path), proxy).run_suite("gpt-oss-20b", [scenario])

    assert suite["status"] == "partial"
    assert suite["passed_count"] == 0
    assert suite["partial_count"] == 1
    assert suite["failed_count"] == 0
    assert suite["cases"][0]["status"] == "partial"


@pytest.mark.asyncio
async def test_live_tool_loop_reports_partial_when_only_workspace_listing_is_missing(tmp_path):
    scenario = next(scenario for scenario in default_live_tool_loop_scenarios() if scenario.id == "live-targeted-bugfix-plan")
    plan = (
        "Bug Minimal patch Tests Risk parse_retry_after "
        "llama_pack/core/runtime/retry.py tests/test_retry.py"
    )
    proxy = ScriptedLiveProxy(
        [
            ("search_workspace", {"query": "parse_retry_after"}),
            ("read_workspace_file", {"path": "llama_pack/core/runtime/retry.py"}),
            ("read_workspace_file", {"path": "tests/test_retry.py"}),
            ("write_bugfix_plan", {"content": plan}),
        ],
        final_answer="Bugfix plan written.",
    )

    result = await LiveToolLoopEvaluator(_config(tmp_path), proxy).run_case("gpt-oss-20b", scenario)

    assert result["status"] == "partial"
    assert result["missing_expected_tools"] == ["list_workspace"]
    assert result["checks"]["expected_tool_sequence"] is False
