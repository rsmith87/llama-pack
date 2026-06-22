from __future__ import annotations

import json
import subprocess

import httpx
import pytest
import respx

from llama_pack.core.agent_tools.executor import ToolExecutor
from llama_pack.core.agent_tools.prompt_builder import PromptBuilder
from llama_pack.core.agent_tools.registry import ToolRegistry
from llama_pack.core.agent_tools.runtime import AgentToolLoop
from llama_pack.core.agent_tools.tracing import RuntimeTraceRecorder
from llama_pack.core.agent_tools.answer_verifier import AnswerVerifier, extract_answer_claims
from llama_pack.core.code_graph.tools import ProjectGraphToolContext, execute_project_graph_tool, project_graph_tool_definitions
from llama_pack.core.config import load_config
from llama_pack.core.persistence.db_infra import sqlite_url_for_path
from llama_pack.core.persistence.project_graph_store_orm import ProjectGraphStoreOrm
from llama_pack.core.persistence.project_store_orm import ProjectStoreOrm
from tests.persistence_db_setup import prepare_projects_db


def test_tool_registry_emits_openai_tool_definitions(tmp_path):
    config = load_config(
        {
            "mode": "agent",
            "agent_tools": {
                "enabled": True,
                "safe_roots": [str(tmp_path)],
                "tools": {
                    "read_status": {
                        "type": "file_read",
                        "description": "Read status.",
                        "path": str(tmp_path / "status.txt"),
                    }
                },
            },
        }
    )

    tools = ToolRegistry(config.agent_tools).openai_tools()

    assert tools == [
        {
            "type": "function",
            "function": {
                "name": "read_status",
                "description": "Read status.",
                "parameters": {"type": "object", "properties": {}, "additionalProperties": False},
            },
        }
    ]


def test_tool_registry_emits_dynamic_file_read_path_schema(tmp_path):
    config = load_config(
        {
            "mode": "agent",
            "agent_tools": {
                "enabled": True,
                "safe_roots": [str(tmp_path)],
                "tools": {
                    "read_project_file": {
                        "type": "file_read_dynamic",
                        "description": "Read a project file.",
                        "path": str(tmp_path),
                    }
                },
            },
        }
    )

    tools = ToolRegistry(config.agent_tools).openai_tools()

    assert tools[0]["function"]["parameters"] == {
        "type": "object",
        "properties": {
            "path": {
                "type": "string",
                "description": "Relative file path under the configured root.",
            },
            "start_line": {
                "type": "integer",
                "minimum": 1,
                "description": "Optional 1-based first line to read.",
            },
            "end_line": {
                "type": "integer",
                "minimum": 1,
                "description": "Optional 1-based last line to read.",
            },
        },
        "required": ["path"],
        "additionalProperties": False,
    }


def test_tool_registry_emits_project_graph_runtime_tools(tmp_path):
    config = load_config({"mode": "agent", "log_dir": str(tmp_path), "agent_tools": {"enabled": True}})

    tools = ToolRegistry(config.agent_tools, runtime_tools=project_graph_tool_definitions()).openai_tools()

    names = [tool["function"]["name"] for tool in tools]
    assert "graph_overview" in names
    assert "graph_find_symbol" in names
    find_symbol = next(tool for tool in tools if tool["function"]["name"] == "graph_find_symbol")
    assert find_symbol["function"]["parameters"]["required"] == ["query"]


def test_answer_verifier_extracts_codebase_paths_and_symbols():
    claims = extract_answer_claims(
        "Edit `llama_pack/core/benchmarks/runner.py` and call BenchmarkRunner.execute_run. "
        "Ignore `src/repositories/sample_repository.py`."
    )

    assert "llama_pack/core/benchmarks/runner.py" in claims.paths
    assert "src/repositories/sample_repository.py" in claims.paths
    assert "BenchmarkRunner.execute_run" in claims.symbols


def test_answer_verifier_reports_missing_paths_and_symbols(tmp_path):
    db_path = tmp_path / "projects.db"
    prepare_projects_db(db_path)
    graph_store = ProjectGraphStoreOrm(sqlite_url_for_path(db_path))
    project_id = "project-1"
    snapshot = graph_store.create_snapshot(project_id=project_id, node_name="local", root_path=str(tmp_path), git_commit=None)
    graph_store.replace_snapshot_graph(
        snapshot_id=str(snapshot["id"]),
        files=[
            {
                "id": "file-runner",
                "path": "llama_pack/core/benchmarks/runner.py",
                "language": "python",
                "size_bytes": 10,
                "content_hash": "hash",
                "mtime_ns": 1,
                "parse_status": "parsed",
                "parse_error": None,
            }
        ],
        symbols=[
            {
                "id": "sym-runner",
                "file_id": "file-runner",
                "name": "BenchmarkRunner",
                "qualified_name": "llama_pack.core.benchmarks.runner.BenchmarkRunner",
                "kind": "class",
                "language": "python",
                "start_line": 1,
                "end_line": 10,
                "signature": "class BenchmarkRunner",
                "doc_summary": None,
                "exported": True,
                "confidence": 1.0,
            }
        ],
        imports=[],
        relations=[],
    )
    graph_store.activate_snapshot(str(snapshot["id"]))
    verifier = AnswerVerifier(ProjectGraphToolContext(project_id=project_id, store=graph_store))

    report = verifier.verify(
        "Use `llama_pack/core/benchmarks/runner.py`, `src/repositories/sample_repository.py`, "
        "BenchmarkRunner, and SampleRepository.save.",
        source_evidence_available=True,
    )

    assert report.ok is False
    assert "src/repositories/sample_repository.py" in report.missing_paths
    assert "SampleRepository.save" in report.missing_symbols
    assert "llama_pack/core/benchmarks/runner.py" in report.verified_paths
    assert "BenchmarkRunner" in report.verified_symbols


def test_answer_verifier_reports_issue_spans_for_missing_claims(tmp_path):
    db_path = tmp_path / "projects.db"
    prepare_projects_db(db_path)
    graph_store = ProjectGraphStoreOrm(sqlite_url_for_path(db_path))
    project_id = "project-1"
    snapshot = graph_store.create_snapshot(project_id=project_id, node_name="local", root_path=str(tmp_path), git_commit=None)
    graph_store.replace_snapshot_graph(snapshot_id=str(snapshot["id"]), files=[], symbols=[], imports=[], relations=[])
    graph_store.activate_snapshot(str(snapshot["id"]))
    verifier = AnswerVerifier(ProjectGraphToolContext(project_id=project_id, store=graph_store))

    answer = "Edit `src/repositories/sample_repository.py`, then call SampleRepository.save."
    report = verifier.verify(answer, source_evidence_available=True)

    assert report.ok is False
    assert report.issues == [
        {
            "kind": "missing_path",
            "value": "src/repositories/sample_repository.py",
            "start": answer.index("src/repositories/sample_repository.py"),
            "end": answer.index("src/repositories/sample_repository.py") + len("src/repositories/sample_repository.py"),
            "excerpt": "`src/repositories/sample_repository.py`",
            "severity": "failed",
        },
        {
            "kind": "missing_symbol",
            "value": "SampleRepository.save",
            "start": answer.index("SampleRepository.save"),
            "end": answer.index("SampleRepository.save") + len("SampleRepository.save"),
            "excerpt": "SampleRepository.save",
            "severity": "failed",
        },
    ]


def test_answer_verifier_requires_structured_trace_edge_evidence(tmp_path):
    db_path = tmp_path / "projects.db"
    prepare_projects_db(db_path)
    graph_store = ProjectGraphStoreOrm(sqlite_url_for_path(db_path))
    project_id = "project-1"
    root = tmp_path / "project"
    root.mkdir()
    source = root / "llama_pack" / "api" / "routes" / "benchmarks.py"
    source.parent.mkdir(parents=True)
    source.write_text("asyncio.create_task(runner.execute_run(run[\"id\"]))\n", encoding="utf-8")
    snapshot = graph_store.create_snapshot(project_id=project_id, node_name="local", root_path=str(root), git_commit=None)
    graph_store.replace_snapshot_graph(
        snapshot_id=str(snapshot["id"]),
        files=[
            {
                "id": "file-benchmarks",
                "path": "llama_pack/api/routes/benchmarks.py",
                "language": "python",
                "size_bytes": source.stat().st_size,
                "content_hash": "hash",
                "mtime_ns": 1,
                "parse_status": "parsed",
                "parse_error": None,
            }
        ],
        symbols=[
            {
                "id": "sym-runner",
                "file_id": "file-benchmarks",
                "name": "BenchmarkRunner",
                "qualified_name": "llama_pack.core.benchmarks.runner.BenchmarkRunner",
                "kind": "class",
                "language": "python",
                "start_line": 1,
                "end_line": 1,
                "signature": "class BenchmarkRunner",
                "doc_summary": None,
                "exported": True,
                "confidence": 1.0,
            },
            {
                "id": "sym-execute-run",
                "file_id": "file-benchmarks",
                "name": "execute_run",
                "qualified_name": "llama_pack.core.benchmarks.runner.BenchmarkRunner.execute_run",
                "kind": "method",
                "language": "python",
                "start_line": 1,
                "end_line": 1,
                "signature": "async def execute_run",
                "doc_summary": None,
                "exported": False,
                "confidence": 1.0,
            }
        ],
        imports=[],
        relations=[],
    )
    graph_store.activate_snapshot(str(snapshot["id"]))
    verifier = AnswerVerifier(ProjectGraphToolContext(project_id=project_id, store=graph_store))

    answer = (
        "Ordered Call Path\n"
        "llama_pack.api.routes.benchmarks.start_runs -> BenchmarkRunner.execute_run\n"
        "Handoff: In llama_pack/api/routes/benchmarks.py at line 123: "
        "asyncio.create_task(runner.execute_run(run[\"id\"]))"
    )
    report = verifier.verify(answer, source_evidence_available=True)

    assert report.ok is False
    assert report.issues == [
        {
            "kind": "missing_source_evidence",
            "value": "runtime trace edges",
            "start": 0,
            "end": len("Ordered Call Path"),
            "excerpt": "Ordered Call Path",
            "severity": "failed",
        }
    ]


def test_answer_verifier_rejects_trace_edge_statement_not_in_file(tmp_path):
    db_path = tmp_path / "projects.db"
    prepare_projects_db(db_path)
    graph_store = ProjectGraphStoreOrm(sqlite_url_for_path(db_path))
    project_id = "project-1"
    root = tmp_path / "project"
    root.mkdir()
    source = root / "llama_pack" / "api" / "routes" / "benchmarks.py"
    source.parent.mkdir(parents=True)
    source.write_text("asyncio.create_task(runner.execute_run(run[\"id\"]))\n", encoding="utf-8")
    snapshot = graph_store.create_snapshot(project_id=project_id, node_name="local", root_path=str(root), git_commit=None)
    graph_store.replace_snapshot_graph(
        snapshot_id=str(snapshot["id"]),
        files=[
            {
                "id": "file-benchmarks",
                "path": "llama_pack/api/routes/benchmarks.py",
                "language": "python",
                "size_bytes": source.stat().st_size,
                "content_hash": "hash",
                "mtime_ns": 1,
                "parse_status": "parsed",
                "parse_error": None,
            }
        ],
        symbols=[
            {
                "id": "sym-runner",
                "file_id": "file-benchmarks",
                "name": "BenchmarkRunner",
                "qualified_name": "llama_pack.core.benchmarks.runner.BenchmarkRunner",
                "kind": "class",
                "language": "python",
                "start_line": 1,
                "end_line": 1,
                "signature": "class BenchmarkRunner",
                "doc_summary": None,
                "exported": True,
                "confidence": 1.0,
            },
            {
                "id": "sym-execute-run",
                "file_id": "file-benchmarks",
                "name": "execute_run",
                "qualified_name": "llama_pack.core.benchmarks.runner.BenchmarkRunner.execute_run",
                "kind": "method",
                "language": "python",
                "start_line": 1,
                "end_line": 1,
                "signature": "async def execute_run",
                "doc_summary": None,
                "exported": False,
                "confidence": 1.0,
            }
        ],
        imports=[],
        relations=[],
    )
    graph_store.activate_snapshot(str(snapshot["id"]))
    verifier = AnswerVerifier(ProjectGraphToolContext(project_id=project_id, store=graph_store))

    statement = "asyncio.create_task(runner.execute_run(run_id))"
    answer = (
        "Ordered call path with source evidence:\n"
        "1. from_symbol=benchmarks.start_runs to_symbol=BenchmarkRunner.execute_run "
        f"file=llama_pack/api/routes/benchmarks.py statement='{statement}'"
    )
    report = verifier.verify(answer, source_evidence_available=True)

    assert report.ok is False
    assert report.issues == [
        {
            "kind": "missing_source_evidence",
            "value": statement,
            "start": answer.index(statement),
            "end": answer.index(statement) + len(statement),
            "excerpt": statement,
            "severity": "failed",
        }
    ]


