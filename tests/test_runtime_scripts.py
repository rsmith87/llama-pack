from __future__ import annotations

import json
import os
import subprocess
from pathlib import Path
from stat import S_IXUSR


ROOT_DIR = Path(__file__).resolve().parents[1]


def test_smoke_ocr_document_script_validates_paths_without_loading_ocr(tmp_path: Path) -> None:
    script = ROOT_DIR / "scripts" / "smoke_ocr_document.py"
    missing_file = tmp_path / "missing.png"
    det_model = tmp_path / "det"
    rec_model = tmp_path / "rec"
    det_model.mkdir()
    rec_model.mkdir()

    result = subprocess.run(
        [
            "python3",
            str(script),
            "--file",
            str(missing_file),
            "--det-model",
            str(det_model),
            "--rec-model",
            str(rec_model),
        ],
        cwd=ROOT_DIR,
        capture_output=True,
        text=True,
    )

    assert result.returncode == 2
    assert f"OCR input file does not exist: {missing_file}" in result.stderr


def test_evaluate_ocr_candidates_script_prints_config_only_json(tmp_path: Path) -> None:
    script = ROOT_DIR / "scripts" / "evaluate_ocr_candidates.py"
    sample_file = tmp_path / "invoice.png"
    sample_file.write_bytes(b"fake-image")

    result = subprocess.run(
        [
            "python3",
            str(script),
            "--file",
            str(sample_file),
            "--config-only",
        ],
        cwd=ROOT_DIR,
        capture_output=True,
        text=True,
        check=True,
    )

    payload = json.loads(result.stdout)

    assert payload["files"] == [str(sample_file)]
    assert payload["recommendation"] == "stay-tesseract-first-until-local-paddleocr-vl-benchmark-wins"
    assert payload["candidates"][0]["id"] == "tesseract-baseline"
    assert payload["candidates"][1]["shared_ocr_config"] == {
        "engine": "paddleocr",
        "det_model": "models/ocr/pp-ocrv5-server/det",
        "rec_model": "models/ocr/pp-ocrv5-server/rec",
        "det_model_name": "PP-OCRv5_server_det",
        "rec_model_name": "PP-OCRv5_server_rec",
    }
    assert payload["candidates"][2]["integration_status"] == "requires-new-paddleocr-vl-runner"


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
        "scripts/install_ocr_model.sh",
        "scripts/setup_llama_pack.sh",
    ]:
        subprocess.run(["bash", "-n", str(ROOT_DIR / script)], check=True)

    subprocess.run(["python3", "-m", "py_compile", str(ROOT_DIR / "scripts" / "smoke_ocr_document.py")], check=True)
    subprocess.run(
        ["python3", "-m", "py_compile", str(ROOT_DIR / "scripts" / "evaluate_ocr_candidates.py")],
        check=True,
    )


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
        "scripts/install_ocr_model.sh",
        "scripts/smoke_ocr_document.py",
        "scripts/evaluate_ocr_candidates.py",
        "scripts/refresh_curated_catalog.py",
        "scripts/setup_llama_pack.py",
        "scripts/setup_llama_pack.sh",
    ]:
        assert (ROOT_DIR / script).stat().st_mode & S_IXUSR


