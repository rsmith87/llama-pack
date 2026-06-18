#!/usr/bin/env python3
from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from llama_pack.core.setup.active_setup import MigrationStepResult, run_setup_migrations


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Upgrade all Llama Pack persistence databases.")
    parser.add_argument(
        "--config",
        required=True,
        help="Path to the Llama Pack YAML config file.",
    )
    return parser.parse_args(argv)


def format_result(result: MigrationStepResult) -> str:
    status = "ok" if result.ok else "failed"
    suffix = "" if result.ok else f": {result.error}"
    return f"{result.target} {result.revision} {status}{suffix}"


def main(argv: list[str]) -> int:
    args = parse_args(argv)
    config_path = Path(args.config)
    results = run_setup_migrations(config_path)
    for result in results:
        print(format_result(result))
    if any(not result.ok for result in results):
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
