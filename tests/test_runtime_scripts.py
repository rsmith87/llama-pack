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


def test_start_frontend_checks_running_pid_before_building() -> None:
    contents = read_script("start_frontend.sh")

    assert contents.index('if [[ -f "$PID_FILE" ]]') < contents.index('echo "Building frontend..."')


def test_start_controller_stack_script_starts_controller_and_frontend() -> None:
    contents = read_script("start_controller_stack.sh")

    assert ".neuraxis_controller.pid" in contents
    assert ".neuraxis_frontend.pid" in contents
    assert "currently up" in contents
    assert 'scripts/start_controller.sh' in contents
    assert 'scripts/start_frontend.sh' in contents
    assert 'NEURAXIS_START_FRONTEND=0 "$ROOT_DIR/scripts/start_controller.sh"' in contents


def test_start_agent_stack_script_starts_agent_and_frontend() -> None:
    contents = read_script("start_agent_stack.sh")

    assert ".neuraxis_agent.pid" in contents
    assert ".neuraxis_frontend.pid" in contents
    assert "currently up" in contents
    assert 'scripts/start_agent.sh' in contents
    assert 'scripts/start_frontend.sh' in contents
    assert 'NEURAXIS_START_FRONTEND=0 "$ROOT_DIR/scripts/start_agent.sh"' in contents


def test_stack_scripts_refresh_frontend_status_after_backend_start() -> None:
    for script_name in ("start_agent_stack.sh", "start_controller_stack.sh"):
        contents = read_script(script_name)

        backend_start = contents.index('NEURAXIS_START_FRONTEND=0 "$ROOT_DIR/scripts/start_')
        frontend_start = contents.index('"$ROOT_DIR/scripts/start_frontend.sh"')
        assert backend_start < contents.index('if is_running "$FRONTEND_PID_FILE"; then', backend_start)
        assert contents.index('if is_running "$FRONTEND_PID_FILE"; then', backend_start) < frontend_start


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
        "scripts/install_caddy_fullchain.sh",
        "scripts/renew_caddy_step_cert.sh",
        "scripts/install_llama_cpp.sh",
        "scripts/setup_neuraxis.sh",
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
        "scripts/install_caddy_fullchain.sh",
        "scripts/renew_caddy_step_cert.sh",
        "scripts/install_llama_cpp.sh",
        "scripts/setup_neuraxis.py",
        "scripts/setup_neuraxis.sh",
    ]:
        assert (ROOT_DIR / script).stat().st_mode & S_IXUSR


def test_setup_neuraxis_controller_dry_run_builds_full_setup_plan(tmp_path: Path) -> None:
    result = subprocess.run(
        [
            "python3",
            str(ROOT_DIR / "scripts" / "setup_neuraxis.py"),
            "--non-interactive",
            "--dry-run",
            "--role",
            "controller",
            "--config",
            str(tmp_path / "controller.config.yaml"),
            "--env-file",
            str(tmp_path / ".neuraxis.env"),
            "--host",
            "0.0.0.0",
            "--port",
            "9137",
            "--enable-memory",
            "--start",
        ],
        cwd=ROOT_DIR,
        check=True,
        capture_output=True,
        text=True,
    )

    assert "Setup role: controller" in result.stdout
    assert "uv sync" in result.stdout
    assert "scripts/onboard_controller.sh" in result.stdout
    assert "--enable-memory" in result.stdout
    assert "scripts/start_controller.sh" in result.stdout


def test_setup_neuraxis_agent_dry_run_builds_gpu_first_setup_plan(tmp_path: Path) -> None:
    result = subprocess.run(
        [
            "python3",
            str(ROOT_DIR / "scripts" / "setup_neuraxis.py"),
            "--non-interactive",
            "--dry-run",
            "--role",
            "agent",
            "--config",
            str(tmp_path / "agent.config.yaml"),
            "--env-file",
            str(tmp_path / ".neuraxis.env"),
            "--node",
            "linux-2080ti",
            "--controller-url",
            "http://controller.local:9137",
            "--agent-url",
            "http://agent.local:9137",
            "--controller-registration-key",
            "join-key",
            "--llama-cpp-backend",
            "auto",
            "--start",
        ],
        cwd=ROOT_DIR,
        check=True,
        capture_output=True,
        text=True,
    )

    assert "Setup role: agent" in result.stdout
    assert "uv sync" in result.stdout
    assert "scripts/install_llama_cpp.sh" in result.stdout
    assert "--backend auto" in result.stdout
    assert "scripts/onboard_agent.sh" in result.stdout
    assert "--llama-cpp-dir" in result.stdout
    assert "NEURAXIS_CONTROLLER_REGISTRATION_KEY_OUTBOUND" in result.stdout
    assert "scripts/start_agent.sh" in result.stdout


