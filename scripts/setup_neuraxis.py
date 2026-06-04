#!/usr/bin/env python3
from __future__ import annotations

import argparse
import os
import shlex
import shutil
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[1]


@dataclass
class Step:
    title: str
    command: list[str]
    env: dict[str, str] | None = None


def default(value: str | None, fallback: str) -> str:
    return value if value not in (None, "") else fallback


def prompt(label: str, fallback: str | None = None) -> str:
    suffix = f" [{fallback}]" if fallback else ""
    value = input(f"{label}{suffix}: ").strip()
    return value or (fallback or "")


def prompt_bool(label: str, fallback: bool = False) -> bool:
    default_text = "Y/n" if fallback else "y/N"
    value = input(f"{label} [{default_text}]: ").strip().lower()
    if not value:
        return fallback
    return value in {"y", "yes", "true", "1"}


def prompt_choice(label: str, choices: list[str], fallback: str) -> str:
    print(label)
    for index, choice in enumerate(choices, start=1):
        marker = " (default)" if choice == fallback else ""
        print(f"  {index}. {choice}{marker}")
    while True:
        value = input("> ").strip().lower()
        if not value:
            return fallback
        if value.isdigit() and 1 <= int(value) <= len(choices):
            return choices[int(value) - 1]
        if value in choices:
            return value
        print(f"Choose one of: {', '.join(choices)}")


def shell_join(command: list[str]) -> str:
    return " ".join(shlex.quote(part) for part in command)


def print_step(step: Step, dry_run: bool) -> None:
    prefix = "Would run" if dry_run else "Running"
    print(f"\n{prefix}: {step.title}")
    if step.env:
        for key, value in step.env.items():
            print(f"  export {key}={shlex.quote(value)}")
    print(f"  {shell_join(step.command)}")


def run_step(step: Step, dry_run: bool) -> None:
    print_step(step, dry_run)
    if dry_run:
        return
    env = os.environ.copy()
    if step.env:
        env.update(step.env)
    subprocess.run(step.command, cwd=ROOT_DIR, env=env, check=True)


def require_commands(commands: list[str], dry_run: bool) -> None:
    missing = [command for command in commands if shutil.which(command) is None]
    if not missing:
        return
    message = "Missing required command(s): " + ", ".join(missing)
    if dry_run:
        print(f"Warning: {message}")
        return
    raise SystemExit(message)


