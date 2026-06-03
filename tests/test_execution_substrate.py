import asyncio
import json

import pytest

from llama_manager.core.nodes.worker import AgentWorker
from llama_manager.core.config import load_config
from llama_manager.core.orchestration.job_contracts import validate_job_payload
from llama_manager.main import create_app
from tests.helpers import authenticated_client as TestClient
from tests.persistence_db_setup import prepare_all_persistence_dbs

WORKER_HEADERS = {"X-Llama-Manager-Key": "node-secret"}


def worker_nodes(*names):
    return {
        name: {"url": f"http://{name}.example:9000", "api_key": "node-secret"}
        for name in names
    }


def _create_controller_app(tmp_path, nodes):
    log_dir = tmp_path / "logs"
    prepare_all_persistence_dbs(log_dir)
    return create_app(config=load_config({"mode": "controller", "log_dir": str(log_dir), "nodes": nodes}))


def test_llm_generate_job_validates_required_payload(tmp_path):
    app = _create_controller_app(tmp_path, {})
    client = TestClient(app)

    missing_model = client.post(
        "/lm-api/v1/jobs",
        json={"type": "llm.generate", "payload": {"messages": [{"role": "user", "content": "hi"}]}},
    )
    assert missing_model.status_code == 422

    valid = client.post(
        "/lm-api/v1/jobs",
        json={
            "type": "llm.generate",
            "payload": {
                "model": "qwen",
                "messages": [{"role": "user", "content": "hi"}],
                "temperature": 0.2,
            },
        },
    )
    assert valid.status_code == 201
    assert valid.json()["type"] == "llm.generate"


def test_llm_embed_job_validates_required_payload(tmp_path):
    app = _create_controller_app(tmp_path, {})
    client = TestClient(app)

    missing_model = client.post(
        "/lm-api/v1/jobs",
        json={"type": "llm.embed", "payload": {"input": "hello"}},
    )
    assert missing_model.status_code == 422

    valid = client.post(
        "/lm-api/v1/jobs",
        json={
            "type": "llm.embed",
            "payload": {
                "model": "nomic-embed",
                "input": ["hello", "world"],
                "target": "auto",
            },
        },
    )
    assert valid.status_code == 201
    assert valid.json()["type"] == "llm.embed"


def test_validate_model_transfer_payload_accepts_selected_with_sidecars():
    payload = validate_job_payload(
        "model.transfer",
        {
            "source_node": "mac-mini",
            "destination_node": "linux-2080ti",
            "source_file_id": "abc123",
            "include": "selected_with_sidecars",
        },
    )

    assert payload["source_node"] == "mac-mini"
    assert payload["destination_node"] == "linux-2080ti"
    assert payload["source_file_id"] == "abc123"
    assert payload["include"] == "selected_with_sidecars"


def test_validate_model_transfer_payload_rejects_same_node():
    with pytest.raises(ValueError, match="source_node and destination_node must differ"):
        validate_job_payload(
            "model.transfer",
            {
                "source_node": "mac-mini",
                "destination_node": "mac-mini",
                "source_file_id": "abc123",
                "include": "selected_with_sidecars",
            },
        )


def test_model_download_job_validates_required_payload(tmp_path):
    app = _create_controller_app(tmp_path, {})
    client = TestClient(app)

    missing_repo = client.post(
        "/lm-api/v1/jobs",
        json={"type": "model.download", "payload": {"include_file": "model.gguf"}},
    )
    assert missing_repo.status_code == 422

    invalid_include = client.post(
        "/lm-api/v1/jobs",
        json={"type": "model.download", "payload": {"repo_id": "owner/model", "include_file": "../model.gguf"}},
    )
    assert invalid_include.status_code == 422

    valid = client.post(
        "/lm-api/v1/jobs",
        json={
            "type": "model.download",
            "target": "node:agent-a",
            "payload": {
                "repo_id": "owner/model-GGUF",
                "revision": "main",
                "include_file": "model-Q4_K_M.gguf",
                "mmproj_file": "mmproj-F16.gguf",
            },
        },
    )
    assert valid.status_code == 201
    assert valid.json()["type"] == "model.download"
    assert valid.json()["payload"]["repo_id"] == "owner/model-GGUF"


