from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Any

from llama_pack.core.chat.proxy import ChatProxy


@dataclass
class InferenceResult:
    response_payload: dict[str, Any]
    ttft_ms: float
    tokens_per_second: float
    total_duration_ms: float
    prompt_tokens: int
    completion_tokens: int
    completion_chars: int
    raw_telemetry: dict[str, Any]


async def run_inference(proxy: ChatProxy, model_name: str, payload: dict[str, Any]) -> InferenceResult:
    """Run a single inference call and return normalized telemetry.

    Uses the llama.cpp ``timings`` block when available (prompt_ms for TTFT,
    predicted_per_second for tok/s).  Wall-clock total_duration_ms is always
    captured independently so the caller gets a consistent baseline even when
    the upstream server omits timings.
    """
    start = time.monotonic()
    response, meta = await proxy.chat_with_meta(model_name, payload)
    total_duration_ms = (time.monotonic() - start) * 1000.0

    timings: dict[str, Any] = response.get("timings") or {}
    ttft_ms = float(timings.get("prompt_ms") or 0.0)
    tokens_per_second = float(timings.get("predicted_per_second") or 0.0)

    usage: dict[str, Any] = response.get("usage") or {}
    prompt_tokens = int(usage.get("prompt_tokens") or 0)
    completion_tokens = int(usage.get("completion_tokens") or 0)

    choices: list[Any] = response.get("choices") or []
    content = choices[0].get("message", {}).get("content", "") if choices else ""
    completion_chars = len(str(content or ""))

    return InferenceResult(
        response_payload=response,
        ttft_ms=ttft_ms,
        tokens_per_second=tokens_per_second,
        total_duration_ms=total_duration_ms,
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
        completion_chars=completion_chars,
        raw_telemetry={"timings": timings, "usage": usage, "route": meta},
    )
