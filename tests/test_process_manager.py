from pathlib import Path
from unittest.mock import patch

from llama_manager.core.config import load_config
from llama_manager.core.runtime.process_manager import ProcessManager, _AdoptedProcess


class FakeProcess:
    def __init__(self, pid=1234):
        self.pid = pid
        self._returncode = None
        self.terminated = False
        self.killed = False

    def poll(self):
        return self._returncode

    def terminate(self):
        self.terminated = True
        self._returncode = 0

    def wait(self, timeout=None):
        return self._returncode

    def kill(self):
        self.killed = True
        self._returncode = -9


def test_process_manager_start_stop_status_and_log_tail(tmp_path):
    spawned = []

    def fake_popen(command, stdout, stderr, cwd):
        spawned.append((command, stdout, stderr, cwd))
        return FakeProcess()

    config = load_config(
        {
            "mode": "agent",
            "llama_server_bin": "llama-server",
            "log_dir": str(tmp_path / "logs"),
            "models": {
                "qwen": {
                    "path": "/models/qwen.gguf",
                    "port": 8081,
                    "ctx": 4096,
                    "gpu_layers": 99,
                }
            },
        }
    )
    manager = ProcessManager(config, popen=fake_popen)

    with patch.object(manager, "_find_pid_on_port", return_value=None):
        started = manager.start("qwen")

    assert started.running is True
    assert started.pid == 1234
    assert started.port == 8081
    assert spawned[0][0][:3] == ["llama-server", "--model", "/models/qwen.gguf"]

    log_path = Path(started.log_path)
    log_path.write_text("one\ntwo\nthree\n", encoding="utf-8")
    assert manager.tail_logs("qwen", lines=2) == "two\nthree\n"

    stopped = manager.stop("qwen")
    assert stopped.running is False
    assert stopped.pid is None


def test_process_manager_starts_profile_with_effective_config(tmp_path):
    spawned = []
    config = load_config(
        {
            "mode": "agent",
            "llama_server_bin": "llama-server",
            "log_dir": str(tmp_path),
            "models": {
                "gemma": {
                    "path": "/models/gemma.gguf",
                    "port": 8081,
                    "ctx": 8192,
                    "gpu_layers": 10,
                    "profiles": {"long": {"ctx": 131072, "gpu_layers": 20, "port": 8083}},
                }
            },
        }
    )

    def popen(command, **kwargs):
        spawned.append(command)
        return FakeProcess(pid=321)

    manager = ProcessManager(config, popen=popen)
    with patch.object(manager, "_find_pid_on_port", return_value=None):
        status = manager.start("gemma:long")

    assert status.name == "gemma:long"
    assert status.port == 8083
    assert status.ctx == 131072
    assert spawned[0] == [
        "llama-server",
        "--model",
        "/models/gemma.gguf",
        "--host",
        "127.0.0.1",
        "--port",
        "8083",
        "--ctx-size",
        "131072",
        "--n-gpu-layers",
        "20",
    ]


def test_process_manager_profile_status_includes_profile_metadata(tmp_path):
    config = load_config(
        {
            "mode": "agent",
            "log_dir": str(tmp_path),
            "models": {
                "gemma": {
                    "path": "/models/gemma.gguf",
                    "port": 8081,
                    "ctx": 8192,
                    "gpu_layers": 10,
                    "profiles": {
                        "long": {
                            "ctx": 131072,
                            "gpu_layers": 20,
                            "port": 8083,
                            "label": "Long Context",
                            "order": 30,
                            "kind": "long-context",
                            "kv_cache_policy": "cpu-ok",
                            "resource_tier": "high",
                        }
                    },
                }
            },
        }
    )
    manager = ProcessManager(config)

    status = manager.status("gemma:long")

    assert status.name == "gemma:long"
    assert status.port == 8083
    assert status.ctx == 131072
    assert status.gpu_layers == 20
    assert status.family == "gemma"
    assert status.profile == "long"
    assert status.profile_label == "Long Context"
    assert status.profile_order == 30
    assert status.profile_kind == "long-context"
    assert status.kv_cache_policy == "cpu-ok"
    assert status.resource_tier == "high"
    assert Path(status.log_path).name == "__profile__gemma%3Along.log"