def test_setup_llama_pack_controller_dry_run_builds_full_setup_plan(tmp_path: Path) -> None:
    result = subprocess.run(
        [
            "python3",
            str(ROOT_DIR / "scripts" / "setup_llama_pack.py"),
            "--non-interactive",
            "--dry-run",
            "--role",
            "controller",
            "--config",
            str(tmp_path / "controller.config.yaml"),
            "--env-file",
            str(tmp_path / ".llama_pack.env"),
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


def test_setup_llama_pack_agent_dry_run_builds_gpu_first_setup_plan(tmp_path: Path) -> None:
    result = subprocess.run(
        [
            "python3",
            str(ROOT_DIR / "scripts" / "setup_llama_pack.py"),
            "--non-interactive",
            "--dry-run",
            "--role",
            "agent",
            "--config",
            str(tmp_path / "agent.config.yaml"),
            "--env-file",
            str(tmp_path / ".llama_pack.env"),
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
    assert "LLAMA_PACK_CONTROLLER_REGISTRATION_KEY_OUTBOUND" in result.stdout
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


def test_install_caddy_fullchain_installs_to_user_writable_cert_dir_without_sudo(tmp_path: Path) -> None:
    leaf = tmp_path / "mac-mini.crt"
    key = tmp_path / "mac-mini.key"
    intermediate = tmp_path / "intermediate_ca.crt"
    cert_dir = tmp_path / "caddy-certs"
    cert_dir.mkdir()
    leaf.write_text("leaf\n", encoding="utf-8")
    key.write_text("key\n", encoding="utf-8")
    intermediate.write_text("intermediate\n", encoding="utf-8")

    result = subprocess.run(
        [
            "bash",
            str(ROOT_DIR / "scripts" / "install_caddy_fullchain.sh"),
            "--name",
            "mac-mini",
            "--leaf",
            str(leaf),
            "--key",
            str(key),
            "--intermediate",
            str(intermediate),
            "--cert-dir",
            str(cert_dir),
            "--owner",
            str(os.getuid()),
            "--group",
            str(os.getgid()),
        ],
        cwd=ROOT_DIR,
        capture_output=True,
        text=True,
        check=True,
    )

    assert "Installed Caddy certs under:" in result.stdout
    assert (cert_dir / "mac-mini.crt").read_text(encoding="utf-8") == "leaf\n"
    assert (cert_dir / "mac-mini-fullchain.crt").read_text(encoding="utf-8") == "leaf\nintermediate\n"
    assert (cert_dir / "mac-mini.key").read_text(encoding="utf-8") == "key\n"


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


def test_onboard_controller_enable_memory_writes_working_config(tmp_path: Path) -> None:
    config = tmp_path / "controller.config.yaml"
    env_file = tmp_path / ".llama_pack.env"
    model_dir = tmp_path / "models" / "embedding" / "all-MiniLM-L6-v2"
    store_dir = tmp_path / "memory"
    model_dir.mkdir(parents=True)
    env = {
        **os.environ,
        "LLAMA_PACK_CONTROLLER_REGISTRATION_KEY": "controller-key",
        "LLAMA_PACK_CONTROLLER_ADMIN_API_KEY": "admin-key",
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
    assert f"export LLAMA_PACK_MEMORY_MODEL_PATH={model_dir}" in env_text


def test_onboard_controller_enable_memory_reports_missing_model_path(tmp_path: Path) -> None:
    config = tmp_path / "controller.config.yaml"
    env_file = tmp_path / ".llama_pack.env"
    missing_model_dir = tmp_path / "missing-model"
    env = {
        **os.environ,
        "LLAMA_PACK_CONTROLLER_REGISTRATION_KEY": "controller-key",
        "LLAMA_PACK_CONTROLLER_ADMIN_API_KEY": "admin-key",
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
    env_file = tmp_path / ".llama_pack.env"
    controller_url = "http://192.168.1.104:9137"
    agent_url = "http://192.168.1.205:9137"
    env = {
        **os.environ,
        "LLAMA_PACK_CONTROLLER_REGISTRATION_KEY_OUTBOUND": "join-key",
        "LLAMA_PACK_AGENT_API_KEY": "agent-key",
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
    assert "controller_url: ${LLAMA_PACK_CONTROLLER_URL}" in config_text
    assert "agent_url: ${LLAMA_PACK_AGENT_URL}" in config_text
    assert controller_url not in config_text
    assert agent_url not in config_text

    env_text = env_file.read_text(encoding="utf-8")
    assert f"export LLAMA_PACK_CONTROLLER_URL={controller_url}" in env_text
    assert f"export LLAMA_PACK_AGENT_URL={agent_url}" in env_text

    assert "url: ${LLAMA_PACK_LINUX_2080TI_AGENT_URL}" in result.stdout
