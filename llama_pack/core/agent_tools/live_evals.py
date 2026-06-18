from __future__ import annotations

from collections import Counter
import json
import tempfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any
from uuid import uuid4

import httpx

from llama_pack.core.agent_tools.executor import ToolExecutor
from llama_pack.core.agent_tools.registry import ToolRegistry
from llama_pack.core.agent_tools.tracing import RuntimeTraceRecorder
from llama_pack.core.config.models import AgentToolDefinitionConfig, AgentToolsConfig, AppConfig


@dataclass(frozen=True)
class LiveToolLoopScenario:
    id: str
    prompt: str
    expected_tool_sequence: list[str]
    expected_final_substrings: list[str]
    expected_artifacts: list[str]
    expected_artifact_substrings: dict[str, list[str]]
    seed_files: dict[str, str]
    write_tools: dict[str, str]
    search_glob: str
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
        with tempfile.TemporaryDirectory(prefix="llama-pack-live-tool-loop-") as tmpdir:
            workspace = Path(tmpdir)
            _seed_workspace(workspace, scenario.seed_files)
            live_config = _live_workspace_config(self.config, workspace, scenario)
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
                "expected_final_substrings": _contains_all(final_answer, scenario.expected_final_substrings),
                "no_tool_errors": all(bool(result.get("ok")) for result in tool_results),
                "no_repeated_calls": _max_repeated_call_signatures(tool_results) <= scenario.max_repeated_tool_calls,
                **artifact_checks,
            }
            score = _score(checks)
            missing_expected_tools, unexpected_tools = _tool_sequence_delta(observed_tools, scenario.expected_tool_sequence)
            artifact_diagnostics = _artifact_diagnostics(workspace, scenario)
            partial_checks = {"expected_final_substrings", "expected_artifact_substrings"}
            if set(missing_expected_tools) == {"list_workspace"}:
                partial_checks.add("expected_tool_sequence")
            status = _case_status(checks, partial_checks=partial_checks)
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
        partial_count = sum(1 for result in results if result["status"] == "partial")
        failed_count = len(results) - passed_count - partial_count
        average_score = round(sum(float(result["score"]) for result in results) / len(results), 4) if results else 0.0
        suite = {
            "model": model_name,
            "status": _suite_status(passed_count=passed_count, partial_count=partial_count, failed_count=failed_count),
            "case_count": len(results),
            "passed_count": passed_count,
            "partial_count": partial_count,
            "failed_count": failed_count,
            "average_score": average_score,
            "cases": results,
        }
        if self.emit_suite_events:
            self._emit(
                "run_completed" if failed_count == 0 and partial_count == 0 else "run_failed",
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
            expected_final_substrings=["created", "notes"],
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
            seed_files={
                "README.md": (
                    "# Collaborative Notes App\n\n"
                    "Create a notes app that allows collaboration between users. "
                    "User account information and registration is not needed. "
                    "Build with future relationships from notes to users using user_id and note_id respectively.\n"
                ),
                "schema-notes.md": (
                    "Entities: users, notes, note_collaborators.\n"
                    "Relationship constraints: notes.user_id, note_collaborators.user_id, note_collaborators.note_id.\n"
                ),
                "api-starter.md": (
                    "Needed API areas: CRUD notes, list notes by user_id, share notes with collaborators, list collaborators by note_id.\n"
                ),
            },
            write_tools={"write_notes_app_design": "docs/notes-app-design.md"},
            search_glob="*.md",
            forbidden_artifact_substrings={
                "docs/notes-app-design.md": [
                    "password",
                    "login form",
                    "signup",
                ],
            },
        ),
        LiveToolLoopScenario(
            id="live-ci-failure-triage",
            prompt=(
                "Use the workspace tools to triage the failing CI run. Search for "
                "test_create_run_requires_model, inspect the CI log, relevant source, and relevant test. "
                "Write docs/ci-triage.md with Root cause, Minimal fix, and Verification sections. "
                "Include the exact failing test name, relevant file path, and command to rerun the focused test. "
                "Do not use unrelated package or frontend notes."
            ),
            expected_tool_sequence=[
                "list_workspace",
                "search_workspace",
                "read_workspace_file",
                "write_ci_triage_report",
            ],
            expected_final_substrings=["triage", "report"],
            expected_artifacts=["docs/ci-triage.md"],
            expected_artifact_substrings={
                "docs/ci-triage.md": [
                    "Root cause",
                    "Minimal fix",
                    "Verification",
                    "tests/test_api.py::test_create_run_requires_model",
                    "llama_pack/api/routes/runs.py",
                    "uv run pytest tests/test_api.py -v",
                ],
            },
            seed_files={
                ".github/workflows/ci.yml": (
                    "name: CI\n"
                    "on: [push]\n"
                    "jobs:\n"
                    "  test:\n"
                    "    runs-on: ubuntu-latest\n"
                    "    steps:\n"
                    "      - uses: actions/checkout@v4\n"
                    "      - run: uv run pytest tests/test_api.py -v\n"
                ),
                "logs/ci-failure.log": (
                    "FAILED tests/test_api.py::test_create_run_requires_model - AssertionError: expected 422, got 200\n"
                    "request payload omitted model but route accepted it\n"
                ),
                "llama_pack/api/routes/runs.py": (
                    "async def create_run(body):\n"
                    "    model = body.get('model')\n"
                    "    return {'status': 'queued', 'model': model}\n"
                ),
                "tests/test_api.py": (
                    "def test_create_run_requires_model(client):\n"
                    "    response = client.post('/lm-api/v1/runs', json={'prompt': 'hello'})\n"
                    "    assert response.status_code == 422\n"
                ),
                "docs/frontend-notes.md": "Frontend bundle cache notes are unrelated to this API validation failure.\n",
                "package-notes.md": "Package publishing notes mention test_create_run_requires_model only as stale migration history.\n",
            },
            write_tools={"write_ci_triage_report": "docs/ci-triage.md"},
            search_glob="**/*",
            forbidden_artifact_substrings={"docs/ci-triage.md": ["frontend bundle", "package publishing"]},
            max_iterations=9,
        ),
        LiveToolLoopScenario(
            id="live-config-migration-plan",
            prompt=(
                "Use the workspace tools to compare the existing and target YAML config fixtures. "
                "Search for controller_db_url, read the existing config, target config, and migration notes. "
                "Write docs/config-migration-plan.md with Current state, Migration steps, Compatibility, and Verification sections. "
                "Preserve exact config key names and do not recommend stale legacy_model_path fields."
            ),
            expected_tool_sequence=[
                "list_workspace",
                "search_workspace",
                "read_workspace_file",
                "write_config_migration_plan",
            ],
            expected_final_substrings=["migration", "plan"],
            expected_artifacts=["docs/config-migration-plan.md"],
            expected_artifact_substrings={
                "docs/config-migration-plan.md": [
                    "Current state",
                    "Migration steps",
                    "Compatibility",
                    "Verification",
                    "controller_db_url",
                    "auth_db_url",
                    "agent_tools",
                    "uv run pytest tests/test_persistence_db_infra.py tests/test_alembic_config.py -v",
                ],
            },
            seed_files={
                "fixtures/migration-task7-existing-config.yaml": (
                    "mode: controller\n"
                    "controller_db_url: sqlite:///logs/controller_state.db\n"
                    "auth_db_url: sqlite:///logs/auth_store.db\n"
                    "agent_tools:\n"
                    "  enabled: true\n"
                ),
                "fixtures/migration-task7-config.yaml": (
                    "mode: controller\n"
                    "controller_db_url: sqlite:///data/controller_state.db\n"
                    "auth_db_url: sqlite:///data/auth_store.db\n"
                    "agent_tools:\n"
                    "  enabled: true\n"
                    "  max_iterations: 8\n"
                ),
                "docs/migration-notes.md": (
                    "Keep controller_db_url and auth_db_url explicit. "
                    "Validate with persistence and Alembic config tests. "
                    "legacy_model_path was removed and must not be reintroduced.\n"
                ),
                "docs/stale-config.md": "Old examples mention legacy_model_path and should not be used.\n",
            },
            write_tools={"write_config_migration_plan": "docs/config-migration-plan.md"},
            search_glob="**/*",
            forbidden_artifact_substrings={"docs/config-migration-plan.md": ["legacy_model_path"]},
            max_iterations=9,
        ),
        LiveToolLoopScenario(
            id="live-targeted-bugfix-plan",
            prompt=(
                "Use the workspace tools to prepare a targeted bugfix plan. Search for parse_retry_after, "
                "then inspect only the relevant source and test files. Write docs/bugfix-plan.md with "
                "Bug, Minimal patch, Tests, and Risk sections. Avoid broad architecture notes."
            ),
            expected_tool_sequence=[
                "list_workspace",
                "search_workspace",
                "read_workspace_file",
                "write_bugfix_plan",
            ],
            expected_final_substrings=["bugfix", "plan"],
            expected_artifacts=["docs/bugfix-plan.md"],
            expected_artifact_substrings={
                "docs/bugfix-plan.md": [
                    "Bug",
                    "Minimal patch",
                    "Tests",
                    "Risk",
                    "parse_retry_after",
                    "llama_pack/core/runtime/retry.py",
                    "tests/test_retry.py",
                ],
            },
            seed_files={
                "llama_pack/core/runtime/retry.py": (
                    "def parse_retry_after(value: str) -> int:\n"
                    "    return int(value)\n"
                ),
                "tests/test_retry.py": (
                    "def test_parse_retry_after_accepts_http_date():\n"
                    "    assert parse_retry_after('Wed, 21 Oct 2015 07:28:00 GMT') >= 0\n"
                ),
                "docs/architecture.md": "Broad architecture notes are unrelated to this small parser fix.\n",
                "docs/runtime-overview.md": "Runtime overview mentions retries but not parse_retry_after.\n",
            },
            write_tools={"write_bugfix_plan": "docs/bugfix-plan.md"},
            search_glob="**/*",
            forbidden_artifact_substrings={"docs/bugfix-plan.md": ["broad architecture", "rewrite runtime"]},
            max_iterations=9,
        ),
        LiveToolLoopScenario(
            id="live-pr-review-findings",
            prompt=(
                "Use the workspace tools to review the proposed change. Inspect the diff, touched source, "
                "and tests. Write docs/pr-review.md with actionable findings ordered by severity. "
                "Do not include style-only comments."
            ),
            expected_tool_sequence=[
                "list_workspace",
                "read_workspace_file",
                "write_pr_review",
            ],
            expected_final_substrings=["review", "findings"],
            expected_artifacts=["docs/pr-review.md"],
            expected_artifact_substrings={
                "docs/pr-review.md": [
                    "P1",
                    "api_key",
                    "llama_pack/auth.py",
                    "tests/test_auth.py",
                    "unauthenticated",
                ],
            },
            seed_files={
                "review/diff.patch": (
                    "diff --git a/llama_pack/auth.py b/llama_pack/auth.py\n"
                    "-    if api_key is None: raise Unauthorized()\n"
                    "+    if api_key is None: return AnonymousUser()\n"
                ),
                "llama_pack/auth.py": (
                    "def require_api_key(api_key):\n"
                    "    if api_key is None:\n"
                    "        return AnonymousUser()\n"
                    "    return validate_key(api_key)\n"
                ),
                "tests/test_auth.py": (
                    "def test_missing_api_key_is_unauthenticated(client):\n"
                    "    assert client.get('/lm-api/v1/runs').status_code == 401\n"
                ),
                "review/style-notes.md": "Line length and import ordering are not actionable for this review.\n",
            },
            write_tools={"write_pr_review": "docs/pr-review.md"},
            search_glob="**/*",
            forbidden_artifact_substrings={"docs/pr-review.md": ["line length", "import ordering", "style-only"]},
            max_iterations=8,
        ),
    ]


