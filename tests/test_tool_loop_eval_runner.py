from __future__ import annotations

import importlib.util
import asyncio
import json
from pathlib import Path

import pytest


SCRIPT_PATH = Path(__file__).resolve().parents[1] / "scripts" / "tool_loop_eval.py"


def _load_runner():
    spec = importlib.util.spec_from_file_location("tool_loop_eval_script", SCRIPT_PATH)
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_parse_args_defaults_to_log_outputs():
    runner = _load_runner()

    args = runner.parse_args(["--model", "gpt-oss-20b"])

    assert args.model == ["gpt-oss-20b"]
    assert args.target == "auto"
    assert args.output_jsonl is None
    assert args.latest_json is None
    assert args.case == ["all"]


def test_parse_args_accepts_node_target():
    runner = _load_runner()

    args = runner.parse_args(["--model", "gpt-oss-20b", "--target", "node:mac-mini"])

    assert args.target == "node:mac-mini"


def test_resolve_output_paths_uses_config_log_dir(tmp_path):
    runner = _load_runner()

    args = runner.parse_args(["--model", "gpt-oss-20b"])
    output_jsonl, latest_json = runner.resolve_output_paths(args, tmp_path)

    assert output_jsonl == tmp_path / "tool_loop_eval_results.jsonl"
    assert latest_json == tmp_path / "tool_loop_eval_latest.json"


def test_resolve_env_file_defaults_to_repo_env(monkeypatch):
    runner = _load_runner()
    monkeypatch.delenv("NEURAXIS_ENV_FILE", raising=False)

    assert runner.resolve_env_file(None) == runner.ROOT_DIR / ".neuraxis.env"


def test_resolve_env_file_uses_env_override(monkeypatch, tmp_path):
    runner = _load_runner()
    env_file = tmp_path / "custom.env"
    monkeypatch.setenv("NEURAXIS_ENV_FILE", str(env_file))

    assert runner.resolve_env_file(None) == env_file


def test_load_env_file_expands_config_placeholders(monkeypatch, tmp_path):
    runner = _load_runner()
    from llama_manager.core.config import load_config

    monkeypatch.delenv("MAC_MINI_URL", raising=False)
    env_file = tmp_path / ".neuraxis.env"
    env_file.write_text(
        "MAC_MINI_URL=https://mac-mini.local\n"
        "export MAC_MINI_KEY='secret key'\n",
        encoding="utf-8",
    )
    config_file = tmp_path / "config.yaml"
    config_file.write_text(
        "mode: controller\n"
        "nodes:\n"
        "  mac-mini:\n"
        "    url: ${MAC_MINI_URL}\n"
        "    api_key: ${MAC_MINI_KEY}\n",
        encoding="utf-8",
    )

    runner.load_env_file(env_file)
    config = load_config(config_file)

    assert config.nodes["mac-mini"].url == "https://mac-mini.local"
    assert config.nodes["mac-mini"].api_key == "secret key"


def test_apply_node_api_key_fallback_uses_node_specific_env(monkeypatch, tmp_path):
    runner = _load_runner()
    from llama_manager.core.config import load_config

    monkeypatch.setenv("NEURAXIS_MAC_MINI_AGENT_API_KEY", "mac-key")
    monkeypatch.setenv("NEURAXIS_AGENT_API_KEY", "generic-key")
    config = load_config(
        {
            "mode": "controller",
            "log_dir": str(tmp_path),
            "nodes": {"mac-mini": {"url": "https://mac-mini.local"}},
        }
    )

    runner.apply_node_api_key_fallback(config, "mac-mini")

    assert config.nodes["mac-mini"].api_key == "mac-key"


