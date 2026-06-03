#!/usr/bin/env python3
from __future__ import annotations

import argparse
import os
import signal
import subprocess
import sys
import time
from pathlib import Path
from typing import Any

import httpx

ROOT_DIR = Path(__file__).resolve().parents[1]
DEFAULT_CONFIG = ROOT_DIR / "linux-agent.config.example.yaml"


class SmokeCheckError(RuntimeError):
    pass


def fail(message: str) -> None:
    raise SystemExit(message)


def has_unresolved_placeholder(value: str | None) -> bool:
    return bool(value and "${" in value)


def validate_transfer_agent_config(config: Any, expected_node: str) -> None:
    errors = []
    if config.mode != "agent":
        errors.append("mode must be 'agent'")
    if config.node_name != expected_node:
        errors.append(f"node_name must be '{expected_node}'")
    if not config.controller_url:
        errors.append("controller_url is required")
    if not config.agent_url:
        errors.append("agent_url is required")
    if not config.agent_api_key:
        errors.append("agent_api_key is required for destination library checks")
    elif has_unresolved_placeholder(config.agent_api_key):
        errors.append("agent_api_key has an unresolved environment placeholder")
    if config.controller_registration_key_outbound is None:
        errors.append("controller_registration_key_outbound is required")
    elif has_unresolved_placeholder(config.controller_registration_key_outbound):
        errors.append("controller_registration_key_outbound has an unresolved environment placeholder")
    if not config.agent_worker_enabled:
        errors.append("agent_worker_enabled must be true for destination transfer execution")
    if errors:
        fail("Transfer smoke config is not ready:\n- " + "\n- ".join(errors))


def validate_runtime_paths(config: Any) -> None:
    errors = []
    llama_server_bin = Path(config.llama_server_bin).expanduser()
    llama_cpp_dir = Path(config.llama_cpp_dir).expanduser()
    if not llama_server_bin.is_file():
        errors.append(f"llama_server_bin does not exist: {llama_server_bin}")
    if not llama_cpp_dir.is_dir():
        errors.append(f"llama_cpp_dir does not exist: {llama_cpp_dir}")
    for root in config.model_roots:
        expanded = Path(root).expanduser()
        if not expanded.is_dir():
            errors.append(f"hf_models_dirs entry does not exist: {expanded}")
    if errors:
        fail("Linux runtime paths are not smoke-test ready:\n- " + "\n- ".join(errors))


def headers(api_key: str | None) -> dict[str, str]:
    return {"X-Llama-Manager-Key": api_key} if api_key else {}


def get_json(client: httpx.Client, url: str, api_key: str | None = None) -> Any:
    response = client.get(url, headers=headers(api_key))
    response.raise_for_status()
    return response.json()


def post_json(client: httpx.Client, url: str, payload: dict[str, Any], api_key: str | None = None) -> Any:
    response = client.post(url, json=payload, headers=headers(api_key))
    response.raise_for_status()
    return response.json()


def wait_for_agent_health(
    client: httpx.Client,
    agent_url: str,
    api_key: str,
    timeout_seconds: float,
) -> dict[str, Any]:
    deadline = time.monotonic() + timeout_seconds
    last_error: Exception | None = None
    url = f"{agent_url.rstrip('/')}/health"
    while time.monotonic() < deadline:
        try:
            payload = get_json(client, url, api_key)
            if payload.get("mode") == "agent":
                return payload
            last_error = SmokeCheckError(f"{url} returned mode={payload.get('mode')!r}")
        except Exception as exc:
            last_error = exc
        time.sleep(1)
    raise SmokeCheckError(f"Agent health did not become ready at {url}: {last_error}")


def normalize_url(value: str) -> str:
    return value.rstrip("/")


def find_registered_node(nodes: list[dict[str, Any]], node_name: str, agent_url: str) -> dict[str, Any]:
    for node in nodes:
        if node.get("name") != node_name:
            continue
        if normalize_url(str(node.get("url", ""))) != normalize_url(agent_url):
            raise SmokeCheckError(
                f"{node_name} registered with url={node.get('url')!r}, expected {agent_url!r}"
            )
        if not node.get("heartbeat_fresh"):
            raise SmokeCheckError(f"{node_name} heartbeat is not fresh")
        if not node.get("last_heartbeat"):
            raise SmokeCheckError(f"{node_name} has no last_heartbeat")
        return node
    raise SmokeCheckError(f"{node_name} is not listed by the controller")


