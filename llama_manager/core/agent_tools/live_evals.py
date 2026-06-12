from __future__ import annotations

from collections import Counter
import json
import tempfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any
from uuid import uuid4

import httpx

from llama_manager.core.agent_tools.executor import ToolExecutor
from llama_manager.core.agent_tools.registry import ToolRegistry
from llama_manager.core.agent_tools.tracing import RuntimeTraceRecorder
from llama_manager.core.config.models import AgentToolDefinitionConfig, AgentToolsConfig, AppConfig


@dataclass(frozen=True)
class LiveToolLoopScenario:
    id: str
    prompt: str
    expected_tool_sequence: list[str]
    expected_artifacts: list[str]
    expected_artifact_substrings: dict[str, list[str]]
    forbidden_artifact_substrings: dict[str, list[str]] = field(default_factory=dict)
    request_defaults: dict[str, Any] = field(default_factory=lambda: {"max_tokens": 1200})
    max_iterations: int = 8
    max_repeated_tool_calls: int = 1


class LiveToolLoopEvaluator:
    def __init__(
        self,
        config: AppConfig,
        proxy: Any,
        executor_factory: Any | None = None,
        trace_recorder: RuntimeTraceRecorder | None = None,
        emit_suite_events: bool = True,
    ) -> None:
        self.config = config
        self.proxy = proxy
        self.executor_factory = executor_factory or ToolExecutor
        self.trace_recorder = trace_recorder
        self.emit_suite_events = emit_suite_events

    async def run_case(self, model_name: str, scenario: LiveToolLoopScenario, request_id: str | None = None) -> dict[str, Any]:
        request_id = request_id or str(uuid4())
        with tempfile.TemporaryDirectory(prefix="neuraxis-live-tool-loop-") as tmpdir:
            workspace = Path(tmpdir)
            _seed_notes_workspace(workspace)
            live_config = _live_notes_config(self.config, workspace, scenario.max_iterations)
            tool_defs = ToolRegistry(live_config.agent_tools).openai_tools()
            executor = self.executor_factory(live_config, trace_recorder=self.trace_recorder)
            messages: list[dict[str, Any]] = [{"role": "user", "content": scenario.prompt}]
            observed_tools: list[str] = []
            tool_results: list[dict[str, Any]] = []
            final_answer = ""
            completed = False
            error = ""
            iteration_count = 0
            self._emit(
                "case_started",
                case_id=scenario.id,
                model=model_name,
                title=f"{scenario.id} started",
                payload={"prompt": scenario.prompt, "expected_tool_sequence": list(scenario.expected_tool_sequence)},
            )

            for _ in range(scenario.max_iterations):
                iteration_count += 1
                self._emit(
                    "assistant_turn_started",
                    case_id=scenario.id,
                    model=model_name,
                    title=f"Assistant turn {iteration_count}",
                    payload={"iteration": iteration_count},
                )
                payload = {
                    "temperature": 0.0,
                    **scenario.request_defaults,
                    "messages": messages,
                    "tools": tool_defs,
                }
                try:
                    response, _meta = await self.proxy.chat_with_meta(model_name, payload)
                except Exception as exc:
                    error = _chat_error_message(exc)
                    break
                message = _assistant_message(response)
                tool_calls = _tool_calls(message)
                if not tool_calls:
                    final_answer = _message_content(message)
                    self._emit(
                        "assistant_message_completed",
                        status="passed",
                        case_id=scenario.id,
                        model=model_name,
                        title="Assistant answered",
                        payload={"content": final_answer, "iteration": iteration_count},
                    )
                    completed = True
                    break
                messages.append(message)
                for tool_call in tool_calls:
                    function = tool_call.get("function") or {}
                    name = str(function.get("name") or "")
                    raw_arguments = function.get("arguments")
                    arguments, argument_error = _parse_arguments_with_error(raw_arguments)
                    observed_tools.append(name)
                    if argument_error:
                        error = f"invalid tool arguments for {name}"
                        tool_results.append(
                            {
                                "tool_call_id": tool_call.get("id") or name,
                                "tool_name": name,
                                "function": {
                                    "name": name,
                                    "arguments": raw_arguments if isinstance(raw_arguments, str) else json.dumps(raw_arguments or {}),
                                },
                                "raw_arguments": raw_arguments if isinstance(raw_arguments, str) else json.dumps(raw_arguments or {}),
                                "arguments": {},
                                "ok": False,
                                "error": argument_error,
                                "expected_error": False,
                                "result": {"ok": False, "error": argument_error},
                            }
                        )
                        break
                    tool_call_id = str(tool_call.get("id") or name)
                    result = await executor.execute(
                        name,
                        arguments,
                        request_id=request_id,
                        model=model_name,
                        case_id=scenario.id,
                        tool_call_id=tool_call_id,
                    )
                    tool_results.append(
                        {
                            "tool_call_id": tool_call_id,
                            "tool_name": name,
                            "function": {
                                "name": name,
                                "arguments": raw_arguments if isinstance(raw_arguments, str) else json.dumps(raw_arguments or {}),
                            },
                            "raw_arguments": raw_arguments if isinstance(raw_arguments, str) else json.dumps(raw_arguments or {}),
                            "arguments": arguments,
                            "ok": bool(result.get("ok")),
                            "error": result.get("error") or "",
                            "expected_error": False,
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
                if error:
                    break
            else:
                error = "live tool loop reached max_iterations before final assistant response"

            if error and not tool_results and not final_answer:
                self._emit(
                    "case_scored",
                    status="failed",
                    case_id=scenario.id,
                    model=model_name,
                    title=f"{scenario.id} scored",
                    payload={"score": 0.0, "error": error},
                )
                self._emit(
                    "case_completed",
                    status="failed",
                    case_id=scenario.id,
                    model=model_name,
                    title=f"{scenario.id} completed",
                    payload={"status": "failed", "error": error},
                )
                return {
                    "case_id": scenario.id,
                    "case_category": "live_workspace",
                    "model": model_name,
                    "status": "failed",
                    "score": 0.0,
                    "checks": {
                        "completed": False,
                        "expected_tool_sequence": False,
                        "expected_final_substrings": False,
                        "no_tool_errors": False,
                        "no_repeated_calls": False,
                        "expected_artifacts": False,
                        "expected_artifact_substrings": False,
                        "no_forbidden_artifact_substrings": False,
                    },
                    "error": error,
                    "iteration_count": iteration_count,
                    "tool_call_count": 0,
                    "observed_tool_sequence": [],
                    "expected_tool_sequence": list(scenario.expected_tool_sequence),
                    "missing_expected_tools": list(scenario.expected_tool_sequence),
                    "unexpected_tools": [],
                    "scoring_mode": "set_membership",
                    "tool_results": [],
                    "trace_events": self.trace_recorder.events_for_case(scenario.id) if self.trace_recorder is not None else [],
                    "final_answer": "",
                    "artifacts": _artifact_payloads(workspace, scenario.expected_artifacts),
                }

            artifact_checks = _artifact_checks(workspace, scenario)
            checks = {
                "completed": completed,
                "expected_tool_sequence": _contains_required_tools(observed_tools, scenario.expected_tool_sequence),
                "expected_final_substrings": _contains_all(final_answer, ["created", "notes"]),
                "no_tool_errors": all(bool(result.get("ok")) for result in tool_results),
                "no_repeated_calls": _max_repeated_call_signatures(tool_results) <= scenario.max_repeated_tool_calls,
                **artifact_checks,
            }
            score = _score(checks)
            missing_expected_tools, unexpected_tools = _tool_sequence_delta(observed_tools, scenario.expected_tool_sequence)
            artifact_diagnostics = _artifact_diagnostics(workspace, scenario)
            status = "passed" if score == 1.0 else "failed"
            self._emit(
                "case_scored",
                status=status,
                case_id=scenario.id,
                model=model_name,
                title=f"{scenario.id} scored",
                payload={"score": score, "checks": checks},
            )
            self._emit(
                "case_completed",
                status=status,
                case_id=scenario.id,
                model=model_name,
                title=f"{scenario.id} completed",
                payload={"status": status, "error": error},
            )
            return {
                "case_id": scenario.id,
                "case_category": "live_workspace",
                "model": model_name,
                "status": status,
                "score": score,
                "checks": checks,
                "error": error,
                "iteration_count": iteration_count,
                "tool_call_count": len(observed_tools),
                "observed_tool_sequence": observed_tools,
                "expected_tool_sequence": list(scenario.expected_tool_sequence),
                "missing_expected_tools": missing_expected_tools,
                "unexpected_tools": unexpected_tools,
                **artifact_diagnostics,
                "scoring_mode": "set_membership",
                "tool_results": tool_results,
                "trace_events": self.trace_recorder.events_for_case(scenario.id) if self.trace_recorder is not None else [],
                "final_answer": final_answer,
                "artifacts": _artifact_payloads(workspace, scenario.expected_artifacts),
            }

    async def run_suite(self, model_name: str, scenarios: list[LiveToolLoopScenario]) -> dict[str, Any]:
        if self.emit_suite_events:
            self._emit(
                "run_started",
                model=model_name,
                title="Live tool-loop eval run started",
                payload={"case_count": len(scenarios), "case_ids": [scenario.id for scenario in scenarios]},
            )
        results = [await self.run_case(model_name, scenario) for scenario in scenarios]
        passed_count = sum(1 for result in results if result["status"] == "passed")
        failed_count = len(results) - passed_count
        average_score = round(sum(float(result["score"]) for result in results) / len(results), 4) if results else 0.0
        suite = {
            "model": model_name,
            "status": "passed" if failed_count == 0 else "failed",
            "case_count": len(results),
            "passed_count": passed_count,
            "failed_count": failed_count,
            "average_score": average_score,
            "cases": results,
        }
        if self.emit_suite_events:
            self._emit(
                "run_completed" if failed_count == 0 else "run_failed",
                status=suite["status"],
                model=model_name,
                title="Live tool-loop eval run completed",
                payload={"status": suite["status"], "case_count": len(results)},
            )
        return suite

    def _emit(self, event_type: str, **kwargs: Any) -> dict[str, Any] | None:
        if self.trace_recorder is None:
            return None
        return self.trace_recorder.emit(event_type, **kwargs)


def default_live_tool_loop_scenarios() -> list[LiveToolLoopScenario]:
    return [
        LiveToolLoopScenario(
            id="live-collaborative-notes-design",
            prompt=(
                "Use the workspace tools to inspect the notes app brief and starter files. "
                "Call search_workspace exactly once with query user_id before writing the design, "
                "so relationship references from the markdown workspace are included. "
                "Create docs/notes-app-design.md with a compact implementation design under 700 words. "
                "The design must include sections named Overview, Data model, API, Frontend, Collaboration, and Risk. "
                "Use 2-3 short bullets per section instead of long tables. "
                "Do not implement registration or account-management flows."
            ),
            expected_tool_sequence=[
                "list_workspace",
                "read_workspace_file",
                "search_workspace",
                "write_notes_app_design",
            ],
            expected_artifacts=["docs/notes-app-design.md"],
            expected_artifact_substrings={
                "docs/notes-app-design.md": [
                    "Overview",
                    "Data model",
                    "API",
                    "Frontend",
                    "Collaboration",
                    "Risk",
                    "user_id",
                    "note_id",
                    "collaborators",
                    "registration",
                ],
            },
            forbidden_artifact_substrings={
                "docs/notes-app-design.md": [
                    "password",
                    "login form",
                    "signup",
                ],
            },
        )
    ]


def _seed_notes_workspace(workspace: Path) -> None:
    (workspace / "docs").mkdir(parents=True, exist_ok=True)
    (workspace / "README.md").write_text(
        "# Collaborative Notes App\n\n"
        "Create a notes app that allows collaboration between users. "
        "User account information and registration is not needed. "
        "Build with future relationships from notes to users using user_id and note_id respectively.\n",
        encoding="utf-8",
    )
    (workspace / "schema-notes.md").write_text(
        "Entities: users, notes, note_collaborators.\n"
        "Relationship constraints: notes.user_id, note_collaborators.user_id, note_collaborators.note_id.\n",
        encoding="utf-8",
    )
    (workspace / "api-starter.md").write_text(
        "Needed API areas: CRUD notes, list notes by user_id, share notes with collaborators, list collaborators by note_id.\n",
        encoding="utf-8",
    )


def _live_notes_config(config: AppConfig, workspace: Path, max_iterations: int) -> AppConfig:
    tools = {
        "list_workspace": AgentToolDefinitionConfig(
            type="directory_list",
            description="List files in the live scenario workspace.",
            path=workspace,
            recursive=True,
            max_depth=2,
        ),
        "read_workspace_file": AgentToolDefinitionConfig(
            type="file_read_dynamic",
            description="Read a relative file from the live scenario workspace.",
            path=workspace,
        ),
        "search_workspace": AgentToolDefinitionConfig(
            type="text_search",
            description=(
                "Search markdown files in the live scenario workspace. "
                "For the notes app design eval, call this once with query user_id before writing."
            ),
            path=workspace,
            glob="*.md",
            parameters={
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Text to search for in the scenario markdown files.",
                    }
                },
                "required": ["query"],
            },
        ),
        "write_notes_app_design": AgentToolDefinitionConfig(
            type="file_write",
            description="Write the collaborative notes app design document.",
            path=workspace / "docs" / "notes-app-design.md",
            write_mode="write",
            max_write_bytes=65536,
            parameters={
                "type": "object",
                "properties": {
                    "content": {
                        "type": "string",
                        "description": "Markdown content for docs/notes-app-design.md.",
                    }
                },
                "required": ["content"],
            },
        ),
    }
    return config.model_copy(
        update={
            "agent_tools": AgentToolsConfig(
                enabled=True,
                max_iterations=max_iterations,
                safe_roots=[workspace],
                tools=tools,
            )
        }
    )