def test_cancel_running_job_records_cancel_requested(tmp_path):
    app = _create_controller_app(tmp_path, worker_nodes("win"))
    client = TestClient(app)

    job = client.post("/lm-api/v1/jobs", json={"type": "task", "payload": {"x": 1}}).json()
    claim = client.post("/lm-api/v1/nodes/win/work/claim", json={"max_jobs": 1}, headers=WORKER_HEADERS).json()
    client.post(
        f"/lm-api/v1/nodes/win/work/{claim[0]['attempt_id']}/progress",
        json={"progress": {"stage": "start"}},
        headers=WORKER_HEADERS,
    )

    canceled = client.post(f"/lm-api/v1/jobs/{job['id']}/cancel")
    assert canceled.status_code == 200
    assert canceled.json()["status"] == "cancel_requested"
    assert canceled.json()["cancellation_requested"] is True

    events = client.get(f"/lm-api/v1/jobs/{job['id']}/events").json()
    assert any(event["event_type"] == "cancel_requested" for event in events)


def test_job_events_stream_replays_events_and_closes_on_terminal_state(tmp_path):
    app = _create_controller_app(tmp_path, worker_nodes("win"))
    client = TestClient(app)

    job = client.post("/lm-api/v1/jobs", json={"type": "task", "payload": {"x": 1}}).json()
    claim = client.post("/lm-api/v1/nodes/win/work/claim", json={"max_jobs": 1}, headers=WORKER_HEADERS).json()
    client.post(
        f"/lm-api/v1/nodes/win/work/{claim[0]['attempt_id']}/complete",
        json={"result": {"ok": True}},
        headers=WORKER_HEADERS,
    )

    with client.stream("GET", f"/lm-api/v1/jobs/{job['id']}/events/stream") as response:
        body = response.read().decode("utf-8")

    assert response.status_code == 200
    assert "event: job_created" in body
    assert "event: job_completed" in body


@pytest.mark.asyncio
async def test_agent_worker_completes_llm_generate_job():
    calls = []

    async def request(method, url, payload=None, headers=None):
        calls.append((method, url, payload))
        if url.endswith("/nodes/agent-a/work/claim"):
            return [
                {
                    "attempt_id": "attempt-1",
                    "job": {
                        "id": "job-1",
                        "type": "llm.generate",
                        "status": "assigned",
                        "target_selector": "auto",
                        "payload": {
                            "model": "qwen",
                            "messages": [{"role": "user", "content": "hi"}],
                            "target": "local",
                        },
                    },
                }
            ]
        if url.endswith("/nodes/agent-a/work/jobs/job-1/cancellation"):
            return {"id": "job-1", "status": "assigned", "cancellation_requested": False}
        if url.endswith("/nodes/agent-a/work/attempt-1/progress"):
            return {"ok": True}
        if url.endswith("/nodes/agent-a/work/attempt-1/complete"):
            return {"id": "job-1", "status": "completed"}
        raise AssertionError(f"unexpected request: {method} {url}")

    async def chat(model, payload):
        assert model == "qwen"
        assert payload["messages"][0]["content"] == "hi"
        return {"choices": [{"message": {"content": "hello"}}]}, {"route": "local"}

    worker = AgentWorker(
        config=load_config(
            {
                "mode": "agent",
                "controller_url": "http://controller",
                "node_name": "agent-a",
                "agent_worker_enabled": True,
            }
        ),
        request=request,
        chat=chat,
    )

    processed = await worker.run_once()

    assert processed == 1
    assert calls[0][1] == "http://controller/lm-api/v1/nodes/agent-a/work/claim"
    complete_payload = [call[2] for call in calls if call[1].endswith("/complete")][0]
    assert complete_payload["result"]["response"]["choices"][0]["message"]["content"] == "hello"
    assert complete_payload["result"]["worker_node"] == "agent-a"


@pytest.mark.asyncio
async def test_agent_worker_does_not_duplicate_api_prefix():
    calls = []

    async def request(method, url, payload=None, headers=None):
        calls.append((method, url, payload))
        return []

    worker = AgentWorker(
        config=load_config(
            {
                "mode": "agent",
                "controller_url": "http://controller/lm-api/v1",
                "node_name": "agent-a",
                "agent_worker_enabled": True,
            }
        ),
        request=request,
    )

    processed = await worker.run_once()

    assert processed == 0
    assert calls[0][1] == "http://controller/lm-api/v1/nodes/agent-a/work/claim"