def wait_for_controller_registration(
    client: httpx.Client,
    controller_url: str,
    node_name: str,
    agent_url: str,
    controller_api_key: str | None,
    timeout_seconds: float,
) -> dict[str, Any]:
    deadline = time.monotonic() + timeout_seconds
    last_error: Exception | None = None
    url = f"{controller_url.rstrip('/')}/lm-api/v1/nodes"
    while time.monotonic() < deadline:
        try:
            nodes = get_json(client, url, controller_api_key)
            return find_registered_node(nodes, node_name, agent_url)
        except Exception as exc:
            last_error = exc
        time.sleep(1)
    raise SmokeCheckError(f"Controller did not report fresh registration at {url}: {last_error}")


def select_source_file(files: list[dict[str, Any]], selector: str) -> dict[str, Any]:
    matches = [
        item
        for item in files
        if selector in {str(item.get("id", "")), str(item.get("filename", "")), str(item.get("path", ""))}
    ]
    if not matches:
        raise SmokeCheckError(f"Source GGUF selector did not match any library entry: {selector}")
    if len(matches) > 1:
        raise SmokeCheckError(f"Source GGUF selector matches multiple GGUF files: {selector}")
    return matches[0]


def start_agent(config_path: Path, host: str, port: int) -> subprocess.Popen[str]:
    env = os.environ.copy()
    env["NEURAXIS_CONFIG"] = str(config_path)
    return subprocess.Popen(
        [
            sys.executable,
            "-m",
            "uvicorn",
            "llama_manager.main:app",
            "--host",
            host,
            "--port",
            str(port),
        ],
        cwd=ROOT_DIR,
        env=env,
        text=True,
    )


def stop_agent(process: subprocess.Popen[str]) -> None:
    if process.poll() is not None:
        return
    process.send_signal(signal.SIGTERM)
    try:
        process.wait(timeout=10)
    except subprocess.TimeoutExpired:
        process.kill()
        process.wait(timeout=5)


def wait_for_transfer_completion(
    client: httpx.Client,
    controller_url: str,
    transfer_id: str,
    controller_api_key: str,
    timeout_seconds: float,
) -> dict[str, Any]:
    deadline = time.monotonic() + timeout_seconds
    last_transfer: dict[str, Any] | None = None
    url = f"{controller_url.rstrip('/')}/transfers/{transfer_id}"
    while time.monotonic() < deadline:
        transfer = get_json(client, url, controller_api_key)
        last_transfer = transfer if isinstance(transfer, dict) else None
        status = str(transfer.get("status", "")).lower()
        if status in {"completed", "failed", "timed_out", "canceled"}:
            return transfer
        time.sleep(1)
    raise SmokeCheckError(f"Transfer did not finish at {url}: last status={last_transfer}")


def verify_transfer_result(
    transfer: dict[str, Any],
    *,
    destination_root: Path,
    selected_file: dict[str, Any],
) -> dict[str, Any]:
    status = str(transfer.get("status", "")).lower()
    if status != "completed":
        raise SmokeCheckError(
            f"Transfer {transfer.get('id')} finished with status={transfer.get('status')!r} "
            f"error_code={transfer.get('error_code')!r} detail={transfer.get('error_detail')!r}"
        )

    destination_root_resolved = destination_root.resolve()
    selected_filename = str(selected_file.get("filename"))
    results = []
    copied = transfer.get("copied", [])
    skipped = transfer.get("skipped", [])
    if isinstance(copied, list):
        results.extend(item for item in copied if isinstance(item, dict))
    if isinstance(skipped, list):
        results.extend(item for item in skipped if isinstance(item, dict))

    selected_match: dict[str, Any] | None = None
    for item in results:
        path_text = item.get("path")
        if not path_text:
            continue
        path = Path(str(path_text))
        try:
            path.resolve().relative_to(destination_root_resolved)
        except ValueError as exc:
            raise SmokeCheckError(f"Transferred file is outside destination model root: {path}") from exc
        if path.name == selected_filename:
            selected_match = item
    if selected_match is None:
        raise SmokeCheckError(f"Transfer result does not include selected GGUF {selected_filename}")
    return selected_match


def verify_destination_library_file(
    files: list[dict[str, Any]],
    *,
    destination_path: Path,
) -> dict[str, Any]:
    destination_text = str(destination_path)
    for item in files:
        if item.get("path") == destination_text:
            return item
    raise SmokeCheckError(f"Destination library did not report transferred GGUF: {destination_text}")