def _seed_workspace(workspace: Path, seed_files: dict[str, str]) -> None:
    for relative_path, content in seed_files.items():
        path = workspace / relative_path
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")


def _live_workspace_config(config: AppConfig, workspace: Path, scenario: LiveToolLoopScenario) -> AppConfig:
    tools = {
        "list_workspace": AgentToolDefinitionConfig(
            type="directory_list",
            description="List files in the live coding-agent scenario workspace.",
            path=workspace,
            recursive=True,
            max_depth=6,
        ),
        "read_workspace_file": AgentToolDefinitionConfig(
            type="file_read_dynamic",
            description="Read a relative file from the live coding-agent scenario workspace.",
            path=workspace,
        ),
        "search_workspace": AgentToolDefinitionConfig(
            type="text_search",
            description=(
                "Search files in the live coding-agent scenario workspace. "
                "Use specific identifiers from the task prompt as queries."
            ),
            path=workspace,
            glob=scenario.search_glob,
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
    }
    for tool_name, relative_path in scenario.write_tools.items():
        tools[tool_name] = AgentToolDefinitionConfig(
            type="file_write",
            description=f"Write the scenario artifact {relative_path}.",
            path=workspace / relative_path,
            write_mode="write",
            max_write_bytes=65536,
            parameters={
                "type": "object",
                "properties": {
                    "content": {
                        "type": "string",
                        "description": f"Markdown content for {relative_path}.",
                    }
                },
                "required": ["content"],
            },
        )
    return config.model_copy(
        update={
            "agent_tools": AgentToolsConfig(
                enabled=True,
                max_iterations=scenario.max_iterations,
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
    if normalized_substring == "legacy_model_path":
        allowed_negations = (
            "legacy_model_path is not present",
            "legacy_model_path is absent",
            "legacy_model_path was removed",
            "legacy_model_path must not be reintroduced",
            "do not use legacy_model_path",
            "do not recommend legacy_model_path",
            "without legacy_model_path",
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


def _case_status(checks: dict[str, bool], partial_checks: set[str]) -> str:
    failed_checks = {name for name, passed in checks.items() if not passed}
    if not failed_checks:
        return "passed"
    if failed_checks.issubset(partial_checks):
        return "partial"
    return "failed"


def _suite_status(*, passed_count: int, partial_count: int, failed_count: int) -> str:
    if failed_count:
        return "failed"
    if partial_count:
        return "partial"
    return "passed" if passed_count else "passed"
