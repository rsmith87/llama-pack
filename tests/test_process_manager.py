from pathlib import Path
from unittest.mock import patch

from llama_pack.core.config import load_config
from llama_pack.core.model_assets.catalog_service import ModelCatalogService
from llama_pack.core.persistence.model_asset_store_orm import ModelAssetStoreOrm
from llama_pack.core.runtime.process_manager import ProcessManager, _AdoptedProcess
from tests.persistence_db_setup import prepare_models_db


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


def _catalog_config(tmp_path):
    db_path = tmp_path / "models.db"
    prepare_models_db(db_path)
    config = load_config(
        {
            "mode": "agent",
            "llama_server_bin": "llama-server",
            "log_dir": str(tmp_path / "logs"),
            "models_db_url": f"sqlite+pysqlite:///{db_path}",
        }
    )
    store = ModelAssetStoreOrm(db_path=db_path)
    catalog = ModelCatalogService(store)
    return config, store, catalog


def _register_model(
    store: ModelAssetStoreOrm,
    *,
    model_name: str,
    path: str,
    port: int,
    ctx: int = 4096,
    gpu_layers: int = 0,
    host: str = "127.0.0.1",
    favorite: bool = False,
    vision: bool = False,
    mmproj_path: str | None = None,
    supports_mtp: bool = False,
    mtp_path: str | None = None,
    prompt_template: str | None = None,
    profiles: list[dict[str, object]] | None = None,
) -> dict[str, object]:
    asset = store.upsert_asset(
        canonical_path=path,
        filename=Path(path).name,
        display_name=model_name,
        size_bytes=10,
        asset_kind="gguf",
        source_type="manual",
    )
    mmproj_asset_id = None
    if mmproj_path is not None:
        mmproj_asset_id = store.upsert_asset(
            canonical_path=mmproj_path,
            filename=Path(mmproj_path).name,
            display_name=f"{model_name}-mmproj",
            size_bytes=4,
            asset_kind="mmproj",
            source_type="download",
        )["asset_id"]
    mtp_asset_id = None
    if mtp_path is not None:
        mtp_asset_id = store.upsert_asset(
            canonical_path=mtp_path,
            filename=Path(mtp_path).name,
            display_name=f"{model_name}-mtp",
            size_bytes=6,
            asset_kind="gguf",
            source_type="download",
        )["asset_id"]

    row = store.upsert_model(
        model_name=model_name,
        asset_id=asset["asset_id"],
        config_source="db",
        ctx=ctx,
        gpu_layers=gpu_layers,
        vision=vision,
        favorite=favorite,
        supports_mtp=supports_mtp,
        mmproj_asset_id=mmproj_asset_id,
        mtp_draft_asset_id=mtp_asset_id,
        prompt_template=prompt_template,
    )
    store.upsert_model_deployment(
        model_id=str(row["model_id"]),
        deployment_name="default",
        node_name=None,
        host=host,
        port=port,
    )
    for profile in profiles or []:
        store.upsert_model_profile(
            model_id=str(row["model_id"]),
            profile_key=str(profile["profile_key"]),
            label=profile.get("label"),
            order=int(profile.get("order", 100)),
            kind=profile.get("kind"),
            ctx=profile.get("ctx"),
            gpu_layers=profile.get("gpu_layers"),
            host=profile.get("host"),
            extra_args=profile.get("extra_args"),
            intended_ctx=profile.get("intended_ctx"),
            kv_cache_policy=profile.get("kv_cache_policy"),
            resource_tier=profile.get("resource_tier"),
            strengths=profile.get("strengths"),
            cost_tier=profile.get("cost_tier"),
        )
        if profile.get("port") is not None:
            store.upsert_model_deployment(
                model_id=str(row["model_id"]),
                deployment_name=f"profile:{profile['profile_key']}",
                node_name=None,
                host=str(profile.get("host") or host),
                port=int(profile["port"]),
                profile_key=str(profile["profile_key"]),
            )
    return row


def test_process_manager_start_stop_status_and_log_tail(tmp_path):
    spawned = []

    def fake_popen(command, stdout, stderr, cwd):
        spawned.append((command, stdout, stderr, cwd))
        return FakeProcess()

    config, store, catalog = _catalog_config(tmp_path)
    _register_model(store, model_name="qwen", path="/models/qwen.gguf", port=8081, ctx=4096, gpu_layers=99)
    manager = ProcessManager(config, catalog_service=catalog, popen=fake_popen)

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