@pytest.mark.asyncio
async def test_agent_worker_authenticates_work_requests_with_agent_api_key():
    calls = []

    async def request(method, url, payload=None, headers=None):
        calls.append((method, url, payload, headers))
        return []

    worker = AgentWorker(
        config=load_config(
            {
                "mode": "agent",
                "controller_url": "http://controller",
                "node_name": "agent-a",
                "agent_api_key": "agent-key",
                "controller_registration_key_outbound": "registration-key",
                "agent_worker_enabled": True,
            }
        ),
        request=request,
    )

    processed = await worker.run_once()

    assert processed == 0
    assert calls[0][1] == "http://controller/lm-api/v1/nodes/agent-a/work/claim"
    assert calls[0][3] == {"X-Llama-Manager-Key": "agent-key"}


@pytest.mark.asyncio
async def test_agent_worker_fails_unsupported_job_type_non_retryable():
    calls = []

    async def request(method, url, payload=None, headers=None):
        calls.append((method, url, payload))
        if url.endswith("/nodes/agent-a/work/claim"):
            return [{"attempt_id": "attempt-1", "job": {"id": "job-1", "type": "other", "payload": {}}}]
        if url.endswith("/nodes/agent-a/work/attempt-1/fail"):
            return {"id": "job-1", "status": "failed"}
        raise AssertionError(f"unexpected request: {method} {url}")

    worker = AgentWorker(
        config=load_config(
            {
                "mode": "agent",
                "controller_url": "http://controller",
                "node_name": "agent-a",
                "agent_worker_enabled": True,
            }
        ),
        request=request,
        chat=None,
    )

    assert await worker.run_once() == 1
    fail_payload = [call[2] for call in calls if call[1].endswith("/fail")][0]
    assert fail_payload["error_code"] == "UNSUPPORTED_JOB_TYPE"
    assert fail_payload["retryable"] is False


@pytest.mark.asyncio
async def test_agent_worker_completes_llm_embed_job():
    calls = []

    async def request(method, url, payload=None, headers=None):
        calls.append((method, url, payload))
        if url.endswith("/nodes/agent-a/work/claim"):
            return [
                {
                    "attempt_id": "attempt-1",
                    "job": {
                        "id": "job-2",
                        "type": "llm.embed",
                        "status": "assigned",
                        "target_selector": "auto",
                        "payload": {
                            "model": "nomic-embed",
                            "input": ["alpha", "beta"],
                            "target": "auto",
                        },
                    },
                }
            ]
        if url.endswith("/nodes/agent-a/work/jobs/job-2/cancellation"):
            return {"id": "job-2", "status": "assigned", "cancellation_requested": False}
        if url.endswith("/nodes/agent-a/work/attempt-1/progress"):
            return {"ok": True}
        if url.endswith("/nodes/agent-a/work/attempt-1/complete"):
            return {"id": "job-2", "status": "completed"}
        raise AssertionError(f"unexpected request: {method} {url}")

    async def embeddings(model, inputs, target):
        assert model == "nomic-embed"
        assert inputs == ["alpha", "beta"]
        assert target == "local"
        return {"data": [{"embedding": [0.1, 0.2]}]}, {"route": "local"}

    worker = AgentWorker(
        config=load_config(
            {
                "mode": "agent",
                "controller_url": "http://controller",
                "node_name": "agent-a",
                "agent_worker_enabled": True,
            }
        ),
        request=request,
        chat=None,
        embeddings=embeddings,
    )

    processed = await worker.run_once()

    assert processed == 1
    complete_payload = [call[2] for call in calls if call[1].endswith("/complete")][0]
    assert complete_payload["result"]["response"]["data"][0]["embedding"] == [0.1, 0.2]
    assert complete_payload["result"]["worker_node"] == "agent-a"
    assert complete_payload["result"]["target"] == "auto"