def test_apply_node_api_key_fallback_replaces_unresolved_placeholder(monkeypatch, tmp_path):
    runner = _load_runner()
    from llama_manager.core.config import load_config

    monkeypatch.delenv("NEURAXIS_MAC_MINI_AGENT_API_KEY", raising=False)
    monkeypatch.setenv("NEURAXIS_AGENT_API_KEY", "generic-key")
    config = load_config(
        {
            "mode": "controller",
            "log_dir": str(tmp_path),
            "nodes": {
                "mac-mini": {
                    "url": "https://mac-mini.local",
                    "api_key": "${NEURAXIS_MAC_MINI_AGENT_API_KEY}",
                }
            },
        }
    )

    runner.apply_node_api_key_fallback(config, "mac-mini")

    assert config.nodes["mac-mini"].api_key == "generic-key"


def test_apply_node_api_key_fallback_preserves_configured_key(monkeypatch, tmp_path):
    runner = _load_runner()
    from llama_manager.core.config import load_config

    monkeypatch.setenv("NEURAXIS_MAC_MINI_AGENT_API_KEY", "env-key")
    config = load_config(
        {
            "mode": "controller",
            "log_dir": str(tmp_path),
            "nodes": {
                "mac-mini": {
                    "url": "https://mac-mini.local",
                    "api_key": "configured-key",
                }
            },
        }
    )

    runner.apply_node_api_key_fallback(config, "mac-mini")

    assert config.nodes["mac-mini"].api_key == "configured-key"


def test_write_outputs_appends_jsonl_and_writes_latest_summary(tmp_path):
    runner = _load_runner()
    output_jsonl = tmp_path / "results.jsonl"
    latest_json = tmp_path / "latest.json"
    suites = [
        {
            "model": "gpt-oss-20b",
            "status": "passed",
            "case_count": 1,
            "passed_count": 1,
            "failed_count": 0,
            "average_score": 1.0,
            "cases": [],
        }
    ]

    runner.write_outputs(suites, output_jsonl=output_jsonl, latest_json=latest_json)

    lines = output_jsonl.read_text(encoding="utf-8").splitlines()
    assert len(lines) == 1
    assert json.loads(lines[0])["model"] == "gpt-oss-20b"
    latest = json.loads(latest_json.read_text(encoding="utf-8"))
    assert latest["suite_count"] == 1
    assert latest["models"] == ["gpt-oss-20b"]
    assert latest["suites"][0]["average_score"] == 1.0


def test_select_cases_rejects_unknown_case():
    runner = _load_runner()

    with pytest.raises(SystemExit, match="Unknown tool-loop eval case"):
        runner.select_cases(["missing-case"])


def test_validate_config_allows_controller_mode_with_tools(tmp_path):
    runner = _load_runner()
    from llama_manager.core.config import load_config

    config = load_config(
        {
            "mode": "controller",
            "log_dir": str(tmp_path),
            "agent_tools": {
                "enabled": True,
                "tools": {
                    "read_status": {
                        "type": "shell",
                        "description": "Read status.",
                        "command": ["printf", "ok"],
                    }
                },
            },
        }
    )

    runner.validate_config(config)


def test_validate_config_allows_controller_node_target_without_controller_tools(tmp_path):
    runner = _load_runner()
    from llama_manager.core.config import load_config

    config = load_config({"mode": "controller", "log_dir": str(tmp_path)})

    runner.validate_config(config, target="node:mac-mini")


def test_validate_config_rejects_node_target_with_agent_mode(tmp_path):
    runner = _load_runner()
    from llama_manager.core.config import load_config

    config = load_config(
        {
            "mode": "agent",
            "log_dir": str(tmp_path),
            "agent_tools": {
                "enabled": True,
                "tools": {
                    "read_status": {
                        "type": "shell",
                        "description": "Read status.",
                        "command": ["printf", "ok"],
                    }
                },
            },
        }
    )

    with pytest.raises(SystemExit, match="require a controller-mode config"):
        runner.validate_config(config, target="node:mac-mini")


def test_local_target_selector_uses_agent_node_name_when_configured(tmp_path):
    runner = _load_runner()
    from llama_manager.core.config import load_config

    config = load_config({"mode": "agent", "log_dir": str(tmp_path), "node_name": "mac-mini"})

    assert runner.local_target_selector(config) == "local:mac-mini"
    assert runner.local_target_instance(config) == "mac-mini"


