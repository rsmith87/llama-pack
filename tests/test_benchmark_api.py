from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, patch

import pytest

from llama_manager.core.config import load_config
from llama_manager.main import create_app
from tests.helpers import authenticated_client as TestClient
from tests.persistence_db_setup import prepare_all_persistence_dbs


@pytest.fixture(autouse=True)
def _prepare_migrated_persistence(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    prepare_all_persistence_dbs(tmp_path)
    prepare_all_persistence_dbs(tmp_path / "logs")


def _controller_app(tmp_path):
    return create_app(config=load_config({"mode": "controller", "log_dir": str(tmp_path)}))


class TestBenchmarkDefinitions:
    def test_list_returns_seeded_presets(self, tmp_path):
        app = _controller_app(tmp_path)
        with TestClient(app) as client:
            resp = client.get("/lm-api/v1/benchmarks/definitions")
        assert resp.status_code == 200
        defs = resp.json()["definitions"]
        by_slug = {d["slug"]: d for d in defs}
        assert set(by_slug) == {
            "factual-qa-mini",
            "instruction-following-mini",
            "reasoning-math-mini",
            "summarization-mini",
        }
        assert by_slug["factual-qa-mini"]["tags"] == ["preset", "eval-pack", "factuality", "qa"]
        assert "Factual" in by_slug["factual-qa-mini"]["description"]

    def test_create_definition(self, tmp_path):
        app = _controller_app(tmp_path)
        with TestClient(app) as client:
            resp = client.post(
                "/lm-api/v1/benchmarks/definitions",
                json={
                    "name": "Test Bench",
                    "prompt_text": "Say hello",
                    "sample_count": 2,
                    "max_tokens": 64,
                },
            )
        assert resp.status_code == 201
        body = resp.json()
        assert body["name"] == "Test Bench"
        assert body["slug"] == "test-bench"
        assert body["sample_count"] == 2

    def test_create_definition_invalid_slug_rejected(self, tmp_path):
        app = _controller_app(tmp_path)
        with TestClient(app) as client:
            resp = client.post(
                "/lm-api/v1/benchmarks/definitions",
                json={"name": "x", "slug": "Bad Slug!", "prompt_text": "p", "sample_count": 1, "max_tokens": 64},
            )
        assert resp.status_code == 422

    def test_not_available_in_agent_mode(self, tmp_path):
        app = create_app(config=load_config({"mode": "agent", "log_dir": str(tmp_path)}))
        with TestClient(app) as client:
            resp = client.get("/lm-api/v1/benchmarks/definitions")
        assert resp.status_code == 404


class TestBenchmarkRuns:
    def _get_preset_id(self, client, slug: str) -> str:
        defs = client.get("/lm-api/v1/benchmarks/definitions").json()["definitions"]
        return next(d["id"] for d in defs if d["slug"] == slug)

    def test_start_runs_returns_202_with_pending_runs(self, tmp_path):
        app = _controller_app(tmp_path)
        with TestClient(app) as client:
            def_id = self._get_preset_id(client, "factual-qa-mini")
            resp = client.post(
                "/lm-api/v1/benchmarks/runs",
                json={"definition_id": def_id, "models": ["modelA", "modelB"]},
            )
        assert resp.status_code == 202
        runs = resp.json()["runs"]
        assert len(runs) == 2
        for run in runs:
            assert run["status"] == "pending"
            assert run["benchmark_definition_id"] == def_id
            assert run["managed_load"] is False
            assert run["target_node"] is None

    def test_managed_load_requires_target_node(self, tmp_path):
        app = _controller_app(tmp_path)
        with TestClient(app) as client:
            def_id = self._get_preset_id(client, "factual-qa-mini")
            resp = client.post(
                "/lm-api/v1/benchmarks/runs",
                json={"definition_id": def_id, "models": ["modelA"], "managed_load": True},
            )
        assert resp.status_code == 422

    def test_start_managed_runs_persists_lifecycle_fields(self, tmp_path):
        app = _controller_app(tmp_path)
        with TestClient(app) as client:
            def_id = self._get_preset_id(client, "factual-qa-mini")
            resp = client.post(
                "/lm-api/v1/benchmarks/runs",
                json={
                    "definition_id": def_id,
                    "models": ["modelA"],
                    "managed_load": True,
                    "target_node": "gpu-a",
                    "restore_after": True,
                },
            )
        assert resp.status_code == 202
        run = resp.json()["runs"][0]
        assert run["managed_load"] is True
        assert run["target_node"] == "gpu-a"
        assert run["target_selector"] == "node:gpu-a"
        assert run["restore_after"] is True

    def test_start_runs_unknown_definition_returns_404(self, tmp_path):
        app = _controller_app(tmp_path)
        with TestClient(app) as client:
            resp = client.post(
                "/lm-api/v1/benchmarks/runs",
                json={"definition_id": "does-not-exist", "models": ["modelA"]},
            )
        assert resp.status_code == 404

    def test_get_run_not_found_returns_404(self, tmp_path):
        app = _controller_app(tmp_path)
        with TestClient(app) as client:
            resp = client.get("/lm-api/v1/benchmarks/runs/nonexistent-id")
        assert resp.status_code == 404

    def test_get_run_after_start(self, tmp_path):
        app = _controller_app(tmp_path)
        with TestClient(app) as client:
            def_id = self._get_preset_id(client, "summarization-mini")
            start = client.post(
                "/lm-api/v1/benchmarks/runs",
                json={"definition_id": def_id, "models": ["m1"]},
            )
            run_id = start.json()["runs"][0]["id"]
            resp = client.get(f"/lm-api/v1/benchmarks/runs/{run_id}")
        assert resp.status_code == 200
        assert resp.json()["id"] == run_id

    def test_list_runs_filtered_by_definition(self, tmp_path):
        app = _controller_app(tmp_path)
        with TestClient(app) as client:
            def_a = self._get_preset_id(client, "factual-qa-mini")
            def_b = self._get_preset_id(client, "summarization-mini")
            client.post("/lm-api/v1/benchmarks/runs", json={"definition_id": def_a, "models": ["m1"]})
            client.post("/lm-api/v1/benchmarks/runs", json={"definition_id": def_b, "models": ["m2"]})

            resp_a = client.get(f"/lm-api/v1/benchmarks/runs?definition_id={def_a}")
            resp_b = client.get(f"/lm-api/v1/benchmarks/runs?definition_id={def_b}")

        assert all(r["benchmark_definition_id"] == def_a for r in resp_a.json()["runs"])
        assert all(r["benchmark_definition_id"] == def_b for r in resp_b.json()["runs"])


class TestBenchmarkRunsCompare:
    def _start_run(self, client, def_id: str, model: str) -> str:
        resp = client.post("/lm-api/v1/benchmarks/runs", json={"definition_id": def_id, "models": [model]})
        return resp.json()["runs"][0]["id"]

    def test_compare_same_definition(self, tmp_path):
        app = _controller_app(tmp_path)
        with TestClient(app) as client:
            defs = client.get("/lm-api/v1/benchmarks/definitions").json()["definitions"]
            def_id = defs[0]["id"]
            run_a = self._start_run(client, def_id, "m1")
            run_b = self._start_run(client, def_id, "m2")
            resp = client.post("/lm-api/v1/benchmarks/runs/compare", json={"run_ids": [run_a, run_b]})
        assert resp.status_code == 200
        body = resp.json()
        assert body["definition_id"] == def_id
        assert len(body["runs"]) == 2

    def test_compare_different_definitions_rejected(self, tmp_path):
        app = _controller_app(tmp_path)
        with TestClient(app) as client:
            defs = client.get("/lm-api/v1/benchmarks/definitions").json()["definitions"]
            def_a = defs[0]["id"]
            def_b = defs[1]["id"]
            run_a = self._start_run(client, def_a, "m1")
            run_b = self._start_run(client, def_b, "m2")
            resp = client.post("/lm-api/v1/benchmarks/runs/compare", json={"run_ids": [run_a, run_b]})
        assert resp.status_code == 422

    def test_compare_nonexistent_run_returns_404(self, tmp_path):
        app = _controller_app(tmp_path)
        with TestClient(app) as client:
            defs = client.get("/lm-api/v1/benchmarks/definitions").json()["definitions"]
            run_a = self._start_run(client, defs[0]["id"], "m1")
            resp = client.post(
                "/lm-api/v1/benchmarks/runs/compare",
                json={"run_ids": [run_a, "ghost-id"]},
            )
        assert resp.status_code == 404


class TestBenchmarkRunExecution:
    """Integration test: verify the runner writes samples + aggregates to the store."""

    def test_runner_completes_run_with_mocked_inference(self, tmp_path):
        from llama_manager.core.benchmarks.runner import BenchmarkRunner
        from llama_manager.core.chat.inference_service import InferenceResult

        mock_result = InferenceResult(
            response_payload={"choices": [{"message": {"content": "Paris"}}]},
            ttft_ms=45.0,
            tokens_per_second=28.5,
            total_duration_ms=320.0,
            prompt_tokens=12,
            completion_tokens=5,
            completion_chars=5,
            raw_telemetry={"timings": {}, "usage": {}},
        )

        app = _controller_app(tmp_path)
        store = app.state.benchmark_store
        defs = store.list_definitions()
        def_id = next(d["id"] for d in defs if d["slug"] == "factual-qa-mini")

        run = store.create_run(
            benchmark_definition_id=def_id,
            model="test-model",
            status="pending",
        )

        runner = BenchmarkRunner(store, app.state.chat_proxy)

        with patch(
            "llama_manager.core.benchmarks.runner.run_inference",
            new=AsyncMock(return_value=mock_result),
        ):
            asyncio.get_event_loop().run_until_complete(runner.execute_run(run["id"]))

        finished = store.get_run(run["id"])
        assert finished["status"] == "completed"
        assert finished["aggregate"] is not None
        assert finished["aggregate"]["success_rate"] == pytest.approx(1.0)
        assert len(finished["samples"]) == 5  # factual-qa-mini has sample_count=5

    def test_runner_marks_partial_on_mixed_failures(self, tmp_path):
        from llama_manager.core.benchmarks.runner import BenchmarkRunner
        from llama_manager.core.chat.inference_service import InferenceResult

        call_count = 0

        async def flaky_inference(*_args, **_kwargs):
            nonlocal call_count
            call_count += 1
            if call_count % 2 == 0:
                raise RuntimeError("inference timeout")
            return InferenceResult(
                response_payload={"choices": [{"message": {"content": "ok"}}]},
                ttft_ms=50.0,
                tokens_per_second=25.0,
                total_duration_ms=400.0,
                prompt_tokens=8,
                completion_tokens=4,
                completion_chars=2,
                raw_telemetry={},
            )

        app = _controller_app(tmp_path)
        store = app.state.benchmark_store
        defs = store.list_definitions()
        # Use summarization-mini (sample_count=3) for deterministic even/odd split
        def_id = next(d["id"] for d in defs if d["slug"] == "summarization-mini")
        run = store.create_run(benchmark_definition_id=def_id, model="m", status="pending")

        runner = BenchmarkRunner(store, app.state.chat_proxy)
        with patch("llama_manager.core.benchmarks.runner.run_inference", new=flaky_inference):
            asyncio.get_event_loop().run_until_complete(runner.execute_run(run["id"]))

        finished = store.get_run(run["id"])
        assert finished["status"] == "partial"
        assert 0.0 < finished["aggregate"]["success_rate"] < 1.0

    def test_runner_manages_model_lifecycle_and_restores(self, tmp_path):
        from llama_manager.core.benchmarks.runner import BenchmarkRunner
        from llama_manager.core.chat.inference_service import InferenceResult

        app = _controller_app(tmp_path)
        store = app.state.benchmark_store
        def_id = next(d["id"] for d in store.list_definitions() if d["slug"] == "reasoning-math-mini")
        run = store.create_run(
            benchmark_definition_id=def_id,
            model="bench-model",
            target_selector="node:gpu-a",
            target_node="gpu-a",
            managed_load=True,
            restore_after=True,
            status="pending",
        )
        running = {"other-model"}
        calls: list[tuple[str, str, str]] = []

        async def request_node(node_name, method, path, json_body=None):
            calls.append((node_name, method, path))
            if method == "GET":
                return [
                    {"name": "other-model", "running": "other-model" in running},
                    {"name": "bench-model", "running": "bench-model" in running},
                ]
            if path.endswith("/stop"):
                running.discard(path.split("/")[-2])
            if path.endswith("/start"):
                running.add(path.split("/")[-2])
            return {"ok": True}

        async def inference(_proxy, _model, payload):
            assert payload["target"] == "node:gpu-a"
            return InferenceResult(
                response_payload={"choices": [{"message": {"content": "ok"}}]},
                ttft_ms=10.0,
                tokens_per_second=20.0,
                total_duration_ms=30.0,
                prompt_tokens=1,
                completion_tokens=1,
                completion_chars=2,
                raw_telemetry={},
            )

        app.state.chat_proxy.node_registry.request_node = request_node
        runner = BenchmarkRunner(store, app.state.chat_proxy)
        with patch("llama_manager.core.benchmarks.runner.run_inference", new=inference):
            asyncio.get_event_loop().run_until_complete(runner.execute_run(run["id"]))

        finished = store.get_run(run["id"])
        assert finished["status"] == "completed"
        assert running == {"other-model"}
        assert ("gpu-a", "POST", "/lm-api/v1/models/other-model/stop") in calls
        assert ("gpu-a", "POST", "/lm-api/v1/models/bench-model/start") in calls
        assert ("gpu-a", "POST", "/lm-api/v1/models/bench-model/stop") in calls
        assert calls[-1] == ("gpu-a", "POST", "/lm-api/v1/models/other-model/start")

    def test_runner_marks_failed_when_managed_model_start_times_out(self, tmp_path):
        from llama_manager.core.benchmarks.runner import BenchmarkRunner

        app = _controller_app(tmp_path)
        store = app.state.benchmark_store
        def_id = next(d["id"] for d in store.list_definitions() if d["slug"] == "summarization-mini")
        run = store.create_run(
            benchmark_definition_id=def_id,
            model="bench-model",
            target_selector="node:gpu-a",
            target_node="gpu-a",
            managed_load=True,
            restore_after=True,
            status="pending",
        )
        running = {"other-model"}
        calls: list[tuple[str, str, str]] = []

        async def request_node(node_name, method, path, json_body=None):
            calls.append((node_name, method, path))
            if method == "GET":
                return [
                    {"name": "bench-model", "running": False},
                    {"name": "other-model", "running": "other-model" in running},
                ]
            if path.endswith("/stop"):
                running.discard(path.split("/")[-2])
            if path.endswith("/start") and "other-model" in path:
                running.add("other-model")
            return {"ok": True}

        app.state.chat_proxy.node_registry.request_node = request_node
        runner = BenchmarkRunner(store, app.state.chat_proxy, model_start_timeout_seconds=0)
        asyncio.get_event_loop().run_until_complete(runner.execute_run(run["id"]))

        finished = store.get_run(run["id"])
        assert finished["status"] == "failed"
        assert finished["error_detail"] == "model_start_timeout"
        assert finished["samples"] == []
        assert running == {"other-model"}
        assert calls[-1] == ("gpu-a", "POST", "/lm-api/v1/models/other-model/start")