def _artifact_checks(workspace: Path, scenario: LiveToolLoopScenario) -> dict[str, bool]:
    artifacts_exist = all((workspace / path).is_file() for path in scenario.expected_artifacts)
    expected_content = all(
        _contains_all((workspace / path).read_text(encoding="utf-8") if (workspace / path).exists() else "", substrings)
        for path, substrings in scenario.expected_artifact_substrings.items()
    )
    forbidden_content = all(
        not _contains_any((workspace / path).read_text(encoding="utf-8") if (workspace / path).exists() else "", substrings)
        for path, substrings in scenario.forbidden_artifact_substrings.items()
    )
    return {
        "expected_artifacts": artifacts_exist,
        "expected_artifact_substrings": expected_content,
        "no_forbidden_artifact_substrings": forbidden_content,
    }


def _artifact_payloads(workspace: Path, artifact_paths: list[str]) -> list[dict[str, Any]]:
    payloads = []
    for path in artifact_paths:
        artifact = workspace / path
        payloads.append(
            {
                "path": path,
                "exists": artifact.is_file(),
                "content": artifact.read_text(encoding="utf-8") if artifact.is_file() else "",
            }
        )
    return payloads


def _artifact_diagnostics(workspace: Path, scenario: LiveToolLoopScenario) -> dict[str, dict[str, list[str]]]:
    return {
        "missing_artifact_substrings": _missing_artifact_substrings(workspace, scenario),
        "forbidden_artifact_substrings_found": _forbidden_artifact_substrings_found(workspace, scenario),
    }