def test_local_target_selector_uses_standalone_without_node_name(tmp_path):
    runner = _load_runner()
    from llama_manager.core.config import load_config

    config = load_config({"mode": "agent", "log_dir": str(tmp_path)})

    assert runner.local_target_selector(config) == "local:standalone"
    assert runner.local_target_instance(config) == "standalone"


def test_cases_include_target_request_default():
    runner = _load_runner()

    cases = runner.cases_with_target(runner.select_cases(["all"]), "node:mac-mini")

    assert cases
    assert all(case.request_defaults["target"] == "node:mac-mini" for case in cases)
    by_id = {case.id: case for case in cases}
    assert by_id["argument-repair"].required_tool_arguments == {"fetch_ticket": {"ticket_id": "NX-42"}}
    assert by_id["parallel-fact-gathering"].scoring_mode == "set_membership"
    assert by_id["linear-8-step-synthesis"].max_iterations == 10


def test_persist_outputs_writes_tool_loop_runs_to_benchmarks_db(tmp_path):
    runner = _load_runner()
    from llama_manager.core.config import load_config
    from llama_manager.core.persistence.benchmark_store_orm import BenchmarkStoreOrm
    from tests.persistence_db_setup import prepare_benchmarks_db

    db_path = tmp_path / "benchmarks.db"
    prepare_benchmarks_db(db_path)
    config = load_config(
        {
            "mode": "controller",
            "log_dir": str(tmp_path / "logs"),
            "benchmarks_db_url": f"sqlite+pysqlite:///{db_path}",
        }
    )
    latest = {
        "generated_at": "2026-06-11T04:10:00+00:00",
        "suite_count": 1,
        "models": ["gpt-oss-20b"],
        "suites": [
            {
                "model": "gpt-oss-20b",
                "status": "passed",
                "case_count": 1,
                "passed_count": 1,
                "failed_count": 0,
                "average_score": 1.0,
                "cases": [
                    {
                        "case_id": "avoid-unneeded-tools",
                        "status": "passed",
                        "score": 1.0,
                        "checks": {"completed": True},
                        "error": "",
                        "iteration_count": 1,
                        "tool_call_count": 0,
                        "observed_tool_sequence": [],
                        "expected_tool_sequence": [],
                        "tool_results": [],
                        "final_answer": "tool loop ready",
                    }
                ],
            }
        ],
    }

    persisted = runner.persist_outputs(config, latest, target="node:linux-2080ti")

    assert len(persisted) == 1
    store = BenchmarkStoreOrm(db_url=f"sqlite+pysqlite:///{db_path}")
    runs = store.list_tool_loop_eval_runs()
    assert [run["id"] for run in runs] == [persisted[0]["id"]]
    assert runs[0]["target_selector"] == "node:linux-2080ti"
    assert runs[0]["target_node"] == "linux-2080ti"
    assert runs[0]["target_instance"] == "linux-2080ti"
    fetched = store.get_tool_loop_eval_run(runs[0]["id"])
    assert fetched["cases"][0]["case_id"] == "avoid-unneeded-tools"


def test_persist_outputs_records_standalone_local_scope(tmp_path):
    runner = _load_runner()
    from llama_manager.core.config import load_config
    from llama_manager.core.persistence.benchmark_store_orm import BenchmarkStoreOrm
    from tests.persistence_db_setup import prepare_benchmarks_db

    db_path = tmp_path / "benchmarks.db"
    prepare_benchmarks_db(db_path)
    config = load_config(
        {
            "mode": "agent",
            "log_dir": str(tmp_path / "logs"),
            "benchmarks_db_url": f"sqlite+pysqlite:///{db_path}",
        }
    )
    latest = {
        "generated_at": "2026-06-11T04:10:00+00:00",
        "suite_count": 1,
        "models": ["gpt-oss-20b"],
        "suites": [
            {
                "model": "gpt-oss-20b",
                "status": "passed",
                "case_count": 0,
                "passed_count": 0,
                "failed_count": 0,
                "average_score": 0.0,
                "cases": [],
            }
        ],
    }

    persisted = runner.persist_outputs(config, latest, target="auto")

    assert len(persisted) == 1
    store = BenchmarkStoreOrm(db_url=f"sqlite+pysqlite:///{db_path}")
    runs = store.list_tool_loop_eval_runs()
    assert runs[0]["target_selector"] == "local:standalone"
    assert runs[0]["target_node"] is None
    assert runs[0]["target_instance"] == "standalone"