def test_install_llama_cpp_dry_run_reports_backend_commands(tmp_path: Path) -> None:
    install_dir = tmp_path / "llama.cpp"

    result = subprocess.run(
        [
            "bash",
            str(ROOT_DIR / "scripts" / "install_llama_cpp.sh"),
            "--dir",
            str(install_dir),
            "--backend",
            "cuda",
            "--ref",
            "b1234",
            "--dry-run",
        ],
        cwd=ROOT_DIR,
        check=True,
        capture_output=True,
        text=True,
    )

    assert "Selected backend: cuda" in result.stdout
    assert "git clone https://github.com/ggml-org/llama.cpp.git" in result.stdout
    assert "git checkout b1234" in result.stdout
    assert "-DGGML_CUDA=ON" in result.stdout
    assert f"llama_server_bin: {install_dir}/build/bin/llama-server" in result.stdout
    assert f"llama_cpp_dir: {install_dir}" in result.stdout
    assert f"python_bin: {install_dir}/.venv/bin/python" in result.stdout


def test_install_llama_cpp_cpu_dry_run_disables_higher_priority_backends(tmp_path: Path) -> None:
    result = subprocess.run(
        [
            "bash",
            str(ROOT_DIR / "scripts" / "install_llama_cpp.sh"),
            "--dir",
            str(tmp_path / "llama.cpp"),
            "--backend",
            "cpu",
            "--dry-run",
        ],
        cwd=ROOT_DIR,
        check=True,
        capture_output=True,
        text=True,
    )

    assert "Selected backend: cpu" in result.stdout
    assert "-DGGML_METAL=OFF" in result.stdout
    assert "-DGGML_CUDA=OFF" in result.stdout


def test_install_caddy_fullchain_dry_run_builds_chain_and_reports_install_commands(tmp_path: Path) -> None:
    leaf = tmp_path / "pi-controller.crt"
    key = tmp_path / "pi-controller.key"
    intermediate = tmp_path / "intermediate_ca.crt"
    cert_dir = tmp_path / "caddy-certs"
    leaf.write_text("leaf\n", encoding="utf-8")
    key.write_text("key\n", encoding="utf-8")
    intermediate.write_text("intermediate\n", encoding="utf-8")

    result = subprocess.run(
        [
            "bash",
            str(ROOT_DIR / "scripts" / "install_caddy_fullchain.sh"),
            "--name",
            "pi-controller",
            "--leaf",
            str(leaf),
            "--key",
            str(key),
            "--intermediate",
            str(intermediate),
            "--cert-dir",
            str(cert_dir),
            "--dry-run",
        ],
        cwd=ROOT_DIR,
        check=True,
        capture_output=True,
        text=True,
    )

    fullchain = tmp_path / "pi-controller-fullchain.crt"
    assert fullchain.read_text(encoding="utf-8") == "leaf\nintermediate\n"
    assert "sudo install -d -o root -g caddy -m 750" in result.stdout
    assert f"sudo install -o root -g caddy -m 644 {leaf}" in result.stdout
    assert f"sudo install -o root -g caddy -m 644 {fullchain}" in result.stdout
    assert f"sudo install -o root -g caddy -m 640 {key}" in result.stdout
    assert str(cert_dir / "pi-controller-fullchain.crt") in result.stdout


def test_install_caddy_fullchain_reports_missing_inputs(tmp_path: Path) -> None:
    result = subprocess.run(
        [
            "bash",
            str(ROOT_DIR / "scripts" / "install_caddy_fullchain.sh"),
            "--name",
            "pi-controller",
            "--leaf",
            str(tmp_path / "missing.crt"),
            "--key",
            str(tmp_path / "missing.key"),
            "--intermediate",
            str(tmp_path / "missing-intermediate.crt"),
            "--dry-run",
        ],
        cwd=ROOT_DIR,
        capture_output=True,
        text=True,
    )

    assert result.returncode == 1
    assert "Leaf certificate not found" in result.stderr


def test_renew_caddy_step_cert_dry_run_reports_renew_install_and_reload(tmp_path: Path) -> None:
    leaf = tmp_path / "pi-controller.crt"
    key = tmp_path / "pi-controller.key"
    intermediate = tmp_path / "intermediate_ca.crt"
    root = tmp_path / "ca-root.crt"
    cert_dir = tmp_path / "caddy-certs"
    leaf.write_text("leaf\n", encoding="utf-8")
    key.write_text("key\n", encoding="utf-8")
    intermediate.write_text("intermediate\n", encoding="utf-8")
    root.write_text("root\n", encoding="utf-8")

    result = subprocess.run(
        [
            "bash",
            str(ROOT_DIR / "scripts" / "renew_caddy_step_cert.sh"),
            "--name",
            "pi-controller",
            "--leaf",
            str(leaf),
            "--key",
            str(key),
            "--intermediate",
            str(intermediate),
            "--ca-url",
            "https://pi-controller.local:8443",
            "--root",
            str(root),
            "--cert-dir",
            str(cert_dir),
            "--dry-run",
        ],
        cwd=ROOT_DIR,
        check=True,
        capture_output=True,
        text=True,
    )

    assert f"step ca renew {leaf} {key} --expires-in 168h" in result.stdout
    assert "--ca-url https://pi-controller.local:8443" in result.stdout
    assert f"--root {root}" in result.stdout
    assert "scripts/install_caddy_fullchain.sh" in result.stdout
    assert f"--cert-dir {cert_dir}" in result.stdout
    assert "--dry-run" in result.stdout
    assert "sudo systemctl reload caddy" in result.stdout