def _missing_artifact_substrings(workspace: Path, scenario: LiveToolLoopScenario) -> dict[str, list[str]]:
    missing: dict[str, list[str]] = {}
    for path, substrings in scenario.expected_artifact_substrings.items():
        content = (workspace / path).read_text(encoding="utf-8") if (workspace / path).exists() else ""
        missing_for_path = [substring for substring in substrings if not _contains_all(content, [substring])]
        if missing_for_path:
            missing[path] = missing_for_path
    return missing


def _forbidden_artifact_substrings_found(workspace: Path, scenario: LiveToolLoopScenario) -> dict[str, list[str]]:
    found: dict[str, list[str]] = {}
    for path, substrings in scenario.forbidden_artifact_substrings.items():
        content = (workspace / path).read_text(encoding="utf-8") if (workspace / path).exists() else ""
        found_for_path = [substring for substring in substrings if _contains_any(content, [substring])]
        if found_for_path:
            found[path] = found_for_path
    return found


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
    parsed, _error = _parse_arguments_with_error(raw)
    return parsed


def _parse_arguments_with_error(raw: Any) -> tuple[dict[str, Any], str]:
    if isinstance(raw, dict):
        return raw, ""
    if not isinstance(raw, str) or not raw.strip():
        return {}, ""
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as exc:
        return {}, f"invalid JSON arguments: {exc.msg}"
    if not isinstance(parsed, dict):
        return {}, "tool arguments must be a JSON object"
    return parsed, ""