def verify_transfer_list_contains(
    transfers: list[dict[str, Any]],
    *,
    transfer_id: str,
) -> None:
    if not any(item.get("id") == transfer_id for item in transfers):
        raise SmokeCheckError(f"Controller transfer list does not include transfer id {transfer_id}")


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Start a destination Linux agent and verify a controller-driven GGUF transfer "
            "from a source agent into the destination model root."
        )
    )
    parser.add_argument("--config", type=Path, default=DEFAULT_CONFIG)
    parser.add_argument("--node", default="linux-2080ti")
    parser.add_argument("--host", default=os.getenv("NEURAXIS_HOST", "127.0.0.1"))
    parser.add_argument("--port", type=int, default=int(os.getenv("NEURAXIS_PORT", "9137")))
    parser.add_argument("--timeout", type=float, default=90)
    parser.add_argument("--controller-api-key", default=os.getenv("NEURAXIS_CONTROLLER_API_KEY"))
    parser.add_argument("--source-node", required=True, help="Controller node name for the source agent.")
    parser.add_argument(
        "--source-agent-url",
        default=os.getenv("NEURAXIS_SOURCE_AGENT_URL"),
        help="Direct source agent URL used to resolve the selected GGUF from /library/ggufs.",
    )
    parser.add_argument(
        "--source-agent-api-key",
        default=os.getenv("NEURAXIS_SOURCE_AGENT_API_KEY"),
        help="API key for the direct source agent /library/ggufs request.",
    )
    parser.add_argument(
        "--source-gguf",
        required=True,
        help="Source GGUF selector: exact file id, filename, or full source path.",
    )
    parser.add_argument(
        "--stop-after-check",
        action="store_true",
        help="Stop the destination uvicorn process after the smoke checks pass.",
    )
    parser.add_argument(
        "--skip-runtime-path-check",
        action="store_true",
        help="Skip llama.cpp and destination model directory existence checks.",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    from llama_manager.core.config import load_config

    args = parse_args(argv or sys.argv[1:])
    if not args.controller_api_key:
        fail("--controller-api-key is required")
    if not args.source_agent_url:
        fail("--source-agent-url is required")

    config_path = args.config.resolve()
    config = load_config(config_path)
    validate_transfer_agent_config(config, expected_node=args.node)
    if not args.skip_runtime_path_check:
        validate_runtime_paths(config)

    print(f"Config OK: {config_path}")
    process = start_agent(config_path, args.host, args.port)
    print(f"Started destination agent PID {process.pid} on {args.host}:{args.port}")
    try:
        with httpx.Client(timeout=10) as client:
            health = wait_for_agent_health(
                client,
                config.agent_url,
                config.agent_api_key or "",
                args.timeout,
            )
            print(f"Destination agent health OK: mode={health.get('mode')} config={health.get('config_source')}")
            node = wait_for_controller_registration(
                client,
                config.controller_url or "",
                args.node,
                config.agent_url,
                args.controller_api_key,
                args.timeout,
            )
            print(
                "Controller registration OK: "
                f"name={node.get('name')} heartbeat={node.get('last_heartbeat')}"
            )

            source_files = get_json(
                client,
                f"{args.source_agent_url.rstrip('/')}/library/ggufs",
                args.source_agent_api_key,
            )
            selected = select_source_file(source_files, args.source_gguf)
            print(
                "Selected source GGUF: "
                f"id={selected.get('id')} filename={selected.get('filename')} path={selected.get('path')}"
            )

            transfer = post_json(
                client,
                f"{str(config.controller_url).rstrip('/')}/lm-api/v1/nodes/{args.source_node}/transfers",
                {
                    "destination_node": args.node,
                    "source_file_id": selected["id"],
                    "include": "selected_with_sidecars",
                },
                args.controller_api_key,
            )
            transfer_id = str(transfer.get("id", ""))
            if not transfer_id:
                raise SmokeCheckError(f"Controller did not return a transfer id: {transfer}")
            print(f"Created transfer: id={transfer_id} status={transfer.get('status')}")

            finished = wait_for_transfer_completion(
                client,
                str(config.controller_url),
                transfer_id,
                args.controller_api_key,
                args.timeout,
            )
            selected_copy = verify_transfer_result(
                finished,
                destination_root=config.model_roots[0],
                selected_file=selected,
            )
            destination_path = Path(str(selected_copy["path"]))
            print(
                "Transfer completed: "
                f"status={finished.get('status')} copied={finished.get('files_copied')} "
                f"skipped={finished.get('files_skipped')} selected_path={destination_path}"
            )

            destination_files = get_json(
                client,
                f"{str(config.agent_url).rstrip('/')}/library/ggufs",
                config.agent_api_key,
            )
            library_item = verify_destination_library_file(destination_files, destination_path=destination_path)
            print(f"Destination library OK: id={library_item.get('id')} path={library_item.get('path')}")

            transfers = get_json(client, f"{str(config.controller_url).rstrip('/')}/transfers", args.controller_api_key)
            verify_transfer_list_contains(transfers, transfer_id=transfer_id)
            print(f"Controller transfer API OK: transfer {transfer_id} is listed.")
    except Exception as exc:
        stop_agent(process)
        fail(f"Model transfer smoke test failed: {exc}")

    if args.stop_after_check:
        stop_agent(process)
        print("Stopped destination agent after successful smoke check.")
    else:
        print(f"Smoke test passed. Destination agent is still running on PID {process.pid}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