def test_answer_verifier_checks_trace_edge_without_heading(tmp_path):
    db_path = tmp_path / "projects.db"
    prepare_projects_db(db_path)
    graph_store = ProjectGraphStoreOrm(sqlite_url_for_path(db_path))
    project_id = "project-1"
    root = tmp_path / "project"
    root.mkdir()
    source = root / "llama_pack" / "api" / "routes" / "benchmarks.py"
    source.parent.mkdir(parents=True)
    source.write_text("asyncio.create_task(runner.execute_run(run[\"id\"]))\n", encoding="utf-8")
    snapshot = graph_store.create_snapshot(project_id=project_id, node_name="local", root_path=str(root), git_commit=None)
    graph_store.replace_snapshot_graph(
        snapshot_id=str(snapshot["id"]),
        files=[
            {
                "id": "file-benchmarks",
                "path": "llama_pack/api/routes/benchmarks.py",
                "language": "python",
                "size_bytes": source.stat().st_size,
                "content_hash": "hash",
                "mtime_ns": 1,
                "parse_status": "parsed",
                "parse_error": None,
            }
        ],
        symbols=[
            {
                "id": "sym-execute-run",
                "file_id": "file-benchmarks",
                "name": "execute_run",
                "qualified_name": "llama_pack.core.benchmarks.runner.BenchmarkRunner.execute_run",
                "kind": "method",
                "language": "python",
                "start_line": 1,
                "end_line": 1,
                "signature": "async def execute_run",
                "doc_summary": None,
                "exported": False,
                "confidence": 1.0,
            }
        ],
        imports=[],
        relations=[],
    )
    graph_store.activate_snapshot(str(snapshot["id"]))
    verifier = AnswerVerifier(ProjectGraphToolContext(project_id=project_id, store=graph_store))

    statement = "asyncio.create_task(runner.execute_run(run_id))"
    answer = (
        "from_symbol=benchmarks.start_runs to_symbol=BenchmarkRunner.execute_run "
        f"file=llama_pack/api/routes/benchmarks.py statement='{statement}'"
    )
    report = verifier.verify(answer, source_evidence_available=True)

    assert report.ok is False
    assert report.issues == [
        {
            "kind": "missing_source_evidence",
            "value": statement,
            "start": answer.index(statement),
            "end": answer.index(statement) + len(statement),
            "excerpt": statement,
            "severity": "failed",
        }
    ]


@pytest.mark.asyncio
async def test_tool_loop_returns_structured_verification_metadata_for_verified_answer(tmp_path):
    db_path = tmp_path / "projects.db"
    prepare_projects_db(db_path)
    graph_store = ProjectGraphStoreOrm(sqlite_url_for_path(db_path))
    project_id = "project-1"
    snapshot = graph_store.create_snapshot(project_id=project_id, node_name="local", root_path=str(tmp_path), git_commit=None)
    graph_store.replace_snapshot_graph(
        snapshot_id=str(snapshot["id"]),
        files=[
            {
                "id": "file-runner",
                "path": "llama_pack/core/benchmarks/runner.py",
                "language": "python",
                "size_bytes": 10,
                "content_hash": "hash",
                "mtime_ns": 1,
                "parse_status": "parsed",
                "parse_error": None,
            }
        ],
        symbols=[
            {
                "id": "sym-runner",
                "file_id": "file-runner",
                "name": "BenchmarkRunner",
                "qualified_name": "llama_pack.core.benchmarks.runner.BenchmarkRunner",
                "kind": "class",
                "language": "python",
                "start_line": 1,
                "end_line": 10,
                "signature": "class BenchmarkRunner",
                "doc_summary": None,
                "exported": True,
                "confidence": 1.0,
            }
        ],
        imports=[],
        relations=[],
    )
    graph_store.activate_snapshot(str(snapshot["id"]))
    config = load_config({"mode": "agent", "log_dir": str(tmp_path), "agent_tools": {"enabled": True}})

    class Proxy:
        async def chat_with_meta(self, model_name, payload):
            return {
                "choices": [
                    {
                        "message": {
                            "role": "assistant",
                            "content": "Use `llama_pack/core/benchmarks/runner.py` and BenchmarkRunner.",
                        }
                    }
                ]
            }, {"route": "local"}

    response, _meta = await AgentToolLoop(
        config,
        Proxy(),
        project_graph_context=ProjectGraphToolContext(project_id=project_id, store=graph_store),
    ).run("qwen", {"messages": [{"role": "user", "content": "trace BenchmarkRunner"}]})

    assert response["llama_pack"]["verification"] == {
        "status": "verified",
        "ok": True,
        "verified_paths": ["llama_pack/core/benchmarks/runner.py"],
        "missing_paths": [],
        "verified_symbols": ["BenchmarkRunner"],
        "missing_symbols": [],
        "missing_source_evidence": False,
        "issues": [],
    }


@pytest.mark.asyncio
async def test_tool_loop_returns_structured_verification_metadata_for_unverified_answer(tmp_path):
    db_path = tmp_path / "projects.db"
    prepare_projects_db(db_path)
    graph_store = ProjectGraphStoreOrm(sqlite_url_for_path(db_path))
    project_id = "project-1"
    snapshot = graph_store.create_snapshot(project_id=project_id, node_name="local", root_path=str(tmp_path), git_commit=None)
    graph_store.replace_snapshot_graph(snapshot_id=str(snapshot["id"]), files=[], symbols=[], imports=[], relations=[])
    graph_store.activate_snapshot(str(snapshot["id"]))
    config = load_config({"mode": "agent", "log_dir": str(tmp_path), "agent_tools": {"enabled": True}})

    class Proxy:
        async def chat_with_meta(self, model_name, payload):
            return {
                "choices": [
                    {
                        "message": {
                            "role": "assistant",
                            "content": "Edit `src/repositories/sample_repository.py`.",
                        }
                    }
                ]
            }, {"route": "local"}

    response, _meta = await AgentToolLoop(
        config,
        Proxy(),
        project_graph_context=ProjectGraphToolContext(project_id=project_id, store=graph_store),
    ).run("qwen", {"messages": [{"role": "user", "content": "trace repository"}]})

    verification = response["llama_pack"]["verification"]
    assert verification["status"] == "unverified"
    assert verification["ok"] is False
    assert verification["missing_paths"] == ["src/repositories/sample_repository.py"]
    assert verification["issues"] == [
        {
            "kind": "missing_path",
            "value": "src/repositories/sample_repository.py",
            "start": len("Edit `"),
            "end": len("Edit `") + len("src/repositories/sample_repository.py"),
            "excerpt": "`src/repositories/sample_repository.py`",
            "severity": "failed",
        }
    ]


def test_prompt_builder_injects_previous_answer_for_review_request():
    messages = [
        {"role": "user", "content": "Trace BenchmarkRunner."},
        {"role": "assistant", "content": "The runner lives in `llama_pack/core/benchmarks/runner.py`."},
        {"role": "user", "content": "Review your previous answer for unsupported claims."},
    ]

    built = PromptBuilder().build_agent_messages(messages, project_graph_enabled=False)

    assert built is not messages
    assert built[-2]["role"] == "system"
    assert "The user is referring to the previous assistant answer." in built[-2]["content"]
    assert "<previous_assistant_answer>" in built[-2]["content"]
    assert "The runner lives in `llama_pack/core/benchmarks/runner.py`." in built[-2]["content"]
    assert "</previous_assistant_answer>" in built[-2]["content"]
    assert built[-1] == messages[-1]


def test_prompt_builder_requires_source_trace_evidence_contract():
    messages = [{"role": "user", "content": "Trace the runtime path for starting a benchmark run."}]

    built = PromptBuilder().build_agent_messages(messages, project_graph_enabled=True)

    assert built[0]["role"] == "system"
    assert "For runtime trace answers" in built[0]["content"]
    assert "from_symbol" in built[0]["content"]
    assert "to_symbol" in built[0]["content"]
    assert "statement" in built[0]["content"]
    assert "from_symbol=... to_symbol=... file=... statement='...'" in built[0]["content"]
    assert "Answers without this exact edge evidence are unverified" in built[0]["content"]
    assert "mark that edge unverified" in built[0]["content"]


def test_prompt_builder_does_not_inject_previous_answer_for_unrelated_request():
    messages = [
        {"role": "user", "content": "Trace BenchmarkRunner."},
        {"role": "assistant", "content": "The runner lives in `llama_pack/core/benchmarks/runner.py`."},
        {"role": "user", "content": "Now explain BenchmarkStoreOrm."},
    ]

    built = PromptBuilder().build_agent_messages(messages, project_graph_enabled=False)

    assert built == messages


@pytest.mark.asyncio
async def test_tool_executor_reads_configured_file(tmp_path):
    status = tmp_path / "status.txt"
    status.write_text("agent ok", encoding="utf-8")
    config = load_config(
        {
            "mode": "agent",
            "log_dir": str(tmp_path),
            "agent_tools": {
                "enabled": True,
                "safe_roots": [str(tmp_path)],
                "tools": {
                    "read_status": {
                        "type": "file_read",
                        "description": "Read status.",
                        "path": str(status),
                    }
                },
            },
        }
    )

    result = await ToolExecutor(config).execute("read_status", {}, request_id="req-1", model="qwen")

    assert result["ok"] is True
    assert result["content"] == "agent ok"
    trace = json.loads((tmp_path / "agent_tool_calls.jsonl").read_text(encoding="utf-8").strip())
    assert trace["request_id"] == "req-1"
    assert trace["tool_name"] == "read_status"
    assert trace["adapter_type"] == "file_read"
    assert trace["status"] == "ok"


@pytest.mark.asyncio
async def test_tool_executor_reads_dynamic_file_under_configured_root(tmp_path):
    project = tmp_path / "project"
    logs = project / "logs"
    logs.mkdir(parents=True)
    (logs / "backend.log").write_text("backend ready", encoding="utf-8")
    config = load_config(
        {
            "mode": "agent",
            "log_dir": str(tmp_path),
            "agent_tools": {
                "enabled": True,
                "safe_roots": [str(project)],
                "tools": {
                    "read_project_file": {
                        "type": "file_read_dynamic",
                        "description": "Read a project file by relative path.",
                        "path": str(project),
                    }
                },
            },
        }
    )

    result = await ToolExecutor(config).execute(
        "read_project_file",
        {"path": "logs/backend.log"},
        request_id="req-1",
        model="qwen",
    )

    assert result["ok"] is True
    assert result["path"] == str(logs / "backend.log")
    assert result["content"] == "backend ready"