def _message_content(message: dict[str, Any]) -> str:
    content = message.get("content")
    if isinstance(content, str):
        return content
    if content is None:
        return ""
    return str(content)


def _contains_all(text: str, expected_substrings: list[str]) -> bool:
    normalized = _normalize_match_text(text)
    return all(_normalize_match_text(substring) in normalized for substring in expected_substrings)


def _contains_required_tools(observed: list[str], expected: list[str]) -> bool:
    observed_counts = Counter(observed)
    expected_counts = Counter(expected)
    return all(observed_counts[name] >= count for name, count in expected_counts.items())


def _tool_sequence_delta(observed: list[str], expected: list[str]) -> tuple[list[str], list[str]]:
    observed_counts = Counter(observed)
    expected_counts = Counter(expected)
    missing: list[str] = []
    unexpected: list[str] = []
    for name in expected:
        if observed_counts[name] < expected_counts[name]:
            missing.extend([name] * (expected_counts[name] - observed_counts[name]))
            expected_counts[name] = observed_counts[name]
    for name in observed:
        if observed_counts[name] > expected_counts[name]:
            unexpected.extend([name] * (observed_counts[name] - expected_counts[name]))
            observed_counts[name] = expected_counts[name]
    return missing, unexpected


def _contains_any(text: str, substrings: list[str]) -> bool:
    normalized = _normalize_match_text(text)
    return any(_has_forbidden_substring(normalized, substring) for substring in substrings)