def test_process_manager_ready_uses_current_start_log_marker(tmp_path):
    config, store, catalog = _catalog_config(tmp_path)
    _register_model(store, model_name="qwen", path="/models/qwen.gguf", port=8081)
    manager = ProcessManager(config, catalog_service=catalog, popen=lambda *args, **kwargs: FakeProcess())
    log_path = config.log_dir / "qwen.log"
    log_path.parent.mkdir(parents=True, exist_ok=True)
    log_path.write_text("old update_slots: all slots are idle\n", encoding="utf-8")

    with patch.object(manager, "_find_pid_on_port", return_value=None):
        started = manager.start("qwen")

    assert started.running is True
    assert started.ready is False

    with log_path.open("a", encoding="utf-8") as handle:
        handle.write("1.07.812.291 I srv  update_slots: all slots are idle\n")

    assert manager.status("qwen").ready is True


def test_process_manager_starts_profile_with_effective_config(tmp_path):
    spawned = []
    config, store, catalog = _catalog_config(tmp_path)
    _register_model(
        store,
        model_name="gemma",
        path="/models/gemma.gguf",
        port=8081,
        ctx=8192,
        gpu_layers=10,
        profiles=[{"profile_key": "long", "ctx": 131072, "gpu_layers": 20, "order": 30, "port": 8083}],
    )

    def popen(command, **kwargs):
        spawned.append(command)
        return FakeProcess(pid=321)

    manager = ProcessManager(config, catalog_service=catalog, popen=popen)
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
    config, store, catalog = _catalog_config(tmp_path)
    _register_model(
        store,
        model_name="gemma",
        path="/models/gemma.gguf",
        port=8081,
        ctx=8192,
        gpu_layers=10,
        profiles=[
            {
                "profile_key": "long",
                "ctx": 131072,
                "gpu_layers": 20,
                "label": "Long Context",
                "order": 30,
                "port": 8083,
                "kind": "long-context",
                "kv_cache_policy": "cpu-ok",
                "resource_tier": "high",
            }
        ],
    )
    manager = ProcessManager(config, catalog_service=catalog)

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
    config, store, catalog = _catalog_config(tmp_path)
    _register_model(store, model_name="gemma", path="/m.gguf", port=8081)
    manager = ProcessManager(config, catalog_service=catalog)

    assert manager.active_count("gemma") == 0
    with manager.track_active("gemma"):
        assert manager.active_count("gemma") == 1
    assert manager.active_count("gemma") == 0


def test_process_manager_track_active_decrements_after_exception(tmp_path):
    config, store, catalog = _catalog_config(tmp_path)
    _register_model(store, model_name="gemma", path="/m.gguf", port=8081)
    manager = ProcessManager(config, catalog_service=catalog)

    try:
        with manager.track_active("gemma:long"):
            assert manager.active_count("gemma:long") == 1
            raise RuntimeError("boom")
    except RuntimeError:
        pass

    assert manager.active_count("gemma:long") == 0


def test_list_statuses_includes_profile_identities_and_standalone_models(tmp_path):
    config, store, catalog = _catalog_config(tmp_path)
    _register_model(
        store,
        model_name="gemma",
        path="/models/gemma.gguf",
        port=8081,
        ctx=8192,
        gpu_layers=10,
        profiles=[
            {"profile_key": "fast", "ctx": 8192, "order": 10},
            {"profile_key": "long", "ctx": 131072, "order": 30, "port": 8083},
        ],
    )
    _register_model(store, model_name="qwen", path="/models/qwen.gguf", port=8091, ctx=4096, gpu_layers=99)
    manager = ProcessManager(config, catalog_service=catalog)

    statuses = manager.list_statuses()
    names = [status["name"] for status in statuses]

    assert names == ["gemma:fast", "gemma:long", "qwen"]
    assert statuses[0]["family"] == "gemma"
    assert statuses[0]["profile"] == "fast"
    assert statuses[2]["family"] == "qwen"
    assert statuses[2]["profile"] is None