class FakeDownloadManager:
    def __init__(self, statuses):
        self.statuses = list(statuses)
        self.started = []
        self.cancelled = []

    def start(self, repo_id, **kwargs):
        self.started.append((repo_id, kwargs))
        return self.statuses.pop(0)

    def status(self, download_id):
        return self.statuses.pop(0)

    def cancel(self, download_id):
        self.cancelled.append(download_id)
        return {
            "id": download_id,
            "repo_id": "owner/model-GGUF",
            "status": "cancelled",
            "local_path": "/models/owner__model-GGUF",
            "bytes_downloaded": 128,
            "bytes_total": 1024,
            "progress_percent": 12,
        }


class FakeGgufLibrary:
    def __init__(self, files):
        self.files = list(files)
        self.added = []

    def list_files(self, *args, **kwargs):
        return self.files

    def add_model(self, **kwargs):
        self.added.append(kwargs)
        return {"name": kwargs["name"], "path": next(file["path"] for file in self.files if file["id"] == kwargs["file_id"])}


class FakeProcessManager:
    def __init__(self):
        self.started = []

    def start(self, name):
        self.started.append(name)
        return {"name": name, "running": True, "pid": 1234}


@pytest.mark.asyncio
async def test_agent_worker_completes_model_download_job():
    calls = []
    manager = FakeDownloadManager(
        [
            {
                "id": "download-1",
                "repo_id": "owner/model-GGUF",
                "status": "running",
                "local_path": "/models/owner__model-GGUF",
                "bytes_downloaded": 128,
                "bytes_total": 1024,
                "progress_percent": 12,
            },
            {
                "id": "download-1",
                "repo_id": "owner/model-GGUF",
                "status": "succeeded",
                "local_path": "/models/owner__model-GGUF",
                "bytes_downloaded": 1024,
                "bytes_total": 1024,
                "progress_percent": 100,
            },
        ]
    )

    async def request(method, url, payload=None, headers=None):
        calls.append((method, url, payload))
        if url.endswith("/nodes/agent-a/work/claim"):
            return [
                {
                    "attempt_id": "attempt-1",
                    "job": {
                        "id": "job-download-1",
                        "type": "model.download",
                        "status": "assigned",
                        "payload": {
                            "repo_id": "owner/model-GGUF",
                            "revision": "main",
                            "include_file": "model-Q4_K_M.gguf",
                            "mmproj_file": "mmproj-F16.gguf",
                        },
                    },
                }
            ]
        if url.endswith("/nodes/agent-a/work/jobs/job-download-1/cancellation"):
            return {"id": "job-download-1", "cancellation_requested": False}
        if url.endswith("/progress"):
            return {"ok": True}
        if url.endswith("/complete"):
            return {"id": "job-download-1", "status": "completed"}
        raise AssertionError(f"unexpected request: {method} {url}")

    worker = AgentWorker(
        config=load_config(
            {
                "mode": "agent",
                "controller_url": "http://controller",
                "node_name": "agent-a",
                "agent_worker_enabled": True,
            }
        ),
        request=request,
        download_manager=manager,
    )

    processed = await worker.run_once()

    assert processed == 1
    assert manager.started == [
        (
            "owner/model-GGUF",
            {
                "triggered_by": "job:job-download-1",
                "revision": "main",
                "include_file": "model-Q4_K_M.gguf",
                "mmproj_file": "mmproj-F16.gguf",
            },
        )
    ]
    progress_payloads = [call[2]["progress"] for call in calls if call[1].endswith("/progress")]
    assert progress_payloads[0]["stage"] == "started"
    assert progress_payloads[-1]["progress_percent"] == 100
    complete_payload = next(call[2] for call in calls if call[1].endswith("/complete"))
    assert complete_payload["result"]["download_id"] == "download-1"
    assert complete_payload["result"]["status"] == "succeeded"
    assert complete_payload["result"]["worker_node"] == "agent-a"