def _has_forbidden_substring(normalized_text: str, substring: str) -> bool:
    normalized_substring = _normalize_match_text(substring)
    if normalized_substring == "password":
        allowed_negations = (
            "no password",
            "no passwords",
            "without password",
            "without passwords",
            "not store password",
            "not store passwords",
            "does not store password",
            "does not store passwords",
            "do not store password",
            "do not store passwords",
        )
        scrubbed = normalized_text
        for phrase in allowed_negations:
            scrubbed = scrubbed.replace(phrase, "")
        return normalized_substring in scrubbed
    return normalized_substring in normalized_text


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


def _chat_error_message(exc: Exception) -> str:
    if isinstance(exc, httpx.HTTPStatusError):
        text = exc.response.text[:500] if exc.response is not None else ""
        suffix = f": {text}" if text else ""
        return f"model chat request failed with HTTP {exc.response.status_code}{suffix}"
    return f"model chat request failed: {exc}"


def _max_repeated_call_signatures(tool_results: list[dict[str, Any]]) -> int:
    signatures = [
        (
            str(result.get("tool_name") or ""),
            json.dumps(result.get("arguments") or {}, sort_keys=True, separators=(",", ":")),
        )
        for result in tool_results
    ]
    counts = {signature: signatures.count(signature) for signature in set(signatures)}
    return max(counts.values(), default=0)


def _score(checks: dict[str, bool]) -> float:
    if not checks:
        return 0.0
    passed = sum(1 for value in checks.values() if value)
    return round(passed / len(checks), 4)