def test_onboard_controller_exposes_one_step_memory_setup_options() -> None:
    contents = read_script("onboard_controller.sh")

    assert "--enable-memory" in contents
    assert "--memory-model-path PATH" in contents
    assert "--skip-memory-install" in contents
    assert "controller-memory" in contents
    assert "install_embedding_model.sh" in contents


def test_onboard_controller_generated_config_includes_opt_in_memory_block() -> None:
    contents = read_script("onboard_controller.sh")

    assert 'if [[ "$ENABLE_MEMORY" == "true" ]]; then' in contents
    assert "memory:" in contents
    assert "enabled: true" in contents
    assert "embedding_model_path: $MEMORY_MODEL_PATH" in contents
    assert "Memory setup failed" in contents


def test_onboard_controller_enable_memory_writes_working_config(tmp_path: Path) -> None:
    config = tmp_path / "controller.config.yaml"
    env_file = tmp_path / ".neuraxis.env"
    model_dir = tmp_path / "models" / "embedding" / "all-MiniLM-L6-v2"
    store_dir = tmp_path / "memory"
    model_dir.mkdir(parents=True)
    env = {
        **os.environ,
        "NEURAXIS_CONTROLLER_REGISTRATION_KEY": "controller-key",
        "NEURAXIS_CONTROLLER_ADMIN_API_KEY": "admin-key",
    }

    result = subprocess.run(
        [
            "bash",
            str(ROOT_DIR / "scripts" / "onboard_controller.sh"),
            "--config",
            str(config),
            "--env-file",
            str(env_file),
            "--enable-memory",
            "--skip-memory-install",
            "--skip-migrations",
            "--memory-model-path",
            str(model_dir),
            "--memory-store-path",
            str(store_dir),
        ],
        cwd=ROOT_DIR,
        env=env,
        check=True,
        capture_output=True,
        text=True,
    )

    config_text = config.read_text(encoding="utf-8")
    assert "memory:" in config_text
    assert "enabled: true" in config_text
    assert f"embedding_model_path: {model_dir}" in config_text
    assert f"path: {store_dir}" in config_text
    assert "Memory:\n  enabled: true" in result.stdout

    env_text = env_file.read_text(encoding="utf-8")
    assert f"export NEURAXIS_MEMORY_MODEL_PATH={model_dir}" in env_text


def test_onboard_controller_enable_memory_reports_missing_model_path(tmp_path: Path) -> None:
    config = tmp_path / "controller.config.yaml"
    env_file = tmp_path / ".neuraxis.env"
    missing_model_dir = tmp_path / "missing-model"
    env = {
        **os.environ,
        "NEURAXIS_CONTROLLER_REGISTRATION_KEY": "controller-key",
        "NEURAXIS_CONTROLLER_ADMIN_API_KEY": "admin-key",
    }

    result = subprocess.run(
        [
            "bash",
            str(ROOT_DIR / "scripts" / "onboard_controller.sh"),
            "--config",
            str(config),
            "--env-file",
            str(env_file),
            "--enable-memory",
            "--skip-memory-install",
            "--skip-migrations",
            "--memory-model-path",
            str(missing_model_dir),
        ],
        cwd=ROOT_DIR,
        env=env,
        capture_output=True,
        text=True,
    )

    assert result.returncode == 1
    assert "Memory setup failed: embedding model path does not exist" in result.stderr
    assert "scripts/install_embedding_model.sh" in result.stderr


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


def test_onboard_agent_exposes_optional_llama_cpp_install() -> None:
    contents = read_script("onboard_agent.sh")

    assert "--install-llama-cpp" in contents
    assert "--llama-cpp-backend BACKEND" in contents
    assert "--llama-cpp-dir PATH" in contents
    assert "install_llama_cpp.sh" in contents


def test_onboard_agent_can_reuse_local_controller_registration_key() -> None:
    contents = read_script("onboard_agent.sh")

    assert "NEURAXIS_CONTROLLER_REGISTRATION_KEY_OUTBOUND=\"$NEURAXIS_CONTROLLER_REGISTRATION_KEY\"" in contents
    assert "Using local NEURAXIS_CONTROLLER_REGISTRATION_KEY as outbound registration key." in contents