@pytest.mark.asyncio
async def test_dynamic_file_read_trace_locations_distinguish_same_file_ranges(tmp_path):
    project = tmp_path / "project"
    project.mkdir()
    source = project / "service.py"
    source.write_text("one\n two\nthree\nfour\n", encoding="utf-8")
    config = load_config(
        {
            "mode": "agent",
            "log_dir": str(tmp_path),
            "agent_tools": {
                "enabled": True,
                "safe_roots": [str(project)],
                "tools": {
                    "read_project_file": {
                        "type": "file_read_dynamic",
                        "description": "Read a project file by relative path.",
                        "path": str(project),
                    }
                },
            },
        }
    )
    recorder = RuntimeTraceRecorder(trace_id="trace-1", source="agent_tool_loop", scope="chat_completion")
    executor = ToolExecutor(config, trace_recorder=recorder)

    await executor.execute(
        "read_project_file",
        {"path": "service.py", "start_line": 1, "end_line": 2},
        request_id="req-1",
        model="qwen",
        tool_call_id="call-1",
    )
    await executor.execute(
        "read_project_file",
        {"path": "service.py", "start_line": 3, "end_line": 4},
        request_id="req-1",
        model="qwen",
        tool_call_id="call-2",
    )

    completed = [event for event in recorder.events if event["event_type"] == "tool_call_completed"]
    first_result = completed[0]["payload"]["result"]
    second_result = completed[1]["payload"]["result"]
    assert first_result["path"] == second_result["path"] == str(source.resolve())
    assert first_result["content"] == "one\n two"
    assert second_result["content"] == "three\nfour"
    assert first_result["locations"] == [{"path": str(source.resolve()), "start_line": 1, "end_line": 2}]
    assert second_result["locations"] == [{"path": str(source.resolve()), "start_line": 3, "end_line": 4}]


@pytest.mark.asyncio
async def test_dynamic_file_read_rejects_ranges_past_end_of_file(tmp_path):
    project = tmp_path / "project"
    project.mkdir()
    (project / "service.py").write_text("one\ntwo\n", encoding="utf-8")
    config = load_config(
        {
            "mode": "agent",
            "log_dir": str(tmp_path),
            "agent_tools": {
                "enabled": True,
                "safe_roots": [str(project)],
                "tools": {
                    "read_project_file": {
                        "type": "file_read_dynamic",
                        "description": "Read a project file by relative path.",
                        "path": str(project),
                    }
                },
            },
        }
    )

    result = await ToolExecutor(config).execute(
        "read_project_file",
        {"path": "service.py", "start_line": 2, "end_line": 3},
        request_id="req-1",
        model="qwen",
    )

    assert result["ok"] is False
    assert result["error"] == "end_line 3 exceeds file line count 2"


@pytest.mark.asyncio
async def test_tool_executor_runs_project_graph_tool_from_runtime_context(tmp_path):
    db_path = tmp_path / "projects.db"
    prepare_projects_db(db_path)
    project_store = ProjectStoreOrm(sqlite_url_for_path(db_path))
    project = project_store.create_project(name="Llama Pack", root_hint="/repo")
    project_store.close()
    graph_store = ProjectGraphStoreOrm(sqlite_url_for_path(db_path))
    snapshot = graph_store.create_snapshot(project_id=str(project["id"]), node_name="local", root_path="/repo", git_commit=None)
    graph_store.replace_snapshot_graph(
        snapshot_id=str(snapshot["id"]),
        files=[
            {
                "id": "file-ui",
                "path": "frontend/src/App.tsx",
                "language": "typescript",
                "content_hash": "hash-ui",
                "size_bytes": 42,
                "mtime_ns": 1,
                "parse_status": "parsed",
                "parse_error": None,
            }
        ],
        symbols=[
            {
                "id": "sym-app",
                "file_id": "file-ui",
                "qualified_name": "frontend.src.App.App",
                "name": "App",
                "kind": "component",
                "language": "typescript",
                "start_line": 1,
                "end_line": 5,
                "signature": "export function App()",
                "doc_summary": None,
                "exported": True,
                "confidence": 1.0,
            }
        ],
        imports=[],
        relations=[],
    )
    graph_store.activate_snapshot(str(snapshot["id"]))
    config = load_config({"mode": "agent", "log_dir": str(tmp_path), "agent_tools": {"enabled": True}})

    result = await ToolExecutor(
        config,
        project_graph_context=ProjectGraphToolContext(project_id=str(project["id"]), store=graph_store),
    ).execute("graph_find_symbol", {"query": "App"}, request_id="req-1", model="qwen")

    assert result["ok"] is True
    assert result["symbols"][0]["id"] == "sym-app"


@pytest.mark.asyncio
async def test_project_graph_trace_callers_defaults_to_indexed_call_relation_type(tmp_path):
    db_path = tmp_path / "projects.db"
    prepare_projects_db(db_path)
    project_store = ProjectStoreOrm(sqlite_url_for_path(db_path))
    project = project_store.create_project(name="Llama Pack", root_hint="/repo")
    project_store.close()
    graph_store = ProjectGraphStoreOrm(sqlite_url_for_path(db_path))
    snapshot = graph_store.create_snapshot(project_id=str(project["id"]), node_name="local", root_path="/repo", git_commit=None)
    graph_store.replace_snapshot_graph(
        snapshot_id=str(snapshot["id"]),
        files=[
            {
                "id": "file-api",
                "path": "api.py",
                "language": "python",
                "content_hash": "hash-api",
                "size_bytes": 100,
                "mtime_ns": 1,
                "parse_status": "parsed",
                "parse_error": None,
            }
        ],
        symbols=[
            {
                "id": "sym-caller",
                "file_id": "file-api",
                "qualified_name": "api.caller",
                "name": "caller",
                "kind": "function",
                "language": "python",
                "start_line": 1,
                "end_line": 2,
                "signature": "def caller()",
                "doc_summary": None,
                "exported": True,
                "confidence": 1.0,
            },
            {
                "id": "sym-callee",
                "file_id": "file-api",
                "qualified_name": "api.callee",
                "name": "callee",
                "kind": "function",
                "language": "python",
                "start_line": 4,
                "end_line": 5,
                "signature": "def callee()",
                "doc_summary": None,
                "exported": True,
                "confidence": 1.0,
            },
        ],
        imports=[],
        relations=[
            {
                "id": "rel-call",
                "source_symbol_id": "sym-caller",
                "target_symbol_id": "sym-callee",
                "source_file_id": "file-api",
                "target_file_id": "file-api",
                "relation_type": "calls_best_effort",
                "start_line": 2,
                "end_line": 2,
                "confidence": 0.7,
                "evidence": {"call": "callee"},
            }
        ],
    )
    graph_store.activate_snapshot(str(snapshot["id"]))

    result = await execute_project_graph_tool(
        ProjectGraphToolContext(project_id=str(project["id"]), store=graph_store),
        "graph_trace_callers",
        {"symbol_id": "sym-callee"},
    )

    assert result["ok"] is True
    assert result["relations"][0]["target_symbol"]["id"] == "sym-caller"


@pytest.mark.asyncio
async def test_tool_executor_rejects_dynamic_file_path_traversal(tmp_path):
    project = tmp_path / "project"
    project.mkdir()
    (tmp_path / "secret.txt").write_text("secret", encoding="utf-8")
    config = load_config(
        {
            "mode": "agent",
            "log_dir": str(tmp_path),
            "agent_tools": {
                "enabled": True,
                "safe_roots": [str(project)],
                "tools": {
                    "read_project_file": {
                        "type": "file_read_dynamic",
                        "description": "Read a project file by relative path.",
                        "path": str(project),
                    }
                },
            },
        }
    )

    result = await ToolExecutor(config).execute(
        "read_project_file",
        {"path": "../secret.txt"},
        request_id="req-1",
        model="qwen",
    )

    assert result["ok"] is False
    assert "outside configured root" in str(result["error"])


@pytest.mark.asyncio
async def test_tool_executor_runs_configured_shell_command(tmp_path):
    config = load_config(
        {
            "mode": "agent",
            "log_dir": str(tmp_path),
            "agent_tools": {
                "enabled": True,
                "tools": {
                    "say_ok": {
                        "type": "shell",
                        "description": "Say ok.",
                        "command": ["printf", "ok"],
                    }
                },
            },
        }
    )

    result = await ToolExecutor(config).execute("say_ok", {}, request_id="req-1", model="qwen")

    assert result["ok"] is True
    assert result["exit_code"] == 0
    assert result["content"] == "ok"


@pytest.mark.asyncio
async def test_tool_executor_calls_configured_http_endpoint(tmp_path, monkeypatch):
    requests = []

    class FakeAsyncClient:
        def __init__(self, timeout):
            self.timeout = timeout

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def request(self, method, url):
            requests.append((method, url, self.timeout))
            return httpx.Response(200, text="healthy")

    monkeypatch.setattr("llama_pack.core.agent_tools.adapters.http.httpx.AsyncClient", FakeAsyncClient)
    config = load_config(
        {
            "mode": "agent",
            "log_dir": str(tmp_path),
            "agent_tools": {
                "enabled": True,
                "tools": {
                    "health": {
                        "type": "http",
                        "description": "Health.",
                        "method": "GET",
                        "url": "http://127.0.0.1:9137/health",
                    }
                },
            },
        }
    )

    result = await ToolExecutor(config).execute("health", {}, request_id="req-1", model="qwen")

    assert result["ok"] is True
    assert result["status_code"] == 200
    assert result["content"] == "healthy"
    assert requests == [("GET", "http://127.0.0.1:9137/health", 10.0)]


@pytest.mark.asyncio
async def test_tool_executor_lists_configured_directory_with_bounds(tmp_path):
    root = tmp_path / "project"
    (root / "src" / "nested").mkdir(parents=True)
    (root / "src" / "app.py").write_text("print('ok')", encoding="utf-8")
    (root / "src" / "nested" / "deep.py").write_text("print('deep')", encoding="utf-8")
    (root / ".secret").write_text("hidden", encoding="utf-8")
    (root / "README.md").write_text("readme", encoding="utf-8")
    config = load_config(
        {
            "mode": "agent",
            "log_dir": str(tmp_path),
            "agent_tools": {
                "enabled": True,
                "safe_roots": [str(tmp_path)],
                "tools": {
                    "list_project": {
                        "type": "directory_list",
                        "description": "List project.",
                        "path": str(root),
                        "recursive": True,
                        "max_depth": 1,
                        "max_entries": 10,
                        "include_hidden": False,
                    }
                },
            },
        }
    )

    result = await ToolExecutor(config).execute("list_project", {}, request_id="req-1", model="qwen")

    assert result["ok"] is True
    assert result["root"] == str(root.resolve())
    assert result["truncated"] is False
    assert result["entries"] == [
        {"path": "README.md", "type": "file"},
        {"path": "src", "type": "directory"},
        {"path": "src/app.py", "type": "file"},
        {"path": "src/nested", "type": "directory"},
    ]


@pytest.mark.asyncio
async def test_tool_executor_directory_list_truncates_entries(tmp_path):
    root = tmp_path / "project"
    root.mkdir()
    for index in range(3):
        (root / f"file-{index}.txt").write_text(str(index), encoding="utf-8")
    config = load_config(
        {
            "mode": "agent",
            "log_dir": str(tmp_path),
            "agent_tools": {
                "enabled": True,
                "safe_roots": [str(tmp_path)],
                "tools": {
                    "list_project": {
                        "type": "directory_list",
                        "description": "List project.",
                        "path": str(root),
                        "max_entries": 2,
                    }
                },
            },
        }
    )

    result = await ToolExecutor(config).execute("list_project", {}, request_id="req-1", model="qwen")

    assert result["ok"] is True
    assert result["truncated"] is True
    assert [entry["path"] for entry in result["entries"]] == ["file-0.txt", "file-1.txt"]


