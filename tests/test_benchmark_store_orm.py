from __future__ import annotations

import pytest

from llama_pack.core.persistence.benchmark_store_orm import BenchmarkStoreOrm
from tests.persistence_db_setup import prepare_benchmarks_db


@pytest.fixture()
def store(tmp_path) -> BenchmarkStoreOrm:
    db_path = tmp_path / "benchmarks.db"
    prepare_benchmarks_db(db_path)
    return BenchmarkStoreOrm(db_url=f"sqlite:///{db_path}")


class TestSeedDefaults:
    def test_curated_evaluation_presets_seeded_on_init(self, store):
        defs = store.list_definitions()
        by_slug = {d["slug"]: d for d in defs}
        assert set(by_slug) == {
            "factual-qa-mini",
            "instruction-following-mini",
            "reasoning-math-mini",
            "summarization-mini",
        }
        assert by_slug["factual-qa-mini"]["sample_count"] == 5
        assert by_slug["instruction-following-mini"]["sample_count"] == 5
        assert by_slug["reasoning-math-mini"]["sample_count"] == 3
        assert by_slug["summarization-mini"]["sample_count"] == 3
        for defn in by_slug.values():
            assert "preset" in defn["tags"]
            assert "eval-pack" in defn["tags"]
            assert defn["description"]

    def test_seed_is_idempotent(self, tmp_path):
        db_path = tmp_path / "benchmarks.db"
        prepare_benchmarks_db(db_path)
        url = f"sqlite:///{db_path}"
        BenchmarkStoreOrm(db_url=url)
        BenchmarkStoreOrm(db_url=url)
        store = BenchmarkStoreOrm(db_url=url)
        assert len(store.list_definitions()) == 4

    def test_legacy_toy_presets_are_archived_on_init(self, store):
        store.create_definition(
            name="Short Response Latency",
            slug="short-response-latency",
            prompt_text="In one sentence, what is the capital of France?",
            sample_count=5,
            max_tokens=64,
            tags=["preset", "ttft"],
        )
        store.create_definition(
            name="Sustained Generation",
            slug="sustained-generation",
            prompt_text="Explain the water cycle in detail.",
            sample_count=3,
            max_tokens=512,
            tags=["preset", "throughput"],
        )

        BenchmarkStoreOrm(db_url=str(store.engine.url))

        visible_slugs = {d["slug"] for d in store.list_definitions()}
        archived = {d["slug"]: d for d in store.list_definitions(include_archived=True)}
        assert "short-response-latency" not in visible_slugs
        assert "sustained-generation" not in visible_slugs
        assert archived["short-response-latency"]["archived"]
        assert archived["sustained-generation"]["archived"]


class TestDefinitions:
    def test_create_and_list(self, store):
        defn = store.create_definition(
            name="My Test",
            slug="my-test",
            prompt_text="Hello world",
            sample_count=2,
            max_tokens=128,
            tags=["test"],
        )
        assert defn["id"]
        assert defn["slug"] == "my-test"
        assert defn["sample_count"] == 2
        assert defn["tags"] == ["test"]
        assert not defn["archived"]

        all_defs = store.list_definitions()
        ids = [d["id"] for d in all_defs]
        assert defn["id"] in ids

    def test_get_definition(self, store):
        defn = store.create_definition(
            name="Lookup",
            slug="lookup",
            prompt_text="Prompt",
            sample_count=1,
            max_tokens=64,
        )
        fetched = store.get_definition(defn["id"])
        assert fetched is not None
        assert fetched["id"] == defn["id"]
        assert fetched["name"] == "Lookup"

    def test_get_missing_returns_none(self, store):
        assert store.get_definition("nonexistent") is None

    def test_request_defaults_roundtrip(self, store):
        defn = store.create_definition(
            name="With defaults",
            slug="with-defaults",
            prompt_text="Hi",
            sample_count=1,
            max_tokens=64,
            request_defaults={"temperature": 0.5},
        )
        fetched = store.get_definition(defn["id"])
        assert fetched["request_defaults"] == {"temperature": 0.5}