@pytest.mark.asyncio
async def test_agent_worker_cancels_running_model_download_job():
    calls = []
    manager = FakeDownloadManager(
        [
            {
                "id": "download-2",
                "repo_id": "owner/model-GGUF",
                "status": "running",
                "local_path": "/models/owner__model-GGUF",
                "bytes_downloaded": 128,
                "bytes_total": 1024,
                "progress_percent": 12,
            },
        ]
    )
    cancel_checks = 0

    async def request(method, url, payload=None, headers=None):
        nonlocal cancel_checks
        calls.append((method, url, payload))
        if url.endswith("/nodes/agent-a/work/claim"):
            return [
                {
                    "attempt_id": "attempt-1",
                    "job": {
                        "id": "job-download-2",
                        "type": "model.download",
                        "status": "assigned",
                        "payload": {"repo_id": "owner/model-GGUF"},
                    },
                }
            ]
        if url.endswith("/nodes/agent-a/work/jobs/job-download-2/cancellation"):
            cancel_checks += 1
            return {"id": "job-download-2", "cancellation_requested": cancel_checks > 1}
        if url.endswith("/progress"):
            return {"ok": True}
        if url.endswith("/fail"):
            return {"id": "job-download-2", "status": "canceled"}
        raise AssertionError(f"unexpected request: {method} {url}")

    worker = AgentWorker(
        config=load_config(
            {
                "mode": "agent",
                "controller_url": "http://controller",
                "node_name": "agent-a",
                "agent_worker_enabled": True,
            }
        ),
        request=request,
        download_manager=manager,
    )

    processed = await worker.run_once()

    assert processed == 1
    assert manager.cancelled == ["download-2"]
    fail_payload = next(call[2] for call in calls if call[1].endswith("/fail"))
    assert fail_payload["error_code"] == "CANCELED"
    assert fail_payload["retryable"] is False


def test_model_install_job_validates_required_payload(tmp_path):
    app = _create_controller_app(tmp_path, {})
    client = TestClient(app)

    missing_name = client.post(
        "/lm-api/v1/jobs",
        json={"type": "model.install", "payload": {"repo_id": "owner/model", "include_file": "model.gguf", "port": 8081}},
    )
    assert missing_name.status_code == 422

    valid = client.post(
        "/lm-api/v1/jobs",
        json={
            "type": "model.install",
            "target": "node:agent-a",
            "payload": {
                "repo_id": "owner/model",
                "include_file": "model-Q4.gguf",
                "model_name": "model-q4",
                "port": 8081,
                "ctx": 8192,
                "gpu_layers": 999,
            },
        },
    )
    assert valid.status_code == 201
    assert valid.json()["payload"]["model_name"] == "model-q4"
    assert valid.json()["payload"]["start"] is True


@pytest.mark.asyncio
async def test_agent_worker_installs_downloaded_model_and_starts_it():
    calls = []
    download_manager = FakeDownloadManager(
        [
            {
                "id": "download-install-1",
                "repo_id": "owner/model-GGUF",
                "status": "running",
                "local_path": "/models/owner__model-GGUF",
                "bytes_downloaded": 128,
                "bytes_total": 1024,
                "progress_percent": 12,
            },
            {
                "id": "download-install-1",
                "repo_id": "owner/model-GGUF",
                "status": "succeeded",
                "local_path": "/models/owner__model-GGUF",
                "bytes_downloaded": 1024,
                "bytes_total": 1024,
                "progress_percent": 100,
            },
        ]
    )
    library = FakeGgufLibrary([
        {"id": "file-1", "path": "/models/owner__model-GGUF/model-Q4.gguf", "filename": "model-Q4.gguf"},
        {"id": "mmproj", "path": "/models/owner__model-GGUF/mmproj-F16.gguf", "filename": "mmproj-F16.gguf"},
    ])
    process_manager = FakeProcessManager()

    async def request(method, url, payload=None, headers=None):
        calls.append((method, url, payload))
        if url.endswith("/nodes/agent-a/work/claim"):
            return [
                {
                    "attempt_id": "attempt-1",
                    "job": {
                        "id": "job-install-1",
                        "type": "model.install",
                        "status": "assigned",
                        "payload": {
                            "repo_id": "owner/model-GGUF",
                            "include_file": "model-Q4.gguf",
                            "mmproj_file": "mmproj-F16.gguf",
                            "model_name": "model-q4",
                            "port": 8081,
                            "ctx": 8192,
                            "gpu_layers": 999,
                            "vision": True,
                        },
                    },
                }
            ]
        if url.endswith("/nodes/agent-a/work/jobs/job-install-1/cancellation"):
            return {"id": "job-install-1", "cancellation_requested": False}
        if url.endswith("/progress"):
            return {"ok": True}
        if url.endswith("/complete"):
            return {"id": "job-install-1", "status": "completed"}
        raise AssertionError(f"unexpected request: {method} {url}")

    worker = AgentWorker(
        config=load_config(
            {
                "mode": "agent",
                "controller_url": "http://controller",
                "node_name": "agent-a",
                "agent_worker_enabled": True,
            }
        ),
        request=request,
        download_manager=download_manager,
        gguf_library=library,
        process_manager=process_manager,
    )

    processed = await worker.run_once()

    assert processed == 1
    assert library.added == [
        {
            "file_id": "file-1",
            "name": "model-q4",
            "port": 8081,
            "ctx": 8192,
            "gpu_layers": 999,
            "host": "127.0.0.1",
            "reasoning": None,
            "reasoning_budget": None,
            "prompt_template": None,
            "vision": True,
            "mmproj": "/models/owner__model-GGUF/mmproj-F16.gguf",
        }
    ]
    assert process_manager.started == ["model-q4"]
    progress_stages = [call[2]["progress"]["stage"] for call in calls if call[1].endswith("/progress")]
    assert "verified" in progress_stages
    assert "registered" in progress_stages
    assert "started" in progress_stages
    complete_payload = next(call[2] for call in calls if call[1].endswith("/complete"))
    assert complete_payload["result"]["model"]["name"] == "model-q4"
    assert complete_payload["result"]["start_status"]["running"] is True