def test_run_suites_records_model_routing_failure(monkeypatch, tmp_path):
    runner = _load_runner()
    from llama_manager.core.agent_tools.evals import ToolLoopEvalCase
    from llama_manager.core.config import load_config

    config = load_config(
        {
            "mode": "controller",
            "log_dir": str(tmp_path),
            "agent_tools": {
                "enabled": True,
                "tools": {
                    "read_status": {
                        "type": "shell",
                        "description": "Read status.",
                        "command": ["printf", "ok"],
                    }
                },
            },
        }
    )

    class FailingEvaluator:
        def __init__(self, config, proxy):
            pass

        async def run_suite(self, model, cases):
            raise RuntimeError("Model is not running on controller node 'mac-mini': gpt-oss-20b")

    monkeypatch.setattr(runner, "ToolLoopEvaluator", FailingEvaluator)
    suites = asyncio.run(runner.run_suites(config, ["gpt-oss-20b"], [ToolLoopEvalCase(id="case-1", prompt="hi")]))

    assert suites[0]["status"] == "failed"
    assert suites[0]["model"] == "gpt-oss-20b"
    assert "mac-mini" in suites[0]["error"]
    assert suites[0]["cases"][0]["status"] == "failed"


def test_run_suites_with_controller_node_target_calls_agent_eval_endpoint(monkeypatch, tmp_path):
    runner = _load_runner()
    from llama_manager.core.agent_tools.evals import ToolLoopEvalCase
    from llama_manager.core.config import load_config

    config = load_config(
        {
            "mode": "controller",
            "log_dir": str(tmp_path),
            "nodes": {"mac-mini": {"url": "http://mac-mini", "api_key": "node-secret"}},
        }
    )
    calls = []

    class FakeNodeRegistry:
        def __init__(self, config):
            pass

        async def request_node(self, node, method, path, json_body=None, *, timeout=10):
            calls.append((node, method, path, json_body, timeout))
            return {"model": "gpt-oss-20b", "status": "passed", "case_count": 1, "passed_count": 1, "failed_count": 0, "average_score": 1.0, "cases": []}

    monkeypatch.setattr(runner, "NodeRegistry", FakeNodeRegistry)

    suites = asyncio.run(
        runner.run_suites(
            config,
            ["gpt-oss-20b"],
            [ToolLoopEvalCase(id="avoid-unneeded-tools", prompt="hi")],
            target="node:mac-mini",
        )
    )

    assert suites[0]["status"] == "passed"
    assert calls == [
        (
            "mac-mini",
            "POST",
            "/lm-api/v1/runtime/tool-loop-evals/run",
            {"model": "gpt-oss-20b", "case_ids": ["avoid-unneeded-tools"]},
            None,
        )
    ]


def test_run_suites_with_controller_node_target_reports_scheme_less_url(tmp_path):
    runner = _load_runner()
    from llama_manager.core.agent_tools.evals import ToolLoopEvalCase
    from llama_manager.core.config import load_config

    config = load_config(
        {
            "mode": "controller",
            "log_dir": str(tmp_path),
            "nodes": {"mac-mini": {"url": "mac-mini.local"}},
        }
    )

    suites = asyncio.run(
        runner.run_suites(
            config,
            ["gpt-oss-20b"],
            [ToolLoopEvalCase(id="avoid-unneeded-tools", prompt="hi")],
            target="node:mac-mini",
        )
    )

    assert suites[0]["status"] == "failed"
    assert "nodes.mac-mini.url must start with http:// or https://" in suites[0]["error"]
    assert "mac-mini.local" in suites[0]["error"]