@pytest.mark.asyncio
async def test_tool_executor_returns_error_for_unknown_tool(tmp_path):
    config = load_config({"mode": "agent", "log_dir": str(tmp_path), "agent_tools": {"enabled": True}})

    result = await ToolExecutor(config).execute("missing", {}, request_id="req-1", model="qwen")

    assert result["ok"] is False
    assert "Unknown tool" in result["error"]


@pytest.mark.asyncio
async def test_tool_executor_dispatches_through_adapter_map(tmp_path):
    config = load_config(
        {
            "mode": "agent",
            "log_dir": str(tmp_path),
            "agent_tools": {
                "enabled": True,
                "tools": {
                    "say_ok": {
                        "type": "shell",
                        "description": "Say ok.",
                        "command": ["unused"],
                    }
                },
            },
        }
    )
    calls = []

    class FakeAdapter:
        async def execute(self, tool, arguments):
            calls.append((tool.command, arguments))
            return {"ok": True, "content": "from fake adapter"}

    result = await ToolExecutor(config, adapters={"shell": FakeAdapter()}).execute(
        "say_ok",
        {"value": 1},
        request_id="req-1",
        model="qwen",
    )

    assert result == {"ok": True, "content": "from fake adapter"}
    assert calls == [(["unused"], {"value": 1})]


@pytest.mark.asyncio
async def test_tool_loop_handles_one_tool_call_then_final_answer(tmp_path):
    config = load_config(
        {
            "mode": "agent",
            "log_dir": str(tmp_path),
            "agent_tools": {
                "enabled": True,
                "safe_roots": [str(tmp_path)],
                "tools": {
                    "read_status": {
                        "type": "file_read",
                        "description": "Read status.",
                        "path": str(tmp_path / "status.txt"),
                    }
                },
            },
        }
    )
    (tmp_path / "status.txt").write_text("agent ok", encoding="utf-8")

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
            return {"choices": [{"message": {"role": "assistant", "content": "status is agent ok"}}]}, {"route": "local"}

    proxy = Proxy()
    loop = AgentToolLoop(config, proxy)

    response, meta = await loop.run(
        "qwen",
        {"messages": [{"role": "user", "content": "check status"}]},
        request_id="req-1",
    )

    assert response["choices"][0]["message"]["content"] == "status is agent ok"
    assert meta["route"] == "local"
    assert "tools" in proxy.calls[0]
    assert proxy.calls[1]["messages"][-1]["role"] == "tool"
    assert proxy.calls[1]["messages"][-1]["tool_call_id"] == "call-1"


@pytest.mark.asyncio
async def test_tool_loop_stops_at_max_iterations(tmp_path):
    config = load_config(
        {
            "mode": "agent",
            "log_dir": str(tmp_path),
            "agent_tools": {
                "enabled": True,
                "max_iterations": 1,
                "safe_roots": [str(tmp_path)],
                "tools": {
                    "read_status": {
                        "type": "file_read",
                        "description": "Read status.",
                        "path": str(tmp_path / "status.txt"),
                    }
                },
            },
        }
    )
    (tmp_path / "status.txt").write_text("agent ok", encoding="utf-8")

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
                                    "id": "call-1",
                                    "type": "function",
                                    "function": {"name": "read_status", "arguments": "{}"},
                                }
                            ],
                        }
                    }
                ]
            }, {"route": "local"}

    with pytest.raises(RuntimeError, match="max_iterations"):
        await AgentToolLoop(config, Proxy()).run("qwen", {"messages": [{"role": "user", "content": "loop"}]})


@pytest.mark.asyncio
async def test_tool_loop_honors_request_max_iterations_override(tmp_path):
    config = load_config(
        {
            "mode": "agent",
            "log_dir": str(tmp_path),
            "agent_tools": {
                "enabled": True,
                "max_iterations": 1,
                "safe_roots": [str(tmp_path)],
                "tools": {
                    "read_status": {
                        "type": "file_read",
                        "description": "Read status.",
                        "path": str(tmp_path / "status.txt"),
                    }
                },
            },
        }
    )
    (tmp_path / "status.txt").write_text("agent ok", encoding="utf-8")

    class Proxy:
        def __init__(self):
            self.calls = 0

        async def chat_with_meta(self, model_name, payload):
            self.calls += 1
            if self.calls < 3:
                return {
                    "choices": [
                        {
                            "message": {
                                "role": "assistant",
                                "content": "",
                                "tool_calls": [
                                    {
                                        "id": f"call-{self.calls}",
                                        "type": "function",
                                        "function": {"name": "read_status", "arguments": "{}"},
                                    }
                                ],
                            }
                        }
                    ]
                }, {"route": "local"}
            return {"choices": [{"message": {"role": "assistant", "content": "done"}}]}, {"route": "local"}

    response, _meta = await AgentToolLoop(config, Proxy()).run(
        "qwen",
        {
            "messages": [{"role": "user", "content": "loop"}],
            "agent_tool_max_iterations": 3,
        },
    )

    assert response["choices"][0]["message"]["content"] == "done"


@pytest.mark.asyncio
async def test_tool_loop_revises_unverified_project_graph_answer(tmp_path):
    db_path = tmp_path / "projects.db"
    prepare_projects_db(db_path)
    graph_store = ProjectGraphStoreOrm(sqlite_url_for_path(db_path))
    project_id = "project-1"
    snapshot = graph_store.create_snapshot(project_id=project_id, node_name="local", root_path=str(tmp_path), git_commit=None)
    graph_store.replace_snapshot_graph(
        snapshot_id=str(snapshot["id"]),
        files=[
            {
                "id": "file-runner",
                "path": "llama_pack/core/benchmarks/runner.py",
                "language": "python",
                "size_bytes": 10,
                "content_hash": "hash",
                "mtime_ns": 1,
                "parse_status": "parsed",
                "parse_error": None,
            }
        ],
        symbols=[],
        imports=[],
        relations=[],
    )
    graph_store.activate_snapshot(str(snapshot["id"]))
    config = load_config({"mode": "agent", "log_dir": str(tmp_path), "agent_tools": {"enabled": True}})

    class Proxy:
        def __init__(self):
            self.messages = []

        async def chat_with_meta(self, model_name, payload):
            self.messages.append(payload["messages"])
            if len(self.messages) == 1:
                return {"choices": [{"message": {"role": "assistant", "content": "Edit `src/repositories/sample_repository.py`."}}]}, {"route": "local"}
            return {
                "choices": [
                    {
                        "message": {
                            "role": "assistant",
                            "content": "I could not verify that path. Use `llama_pack/core/benchmarks/runner.py`.",
                        }
                    }
                ]
            }, {"route": "local"}

    proxy = Proxy()
    trace_recorder = RuntimeTraceRecorder(trace_id="trace-1", source="agent_tool_loop", scope="chat_completion")
    response, _meta = await AgentToolLoop(
        config,
        proxy,
        trace_recorder=trace_recorder,
        project_graph_context=ProjectGraphToolContext(project_id=project_id, store=graph_store),
    ).run("qwen", {"messages": [{"role": "user", "content": "trace BenchmarkRunner"}]})

    assert "llama_pack/core/benchmarks/runner.py" in response["choices"][0]["message"]["content"]
    assert "src/repositories/sample_repository.py" not in response["choices"][0]["message"]["content"]
    assert "Your draft contains unverified codebase claims" in proxy.messages[1][-1]["content"]
    assert "<draft_answer>" in proxy.messages[1][-1]["content"]
    assert "Edit `src/repositories/sample_repository.py`." in proxy.messages[1][-1]["content"]
    assert "</draft_answer>" in proxy.messages[1][-1]["content"]
    event_types = [event["event_type"] for event in trace_recorder.events]
    assert "answer_verification_started" in event_types
    assert "answer_verification_failed" in event_types
    failed_event = next(event for event in trace_recorder.events if event["event_type"] == "answer_verification_failed")
    assert failed_event["payload"]["issues"] == [
        {
            "kind": "missing_path",
            "value": "src/repositories/sample_repository.py",
            "start": len("Edit `"),
            "end": len("Edit `") + len("src/repositories/sample_repository.py"),
            "excerpt": "`src/repositories/sample_repository.py`",
            "severity": "failed",
        }
    ]


@pytest.mark.asyncio
async def test_tool_loop_revises_trace_answer_without_structured_edge_evidence(tmp_path):
    db_path = tmp_path / "projects.db"
    prepare_projects_db(db_path)
    graph_store = ProjectGraphStoreOrm(sqlite_url_for_path(db_path))
    project_id = "project-1"
    root = tmp_path / "project"
    root.mkdir()
    source = root / "llama_pack" / "api" / "routes" / "benchmarks.py"
    source.parent.mkdir(parents=True)
    source.write_text("asyncio.create_task(runner.execute_run(run[\"id\"]))\n", encoding="utf-8")
    snapshot = graph_store.create_snapshot(project_id=project_id, node_name="local", root_path=str(root), git_commit=None)
    graph_store.replace_snapshot_graph(
        snapshot_id=str(snapshot["id"]),
        files=[
            {
                "id": "file-benchmarks",
                "path": "llama_pack/api/routes/benchmarks.py",
                "language": "python",
                "size_bytes": source.stat().st_size,
                "content_hash": "hash",
                "mtime_ns": 1,
                "parse_status": "parsed",
                "parse_error": None,
            }
        ],
        symbols=[
            {
                "id": "sym-execute-run",
                "file_id": "file-benchmarks",
                "name": "execute_run",
                "qualified_name": "llama_pack.core.benchmarks.runner.BenchmarkRunner.execute_run",
                "kind": "method",
                "language": "python",
                "start_line": 1,
                "end_line": 1,
                "signature": "async def execute_run",
                "doc_summary": None,
                "exported": False,
                "confidence": 1.0,
            }
        ],
        imports=[],
        relations=[],
    )
    graph_store.activate_snapshot(str(snapshot["id"]))
    config = load_config({"mode": "agent", "log_dir": str(tmp_path), "agent_tools": {"enabled": True}})

    class Proxy:
        def __init__(self):
            self.messages = []

        async def chat_with_meta(self, model_name, payload):
            self.messages.append(payload["messages"])
            if len(self.messages) == 1:
                return {
                    "choices": [
                        {
                            "message": {
                                "role": "assistant",
                                "content": (
                                    "Ordered Call Path\n"
                                    "llama_pack.api.routes.benchmarks.start_runs -> BenchmarkRunner.execute_run\n"
                                    "Handoff: In llama_pack/api/routes/benchmarks.py at line 123: "
                                    "asyncio.create_task(runner.execute_run(run[\"id\"]))"
                                ),
                            }
                        }
                    ]
                }, {"route": "local"}
            return {
                "choices": [
                    {
                        "message": {
                            "role": "assistant",
                            "content": (
                                "1. from_symbol=benchmarks.start_runs to_symbol=BenchmarkRunner.execute_run "
                                "file=llama_pack/api/routes/benchmarks.py "
                                "statement='asyncio.create_task(runner.execute_run(run[\"id\"]))'"
                            ),
                        }
                    }
                ]
            }, {"route": "local"}

    proxy = Proxy()
    response, _meta = await AgentToolLoop(
        config,
        proxy,
        project_graph_context=ProjectGraphToolContext(project_id=project_id, store=graph_store),
    ).run("qwen", {"messages": [{"role": "user", "content": "trace benchmark runtime path"}]})

    assert response["llama_pack"]["verification"]["status"] == "verified"
    assert "from_symbol=benchmarks.start_runs" in response["choices"][0]["message"]["content"]
    assert "Unsupported source evidence: runtime trace edges" in proxy.messages[1][-1]["content"]


