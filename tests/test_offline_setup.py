from fastapi import FastAPI
from fastapi.testclient import TestClient
import pytest

from llama_pack.core.offline.setup import OfflineSetupService


class FakeRegistry:
    def __init__(self, responses):
        self.responses = responses
        self.calls = []
        self.configs = {
            "source": type("NodeConfigStub", (), {"url": "http://192.168.1.10:9000"})(),
            "target-ready": type("NodeConfigStub", (), {"url": "http://192.168.1.11:9000"})(),
            "target-missing": type("NodeConfigStub", (), {"url": "http://192.168.1.12:9000"})(),
            "target-down": type("NodeConfigStub", (), {"url": "http://192.168.1.13:9000"})(),
        }

    def list_nodes(self):
        return [
            {"name": "source", "url": "http://192.168.1.10:9000"},
            {"name": "target-ready", "url": "http://192.168.1.11:9000"},
            {"name": "target-missing", "url": "http://192.168.1.12:9000"},
            {"name": "target-down", "url": "http://192.168.1.13:9000"},
        ]

    async def request_node(self, node_name, method, path, json_body=None, timeout=10):
        self.calls.append((node_name, method, path, json_body))
        response = self.responses[(node_name, method, path)]
        if isinstance(response, Exception):
            raise response
        return response

    def get_node_config(self, node_name):
        return self.configs[node_name]


class FakeOrchestrator:
    def __init__(self):
        self.jobs = []

    def create_job(self, *, job_type, payload, target, requested_by):
        job = {
            "id": f"job-{len(self.jobs) + 1}",
            "type": job_type,
            "payload": payload,
            "target": target,
            "requested_by": requested_by,
            "status": "queued",
        }
        self.jobs.append(job)
        return job


class FakeOfflineService:
    async def readiness(self, source_node, model, target_nodes):
        return {"source_node": source_node, "model": model, "nodes": []}

    async def distribute(self, source_node, source_file_id, target_nodes):
        return {"source_node": source_node, "source_file_id": source_file_id, "nodes": []}


@pytest.mark.asyncio
async def test_readiness_reports_per_node_statuses():
    registry = FakeRegistry(
        {
            ("target-ready", "GET", "/lm-api/v1/models"): [{"name": "qwen", "running": False}],
            ("target-ready", "GET", "/lm-api/v1/library/ggufs"): [{"name": "qwen", "id": "file-ready"}],
            ("target-missing", "GET", "/lm-api/v1/models"): [],
            ("target-missing", "GET", "/lm-api/v1/library/ggufs"): [],
            ("target-down", "GET", "/lm-api/v1/models"): RuntimeError("connection refused"),
        }
    )
    service = OfflineSetupService(registry, FakeOrchestrator())

    result = await service.readiness("source", "qwen", ["target-ready", "target-missing", "target-down"])

    by_node = {item["node"]: item for item in result["nodes"]}
    assert by_node["target-ready"]["reachable"] is True
    assert by_node["target-ready"]["artifact_present"] is True
    assert by_node["target-ready"]["registered"] is True
    assert by_node["target-ready"]["ready"] is True
    assert by_node["target-missing"]["reachable"] is True
    assert by_node["target-missing"]["artifact_present"] is False
    assert by_node["target-missing"]["ready"] is False
    assert by_node["target-down"]["reachable"] is False
    assert "connection refused" in by_node["target-down"]["error"]


@pytest.mark.asyncio
async def test_distribute_creates_existing_model_transfer_jobs():
    registry = FakeRegistry(
        {
            ("source", "POST", "/lm-api/v1/transfer-source/grants"): {"ok": True},
        }
    )
    orchestrator = FakeOrchestrator()
    service = OfflineSetupService(registry, orchestrator)

    result = await service.distribute("source", "file-source", ["target-ready"])

    assert result["source_node"] == "source"
    assert result["source_file_id"] == "file-source"
    assert result["nodes"][0]["node"] == "target-ready"
    assert result["nodes"][0]["status"] == "queued"
    assert result["nodes"][0]["transfer_id"] == "job-1"
    assert orchestrator.jobs[0]["type"] == "model.transfer"
    assert orchestrator.jobs[0]["target"] == "node:target-ready"
    assert orchestrator.jobs[0]["payload"]["source_node"] == "source"
    assert orchestrator.jobs[0]["payload"]["destination_node"] == "target-ready"
    assert ("source", "POST", "/lm-api/v1/transfer-source/grants", None) not in registry.calls
    assert any(call[0] == "source" and call[1] == "POST" and call[2] == "/lm-api/v1/transfer-source/grants" for call in registry.calls)


def test_offline_readiness_route_returns_service_payload():
    from llama_pack.api.routes.offline import router

    app = FastAPI()
    app.state.offline_setup_service = FakeOfflineService()
    app.include_router(router, prefix="/lm-api/v1")
    client = TestClient(app)

    response = client.post(
        "/lm-api/v1/offline/readiness",
        json={"source_node": "source", "model": "qwen", "target_nodes": ["gpu-a"]},
    )

    assert response.status_code == 200
    assert response.json() == {"source_node": "source", "model": "qwen", "nodes": []}


def test_offline_distribute_route_returns_service_payload():
    from llama_pack.api.routes.offline import router

    app = FastAPI()
    app.state.offline_setup_service = FakeOfflineService()
    app.include_router(router, prefix="/lm-api/v1")
    client = TestClient(app)

    response = client.post(
        "/lm-api/v1/offline/distribute",
        json={"source_node": "source", "source_file_id": "file-source", "target_nodes": ["gpu-a"]},
    )

    assert response.status_code == 200
    assert response.json() == {"source_node": "source", "source_file_id": "file-source", "nodes": []}
