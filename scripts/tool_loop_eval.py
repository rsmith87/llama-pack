#!/usr/bin/env python3
from __future__ import annotations

import argparse
import asyncio
import json
import sys
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from llama_manager.core.agent_tools.evals import ToolLoopEvalCase, ToolLoopEvaluator, default_tool_loop_eval_cases
from llama_manager.core.chat.proxy import ChatProxy
from llama_manager.core.config import load_config
from llama_manager.core.nodes.registry import NodeRegistry
from llama_manager.core.runtime.process_manager import ProcessManager


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run Neuraxis agent-tool loop evaluations against one or more tool-capable models."
    )
    parser.add_argument("--config", type=Path, default=None, help="Config path. Defaults to NEURAXIS_CONFIG, config.yaml, or config.example.yaml.")
    parser.add_argument("--model", action="append", required=True, help="Model name to evaluate. Repeat for multiple models.")
    parser.add_argument(
        "--target",
        default="auto",
        help="Chat target selector passed to Neuraxis routing. Use node:<name>, for example node:mac-mini.",
    )
    parser.add_argument(
        "--case",
        action="append",
        default=["all"],
        help="Built-in case id to run. Repeat for multiple cases. Defaults to all.",
    )
    parser.add_argument("--output-jsonl", type=Path, default=None, help="Append suite records to this JSONL file.")
    parser.add_argument("--latest-json", type=Path, default=None, help="Write the latest app-ready summary JSON here.")
    return parser.parse_args(argv)


def resolve_output_paths(args: argparse.Namespace, log_dir: Path) -> tuple[Path, Path]:
    output_jsonl = args.output_jsonl or log_dir / "tool_loop_eval_results.jsonl"
    latest_json = args.latest_json or log_dir / "tool_loop_eval_latest.json"
    return output_jsonl, latest_json


def select_cases(case_ids: list[str]) -> list[Any]:
    cases = default_tool_loop_eval_cases()
    requested = set(case_ids)
    if "all" in requested:
        return cases
    by_id = {case.id: case for case in cases}
    missing = sorted(requested - set(by_id))
    if missing:
        raise SystemExit("Unknown tool-loop eval case(s): " + ", ".join(missing))
    return [by_id[case_id] for case_id in case_ids]


def cases_with_target(cases: list[ToolLoopEvalCase], target: str) -> list[ToolLoopEvalCase]:
    target = target.strip() or "auto"
    return [
        ToolLoopEvalCase(
            id=case.id,
            prompt=case.prompt,
            system_prompt=case.system_prompt,
            expected_tool_sequence=list(case.expected_tool_sequence),
            expected_final_substrings=list(case.expected_final_substrings),
            request_defaults={**case.request_defaults, "target": target},
        )
        for case in cases
    ]


def build_proxy(config: Any) -> ChatProxy:
    process_manager = ProcessManager(config)
    node_registry = NodeRegistry(config)
    return ChatProxy(process_manager, config, node_registry)


def validate_config(config: Any, target: str = "auto") -> None:
    if config.mode not in {"agent", "controller"}:
        raise SystemExit("Tool-loop eval runner requires an agent or controller config.")
    if str(target or "auto").startswith("node:") and config.mode != "controller":
        raise SystemExit(
            "Tool-loop evals with --target node:<name> require a controller-mode config "
            "that defines the target node. Pass --config /path/to/controller-config.yaml."
        )
    if str(target or "auto").startswith("node:") and config.mode == "controller":
        return
    if not config.agent_tools.enabled:
        raise SystemExit("agent_tools.enabled must be true for tool-loop evals.")
    if not config.agent_tools.tools:
        raise SystemExit("At least one agent tool must be configured for tool-loop evals.")


async def run_suites(config: Any, models: list[str], cases: list[Any], target: str = "auto") -> list[dict[str, Any]]:
    if config.mode == "controller" and str(target or "auto").startswith("node:"):
        return await run_node_suites(config, models, cases, str(target).split(":", 1)[1])
    proxy = build_proxy(config)
    evaluator = ToolLoopEvaluator(config, proxy)
    suites = []
    for model in models:
        try:
            suites.append(await evaluator.run_suite(model, cases))
        except Exception as exc:
            suites.append(_failed_suite(model, cases, str(exc)))
    return suites


async def run_node_suites(config: Any, models: list[str], cases: list[Any], node_name: str) -> list[dict[str, Any]]:
    node_name = node_name.strip()
    if not node_name:
        raise SystemExit("--target node:<name> requires a node name")
    registry = NodeRegistry(config)
    suites = []
    case_ids = [case.id for case in cases]
    for model in models:
        try:
            suites.append(
                await registry.request_node(
                    node_name,
                    "POST",
                    "/lm-api/v1/runtime/tool-loop-evals/run",
                    {"model": model, "case_ids": case_ids},
                )
            )
        except Exception as exc:
            suites.append(_failed_suite(model, cases, str(exc)))
    return suites


def _failed_suite(model: str, cases: list[Any], error: str) -> dict[str, Any]:
    return {
        "model": model,
        "status": "failed",
        "case_count": len(cases),
        "passed_count": 0,
        "failed_count": len(cases),
        "average_score": 0.0,
        "error": error,
        "cases": [
            {
                "case_id": case.id,
                "model": model,
                "status": "failed",
                "score": 0.0,
                "checks": {
                    "completed": False,
                    "expected_tool_sequence": False,
                    "expected_final_substrings": False,
                    "no_tool_errors": False,
                },
                "error": error,
                "iteration_count": 0,
                "tool_call_count": 0,
                "observed_tool_sequence": [],
                "expected_tool_sequence": list(case.expected_tool_sequence),
                "tool_results": [],
                "final_answer": "",
            }
            for case in cases
        ],
    }


def write_outputs(suites: list[dict[str, Any]], *, output_jsonl: Path, latest_json: Path) -> dict[str, Any]:
    generated_at = datetime.now(UTC).isoformat()
    output_jsonl.parent.mkdir(parents=True, exist_ok=True)
    latest_json.parent.mkdir(parents=True, exist_ok=True)
    with output_jsonl.open("a", encoding="utf-8") as handle:
        for suite in suites:
            handle.write(json.dumps({"generated_at": generated_at, **suite}, sort_keys=True) + "\n")

    latest = {
        "generated_at": generated_at,
        "suite_count": len(suites),
        "models": [str(suite.get("model")) for suite in suites],
        "suites": suites,
    }
    latest_json.write_text(json.dumps(latest, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return latest


async def async_main(argv: list[str]) -> int:
    args = parse_args(argv)
    config = load_config(args.config)
    validate_config(config, args.target)
    cases = cases_with_target(select_cases(args.case), args.target)
    suites = await run_suites(config, args.model, cases, target=args.target)
    output_jsonl, latest_json = resolve_output_paths(args, config.log_dir)
    latest = write_outputs(suites, output_jsonl=output_jsonl, latest_json=latest_json)
    print(json.dumps(latest, indent=2, sort_keys=True))
    return 0 if all(suite["status"] == "passed" for suite in suites) else 1


def main(argv: list[str] | None = None) -> int:
    return asyncio.run(async_main(argv or sys.argv[1:]))


if __name__ == "__main__":
    raise SystemExit(main())