@pytest.mark.asyncio
async def test_tool_loop_revises_code_claims_without_tool_evidence(tmp_path):
    db_path = tmp_path / "projects.db"
    prepare_projects_db(db_path)
    graph_store = ProjectGraphStoreOrm(sqlite_url_for_path(db_path))
    project_id = "project-1"
    snapshot = graph_store.create_snapshot(project_id=project_id, node_name="local", root_path=str(tmp_path), git_commit=None)
    graph_store.replace_snapshot_graph(
        snapshot_id=str(snapshot["id"]),
        files=[
            {
                "id": "file-runner",
                "path": "llama_pack/core/benchmarks/runner.py",
                "language": "python",
                "size_bytes": 10,
                "content_hash": "hash",
                "mtime_ns": 1,
                "parse_status": "parsed",
                "parse_error": None,
            }
        ],
        symbols=[
            {
                "id": "sym-runner",
                "file_id": "file-runner",
                "name": "BenchmarkRunner",
                "qualified_name": "llama_pack.core.benchmarks.runner.BenchmarkRunner",
                "kind": "class",
                "language": "python",
                "start_line": 1,
                "end_line": 10,
                "signature": "class BenchmarkRunner",
                "doc_summary": None,
                "exported": True,
                "confidence": 1.0,
            }
        ],
        imports=[],
        relations=[],
    )
    graph_store.activate_snapshot(str(snapshot["id"]))
    config = load_config({"mode": "agent", "log_dir": str(tmp_path), "agent_tools": {"enabled": True}})

    class Proxy:
        def __init__(self):
            self.messages = []

        async def chat_with_meta(self, model_name, payload):
            self.messages.append(payload["messages"])
            if len(self.messages) == 1:
                return {
                    "choices": [
                        {
                            "message": {
                                "role": "assistant",
                                "content": "Use `llama_pack/core/benchmarks/runner.py` and BenchmarkRunner.",
                            }
                        }
                    ]
                }, {"route": "local"}
            return {
                "choices": [
                    {
                        "message": {
                            "role": "assistant",
                            "content": "Verified with source tools: `llama_pack/core/benchmarks/runner.py` defines BenchmarkRunner.",
                        }
                    }
                ]
            }, {"route": "local"}

    proxy = Proxy()
    response, _meta = await AgentToolLoop(
        config,
        proxy,
        project_graph_context=ProjectGraphToolContext(project_id=project_id, store=graph_store),
    ).run("qwen", {"messages": [{"role": "user", "content": "trace BenchmarkRunner"}]})

    assert "Verified with source tools" in response["choices"][0]["message"]["content"]
    assert "No project/source tool evidence was captured" in proxy.messages[1][-1]["content"]


@pytest.mark.asyncio
async def test_tool_loop_fails_closed_when_revised_answer_is_unverified(tmp_path):
    db_path = tmp_path / "projects.db"
    prepare_projects_db(db_path)
    graph_store = ProjectGraphStoreOrm(sqlite_url_for_path(db_path))
    project_id = "project-1"
    snapshot = graph_store.create_snapshot(project_id=project_id, node_name="local", root_path=str(tmp_path), git_commit=None)
    graph_store.replace_snapshot_graph(snapshot_id=str(snapshot["id"]), files=[], symbols=[], imports=[], relations=[])
    graph_store.activate_snapshot(str(snapshot["id"]))
    config = load_config({"mode": "agent", "log_dir": str(tmp_path), "agent_tools": {"enabled": True}})

    class Proxy:
        async def chat_with_meta(self, model_name, payload):
            return {
                "choices": [
                    {
                        "message": {
                            "role": "assistant",
                            "content": "Route: `src/api/v1/endpoints/benchmark.py`; Runner: `src/services/benchmark_runner.py`.",
                        }
                    }
                ]
            }, {"route": "local"}

    response, _meta = await AgentToolLoop(
        config,
        Proxy(),
        project_graph_context=ProjectGraphToolContext(project_id=project_id, store=graph_store),
    ).run("qwen", {"messages": [{"role": "user", "content": "trace BenchmarkRunner"}]})

    content = response["choices"][0]["message"]["content"]
    assert "I could not verify the codebase claims" in content
    assert "src/api/v1/endpoints/benchmark.py" not in content
    assert "src/services/benchmark_runner.py" not in content


@pytest.mark.asyncio
async def test_tool_executor_searches_files_by_glob(tmp_path):
    root = tmp_path / "project"
    (root / "src").mkdir(parents=True)
    (root / "src" / "app.py").write_text("print('app')", encoding="utf-8")
    (root / "src" / "util.py").write_text("print('util')", encoding="utf-8")
    (root / "README.md").write_text("readme", encoding="utf-8")
    config = load_config(
        {
            "mode": "agent",
            "log_dir": str(tmp_path),
            "agent_tools": {
                "enabled": True,
                "safe_roots": [str(tmp_path)],
                "tools": {
                    "find_py": {
                        "type": "file_search",
                        "description": "Find Python files.",
                        "path": str(root),
                        "glob": "**/*.py",
                        "max_entries": 200,
                        "include_hidden": False,
                    }
                },
            },
        }
    )

    result = await ToolExecutor(config).execute("find_py", {}, request_id="req-1", model="qwen")

    assert result["ok"] is True
    assert result["root"] == str(root.resolve())
    assert result["truncated"] is False
    assert result["matches"] == ["src/app.py", "src/util.py"]


@pytest.mark.asyncio
async def test_tool_executor_file_search_truncates_matches(tmp_path):
    root = tmp_path / "project"
    root.mkdir()
    for i in range(5):
        (root / f"file-{i}.txt").write_text(str(i), encoding="utf-8")
    config = load_config(
        {
            "mode": "agent",
            "log_dir": str(tmp_path),
            "agent_tools": {
                "enabled": True,
                "safe_roots": [str(tmp_path)],
                "tools": {
                    "find_txt": {
                        "type": "file_search",
                        "description": "Find text files.",
                        "path": str(root),
                        "glob": "*.txt",
                        "max_entries": 3,
                    }
                },
            },
        }
    )

    result = await ToolExecutor(config).execute("find_txt", {}, request_id="req-1", model="qwen")

    assert result["ok"] is True
    assert result["truncated"] is True
    assert len(result["matches"]) == 3


@pytest.mark.asyncio
async def test_tool_executor_file_search_excludes_hidden_files(tmp_path):
    root = tmp_path / "project"
    root.mkdir()
    (root / "visible.py").write_text("ok", encoding="utf-8")
    (root / ".hidden.py").write_text("hidden", encoding="utf-8")
    hidden_dir = root / ".git"
    hidden_dir.mkdir()
    (hidden_dir / "config").write_text("git config", encoding="utf-8")
    config = load_config(
        {
            "mode": "agent",
            "log_dir": str(tmp_path),
            "agent_tools": {
                "enabled": True,
                "safe_roots": [str(tmp_path)],
                "tools": {
                    "find_all": {
                        "type": "file_search",
                        "description": "Find files.",
                        "path": str(root),
                        "glob": "**/*",
                        "include_hidden": False,
                    }
                },
            },
        }
    )

    result = await ToolExecutor(config).execute("find_all", {}, request_id="req-1", model="qwen")

    assert result["ok"] is True
    assert result["matches"] == ["visible.py"]


def _make_text_search_config(tmp_path, root, **overrides):
    tool = {
        "type": "text_search",
        "description": "Search source.",
        "path": str(root),
        "glob": "**/*.py",
        "parameters": {
            "type": "object",
            "properties": {"query": {"type": "string"}},
            "required": ["query"],
            "additionalProperties": False,
        },
    }
    tool.update(overrides)
    return load_config(
        {
            "mode": "agent",
            "log_dir": str(tmp_path),
            "agent_tools": {
                "enabled": True,
                "safe_roots": [str(tmp_path)],
                "tools": {"search_src": tool},
            },
        }
    )


@pytest.mark.asyncio
async def test_tool_executor_text_search_finds_matches(tmp_path):
    root = tmp_path / "project"
    (root / "src").mkdir(parents=True)
    (root / "src" / "app.py").write_text("def hello():\n    return 'hello world'\n", encoding="utf-8")
    (root / "src" / "util.py").write_text("def helper():\n    pass\n", encoding="utf-8")
    config = _make_text_search_config(tmp_path, root)

    result = await ToolExecutor(config).execute("search_src", {"query": "hello"}, request_id="req-1", model="qwen")

    assert result["ok"] is True
    assert result["root"] == str(root.resolve())
    assert result["query"] == "hello"
    assert result["truncated"] is False
    assert result["matches"] == [
        {"file": "src/app.py", "line": 1, "text": "def hello():"},
        {"file": "src/app.py", "line": 2, "text": "    return 'hello world'"},
    ]
    assert result["locations"] == [
        {"path": "src/app.py", "start_line": 1, "end_line": 1},
        {"path": "src/app.py", "start_line": 2, "end_line": 2},
    ]


@pytest.mark.asyncio
async def test_text_search_trace_payload_includes_match_locations(tmp_path):
    root = tmp_path / "project"
    root.mkdir()
    (root / "mod.py").write_text("alpha\nneedle\nneedle again\n", encoding="utf-8")
    config = _make_text_search_config(tmp_path, root, glob="*.py")
    recorder = RuntimeTraceRecorder(trace_id="trace-1", source="agent_tool_loop", scope="chat_completion")

    await ToolExecutor(config, trace_recorder=recorder).execute(
        "search_src",
        {"query": "needle"},
        request_id="req-1",
        model="qwen",
        tool_call_id="call-1",
    )

    completed = [event for event in recorder.events if event["event_type"] == "tool_call_completed"]
    assert completed[0]["payload"]["result"]["locations"] == [
        {"path": "mod.py", "start_line": 2, "end_line": 2},
        {"path": "mod.py", "start_line": 3, "end_line": 3},
    ]


@pytest.mark.asyncio
async def test_tool_executor_text_search_is_case_insensitive_by_default(tmp_path):
    root = tmp_path / "project"
    root.mkdir()
    (root / "mod.py").write_text("class MyClass:\n    CONSTANT = 'VALUE'\n", encoding="utf-8")
    config = _make_text_search_config(tmp_path, root, glob="*.py")

    result = await ToolExecutor(config).execute("search_src", {"query": "myclass"}, request_id="req-1", model="qwen")

    assert result["ok"] is True
    assert result["matches"][0]["line"] == 1


@pytest.mark.asyncio
async def test_tool_executor_text_search_truncates_at_max_matches(tmp_path):
    root = tmp_path / "project"
    root.mkdir()
    lines = "\n".join(f"hit_{i} = True" for i in range(10))
    (root / "big.py").write_text(lines, encoding="utf-8")
    config = _make_text_search_config(tmp_path, root, glob="*.py", max_matches=3)

    result = await ToolExecutor(config).execute("search_src", {"query": "hit_"}, request_id="req-1", model="qwen")

    assert result["ok"] is True
    assert result["truncated"] is True
    assert len(result["matches"]) == 3


@pytest.mark.asyncio
async def test_tool_executor_text_search_skips_binary_files(tmp_path):
    root = tmp_path / "project"
    root.mkdir()
    (root / "binary.py").write_bytes(b"some text\x00with null byte\n")
    (root / "text.py").write_text("target = True\n", encoding="utf-8")
    config = _make_text_search_config(tmp_path, root, glob="*.py")

    result = await ToolExecutor(config).execute("search_src", {"query": "target"}, request_id="req-1", model="qwen")

    assert result["ok"] is True
    assert len(result["matches"]) == 1
    assert result["matches"][0]["file"] == "text.py"