class TestRuns:
    def test_create_and_list_run(self, store):
        defs = store.list_definitions()
        def_id = defs[0]["id"]

        run = store.create_run(
            benchmark_definition_id=def_id,
            model="llama3",
            target_selector="node:gpu-a",
            target_node="gpu-a",
            managed_load=True,
            restore_after=True,
            status="pending",
        )
        assert run["id"]
        assert run["status"] == "pending"
        assert run["model"] == "llama3"
        assert run["target_selector"] == "node:gpu-a"
        assert run["target_node"] == "gpu-a"
        assert run["managed_load"] is True
        assert run["restore_after"] is True
        assert run["aggregate"] is None

        runs = store.list_runs(definition_id=def_id)
        assert any(r["id"] == run["id"] for r in runs)

    def test_update_run_status(self, store):
        defs = store.list_definitions()
        run = store.create_run(
            benchmark_definition_id=defs[0]["id"], model="m1", status="pending"
        )
        updated = store.update_run(run["id"], status="running", started_at="2026-01-01T00:00:00+00:00")
        assert updated["status"] == "running"
        assert updated["started_at"] == "2026-01-01T00:00:00+00:00"

    def test_get_run_includes_samples(self, store):
        defs = store.list_definitions()
        run = store.create_run(
            benchmark_definition_id=defs[0]["id"], model="m1", status="running"
        )
        store.create_sample(
            run_id=run["id"],
            sample_index=0,
            status="success",
            ttft_ms=50.0,
            tokens_per_second=30.0,
            total_duration_ms=500.0,
            prompt_tokens=10,
            completion_tokens=20,
            completion_chars=80,
            response_excerpt="hello world",
            error_detail=None,
            raw_telemetry={"timings": {}},
        )
        fetched = store.get_run(run["id"])
        assert fetched is not None
        assert len(fetched["samples"]) == 1
        assert fetched["samples"][0]["ttft_ms"] == pytest.approx(50.0)


class TestToolLoopEvalRuns:
    def test_persist_and_fetch_tool_loop_eval_run(self, store):
        summary = {
            "generated_at": "2026-06-11T04:00:00+00:00",
            "target_selector": "node:linux-2080ti",
            "target_node": "linux-2080ti",
            "suite": {
                "model": "gpt-oss-20b-mxfp4:default",
                "status": "passed",
                "case_count": 2,
                "passed_count": 2,
                "failed_count": 0,
                "average_score": 1.0,
                "cases": [
                    {
                        "case_id": "two-step-tool-synthesis",
                        "model": "gpt-oss-20b-mxfp4:default",
                        "status": "passed",
                        "score": 1.0,
                        "checks": {"completed": True},
                        "error": "",
                        "iteration_count": 3,
                        "tool_call_count": 2,
                        "observed_tool_sequence": ["read_status", "read_details"],
                        "expected_tool_sequence": ["read_status", "read_details"],
                        "missing_expected_tools": [],
                        "unexpected_tools": [],
                        "scoring_mode": "strict_sequence",
                        "tool_results": [{"tool_name": "read_status", "ok": True}],
                        "trace_events": [
                            {
                                "id": "trace-1-000001",
                                "trace_id": "trace-1",
                                "sequence": 1,
                                "timestamp": "2026-06-12T00:00:00+00:00",
                                "event_type": "tool_call_completed",
                                "source": "tool_loop_eval",
                                "scope": "eval_case",
                                "status": "passed",
                                "case_id": "two-step-tool-synthesis",
                                "tool_call_id": "call-1",
                                "model": "gpt-oss-20b-mxfp4:default",
                                "title": "read_status completed",
                                "summary": "",
                                "payload": {"result": {"ok": True}},
                            }
                        ],
                        "final_answer": "green calibration window",
                        "diagnostics": {
                            "missing_artifact_substrings": {"docs/notes-app-design.md": ["registration"]},
                            "forbidden_artifact_substrings_found": {},
                        },
                    },
                    {
                        "case_id": "avoid-unneeded-tools",
                        "model": "gpt-oss-20b-mxfp4:default",
                        "status": "passed",
                        "score": 1.0,
                        "checks": {"completed": True},
                        "error": "",
                        "iteration_count": 1,
                        "tool_call_count": 0,
                        "observed_tool_sequence": [],
                        "expected_tool_sequence": [],
                        "scoring_mode": "strict_sequence",
                        "tool_results": [],
                        "final_answer": "tool loop ready",
                    },
                ],
            },
        }

        run = store.create_tool_loop_eval_run(**summary)

        assert run["id"]
        assert run["model"] == "gpt-oss-20b-mxfp4:default"
        assert run["target_selector"] == "node:linux-2080ti"
        assert run["target_node"] == "linux-2080ti"
        assert run["status"] == "passed"
        assert run["average_score"] == pytest.approx(1.0)
        assert run["case_count"] == 2
        assert run["passed_count"] == 2
        assert run["failed_count"] == 0

        listed = store.list_tool_loop_eval_runs(limit=10)
        assert [item["id"] for item in listed] == [run["id"]]
        assert "cases" not in listed[0]
        assert listed[0]["case_ids"] == ["two-step-tool-synthesis", "avoid-unneeded-tools"]

        fetched = store.get_tool_loop_eval_run(run["id"])
        assert fetched is not None
        assert fetched["id"] == run["id"]
        assert [case["case_id"] for case in fetched["cases"]] == [
            "two-step-tool-synthesis",
            "avoid-unneeded-tools",
        ]
        assert fetched["cases"][0]["observed_tool_sequence"] == ["read_status", "read_details"]
        assert fetched["cases"][0]["tool_results"] == [{"tool_name": "read_status", "ok": True}]
        assert fetched["cases"][0]["trace_events"][0]["event_type"] == "tool_call_completed"
        assert fetched["cases"][0]["trace_events"][0]["payload"] == {"result": {"ok": True}}
        assert fetched["cases"][0]["missing_expected_tools"] == []
        assert fetched["cases"][0]["unexpected_tools"] == []
        assert fetched["cases"][0]["diagnostics"] == {
            "missing_artifact_substrings": {"docs/notes-app-design.md": ["registration"]},
            "forbidden_artifact_substrings_found": {},
        }

    def test_list_tool_loop_eval_runs_filters_model_and_status(self, store):
        def make_suite(model: str, status: str) -> dict:
            return {
                "model": model,
                "status": status,
                "case_count": 1,
                "passed_count": 1 if status == "passed" else 0,
                "failed_count": 0 if status == "passed" else 1,
                "average_score": 1.0 if status == "passed" else 0.5,
                "cases": [],
            }

        passed = store.create_tool_loop_eval_run(
            generated_at="2026-06-11T04:00:00+00:00",
            target_selector="node:a",
            target_node="a",
            suite=make_suite("model-a", "passed"),
        )
        store.create_tool_loop_eval_run(
            generated_at="2026-06-11T04:01:00+00:00",
            target_selector="node:b",
            target_node="b",
            suite=make_suite("model-b", "failed"),
        )

        assert [run["id"] for run in store.list_tool_loop_eval_runs(model="model-a")] == [passed["id"]]
        assert [run["id"] for run in store.list_tool_loop_eval_runs(status="passed")] == [passed["id"]]
        assert store.get_tool_loop_eval_run("missing") is None