def test_agent_worker_config_defaults_disabled():
    config = load_config({"mode": "agent"})

    assert config.agent_worker_enabled is False
    assert config.agent_worker_poll_interval_seconds == 2
    assert config.agent_worker_max_jobs == 1
    assert config.agent_worker_labels == {}
    assert config.agent_worker_capacity == {}


# ---------------------------------------------------------------------------
# Ticket 10.1 — Batch Prompt Suite API
# ---------------------------------------------------------------------------


def test_llm_batch_job_validates_required_payload(tmp_path):
    app = _create_controller_app(tmp_path, {})
    client = TestClient(app)

    missing_model = client.post(
        "/lm-api/v1/jobs",
        json={
            "type": "llm.batch",
            "payload": {"cases": [{"messages": [{"role": "user", "content": "hi"}]}]},
        },
    )
    assert missing_model.status_code == 422

    missing_cases = client.post(
        "/lm-api/v1/jobs",
        json={"type": "llm.batch", "payload": {"model": "qwen"}},
    )
    assert missing_cases.status_code == 422

    empty_cases = client.post(
        "/lm-api/v1/jobs",
        json={"type": "llm.batch", "payload": {"model": "qwen", "cases": []}},
    )
    assert empty_cases.status_code == 422

    valid = client.post(
        "/lm-api/v1/jobs",
        json={
            "type": "llm.batch",
            "payload": {
                "model": "qwen",
                "cases": [{"messages": [{"role": "user", "content": "hello"}]}],
            },
        },
    )
    assert valid.status_code == 201
    assert valid.json()["type"] == "llm.batch"


def test_llm_batch_job_accepts_case_level_overrides(tmp_path):
    app = _create_controller_app(tmp_path, {})
    client = TestClient(app)

    resp = client.post(
        "/lm-api/v1/jobs",
        json={
            "type": "llm.batch",
            "payload": {
                "model": "qwen",
                "target": "auto",
                "temperature": 0.5,
                "max_tokens": 256,
                "cases": [
                    {
                        "id": "my-case",
                        "messages": [{"role": "user", "content": "hello"}],
                        "model": "llama",
                        "target": "node:gpu-box",
                        "temperature": 0.9,
                        "max_tokens": 1024,
                    }
                ],
            },
        },
    )
    assert resp.status_code == 201
    payload = resp.json()["payload"]
    case = payload["cases"][0]
    assert case["id"] == "my-case"
    assert case["model"] == "llama"
    assert case["target"] == "node:gpu-box"
    assert case["temperature"] == 0.9
    assert case["max_tokens"] == 1024