@pytest.mark.asyncio
async def test_tool_executor_text_search_skips_oversized_files(tmp_path):
    root = tmp_path / "project"
    root.mkdir()
    (root / "large.py").write_text("needle\n" * 200, encoding="utf-8")
    (root / "small.py").write_text("needle\n", encoding="utf-8")
    config = _make_text_search_config(tmp_path, root, glob="*.py", max_file_bytes=10)

    result = await ToolExecutor(config).execute("search_src", {"query": "needle"}, request_id="req-1", model="qwen")

    assert result["ok"] is True
    assert all(m["file"] == "small.py" for m in result["matches"])


@pytest.mark.asyncio
async def test_tool_executor_text_search_returns_error_without_query(tmp_path):
    root = tmp_path / "project"
    root.mkdir()
    config = _make_text_search_config(tmp_path, root)

    result = await ToolExecutor(config).execute("search_src", {}, request_id="req-1", model="qwen")

    assert result["ok"] is False
    assert "query" in result["error"]


@pytest.mark.asyncio
async def test_tool_executor_text_search_regex_matches(tmp_path):
    root = tmp_path / "project"
    root.mkdir()
    (root / "mod.py").write_text("def get_user():\n    return user_id\n", encoding="utf-8")
    config = _make_text_search_config(tmp_path, root, glob="*.py", regex=True)

    result = await ToolExecutor(config).execute("search_src", {"query": r"def \w+\("}, request_id="req-1", model="qwen")

    assert result["ok"] is True
    assert result["matches"] == [{"file": "mod.py", "line": 1, "text": "def get_user():"}]


@pytest.mark.asyncio
async def test_tool_executor_text_search_invalid_regex_returns_error(tmp_path):
    root = tmp_path / "project"
    root.mkdir()
    config = _make_text_search_config(tmp_path, root, glob="*.py", regex=True)

    result = await ToolExecutor(config).execute("search_src", {"query": r"[unclosed"}, request_id="req-1", model="qwen")

    assert result["ok"] is False
    assert "invalid regex" in result["error"]


def _make_git_repo(path):
    subprocess.run(["git", "init", str(path)], check=True, capture_output=True)
    subprocess.run(["git", "-C", str(path), "config", "user.email", "test@example.com"], check=True, capture_output=True)
    subprocess.run(["git", "-C", str(path), "config", "user.name", "Test"], check=True, capture_output=True)
    (path / "README.md").write_text("init", encoding="utf-8")
    subprocess.run(["git", "-C", str(path), "add", "."], check=True, capture_output=True)
    subprocess.run(["git", "-C", str(path), "commit", "-m", "init"], check=True, capture_output=True)
    subprocess.run(["git", "-C", str(path), "checkout", "-B", "main"], check=True, capture_output=True)


def _make_git_status_config(tmp_path, repo):
    return load_config(
        {
            "mode": "agent",
            "log_dir": str(tmp_path),
            "agent_tools": {
                "enabled": True,
                "safe_roots": [str(tmp_path)],
                "tools": {
                    "repo_status": {
                        "type": "git_status",
                        "description": "Show repo status.",
                        "path": str(repo),
                    }
                },
            },
        }
    )


@pytest.mark.asyncio
async def test_tool_executor_git_status_clean_repo(tmp_path):
    repo = tmp_path / "myrepo"
    repo.mkdir()
    _make_git_repo(repo)
    config = _make_git_status_config(tmp_path, repo)

    result = await ToolExecutor(config).execute("repo_status", {}, request_id="req-1", model="qwen")

    assert result["ok"] is True
    assert result["branch"] == "main"
    assert result["clean"] is True
    assert result["changed"] == []


@pytest.mark.asyncio
async def test_tool_executor_git_status_shows_changed_files(tmp_path):
    repo = tmp_path / "myrepo"
    repo.mkdir()
    _make_git_repo(repo)
    (repo / "README.md").write_text("modified", encoding="utf-8")
    (repo / "new.py").write_text("print('new')", encoding="utf-8")
    config = _make_git_status_config(tmp_path, repo)

    result = await ToolExecutor(config).execute("repo_status", {}, request_id="req-1", model="qwen")

    assert result["ok"] is True
    assert result["clean"] is False
    paths = [m["path"] for m in result["changed"]]
    assert "README.md" in paths
    assert "new.py" in paths


@pytest.mark.asyncio
async def test_tool_executor_git_status_non_repo_returns_error(tmp_path):
    not_a_repo = tmp_path / "plain_dir"
    not_a_repo.mkdir()
    config = _make_git_status_config(tmp_path, not_a_repo)

    result = await ToolExecutor(config).execute("repo_status", {}, request_id="req-1", model="qwen")

    assert result["ok"] is False
    assert result["error"]


class FakeProcessManager:
    def __init__(self, statuses):
        self._statuses = statuses

    def list_statuses(self):
        return self._statuses


def _fake_status(name, running, pid, port, family):
    return {"name": name, "running": running, "pid": pid, "port": port, "family": family}


def _make_process_status_config(tmp_path):
    return load_config(
        {
            "mode": "agent",
            "log_dir": str(tmp_path),
            "agent_tools": {
                "enabled": True,
                "tools": {
                    "model_health": {
                        "type": "process_status",
                        "description": "Report model server health.",
                    }
                },
            },
        }
    )


@pytest.mark.asyncio
async def test_tool_executor_process_status_reports_running_models(tmp_path):
    config = _make_process_status_config(tmp_path)
    manager = FakeProcessManager(
        [
            _fake_status("gemma", True, 12345, 8081, "gemma"),
            _fake_status("qwen", False, None, 8082, "qwen"),
        ]
    )

    result = await ToolExecutor(config, process_manager=manager).execute(
        "model_health", {}, request_id="req-1", model="qwen"
    )

    assert result["ok"] is True
    assert result["total"] == 2
    assert result["truncated"] is False
    assert result["processes"] == [
        {"name": "gemma", "running": True, "pid": 12345, "port": 8081, "family": "gemma"},
        {"name": "qwen", "running": False, "pid": None, "port": 8082, "family": "qwen"},
    ]


@pytest.mark.asyncio
async def test_tool_executor_process_status_truncates_at_max_entries(tmp_path):
    config = load_config(
        {
            "mode": "agent",
            "log_dir": str(tmp_path),
            "agent_tools": {
                "enabled": True,
                "tools": {
                    "model_health": {
                        "type": "process_status",
                        "description": "Report model server health.",
                        "max_entries": 1,
                    }
                },
            },
        }
    )
    manager = FakeProcessManager(
        [_fake_status(f"model-{i}", False, None, 8080 + i, "family") for i in range(3)]
    )

    result = await ToolExecutor(config, process_manager=manager).execute(
        "model_health", {}, request_id="req-1", model="qwen"
    )

    assert result["ok"] is True
    assert result["total"] == 3
    assert result["truncated"] is True
    assert len(result["processes"]) == 1


@pytest.mark.asyncio
async def test_tool_executor_process_status_no_manager_returns_error(tmp_path):
    config = _make_process_status_config(tmp_path)

    result = await ToolExecutor(config).execute("model_health", {}, request_id="req-1", model="qwen")

    assert result["ok"] is False
    assert "process manager" in result["error"]


# ---------------------------------------------------------------------------
# file_write
# ---------------------------------------------------------------------------


def _make_file_write_config(tmp_path, file_path, *, write_mode="append", max_write_bytes=32768):
    return load_config(
        {
            "mode": "agent",
            "log_dir": str(tmp_path),
            "agent_tools": {
                "enabled": True,
                "safe_roots": [str(tmp_path)],
                "tools": {
                    "agent_notes": {
                        "type": "file_write",
                        "description": "Write a note.",
                        "path": str(file_path),
                        "write_mode": write_mode,
                        "max_write_bytes": max_write_bytes,
                        "parameters": {
                            "type": "object",
                            "properties": {"content": {"type": "string", "description": "Text to write."}},
                            "required": ["content"],
                            "additionalProperties": False,
                        },
                    }
                },
            },
        }
    )


@pytest.mark.asyncio
async def test_tool_executor_file_write_append_creates_and_appends(tmp_path):
    note = tmp_path / "note.txt"
    config = _make_file_write_config(tmp_path, note, write_mode="append")

    result = await ToolExecutor(config).execute("agent_notes", {"content": "first line\n"}, request_id="req-1", model="qwen")

    assert result["ok"] is True
    assert result["mode"] == "append"
    assert note.read_text() == "first line\n"

    result2 = await ToolExecutor(config).execute("agent_notes", {"content": "second line\n"}, request_id="req-1", model="qwen")
    assert result2["ok"] is True
    assert note.read_text() == "first line\nsecond line\n"


@pytest.mark.asyncio
async def test_tool_executor_file_write_overwrites_existing(tmp_path):
    note = tmp_path / "note.txt"
    note.write_text("old content\n")
    config = _make_file_write_config(tmp_path, note, write_mode="write")

    result = await ToolExecutor(config).execute("agent_notes", {"content": "new content\n"}, request_id="req-1", model="qwen")

    assert result["ok"] is True
    assert note.read_text() == "new content\n"


@pytest.mark.asyncio
async def test_tool_executor_file_write_create_only_rejects_existing(tmp_path):
    note = tmp_path / "note.txt"
    note.write_text("already here\n")
    config = _make_file_write_config(tmp_path, note, write_mode="create_only")

    result = await ToolExecutor(config).execute("agent_notes", {"content": "new content\n"}, request_id="req-1", model="qwen")

    assert result["ok"] is False
    assert "create_only" in result["error"]
    assert note.read_text() == "already here\n"


@pytest.mark.asyncio
async def test_tool_executor_file_write_create_only_succeeds_for_new_file(tmp_path):
    note = tmp_path / "new_note.txt"
    config = _make_file_write_config(tmp_path, note, write_mode="create_only")

    result = await ToolExecutor(config).execute("agent_notes", {"content": "brand new\n"}, request_id="req-1", model="qwen")

    assert result["ok"] is True
    assert note.read_text() == "brand new\n"


@pytest.mark.asyncio
async def test_tool_executor_file_write_rejects_oversized_content(tmp_path):
    note = tmp_path / "note.txt"
    config = _make_file_write_config(tmp_path, note, max_write_bytes=10)

    result = await ToolExecutor(config).execute("agent_notes", {"content": "x" * 11}, request_id="req-1", model="qwen")

    assert result["ok"] is False
    assert "max_write_bytes" in result["error"]


@pytest.mark.asyncio
async def test_tool_executor_file_write_rejects_empty_content(tmp_path):
    note = tmp_path / "note.txt"
    config = _make_file_write_config(tmp_path, note)

    result = await ToolExecutor(config).execute("agent_notes", {"content": ""}, request_id="req-1", model="qwen")

    assert result["ok"] is False
    assert result["error"]


@pytest.mark.asyncio
async def test_tool_executor_file_write_blocked_outside_safe_roots(tmp_path):
    import tempfile
    with tempfile.TemporaryDirectory() as other:
        note_path = tmp_path / "notes.txt"
        config = load_config(
            {
                "mode": "agent",
                "log_dir": str(tmp_path),
                "agent_tools": {
                    "enabled": True,
                    "safe_roots": [str(tmp_path)],
                    "tools": {
                        "agent_notes": {
                            "type": "file_write",
                            "description": "Write a note.",
                            "path": str(note_path),
                            "parameters": {
                                "type": "object",
                                "properties": {"content": {"type": "string"}},
                                "required": ["content"],
                                "additionalProperties": False,
                            },
                        }
                    },
                },
            }
        )
        # Manually patch the path to point outside safe_roots at execute time
        tool = config.agent_tools.tools["agent_notes"]
        from pathlib import Path
        tool.__dict__["path"] = Path(other) / "escape.txt"

        result = await ToolExecutor(config).execute("agent_notes", {"content": "escape"}, request_id="req-1", model="qwen")

        assert result["ok"] is False
        assert "safe roots" in result["error"]


