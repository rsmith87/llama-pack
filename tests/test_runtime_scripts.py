from __future__ import annotations

import os
import subprocess
from pathlib import Path
from stat import S_IXUSR


ROOT_DIR = Path(__file__).resolve().parents[1]


def read_script(name: str) -> str:
    return (ROOT_DIR / "scripts" / name).read_text(encoding="utf-8")


def test_start_agent_script_uses_agent_specific_runtime_defaults() -> None:
    script = ROOT_DIR / "scripts" / "start_agent.sh"

    assert script.exists()
    contents = script.read_text(encoding="utf-8")
    assert ".neuraxis_agent.pid" in contents
    assert "neuraxis_agent_uvicorn.log" in contents
    assert "NEURAXIS_MODE=agent" in contents
    assert "Expected agent config" in contents
    assert "NEURAXIS_START_FRONTEND" in contents
    assert 'start_frontend.sh' in contents


def test_start_server_is_deprecated_agent_wrapper() -> None:
    contents = read_script("start_server.sh")

    assert "deprecated" in contents.lower()
    assert 'exec "$ROOT_DIR/scripts/start_agent.sh"' in contents


def test_stop_server_knows_agent_controller_and_legacy_targets() -> None:
    contents = read_script("stop_server.sh")

    assert ".neuraxis_agent.pid" in contents
    assert ".neuraxis_controller.pid" in contents
    assert ".neuraxis_frontend.pid" in contents
    assert ".neuraxis.pid" in contents
    assert '"agent")' in contents
    assert '"controller")' in contents
    assert '"frontend")' in contents
    assert '"server"|"legacy")' in contents


def test_start_controller_script_uses_controller_specific_runtime_defaults() -> None:
    contents = read_script("start_controller.sh")

    assert ".neuraxis_controller.pid" in contents
    assert "neuraxis_controller_uvicorn.log" in contents
    assert "NEURAXIS_MODE=controller" in contents
    assert "Expected controller config" in contents
    assert "NEURAXIS_START_FRONTEND" in contents
    assert 'start_frontend.sh' in contents


def test_start_frontend_script_uses_vite_dev_server_defaults() -> None:
    contents = read_script("start_frontend.sh")

    assert ".neuraxis_frontend.pid" in contents
    assert "neuraxis_frontend_vite.log" in contents
    assert "VITE_API_PROXY_TARGET" in contents
    assert "npm run dev" in contents
    assert 'NEURAXIS_FRONTEND_HOST:-127.0.0.1' in contents
    assert 'NEURAXIS_FRONTEND_PORT:-5173' in contents
    assert 'NEURAXIS_FRONTEND_BASE_PATH:-/ui/' in contents


def test_start_controller_stack_script_starts_controller_and_frontend() -> None:
    contents = read_script("start_controller_stack.sh")

    assert ".neuraxis_controller.pid" in contents
    assert ".neuraxis_frontend.pid" in contents
    assert "currently up" in contents
    assert 'scripts/start_controller.sh' in contents
    assert 'scripts/start_frontend.sh' in contents


def test_start_agent_stack_script_starts_agent_and_frontend() -> None:
    contents = read_script("start_agent_stack.sh")

    assert ".neuraxis_agent.pid" in contents
    assert ".neuraxis_frontend.pid" in contents
    assert "currently up" in contents
    assert 'scripts/start_agent.sh' in contents
    assert 'scripts/start_frontend.sh' in contents


def test_create_test_chat_key_script_updates_env_for_bootstrap() -> None:
    contents = read_script("create_test_chat_key.sh")

    assert "create-test-chat-key" in contents
    assert "NEURAXIS_TEST_CHAT_API_KEY" in contents
    assert ".neuraxis.env" in contents
    assert "chmod 600" in contents


def test_stop_frontend_script_wraps_stop_server_frontend_target() -> None:
    contents = read_script("stop_frontend.sh")

    assert "NEURAXIS_FRONTEND_PID_FILE" in contents
    assert "NEURAXIS_PID_FILE" in contents
    assert 'exec "$ROOT_DIR/scripts/stop_server.sh" frontend' in contents


def test_runtime_shell_scripts_parse_cleanly() -> None:
    for script in [
        "scripts/onboard_agent.sh",
        "scripts/onboard_controller.sh",
        "scripts/start_agent.sh",
        "scripts/start_controller.sh",
        "scripts/start_controller_stack.sh",
        "scripts/start_frontend.sh",
        "scripts/start_agent_stack.sh",
        "scripts/start_server.sh",
        "scripts/stop_frontend.sh",
        "scripts/stop_server.sh",
        "scripts/create_test_chat_key.sh",
    ]:
        subprocess.run(["bash", "-n", str(ROOT_DIR / script)], check=True)


def test_runtime_shell_scripts_are_executable() -> None:
    for script in [
        "scripts/onboard_agent.sh",
        "scripts/onboard_controller.sh",
        "scripts/start_agent.sh",
        "scripts/start_controller.sh",
        "scripts/start_controller_stack.sh",
        "scripts/start_frontend.sh",
        "scripts/start_agent_stack.sh",
        "scripts/start_server.sh",
        "scripts/stop_frontend.sh",
        "scripts/stop_server.sh",
        "scripts/create_test_chat_key.sh",
    ]:
        assert (ROOT_DIR / script).stat().st_mode & S_IXUSR


def test_onboard_agent_keeps_lan_urls_in_env_not_config(tmp_path: Path) -> None:
    config = tmp_path / "agent.config.yaml"
    env_file = tmp_path / ".neuraxis.env"
    controller_url = "http://192.168.1.104:9137"
    agent_url = "http://192.168.1.205:9137"
    env = {
        **os.environ,
        "NEURAXIS_CONTROLLER_REGISTRATION_KEY_OUTBOUND": "join-key",
        "NEURAXIS_AGENT_API_KEY": "agent-key",
    }

    result = subprocess.run(
        [
            "bash",
            str(ROOT_DIR / "scripts" / "onboard_agent.sh"),
            "--config",
            str(config),
            "--env-file",
            str(env_file),
            "--controller-url",
            controller_url,
            "--agent-url",
            agent_url,
            "--node",
            "linux-2080ti",
        ],
        cwd=ROOT_DIR,
        env=env,
        check=True,
        capture_output=True,
        text=True,
    )

    config_text = config.read_text(encoding="utf-8")
    assert "controller_url: ${NEURAXIS_CONTROLLER_URL}" in config_text
    assert "agent_url: ${NEURAXIS_AGENT_URL}" in config_text
    assert controller_url not in config_text
    assert agent_url not in config_text

    env_text = env_file.read_text(encoding="utf-8")
    assert f"export NEURAXIS_CONTROLLER_URL={controller_url}" in env_text
    assert f"export NEURAXIS_AGENT_URL={agent_url}" in env_text

    assert "url: ${NEURAXIS_LINUX_2080TI_AGENT_URL}" in result.stdout
