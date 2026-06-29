from __future__ import annotations

import shutil
import socket
import ssl
import subprocess
import threading
from pathlib import Path

import pytest

from llama_pack.core.network.cert_probe import probe_cert_expiry_seconds


def _write_self_signed_cert(tmp_path: Path) -> tuple[Path, Path]:
    openssl = shutil.which("openssl")
    if openssl is None:
        pytest.skip("openssl is required for the local TLS certificate probe test")

    cert_path = tmp_path / "localhost.crt"
    key_path = tmp_path / "localhost.key"
    subprocess.run(
        [
            openssl,
            "req",
            "-x509",
            "-newkey",
            "rsa:2048",
            "-keyout",
            str(key_path),
            "-out",
            str(cert_path),
            "-days",
            "7",
            "-nodes",
            "-subj",
            "/CN=localhost",
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    return cert_path, key_path


def _serve_one_tls_connection(cert_path: Path, key_path: Path) -> tuple[int, threading.Thread]:
    ready = threading.Event()
    port_holder: list[int] = []
    error_holder: list[BaseException] = []

    def serve() -> None:
        try:
            context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
            context.load_cert_chain(certfile=cert_path, keyfile=key_path)
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as listener:
                listener.bind(("127.0.0.1", 0))
                listener.listen(1)
                port_holder.append(listener.getsockname()[1])
                ready.set()
                with listener.accept()[0] as raw:
                    with context.wrap_socket(raw, server_side=True) as tls:
                        tls.recv(1)
        except BaseException as exc:
            error_holder.append(exc)
            ready.set()

    thread = threading.Thread(target=serve, daemon=True)
    thread.start()
    ready.wait(timeout=5)
    if error_holder:
        raise RuntimeError("TLS test server failed to start") from error_holder[0]
    if not port_holder:
        raise RuntimeError("TLS test server did not report a port")
    return port_holder[0], thread


async def test_probe_cert_expiry_reads_self_signed_certificate(tmp_path: Path) -> None:
    cert_path, key_path = _write_self_signed_cert(tmp_path)
    port, thread = _serve_one_tls_connection(cert_path, key_path)

    expires_in_seconds = await probe_cert_expiry_seconds(f"https://localhost:{port}")

    thread.join(timeout=5)
    assert expires_in_seconds is not None
    assert expires_in_seconds > 0