# ---------------------------------------------------------------------------
# http_json
# ---------------------------------------------------------------------------


def _make_http_json_config(tmp_path, url, *, method="GET", max_response_bytes=65536):
    return load_config(
        {
            "mode": "agent",
            "log_dir": str(tmp_path),
            "agent_tools": {
                "enabled": True,
                "tools": {
                    "health_check": {
                        "type": "http_json",
                        "description": "Check health endpoint.",
                        "url": url,
                        "method": method,
                        "max_response_bytes": max_response_bytes,
                    }
                },
            },
        }
    )


@pytest.mark.asyncio
@respx.mock
async def test_tool_executor_http_json_returns_parsed_data(tmp_path):
    respx.get("http://localhost:8080/health").mock(
        return_value=httpx.Response(200, json={"status": "ok", "port": 8080})
    )
    config = _make_http_json_config(tmp_path, "http://localhost:8080/health")

    result = await ToolExecutor(config).execute("health_check", {}, request_id="req-1", model="qwen")

    assert result["ok"] is True
    assert result["status_code"] == 200
    assert result["data"] == {"status": "ok", "port": 8080}
    assert result["truncated"] is False


@pytest.mark.asyncio
@respx.mock
async def test_tool_executor_http_json_non_200_ok_false(tmp_path):
    respx.get("http://localhost:8080/health").mock(
        return_value=httpx.Response(503, json={"error": "unavailable"})
    )
    config = _make_http_json_config(tmp_path, "http://localhost:8080/health")

    result = await ToolExecutor(config).execute("health_check", {}, request_id="req-1", model="qwen")

    assert result["ok"] is False
    assert result["status_code"] == 503
    assert result["data"] == {"error": "unavailable"}


@pytest.mark.asyncio
@respx.mock
async def test_tool_executor_http_json_invalid_json_returns_error(tmp_path):
    respx.get("http://localhost:8080/health").mock(
        return_value=httpx.Response(200, content=b"not json at all", headers={"content-type": "text/plain"})
    )
    config = _make_http_json_config(tmp_path, "http://localhost:8080/health")

    result = await ToolExecutor(config).execute("health_check", {}, request_id="req-1", model="qwen")

    assert result["ok"] is False
    assert result["status_code"] == 200
    assert "invalid JSON" in result["error"]


@pytest.mark.asyncio
@respx.mock
async def test_tool_executor_http_json_truncates_large_response(tmp_path):
    big_data = {"items": ["x" * 100] * 20}
    respx.get("http://localhost:8080/data").mock(
        return_value=httpx.Response(200, json=big_data)
    )
    config = _make_http_json_config(tmp_path, "http://localhost:8080/data", max_response_bytes=64)

    result = await ToolExecutor(config).execute("health_check", {}, request_id="req-1", model="qwen")

    assert result["status_code"] == 200
    assert result.get("truncated") is True or "invalid JSON" in result.get("error", "")


@pytest.mark.asyncio
async def test_tool_executor_http_json_config_rejects_missing_url(tmp_path):
    with pytest.raises(Exception, match="url"):
        load_config(
            {
                "mode": "agent",
                "log_dir": str(tmp_path),
                "agent_tools": {
                    "enabled": True,
                    "tools": {
                        "bad": {
                            "type": "http_json",
                            "description": "No URL provided.",
                        }
                    },
                },
            }
        )


# ---------------------------------------------------------------------------
# git_diff
# ---------------------------------------------------------------------------


def _make_git_diff_config(tmp_path, repo_path):
    return load_config(
        {
            "mode": "agent",
            "log_dir": str(tmp_path),
            "agent_tools": {
                "enabled": True,
                "safe_roots": [str(tmp_path)],
                "tools": {
                    "repo_diff": {
                        "type": "git_diff",
                        "description": "Show unstaged diff.",
                        "path": str(repo_path),
                        "max_lines": 200,
                    }
                },
            },
        }
    )


@pytest.mark.asyncio
async def test_tool_executor_git_diff_clean_repo(tmp_path):
    repo = tmp_path / "myrepo"
    repo.mkdir()
    _make_git_repo(repo)
    config = _make_git_diff_config(tmp_path, repo)

    result = await ToolExecutor(config).execute("repo_diff", {}, request_id="req-1", model="qwen")

    assert result["ok"] is True
    assert result["diff"] == ""
    assert result["truncated"] is False


@pytest.mark.asyncio
async def test_tool_executor_git_diff_shows_changed_content(tmp_path):
    repo = tmp_path / "myrepo"
    repo.mkdir()
    _make_git_repo(repo)
    (repo / "README.md").write_text("initial content\nmodified line\n")
    config = _make_git_diff_config(tmp_path, repo)

    result = await ToolExecutor(config).execute("repo_diff", {}, request_id="req-1", model="qwen")

    assert result["ok"] is True
    assert "modified line" in result["diff"]
    assert result["total_lines"] > 0


@pytest.mark.asyncio
async def test_tool_executor_git_diff_non_repo_returns_error(tmp_path):
    not_a_repo = tmp_path / "plain_dir"
    not_a_repo.mkdir()
    config = _make_git_diff_config(tmp_path, not_a_repo)

    result = await ToolExecutor(config).execute("repo_diff", {}, request_id="req-1", model="qwen")

    assert result["ok"] is False
    assert result["error"]


# ---------------------------------------------------------------------------
# log_tail
# ---------------------------------------------------------------------------


def _make_log_tail_config(tmp_path, log_path, *, max_lines=100):
    return load_config(
        {
            "mode": "agent",
            "log_dir": str(tmp_path),
            "agent_tools": {
                "enabled": True,
                "safe_roots": [str(tmp_path)],
                "tools": {
                    "server_log": {
                        "type": "log_tail",
                        "description": "Tail the inference server log.",
                        "path": str(log_path),
                        "max_lines": max_lines,
                    }
                },
            },
        }
    )


@pytest.mark.asyncio
async def test_tool_executor_log_tail_returns_lines(tmp_path):
    log = tmp_path / "server.log"
    log.write_text("line one\nline two\nline three\n")
    config = _make_log_tail_config(tmp_path, log)

    result = await ToolExecutor(config).execute("server_log", {}, request_id="req-1", model="qwen")

    assert result["ok"] is True
    assert result["lines"] == ["line one", "line two", "line three"]
    assert result["total_lines"] == 3
    assert result["truncated"] is False


@pytest.mark.asyncio
async def test_tool_executor_log_tail_truncates_to_max_lines(tmp_path):
    log = tmp_path / "server.log"
    log.write_text("\n".join(f"line {i}" for i in range(20)) + "\n")
    config = _make_log_tail_config(tmp_path, log, max_lines=5)

    result = await ToolExecutor(config).execute("server_log", {}, request_id="req-1", model="qwen")

    assert result["ok"] is True
    assert result["total_lines"] == 20
    assert len(result["lines"]) == 5
    assert result["lines"][-1] == "line 19"
    assert result["truncated"] is True


@pytest.mark.asyncio
async def test_tool_executor_log_tail_missing_file_returns_error(tmp_path):
    log = tmp_path / "nonexistent.log"
    config = _make_log_tail_config(tmp_path, log)

    result = await ToolExecutor(config).execute("server_log", {}, request_id="req-1", model="qwen")

    assert result["ok"] is False
    assert result["error"]


# ---------------------------------------------------------------------------
# web_fetch
# ---------------------------------------------------------------------------


def _make_web_fetch_config(tmp_path, *, allowed_domains=None):
    tool_cfg = {
        "type": "web_fetch",
        "description": "Fetch a web page.",
        "strip_html": True,
        "max_response_bytes": 131072,
        "parameters": {
            "type": "object",
            "properties": {"url": {"type": "string", "description": "URL to fetch."}},
            "required": ["url"],
            "additionalProperties": False,
        },
    }
    if allowed_domains is not None:
        tool_cfg["allowed_domains"] = allowed_domains
    return load_config(
        {
            "mode": "agent",
            "log_dir": str(tmp_path),
            "agent_tools": {
                "enabled": True,
                "tools": {"browse": tool_cfg},
            },
        }
    )


@pytest.mark.asyncio
@respx.mock
async def test_tool_executor_web_fetch_returns_stripped_text(tmp_path):
    html = "<html><body><h1>Hello</h1><p>World</p><script>bad()</script></body></html>"
    respx.get("https://example.com/page").mock(
        return_value=httpx.Response(200, content=html.encode(), headers={"content-type": "text/html"})
    )
    config = _make_web_fetch_config(tmp_path)

    result = await ToolExecutor(config).execute("browse", {"url": "https://example.com/page"}, request_id="req-1", model="qwen")

    assert result["ok"] is True
    assert "Hello" in result["content"]
    assert "World" in result["content"]
    assert "bad()" not in result["content"]


@pytest.mark.asyncio
@respx.mock
async def test_tool_executor_web_fetch_allowed_domains_passes(tmp_path):
    respx.get("https://stackoverflow.com/q/1").mock(
        return_value=httpx.Response(200, content=b"<p>answer</p>", headers={"content-type": "text/html"})
    )
    config = _make_web_fetch_config(tmp_path, allowed_domains=["stackoverflow.com"])

    result = await ToolExecutor(config).execute("browse", {"url": "https://stackoverflow.com/q/1"}, request_id="req-1", model="qwen")

    assert result["ok"] is True


@pytest.mark.asyncio
async def test_tool_executor_web_fetch_allowed_domains_blocks_other(tmp_path):
    config = _make_web_fetch_config(tmp_path, allowed_domains=["stackoverflow.com"])

    result = await ToolExecutor(config).execute("browse", {"url": "https://evil.com/page"}, request_id="req-1", model="qwen")

    assert result["ok"] is False
    assert "allowed_domains" in result["error"]


@pytest.mark.asyncio
async def test_tool_executor_web_fetch_blocks_localhost(tmp_path):
    config = _make_web_fetch_config(tmp_path)

    result = await ToolExecutor(config).execute("browse", {"url": "http://localhost:9137/health"}, request_id="req-1", model="qwen")

    assert result["ok"] is False
    assert "blocked" in result["error"]


@pytest.mark.asyncio
async def test_tool_executor_web_fetch_blocks_private_ip(tmp_path):
    config = _make_web_fetch_config(tmp_path)

    result = await ToolExecutor(config).execute("browse", {"url": "http://192.168.1.1/admin"}, request_id="req-1", model="qwen")

    assert result["ok"] is False
    assert "blocked" in result["error"]


@pytest.mark.asyncio
async def test_tool_executor_web_fetch_rejects_non_http_scheme(tmp_path):
    config = _make_web_fetch_config(tmp_path)

    result = await ToolExecutor(config).execute("browse", {"url": "file:///etc/passwd"}, request_id="req-1", model="qwen")

    assert result["ok"] is False
    assert "http" in result["error"]


@pytest.mark.asyncio
async def test_tool_executor_web_fetch_missing_url_returns_error(tmp_path):
    config = _make_web_fetch_config(tmp_path)

    result = await ToolExecutor(config).execute("browse", {}, request_id="req-1", model="qwen")

    assert result["ok"] is False
    assert "url" in result["error"]


@pytest.mark.asyncio
@respx.mock
async def test_tool_executor_web_fetch_subdomain_matches_allowed_domain(tmp_path):
    respx.get("https://www.stackoverflow.com/q/1").mock(
        return_value=httpx.Response(200, content=b"<p>ok</p>", headers={"content-type": "text/html"})
    )
    config = _make_web_fetch_config(tmp_path, allowed_domains=["stackoverflow.com"])

    result = await ToolExecutor(config).execute("browse", {"url": "https://www.stackoverflow.com/q/1"}, request_id="req-1", model="qwen")

    assert result["ok"] is True


