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


def test_cases_include_target_request_default():
    runner = _load_runner()

    cases = runner.cases_with_target(runner.select_cases(["all"]), "node:mac-mini")

    assert cases
    assert all(case.request_defaults["target"] == "node:mac-mini" for case in cases)


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

        async def request_node(self, node, method, path, json_body=None):
            calls.append((node, method, path, json_body))
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