def test_list_statuses_include_catalog_profiles_and_deployments(tmp_path):
    config, store, catalog = _catalog_config(tmp_path)
    row = _register_model(
        store,
        model_name="qwen",
        path="/models/qwen.gguf",
        port=8091,
        ctx=4096,
        gpu_layers=99,
        favorite=True,
        vision=True,
        mmproj_path="/models/mmproj.gguf",
        profiles=[
            {
                "profile_key": "fast",
                "label": "Fast",
                "order": 10,
                "kind": "interactive",
                "ctx": 8192,
                "strengths": ["coding"],
                "cost_tier": "low",
                "port": 8093,
            }
        ],
    )
    store.upsert_model(
        model_name="qwen",
        asset_id=row["asset_id"],
        config_source="db",
        ctx=4096,
        gpu_layers=99,
        favorite=True,
        vision=True,
        mmproj_asset_id=row["mmproj_asset_id"],
        strengths=["vision", "coding"],
        cost_tier="medium",
    )
    manager = ProcessManager(config, catalog_service=catalog)

    [status] = [item for item in manager.list_statuses() if item["name"] == "qwen:fast"]

    assert status["strengths"] == ["coding"]
    assert status["cost_tier"] == "low"
    assert status["model_catalog"]["model_name"] == "qwen"
    assert status["model_profiles"][0]["profile_key"] == "fast"
    assert status["model_deployments"][0]["deployment_name"] == "default"


def test_profile_log_path_does_not_collide_with_standalone_model_name(tmp_path):
    config, store, catalog = _catalog_config(tmp_path)
    _register_model(
        store,
        model_name="gemma",
        path="/models/gemma.gguf",
        port=8081,
        profiles=[{"profile_key": "long", "order": 30}],
    )
    _register_model(store, model_name="gemma__long", path="/models/gemma-standalone.gguf", port=8091)
    manager = ProcessManager(config, catalog_service=catalog)

    assert Path(manager.log_path("gemma:long")).name == "__profile__gemma%3Along.log"
    assert Path(manager.log_path("gemma__long")).name == "gemma__long.log"


def test_set_favorite_on_profile_updates_family_favorite(tmp_path):
    config, store, catalog = _catalog_config(tmp_path)
    row = _register_model(
        store,
        model_name="gemma",
        path="/models/gemma.gguf",
        port=8081,
        profiles=[{"profile_key": "long", "order": 30}],
    )
    manager = ProcessManager(config, catalog_service=catalog)

    status = manager.set_favorite("gemma:long", True)

    assert store.get_model(str(row["model_id"]))["favorite"] is True
    assert status.favorite is True


def test_set_favorite_rejects_unknown_profile_before_mutating_family(tmp_path):
    config, store, catalog = _catalog_config(tmp_path)
    row = _register_model(
        store,
        model_name="gemma",
        path="/models/gemma.gguf",
        port=8081,
        profiles=[{"profile_key": "long", "order": 30}],
    )
    manager = ProcessManager(config, catalog_service=catalog)

    try:
        manager.set_favorite("gemma:missing", True)
    except KeyError as exc:
        assert "gemma:missing" in str(exc)
    else:
        raise AssertionError("expected KeyError")

    assert store.get_model(str(row["model_id"]))["favorite"] is False


def test_start_profile_adopts_existing_process_on_effective_port(tmp_path):
    import os

    config, store, catalog = _catalog_config(tmp_path)
    _register_model(
        store,
        model_name="gemma",
        path="/models/gemma.gguf",
        port=8081,
        profiles=[{"profile_key": "long", "ctx": 131072, "order": 30, "port": 8083}],
    )
    manager = ProcessManager(config, catalog_service=catalog, popen=lambda *a, **kw: (_ for _ in ()).throw(AssertionError("should not spawn")))

    with patch.object(manager, "_find_pid_on_port", return_value=os.getpid()) as find_pid:
        result = manager.start("gemma:long")

    find_pid.assert_called_once_with(8083)
    assert result.running is True
    assert result.pid == os.getpid()


def test_process_manager_rejects_unknown_model(tmp_path):
    config, _store, catalog = _catalog_config(tmp_path)
    manager = ProcessManager(config, catalog_service=catalog)

    try:
        manager.start("missing")
    except KeyError as exc:
        assert "missing" in str(exc)
    else:
        raise AssertionError("expected KeyError")


def _agent_config(tmp_path):
    config, store, catalog = _catalog_config(tmp_path)
    _register_model(store, model_name="qwen", path="/models/qwen.gguf", port=8081, ctx=4096, gpu_layers=99)
    return config, catalog


def test_start_adopts_existing_process_on_port(tmp_path):
    """When a model server survives a manager restart, start() should adopt it."""
    import os

    config, catalog = _agent_config(tmp_path)
    manager = ProcessManager(config, catalog_service=catalog, popen=lambda *a, **kw: (_ for _ in ()).throw(AssertionError("should not spawn")))

    live_pid = os.getpid()
    with patch.object(manager, "_find_pid_on_port", return_value=live_pid):
        result = manager.start("qwen")

    assert result.running is True
    assert result.pid == live_pid
    assert result.process_state == "adopted"
    # The adopted process should be tracked so a second start() is a no-op
    with patch.object(manager, "_find_pid_on_port", return_value=live_pid):
        result2 = manager.start("qwen")
    assert result2.pid == live_pid