# ---------------------------------------------------------------------------
# git_log
# ---------------------------------------------------------------------------


def _make_git_log_config(tmp_path, repo_path, *, max_commits=20):
    return load_config(
        {
            "mode": "agent",
            "log_dir": str(tmp_path),
            "agent_tools": {
                "enabled": True,
                "safe_roots": [str(tmp_path)],
                "tools": {
                    "repo_log": {
                        "type": "git_log",
                        "description": "Show recent commits.",
                        "path": str(repo_path),
                        "max_commits": max_commits,
                    }
                },
            },
        }
    )


@pytest.mark.asyncio
async def test_tool_executor_git_log_returns_commits(tmp_path):
    repo = tmp_path / "myrepo"
    repo.mkdir()
    _make_git_repo(repo)
    (repo / "file.txt").write_text("second commit\n")
    import subprocess
    subprocess.run(["git", "-C", str(repo), "add", "."], check=True)
    subprocess.run(["git", "-C", str(repo), "commit", "-m", "add file.txt"], check=True)
    config = _make_git_log_config(tmp_path, repo)

    result = await ToolExecutor(config).execute("repo_log", {}, request_id="req-1", model="qwen")

    assert result["ok"] is True
    assert result["count"] >= 1
    assert all(k in result["commits"][0] for k in ("hash", "subject", "author", "age"))


@pytest.mark.asyncio
async def test_tool_executor_git_log_respects_max_commits(tmp_path):
    repo = tmp_path / "myrepo"
    repo.mkdir()
    _make_git_repo(repo)
    import subprocess
    for i in range(5):
        (repo / f"file{i}.txt").write_text(f"content {i}\n")
        subprocess.run(["git", "-C", str(repo), "add", "."], check=True)
        subprocess.run(["git", "-C", str(repo), "commit", "-m", f"commit {i}"], check=True)
    config = _make_git_log_config(tmp_path, repo, max_commits=3)

    result = await ToolExecutor(config).execute("repo_log", {}, request_id="req-1", model="qwen")

    assert result["ok"] is True
    assert result["count"] == 3


@pytest.mark.asyncio
async def test_tool_executor_git_log_non_repo_returns_error(tmp_path):
    not_a_repo = tmp_path / "plain_dir"
    not_a_repo.mkdir()
    config = _make_git_log_config(tmp_path, not_a_repo)

    result = await ToolExecutor(config).execute("repo_log", {}, request_id="req-1", model="qwen")

    assert result["ok"] is False
    assert result["error"]


# ---------------------------------------------------------------------------
# sqlite_query
# ---------------------------------------------------------------------------


def _make_sqlite_config(tmp_path, db_path):
    return load_config(
        {
            "mode": "agent",
            "log_dir": str(tmp_path),
            "agent_tools": {
                "enabled": True,
                "safe_roots": [str(tmp_path)],
                "tools": {
                    "query_db": {
                        "type": "sqlite_query",
                        "description": "Query the app database.",
                        "path": str(db_path),
                        "max_entries": 50,
                        "parameters": {
                            "type": "object",
                            "properties": {"query": {"type": "string", "description": "SQL SELECT query."}},
                            "required": ["query"],
                            "additionalProperties": False,
                        },
                    }
                },
            },
        }
    )


def _make_test_db(path) -> None:
    import sqlite3 as _sqlite3
    con = _sqlite3.connect(str(path))
    con.execute("CREATE TABLE items (id INTEGER PRIMARY KEY, name TEXT)")
    con.executemany("INSERT INTO items VALUES (?, ?)", [(1, "alpha"), (2, "beta"), (3, "gamma")])
    con.commit()
    con.close()


@pytest.mark.asyncio
async def test_tool_executor_sqlite_query_returns_rows(tmp_path):
    db = tmp_path / "app.db"
    _make_test_db(db)
    config = _make_sqlite_config(tmp_path, db)

    result = await ToolExecutor(config).execute("query_db", {"query": "SELECT * FROM items ORDER BY id"}, request_id="req-1", model="qwen")

    assert result["ok"] is True
    assert result["columns"] == ["id", "name"]
    assert result["rows"] == [[1, "alpha"], [2, "beta"], [3, "gamma"]]
    assert result["row_count"] == 3
    assert result["truncated"] is False


@pytest.mark.asyncio
async def test_tool_executor_sqlite_query_truncates_to_max_entries(tmp_path):
    db = tmp_path / "app.db"
    import sqlite3 as _sqlite3
    con = _sqlite3.connect(str(db))
    con.execute("CREATE TABLE nums (n INTEGER)")
    con.executemany("INSERT INTO nums VALUES (?)", [(i,) for i in range(10)])
    con.commit()
    con.close()
    config = load_config(
        {
            "mode": "agent",
            "log_dir": str(tmp_path),
            "agent_tools": {
                "enabled": True,
                "safe_roots": [str(tmp_path)],
                "tools": {
                    "query_db": {
                        "type": "sqlite_query",
                        "description": "Query db.",
                        "path": str(db),
                        "max_entries": 3,
                        "parameters": {"type": "object", "properties": {"query": {"type": "string"}}, "required": ["query"], "additionalProperties": False},
                    }
                },
            },
        }
    )

    result = await ToolExecutor(config).execute("query_db", {"query": "SELECT * FROM nums"}, request_id="req-1", model="qwen")

    assert result["ok"] is True
    assert result["row_count"] == 3
    assert result["truncated"] is True


@pytest.mark.asyncio
async def test_tool_executor_sqlite_query_rejects_non_select(tmp_path):
    db = tmp_path / "app.db"
    _make_test_db(db)
    config = _make_sqlite_config(tmp_path, db)

    result = await ToolExecutor(config).execute("query_db", {"query": "DELETE FROM items"}, request_id="req-1", model="qwen")

    assert result["ok"] is False
    assert "SELECT" in result["error"]


@pytest.mark.asyncio
async def test_tool_executor_sqlite_query_missing_db_returns_error(tmp_path):
    db = tmp_path / "nonexistent.db"
    config = _make_sqlite_config(tmp_path, db)

    result = await ToolExecutor(config).execute("query_db", {"query": "SELECT 1"}, request_id="req-1", model="qwen")

    assert result["ok"] is False
    assert result["error"]


@pytest.mark.asyncio
async def test_tool_executor_sqlite_query_allows_cte(tmp_path):
    db = tmp_path / "app.db"
    _make_test_db(db)
    config = _make_sqlite_config(tmp_path, db)

    result = await ToolExecutor(config).execute(
        "query_db",
        {"query": "WITH top AS (SELECT * FROM items LIMIT 2) SELECT * FROM top"},
        request_id="req-1",
        model="qwen",
    )

    assert result["ok"] is True
    assert result["row_count"] == 2


# ---------------------------------------------------------------------------
# MemoryWriteToolAdapter
# ---------------------------------------------------------------------------

class _FakeMemoryStore:
    """Minimal stand-in for ChromaMemoryStore in tool adapter tests."""

    def __init__(self) -> None:
        self.disabled = False
        self.calls: list[dict] = []
        self._search_results: list[dict] = []

    async def write(self, text: str, *, tier: str = "durable", topic=None, tags=None) -> str | None:
        self.calls.append({"text": text, "tier": tier, "topic": topic, "tags": tags or []})
        return "fake-id"

    async def search(self, query: str, top_k: int | None = None) -> list[dict]:
        self.calls.append({"query": query, "top_k": top_k})
        return self._search_results


def _make_memory_write_config(tmp_path):
    return load_config(
        {
            "mode": "agent",
            "agent_tools": {
                "enabled": True,
                "safe_roots": [str(tmp_path)],
                "tools": {
                    "save_note": {
                        "type": "memory_write",
                        "description": "Save a note to memory",
                    }
                },
            },
        }
    )


@pytest.mark.asyncio
async def test_memory_write_adapter_queues_write(tmp_path):
    config = _make_memory_write_config(tmp_path)
    store = _FakeMemoryStore()
    result = await ToolExecutor(config, memory_store=store).execute(
        "save_note", {"text": "user likes Python", "tier": "durable"}, request_id="r1", model="qwen"
    )
    assert result["ok"] is True
    assert result["queued"] is True
    # Give the event loop a tick to run the fire-and-forget task
    import asyncio
    await asyncio.sleep(0)
    assert len(store.calls) == 1
    assert store.calls[0]["text"] == "user likes Python"
    assert store.calls[0]["tier"] == "durable"


@pytest.mark.asyncio
async def test_memory_write_adapter_rejects_empty_text(tmp_path):
    config = _make_memory_write_config(tmp_path)
    store = _FakeMemoryStore()
    result = await ToolExecutor(config, memory_store=store).execute(
        "save_note", {"text": "   "}, request_id="r1", model="qwen"
    )
    assert result["ok"] is False
    assert "text" in result["error"]


@pytest.mark.asyncio
async def test_memory_write_adapter_absent_when_store_disabled(tmp_path):
    config = _make_memory_write_config(tmp_path)
    store = _FakeMemoryStore()
    store.disabled = True
    result = await ToolExecutor(config, memory_store=store).execute(
        "save_note", {"text": "something"}, request_id="r1", model="qwen"
    )
    # Adapter not registered when disabled → unknown tool error
    assert result["ok"] is False
    assert "Unsupported tool adapter" in result["error"]


# ---------------------------------------------------------------------------
# MemorySearchToolAdapter
# ---------------------------------------------------------------------------


def _make_memory_search_config(tmp_path):
    return load_config(
        {
            "mode": "agent",
            "agent_tools": {
                "enabled": True,
                "safe_roots": [str(tmp_path)],
                "tools": {
                    "recall": {
                        "type": "memory_search",
                        "description": "Search memory for relevant facts",
                    }
                },
            },
        }
    )


@pytest.mark.asyncio
async def test_memory_search_adapter_returns_results(tmp_path):
    config = _make_memory_search_config(tmp_path)
    store = _FakeMemoryStore()
    store._search_results = [
        {"text": "user prefers dark mode", "tier": "durable", "score": 0.95},
        {"text": "user works in Python", "tier": "durable", "score": 0.88},
    ]
    result = await ToolExecutor(config, memory_store=store).execute(
        "recall", {"query": "user preferences"}, request_id="r1", model="qwen"
    )
    assert result["ok"] is True
    assert result["count"] == 2
    assert result["results"][0]["text"] == "user prefers dark mode"
    assert store.calls[-1]["query"] == "user preferences"


@pytest.mark.asyncio
async def test_memory_search_adapter_passes_top_k(tmp_path):
    config = _make_memory_search_config(tmp_path)
    store = _FakeMemoryStore()
    store._search_results = [{"text": "fact", "tier": "durable", "score": 0.9}]
    await ToolExecutor(config, memory_store=store).execute(
        "recall", {"query": "something", "top_k": 2}, request_id="r1", model="qwen"
    )
    assert store.calls[-1]["top_k"] == 2


@pytest.mark.asyncio
async def test_memory_search_adapter_rejects_empty_query(tmp_path):
    config = _make_memory_search_config(tmp_path)
    store = _FakeMemoryStore()
    result = await ToolExecutor(config, memory_store=store).execute(
        "recall", {"query": "   "}, request_id="r1", model="qwen"
    )
    assert result["ok"] is False
    assert "query" in result["error"]


@pytest.mark.asyncio
async def test_memory_search_adapter_absent_when_store_disabled(tmp_path):
    config = _make_memory_search_config(tmp_path)
    store = _FakeMemoryStore()
    store.disabled = True
    result = await ToolExecutor(config, memory_store=store).execute(
        "recall", {"query": "something"}, request_id="r1", model="qwen"
    )
    assert result["ok"] is False
    assert "Unsupported tool adapter" in result["error"]
