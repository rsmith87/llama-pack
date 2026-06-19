from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from llama_pack.core.config import AppConfig
from llama_pack.core.runtime.process_manager import ProcessManager


ContextBudgetStatus = Literal["comfortable", "getting_full", "near_limit", "too_large"]


@dataclass(frozen=True)
class ContextBudget:
    model: str
    context_window_tokens: int
    prompt_tokens_estimated: int
    reserved_completion_tokens: int
    available_input_tokens: int
    remaining_context_tokens: int
    usage_ratio: float
    status: ContextBudgetStatus
    estimation_method: str
    precision: str
    warnings: list[str]

    def to_dict(self) -> dict[str, object]:
        return {
            "model": self.model,
            "context_window_tokens": self.context_window_tokens,
            "prompt_tokens_estimated": self.prompt_tokens_estimated,
            "reserved_completion_tokens": self.reserved_completion_tokens,
            "available_input_tokens": self.available_input_tokens,
            "remaining_context_tokens": self.remaining_context_tokens,
            "usage_ratio": self.usage_ratio,
            "status": self.status,
            "estimation_method": self.estimation_method,
            "precision": self.precision,
            "warnings": self.warnings,
        }


class ContextBudgetExceededError(ValueError):
    def __init__(self, budget: ContextBudget):
        self.budget = budget
        super().__init__(
            f"Chat request exceeds context window for model {budget.model}: "
            f"estimated prompt tokens {budget.prompt_tokens_estimated} plus reserved completion tokens "
            f"{budget.reserved_completion_tokens} exceeds context window {budget.context_window_tokens}."
        )


class ContextBudgetEstimator:
    def __init__(self, process_manager: ProcessManager, config: AppConfig):
        self.process_manager = process_manager
        self.config = config

    def estimate(self, model_name: str, payload: dict[str, object]) -> ContextBudget:
        context_window_tokens = self._context_window_tokens(model_name)
        reserved_completion_tokens = _reserved_completion_tokens(payload)
        prompt_tokens_estimated = _estimate_prompt_tokens(payload)
        available_input_tokens = max(0, context_window_tokens - reserved_completion_tokens)
        remaining_context_tokens = context_window_tokens - reserved_completion_tokens - prompt_tokens_estimated
        used_tokens = prompt_tokens_estimated + reserved_completion_tokens
        usage_ratio = used_tokens / context_window_tokens
        warnings: list[str] = []
        if remaining_context_tokens < 0:
            warnings.append(
                "Estimated prompt tokens plus reserved completion tokens exceed the configured context window."
            )
        return ContextBudget(
            model=model_name,
            context_window_tokens=context_window_tokens,
            prompt_tokens_estimated=prompt_tokens_estimated,
            reserved_completion_tokens=reserved_completion_tokens,
            available_input_tokens=available_input_tokens,
            remaining_context_tokens=remaining_context_tokens,
            usage_ratio=usage_ratio,
            status=_budget_status(usage_ratio, remaining_context_tokens),
            estimation_method="approx_chars_div_4",
            precision="approximate",
            warnings=warnings,
        )

    def require_fits(self, model_name: str, payload: dict[str, object]) -> ContextBudget | None:
        try:
            budget = self.estimate(model_name, payload)
        except KeyError:
            if self.config.mode == "controller":
                return None
            raise
        if budget.remaining_context_tokens < 0:
            raise ContextBudgetExceededError(budget)
        return budget

    def _context_window_tokens(self, model_name: str) -> int:
        try:
            runtime_model = self.process_manager.catalog_service.runtime_model(model_name)
            runtime_ctx = getattr(runtime_model, "ctx", None)
            if isinstance(runtime_ctx, int) and runtime_ctx > 0:
                return runtime_ctx
        except (AttributeError, KeyError):
            runtime_model = None
        configured_model = self.config.models.get(model_name)
        if configured_model is None:
            raise KeyError(f"Unknown model {model_name}")
        return configured_model.ctx


def estimate_prompt_tokens(payload: dict[str, object]) -> int:
    return _estimate_prompt_tokens(payload)


def _reserved_completion_tokens(payload: dict[str, object]) -> int:
    n_predict = payload.get("n_predict")
    if isinstance(n_predict, int) and n_predict > 0:
        return n_predict
    max_tokens = payload.get("max_tokens")
    if isinstance(max_tokens, int) and max_tokens > 0:
        return max_tokens
    return 512


def _estimate_prompt_tokens(payload: dict[str, object]) -> int:
    messages = payload.get("messages")
    if not isinstance(messages, list):
        return 1
    rendered_messages: list[str] = []
    for message in messages:
        if not isinstance(message, dict):
            continue
        role = str(message.get("role", "user"))
        content = message.get("content", "")
        rendered_messages.append(f"{role}: {_content_text(content)}")
    rendered_prompt = "\n".join(rendered_messages).strip()
    if not rendered_prompt:
        return 1
    return max(1, len(rendered_prompt) // 4)


def _content_text(content: object) -> str:
    if isinstance(content, str):
        return content
    if not isinstance(content, list):
        return str(content)
    parts: list[str] = []
    for block in content:
        if not isinstance(block, dict):
            parts.append(str(block))
            continue
        block_type = block.get("type")
        if block_type == "text":
            parts.append(str(block.get("text", "")))
        elif block_type == "image_url":
            parts.append("[image]")
        else:
            parts.append(str(block))
    return " ".join(parts)


def _budget_status(usage_ratio: float, remaining_context_tokens: int) -> ContextBudgetStatus:
    if remaining_context_tokens < 0:
        return "too_large"
    if usage_ratio >= 0.95:
        return "near_limit"
    if usage_ratio >= 0.8:
        return "near_limit"
    if usage_ratio >= 0.6:
        return "getting_full"
    return "comfortable"