def test_process_manager_tracks_active_profile_requests(tmp_path):
    config = load_config(
        {
            "mode": "agent",
            "log_dir": str(tmp_path),
            "models": {"gemma": {"path": "/m.gguf", "port": 8081}},
        }
    )
    manager = ProcessManager(config)

    assert manager.active_count("gemma") == 0
    with manager.track_active("gemma"):
        assert manager.active_count("gemma") == 1
    assert manager.active_count("gemma") == 0


def test_process_manager_track_active_decrements_after_exception(tmp_path):
    config = load_config(
        {
            "mode": "agent",
            "log_dir": str(tmp_path),
            "models": {"gemma": {"path": "/m.gguf", "port": 8081}},
        }
    )
    manager = ProcessManager(config)

    try:
        with manager.track_active("gemma:long"):
            assert manager.active_count("gemma:long") == 1
            raise RuntimeError("boom")
    except RuntimeError:
        pass

    assert manager.active_count("gemma:long") == 0


def test_list_statuses_includes_profile_identities_and_standalone_models(tmp_path):
    config = load_config(
        {
            "mode": "agent",
            "log_dir": str(tmp_path),
            "models": {
                "gemma": {
                    "path": "/models/gemma.gguf",
                    "port": 8081,
                    "ctx": 8192,
                    "gpu_layers": 10,
                    "profiles": {
                        "fast": {"ctx": 8192, "port": 8082, "order": 10},
                        "long": {"ctx": 131072, "port": 8083, "order": 30},
                    },
                },
                "qwen": {
                    "path": "/models/qwen.gguf",
                    "port": 8091,
                    "ctx": 4096,
                    "gpu_layers": 99,
                },
            },
        }
    )
    manager = ProcessManager(config)

    statuses = manager.list_statuses()
    names = [status["name"] for status in statuses]

    assert names == ["gemma:fast", "gemma:long", "qwen"]
    assert statuses[0]["family"] == "gemma"
    assert statuses[0]["profile"] == "fast"
    assert statuses[2]["family"] == "qwen"
    assert statuses[2]["profile"] is None


def test_profile_log_path_does_not_collide_with_standalone_model_name(tmp_path):
    config = load_config(
        {
            "mode": "agent",
            "log_dir": str(tmp_path),
            "models": {
                "gemma": {
                    "path": "/models/gemma.gguf",
                    "port": 8081,
                    "profiles": {"long": {"port": 8083}},
                },
                "gemma__long": {
                    "path": "/models/gemma-standalone.gguf",
                    "port": 8091,
                },
            },
        }
    )
    manager = ProcessManager(config)

    assert Path(manager.log_path("gemma:long")).name == "__profile__gemma%3Along.log"
    assert Path(manager.log_path("gemma__long")).name == "gemma__long.log"


def test_set_favorite_on_profile_updates_family_favorite(tmp_path):
    config = load_config(
        {
            "mode": "agent",
            "log_dir": str(tmp_path),
            "models": {
                "gemma": {
                    "path": "/models/gemma.gguf",
                    "port": 8081,
                    "profiles": {"long": {"port": 8083}},
                },
            },
        }
    )
    manager = ProcessManager(config)

    status = manager.set_favorite("gemma:long", True)

    assert config.models["gemma"].favorite is True
    assert status.favorite is True


def test_set_favorite_rejects_unknown_profile_before_mutating_family(tmp_path):
    config = load_config(
        {
            "mode": "agent",
            "log_dir": str(tmp_path),
            "models": {
                "gemma": {
                    "path": "/models/gemma.gguf",
                    "port": 8081,
                    "profiles": {"long": {"port": 8083}},
                },
            },
        }
    )
    manager = ProcessManager(config)

    try:
        manager.set_favorite("gemma:missing", True)
    except KeyError as exc:
        assert "gemma:missing" in str(exc)
    else:
        raise AssertionError("expected KeyError")

    assert config.models["gemma"].favorite is False