def add_common_args(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--role", choices=["controller", "agent", "single-machine"])
    parser.add_argument("--config")
    parser.add_argument("--env-file", default=str(ROOT_DIR / ".neuraxis.env"))
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", default="9137")
    parser.add_argument("--agent-port", default="9138")
    parser.add_argument("--non-interactive", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--start", action="store_true")
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--skip-uv-sync", action="store_true")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Interactive Neuraxis setup wizard for controllers and agents."
    )
    add_common_args(parser)
    parser.add_argument("--node")
    parser.add_argument("--controller-url")
    parser.add_argument("--agent-url")
    parser.add_argument("--controller-registration-key")
    parser.add_argument("--llama-cpp-backend", choices=["auto", "cuda", "metal", "cpu"], default="auto")
    parser.add_argument("--llama-cpp-dir")
    parser.add_argument("--llama-cpp-ref", default="master")
    parser.add_argument("--enable-memory", action="store_true")
    parser.add_argument("--skip-memory-install", action="store_true")
    return parser.parse_args()


def collect_interactive(args: argparse.Namespace) -> argparse.Namespace:
    if args.non_interactive:
        if not args.role:
            raise SystemExit("--role is required with --non-interactive")
        return args

    print("Neuraxis setup wizard\n")
    args.role = args.role or prompt_choice(
        "What are you setting up?",
        ["controller", "agent", "single-machine"],
        "controller",
    )
    args.host = prompt("Bind host", args.host)
    args.port = prompt("Port", args.port)
    args.env_file = prompt("Local secrets env file", args.env_file)

    if args.role in {"controller", "single-machine"}:
        args.config = prompt("Controller config path", args.config or str(ROOT_DIR / "config.yaml"))
        args.enable_memory = prompt_bool("Enable controller semantic memory?", args.enable_memory)

    if args.role in {"agent", "single-machine"}:
        default_agent_config = str(ROOT_DIR / "agent.config.yaml")
        if args.role == "single-machine":
            default_agent_config = str(ROOT_DIR / "local-agent.config.yaml")
            args.agent_port = prompt("Agent port", args.agent_port)
        args.config = args.config or prompt("Agent config path", default_agent_config)
        args.node = prompt("Agent node name", args.node or os.uname().nodename.split(".")[0])
        args.controller_url = prompt("Controller URL", args.controller_url or f"http://127.0.0.1:{args.port}")
        default_agent_url_port = args.agent_port if args.role == "single-machine" else args.port
        args.agent_url = prompt("Agent URL", args.agent_url or f"http://127.0.0.1:{default_agent_url_port}")
        if args.role == "agent":
            args.controller_registration_key = prompt(
                "Controller registration key",
                args.controller_registration_key,
            )
        args.llama_cpp_backend = prompt_choice(
            "llama.cpp backend",
            ["auto", "cuda", "metal", "cpu"],
            args.llama_cpp_backend,
        )
        args.llama_cpp_dir = prompt("llama.cpp directory", args.llama_cpp_dir or str(Path.home() / "Apps" / "llama.cpp"))

    args.start = prompt_bool("Start services after setup?", args.start)
    return args


def controller_steps(args: argparse.Namespace, config: str | None = None) -> list[Step]:
    controller_config = config or args.config or str(ROOT_DIR / "config.yaml")
    command = [
        "scripts/onboard_controller.sh",
        "--config",
        controller_config,
        "--env-file",
        args.env_file,
        "--host",
        args.host,
        "--port",
        args.port,
    ]
    if args.enable_memory:
        command.append("--enable-memory")
    if args.skip_memory_install:
        command.append("--skip-memory-install")
    if args.force:
        command.append("--force")
    steps = [Step("Onboard controller", command)]
    if args.start:
        steps.append(Step("Start controller", ["scripts/start_controller.sh"], {"NEURAXIS_ENV_FILE": args.env_file}))
    return steps


def agent_steps(args: argparse.Namespace, config: str | None = None, port: str | None = None) -> list[Step]:
    agent_config = config or args.config or str(ROOT_DIR / "agent.config.yaml")
    agent_port = port or args.port
    node = default(args.node, os.uname().nodename.split(".")[0])
    controller_url = default(args.controller_url, f"http://127.0.0.1:{args.port}")
    agent_url = default(args.agent_url, f"http://127.0.0.1:{args.port}")
    llama_cpp_dir = default(args.llama_cpp_dir, str(Path.home() / "Apps" / "llama.cpp"))

    install_command = [
        "scripts/install_llama_cpp.sh",
        "--backend",
        args.llama_cpp_backend,
        "--dir",
        llama_cpp_dir,
        "--ref",
        args.llama_cpp_ref,
    ]
    onboard_command = [
        "scripts/onboard_agent.sh",
        "--config",
        agent_config,
        "--env-file",
        args.env_file,
        "--node",
        node,
        "--controller-url",
        controller_url,
        "--agent-url",
        agent_url,
        "--llama-cpp-backend",
        args.llama_cpp_backend,
        "--llama-cpp-dir",
        llama_cpp_dir,
        "--llama-cpp-ref",
        args.llama_cpp_ref,
    ]
    if args.force:
        onboard_command.append("--force")

    env = {}
    if args.controller_registration_key:
        env["NEURAXIS_CONTROLLER_REGISTRATION_KEY_OUTBOUND"] = args.controller_registration_key

    steps = [
        Step("Install llama.cpp", install_command),
        Step("Onboard agent", onboard_command, env or None),
    ]
    if args.start:
        steps.append(
            Step(
                "Start agent",
                ["scripts/start_agent.sh"],
                {"NEURAXIS_ENV_FILE": args.env_file, "NEURAXIS_PORT": agent_port},
            )
        )
    return steps


def build_steps(args: argparse.Namespace) -> list[Step]:
    steps: list[Step] = []
    if not args.skip_uv_sync:
        steps.append(Step("Install Neuraxis Python dependencies", ["uv", "sync"]))

    if args.role == "controller":
        steps.extend(controller_steps(args))
    elif args.role == "agent":
        steps.extend(agent_steps(args))
    elif args.role == "single-machine":
        controller_config = str(ROOT_DIR / "controller.config.yaml")
        agent_config = str(ROOT_DIR / "local-agent.config.yaml")
        steps.extend(controller_steps(args, controller_config))
        if not args.agent_url:
            args.agent_url = f"http://127.0.0.1:{args.agent_port}"
        steps.extend(agent_steps(args, agent_config, args.agent_port))
    else:
        raise SystemExit("Choose --role controller, agent, or single-machine")
    return steps


def main() -> int:
    args = collect_interactive(parse_args())
    print(f"Setup role: {args.role}")
    require_commands(["uv", "python3"], args.dry_run)

    steps = build_steps(args)
    print("\nSetup plan:")
    for step in steps:
        print(f"  - {step.title}")

    if not args.dry_run and not args.non_interactive:
        if not prompt_bool("Run this setup plan now?", True):
            print("Setup cancelled.")
            return 1

    for step in steps:
        run_step(step, args.dry_run)

    print("\nNeuraxis setup complete." if not args.dry_run else "\nDry run complete.")
    if args.role in {"controller", "single-machine"}:
        print(f"Controller secrets: {args.env_file}")
    if args.role in {"agent", "single-machine"}:
        print("Agent setup used GPU-first llama.cpp backend selection.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