def test_status_adopts_existing_process_on_port(tmp_path):
    """Status should report a model server that survived a manager restart."""
    import os

    config, catalog = _agent_config(tmp_path)
    manager = ProcessManager(config, catalog_service=catalog)

    live_pid = os.getpid()
    with patch.object(manager, "_find_pid_on_port", return_value=live_pid) as find_pid:
        result = manager.status("qwen")

    find_pid.assert_called_once_with(8081)
    assert result.running is True
    assert result.pid == live_pid
    assert result.process_state == "adopted"


def test_list_statuses_adopts_existing_process_on_port(tmp_path):
    import os

    config, catalog = _agent_config(tmp_path)
    manager = ProcessManager(config, catalog_service=catalog)

    live_pid = os.getpid()
    with patch.object(manager, "_find_pid_on_port", return_value=live_pid):
        [result] = manager.list_statuses()

    assert result["running"] is True
    assert result["pid"] == live_pid
    assert result["process_state"] == "adopted"


def test_status_reports_stale_process_when_tracked_process_is_dead(tmp_path):
    config, catalog = _agent_config(tmp_path)
    manager = ProcessManager(config, catalog_service=catalog)
    process = FakeProcess(pid=2468)
    process._returncode = -9
    manager._processes["qwen"] = process

    with patch.object(manager, "_find_pid_on_port", return_value=None):
        result = manager.status("qwen")

    assert result.running is False
    assert result.pid == 2468
    assert result.process_state == "stale"


def test_status_profile_adopts_existing_process_on_effective_port(tmp_path):
    import os

    config, store, catalog = _catalog_config(tmp_path)
    _register_model(
        store,
        model_name="gemma",
        path="/models/gemma.gguf",
        port=8081,
        profiles=[{"profile_key": "long", "ctx": 131072, "order": 30, "port": 8083}],
    )
    manager = ProcessManager(config, catalog_service=catalog)

    live_pid = os.getpid()
    with patch.object(manager, "_find_pid_on_port", return_value=live_pid) as find_pid:
        result = manager.status("gemma:long")

    find_pid.assert_called_once_with(8083)
    assert result.running is True
    assert result.pid == live_pid


def test_start_spawns_when_port_free(tmp_path):
    """When no existing process is on the port, start() spawns normally."""
    config, catalog = _agent_config(tmp_path)
    spawned = []

    def fake_popen(command, stdout, stderr, cwd):
        spawned.append(command)
        return FakeProcess(pid=5555)

    manager = ProcessManager(config, catalog_service=catalog, popen=fake_popen)

    with patch.object(manager, "_find_pid_on_port", return_value=None):
        result = manager.start("qwen")

    assert result.running is True
    assert result.pid == 5555
    assert len(spawned) == 1


def test_adopted_process_stop(tmp_path):
    """stop() on an adopted process terminates it cleanly."""
    config, catalog = _agent_config(tmp_path)
    manager = ProcessManager(config, catalog_service=catalog)

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


def test_adopted_process_poll_treats_zombie_as_stopped():
    class Result:
        returncode = 0
        stdout = "Z+\n"

    proc = _AdoptedProcess(pid=12345)
    with patch("llama_pack.core.runtime.process_manager.os.kill", return_value=None), patch(
        "llama_pack.core.runtime.process_manager.subprocess.run",
        return_value=Result(),
    ):
        assert proc.poll() == -1


def test_process_manager_status_includes_mmproj_and_mtp_from_db(tmp_path):
    config, store, catalog = _catalog_config(tmp_path)
    _register_model(
        store,
        model_name="vlm",
        path="/models/vlm.gguf",
        port=9001,
        vision=True,
        mmproj_path="/models/vlm-mmproj.gguf",
        supports_mtp=True,
        mtp_path="/models/vlm-draft.gguf",
    )
    manager = ProcessManager(config, catalog_service=catalog)

    status = manager.status("vlm")
    runtime = manager._get_model("vlm")

    assert status.vision is True
    assert status.mmproj == "/models/vlm-mmproj.gguf"
    assert runtime.speculative is not None
    assert runtime.speculative.draft_model_path == "/models/vlm-draft.gguf"
