from __future__ import annotations

import json

import httpx
import pytest

from llama_manager.core.agent_tools.live_evals import LiveToolLoopEvaluator, default_live_tool_loop_scenarios
from llama_manager.core.config import load_config


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

    assert result["checks"]["no_repeated_calls"] is True


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