class TestAggregateComputation:
    def test_all_success(self):
        from llama_pack.core.persistence.benchmark_store_orm import _compute_aggregate

        samples = [
            {"status": "success", "ttft_ms": 100.0, "tokens_per_second": 20.0, "total_duration_ms": 1000.0},
            {"status": "success", "ttft_ms": 200.0, "tokens_per_second": 30.0, "total_duration_ms": 2000.0},
            {"status": "success", "ttft_ms": 300.0, "tokens_per_second": 40.0, "total_duration_ms": 3000.0},
        ]
        agg = _compute_aggregate(samples)
        assert agg["ttft_ms_median"] == pytest.approx(200.0)
        assert agg["tokens_per_second_median"] == pytest.approx(30.0)
        assert agg["success_rate"] == pytest.approx(1.0)
        assert agg["sample_count"] == 3

    def test_partial_failure(self):
        from llama_pack.core.persistence.benchmark_store_orm import _compute_aggregate

        samples = [
            {"status": "success", "ttft_ms": 100.0, "tokens_per_second": 20.0, "total_duration_ms": 500.0},
            {"status": "failed", "ttft_ms": None, "tokens_per_second": None, "total_duration_ms": None},
        ]
        agg = _compute_aggregate(samples)
        assert agg["success_rate"] == pytest.approx(0.5)
        assert agg["ttft_ms_median"] == pytest.approx(100.0)
        assert agg["sample_count"] == 2

    def test_all_failure(self):
        from llama_pack.core.persistence.benchmark_store_orm import _compute_aggregate

        samples = [{"status": "failed", "ttft_ms": None, "tokens_per_second": None, "total_duration_ms": None}]
        agg = _compute_aggregate(samples)
        assert agg["success_rate"] == pytest.approx(0.0)
        assert agg["ttft_ms_median"] is None