@pytest.mark.asyncio
async def test_agent_worker_completes_llm_batch_job():
    calls = []

    async def request(method, url, payload=None, headers=None):
        calls.append((method, url, payload))
        if url.endswith("/nodes/agent-a/work/claim"):
            return [
                {
                    "attempt_id": "attempt-1",
                    "job": {
                        "id": "job-batch-1",
                        "type": "llm.batch",
                        "status": "assigned",
                        "payload": {
                            "model": "qwen",
                            "target": "auto",
                            "temperature": 0.7,
                            "max_tokens": 512,
                            "cases": [
                                {"messages": [{"role": "user", "content": "case one"}]},
                                {
                                    "id": "my-case",
                                    "messages": [{"role": "user", "content": "case two"}],
                                    "model": "llama",
                                    "target": "node:gpu-box",
                                },
                            ],
                        },
                    },
                }
            ]
        if url.endswith("/nodes/agent-a/work/jobs/job-batch-1/cancellation"):
            return {"id": "job-batch-1", "cancellation_requested": False}
        if url.endswith("/progress"):
            return {"ok": True}
        if url.endswith("/complete"):
            return {"id": "job-batch-1", "status": "completed"}
        raise AssertionError(f"unexpected request: {method} {url}")

    chat_calls: list[tuple[str, dict]] = []

    async def chat(model, payload):
        chat_calls.append((model, payload))
        return {"choices": [{"message": {"content": f"reply from {model}"}}]}, {"route": "local"}

    worker = AgentWorker(
        config=load_config(
            {
                "mode": "agent",
                "controller_url": "http://controller",
                "node_name": "agent-a",
                "agent_worker_enabled": True,
            }
        ),
        request=request,
        chat=chat,
    )

    processed = await worker.run_once()

    assert processed == 1

    complete_call = next(call[2] for call in calls if call[1].endswith("/complete"))
    result = complete_call["result"]
    assert result["cases_total"] == 2
    assert result["cases_completed"] == 2
    assert result["cases_failed"] == 0
    assert result["worker_node"] == "agent-a"

    artifacts = complete_call["artifacts"]
    case_artifacts = [a for a in artifacts if a["kind"] == "llm.batch.case"]
    summary_artifacts = [a for a in artifacts if a["kind"] == "llm.batch.summary"]

    assert len(case_artifacts) == 2
    assert len(summary_artifacts) == 1

    assert case_artifacts[0]["meta"]["case_id"] == "case-1"
    assert case_artifacts[0]["meta"]["model"] == "qwen"
    assert case_artifacts[0]["meta"]["response"]["choices"][0]["message"]["content"] == "reply from qwen"

    assert case_artifacts[1]["meta"]["case_id"] == "my-case"
    assert case_artifacts[1]["meta"]["model"] == "llama"
    assert case_artifacts[1]["meta"]["target"] == "node:gpu-box"

    summary = summary_artifacts[0]["meta"]
    assert summary["cases_total"] == 2
    assert summary["cases_completed"] == 2
    assert summary["cases_failed"] == 0

    assert chat_calls[0][0] == "qwen"
    assert chat_calls[1][0] == "llama"
    assert chat_calls[1][1]["target"] == "node:gpu-box"


@pytest.mark.asyncio
async def test_agent_worker_llm_batch_records_case_error_and_continues():
    calls = []

    async def request(method, url, payload=None, headers=None):
        calls.append((method, url, payload))
        if url.endswith("/nodes/agent-a/work/claim"):
            return [
                {
                    "attempt_id": "attempt-1",
                    "job": {
                        "id": "job-batch-2",
                        "type": "llm.batch",
                        "status": "assigned",
                        "payload": {
                            "model": "qwen",
                            "target": "auto",
                            "temperature": 0.7,
                            "max_tokens": 512,
                            "cases": [
                                {"messages": [{"role": "user", "content": "good case"}]},
                                {"id": "bad-case", "messages": [{"role": "user", "content": "bad case"}]},
                                {"messages": [{"role": "user", "content": "another good case"}]},
                            ],
                        },
                    },
                }
            ]
        if url.endswith("/nodes/agent-a/work/jobs/job-batch-2/cancellation"):
            return {"id": "job-batch-2", "cancellation_requested": False}
        if url.endswith("/progress"):
            return {"ok": True}
        if url.endswith("/complete"):
            return {"id": "job-batch-2", "status": "completed"}
        raise AssertionError(f"unexpected request: {method} {url}")

    call_count = 0

    async def chat(model, payload):
        nonlocal call_count
        call_count += 1
        if call_count == 2:
            raise RuntimeError("simulated inference failure")
        return {"choices": [{"message": {"content": "ok"}}]}, {"route": "local"}

    worker = AgentWorker(
        config=load_config(
            {
                "mode": "agent",
                "controller_url": "http://controller",
                "node_name": "agent-a",
                "agent_worker_enabled": True,
            }
        ),
        request=request,
        chat=chat,
    )

    processed = await worker.run_once()
    assert processed == 1

    complete_call = next(call[2] for call in calls if call[1].endswith("/complete"))
    result = complete_call["result"]
    assert result["cases_total"] == 3
    assert result["cases_completed"] == 2
    assert result["cases_failed"] == 1

    case_artifacts = [a for a in complete_call["artifacts"] if a["kind"] == "llm.batch.case"]
    failed_case = next(a for a in case_artifacts if a["meta"]["case_id"] == "bad-case")
    assert failed_case["meta"]["response"] is None
    assert "simulated inference failure" in failed_case["meta"]["error"]

    summary = next(a for a in complete_call["artifacts"] if a["kind"] == "llm.batch.summary")
    assert summary["meta"]["cases_failed"] == 1


