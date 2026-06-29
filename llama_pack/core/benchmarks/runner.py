from __future__ import annotations

import json
import logging
from datetime import UTC, datetime
from typing import Any

from llama_pack.core.chat.inference_service import run_inference
from llama_pack.core.chat.proxy import ChatProxy
from llama_pack.core.model_lifecycle import ManagedModelLifecycle
from llama_pack.core.persistence.benchmark_store_orm import BenchmarkStoreOrm, _compute_aggregate

logger = logging.getLogger(__name__)

_EXCERPT_MAX = 200


class BenchmarkRunner:
    """Executes benchmark runs sequentially against the shared inference path.

    Each call to ``execute_run`` runs all samples for a single run record,
    writing results back to the store as it goes.  The caller is responsible
    for scheduling concurrent runs (e.g. via ``asyncio.create_task``) when
    benchmarking multiple models; this class processes one run at a time.
    """

    def __init__(self, store: BenchmarkStoreOrm, proxy: ChatProxy, *, model_start_timeout_seconds: float = 120.0) -> None:
        self._store = store
        self._proxy = proxy
        self._model_lifecycle = ManagedModelLifecycle(proxy.node_registry, model_start_timeout_seconds)

    async def execute_run(self, run_id: str) -> None:
        run = self._store.get_run(run_id)
        if run is None:
            logger.warning("BenchmarkRunner: run %s not found", run_id)
            return

        defn = self._store.get_definition(run["benchmark_definition_id"])
        if defn is None:
            self._store.update_run(
                run_id,
                status="failed",
                finished_at=datetime.now(UTC).isoformat(),
                error_detail="Benchmark definition not found",
            )
            return

        self._store.update_run(
            run_id,
            status="running",
            started_at=datetime.now(UTC).isoformat(),
        )

        payload = self._build_payload(defn, run)
        model_name = run["model"]
        samples_succeeded = 0
        samples_failed = 0
        prior_models: list[str] = []

        try:
            if run.get("managed_load"):
                target_node = str(run.get("target_node") or "").strip()
                prior_models = await self._model_lifecycle.snapshot_running_models(target_node)
                await self._model_lifecycle.load_exclusive(target_node, model_name, prior_models)

            for i in range(defn["sample_count"]):
                try:
                    result = await run_inference(self._proxy, model_name, payload)
                    self._store.create_sample(
                        run_id=run_id,
                        sample_index=i,
                        status="success",
                        ttft_ms=result.ttft_ms,
                        tokens_per_second=result.tokens_per_second,
                        total_duration_ms=result.total_duration_ms,
                        prompt_tokens=result.prompt_tokens,
                        completion_tokens=result.completion_tokens,
                        completion_chars=result.completion_chars,
                        response_excerpt=_excerpt(result.response_payload),
                        error_detail=None,
                        raw_telemetry=result.raw_telemetry,
                    )
                    samples_succeeded += 1
                except Exception as exc:
                    logger.warning("BenchmarkRunner: sample %d of run %s failed: %s", i, run_id, exc)
                    self._store.create_sample(
                        run_id=run_id,
                        sample_index=i,
                        status="failed",
                        ttft_ms=None,
                        tokens_per_second=None,
                        total_duration_ms=None,
                        prompt_tokens=None,
                        completion_tokens=None,
                        completion_chars=None,
                        response_excerpt=None,
                        error_detail=str(exc),
                        raw_telemetry=None,
                    )
                    samples_failed += 1

            samples = self._store.get_run_samples(run_id)
            aggregate = _compute_aggregate(samples)

            if samples_failed == 0:
                final_status = "completed"
            elif samples_succeeded == 0:
                final_status = "failed"
            else:
                final_status = "partial"

            self._store.update_run(
                run_id,
                status=final_status,
                finished_at=datetime.now(UTC).isoformat(),
                aggregate_json=json.dumps(aggregate),
            )
        except Exception as exc:
            logger.warning("BenchmarkRunner: run %s failed before sampling: %s", run_id, exc)
            self._store.update_run(
                run_id,
                status="failed",
                finished_at=datetime.now(UTC).isoformat(),
                error_detail=str(exc),
            )
        finally:
            if run.get("managed_load") and run.get("restore_after"):
                await self._model_lifecycle.restore_exclusive(
                    str(run.get("target_node") or "").strip(), model_name, prior_models
                )

    @staticmethod
    def _build_payload(defn: dict[str, Any], run: dict[str, Any]) -> dict[str, Any]:
        messages: list[dict[str, str]] = []
        if defn.get("system_prompt"):
            messages.append({"role": "system", "content": defn["system_prompt"]})
        messages.append({"role": "user", "content": defn["prompt_text"]})

        defaults: dict[str, Any] = defn.get("request_defaults") or {}
        payload: dict[str, Any] = {**defaults, "messages": messages, "max_tokens": defn["max_tokens"]}
        if run.get("target_selector") and run["target_selector"] != "auto":
            payload["target"] = run["target_selector"]
        return payload


def _excerpt(response_payload: dict[str, Any]) -> str:
    choices: list[Any] = response_payload.get("choices") or []
    content = choices[0].get("message", {}).get("content", "") if choices else ""
    text = str(content or "")
    return text[:_EXCERPT_MAX]