def test_start_profile_adopts_existing_process_on_effective_port(tmp_path):
    import os

    config = load_config(
        {
            "mode": "agent",
            "log_dir": str(tmp_path),
            "models": {
                "gemma": {
                    "path": "/models/gemma.gguf",
                    "port": 8081,
                    "profiles": {"long": {"port": 8083}},
                }
            },
        }
    )
    manager = ProcessManager(config, popen=lambda *a, **kw: (_ for _ in ()).throw(AssertionError("should not spawn")))

    with patch.object(manager, "_find_pid_on_port", return_value=os.getpid()) as find_pid:
        result = manager.start("gemma:long")

    find_pid.assert_called_once_with(8083)
    assert result.running is True
    assert result.pid == os.getpid()


def test_process_manager_rejects_unknown_model(tmp_path):
    manager = ProcessManager(load_config({"mode": "agent", "log_dir": str(tmp_path)}))

    try:
        manager.start("missing")
    except KeyError as exc:
        assert "missing" in str(exc)
    else:
        raise AssertionError("expected KeyError")


def _agent_config(tmp_path):
    return load_config(
        {
            "mode": "agent",
            "llama_server_bin": "llama-server",
            "log_dir": str(tmp_path / "logs"),
            "models": {
                "qwen": {
                    "path": "/models/qwen.gguf",
                    "port": 8081,
                    "ctx": 4096,
                    "gpu_layers": 99,
                }
            },
        }
    )


def test_start_adopts_existing_process_on_port(tmp_path):
    """When a model server survives a manager restart, start() should adopt it."""
    import os

    config = _agent_config(tmp_path)
    manager = ProcessManager(config, popen=lambda *a, **kw: (_ for _ in ()).throw(AssertionError("should not spawn")))

    live_pid = os.getpid()
    with patch.object(manager, "_find_pid_on_port", return_value=live_pid):
        result = manager.start("qwen")

    assert result.running is True
    assert result.pid == live_pid
    # The adopted process should be tracked so a second start() is a no-op
    with patch.object(manager, "_find_pid_on_port", return_value=live_pid):
        result2 = manager.start("qwen")
    assert result2.pid == live_pid


def test_start_spawns_when_port_free(tmp_path):
    """When no existing process is on the port, start() spawns normally."""
    config = _agent_config(tmp_path)
    spawned = []

    def fake_popen(command, stdout, stderr, cwd):
        spawned.append(command)
        return FakeProcess(pid=5555)

    manager = ProcessManager(config, popen=fake_popen)

    with patch.object(manager, "_find_pid_on_port", return_value=None):
        result = manager.start("qwen")

    assert result.running is True
    assert result.pid == 5555
    assert len(spawned) == 1


def test_adopted_process_stop(tmp_path):
    """stop() on an adopted process terminates it cleanly."""
    config = _agent_config(tmp_path)
    manager = ProcessManager(config)

    adopted = _AdoptedProcess(pid=12345)
    terminated = []
    adopted.terminate = lambda: terminated.append(True)  # type: ignore[method-assign]
    # Make poll() return "dead" immediately after terminate is called
    adopted.wait = lambda timeout=None: 0  # type: ignore[method-assign]
    adopted.poll = lambda: (None if not terminated else 0)  # type: ignore[method-assign]

    manager._processes["qwen"] = adopted  # type: ignore[assignment]

    stopped = manager.stop("qwen")
    assert stopped.running is False
    assert terminated == [True]


def test_adopted_process_poll_dead():
    proc = _AdoptedProcess(pid=999999999)  # no such PID
    assert proc.poll() == -1


def test_adopted_process_poll_alive():
    import os
    proc = _AdoptedProcess(pid=os.getpid())
    assert proc.poll() is None