@pytest.mark.asyncio
async def test_agent_worker_llm_batch_fails_when_no_chat_executor():
    calls = []

    async def request(method, url, payload=None, headers=None):
        calls.append((method, url, payload))
        if url.endswith("/nodes/agent-a/work/claim"):
            return [
                {
                    "attempt_id": "attempt-1",
                    "job": {
                        "id": "job-batch-3",
                        "type": "llm.batch",
                        "status": "assigned",
                        "payload": {
                            "model": "qwen",
                            "cases": [{"messages": [{"role": "user", "content": "hi"}]}],
                        },
                    },
                }
            ]
        if url.endswith("/nodes/agent-a/work/jobs/job-batch-3/cancellation"):
            return {"id": "job-batch-3", "cancellation_requested": False}
        if url.endswith("/fail"):
            return {"id": "job-batch-3", "status": "failed"}
        raise AssertionError(f"unexpected request: {method} {url}")

    worker = AgentWorker(
        config=load_config(
            {
                "mode": "agent",
                "controller_url": "http://controller",
                "node_name": "agent-a",
                "agent_worker_enabled": True,
            }
        ),
        request=request,
        chat=None,
    )

    processed = await worker.run_once()
    assert processed == 1

    fail_call = next(call[2] for call in calls if call[1].endswith("/fail"))
    assert fail_call["error_code"] == "EXECUTION_ERROR"
    assert fail_call["retryable"] is False


@pytest.mark.asyncio
async def test_agent_worker_llm_batch_auto_assigns_case_ids():
    """Cases without explicit ids receive 'case-1', 'case-2', ... labels."""
    calls = []

    async def request(method, url, payload=None, headers=None):
        calls.append((method, url, payload))
        if url.endswith("/nodes/agent-a/work/claim"):
            return [
                {
                    "attempt_id": "attempt-1",
                    "job": {
                        "id": "job-batch-4",
                        "type": "llm.batch",
                        "status": "assigned",
                        "payload": {
                            "model": "qwen",
                            "cases": [
                                {"messages": [{"role": "user", "content": "a"}]},
                                {"messages": [{"role": "user", "content": "b"}]},
                            ],
                        },
                    },
                }
            ]
        if url.endswith("/nodes/agent-a/work/jobs/job-batch-4/cancellation"):
            return {"id": "job-batch-4", "cancellation_requested": False}
        if url.endswith("/progress"):
            return {"ok": True}
        if url.endswith("/complete"):
            return {"id": "job-batch-4", "status": "completed"}
        raise AssertionError(f"unexpected request: {method} {url}")

    async def chat(model, payload):
        return {"choices": [{"message": {"content": "ok"}}]}, {}

    worker = AgentWorker(
        config=load_config(
            {
                "mode": "agent",
                "controller_url": "http://controller",
                "node_name": "agent-a",
                "agent_worker_enabled": True,
            }
        ),
        request=request,
        chat=chat,
    )

    await worker.run_once()

    complete_call = next(call[2] for call in calls if call[1].endswith("/complete"))
    case_ids = [a["meta"]["case_id"] for a in complete_call["artifacts"] if a["kind"] == "llm.batch.case"]
    assert case_ids == ["case-1", "case-2"]
