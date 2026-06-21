from __future__ import annotations

from typing import Any

from llama_pack.core.chat.context_budget import estimate_prompt_tokens
from llama_pack.core.config.models import AppConfig


def should_summarize_messages(config: AppConfig, model: str, messages: list[dict[str, Any]]) -> bool:
    if not config.context_summarization_enabled or not config.thread_history_compaction_enabled:
        return False
    context_window = context_window_tokens(config, model)
    prompt_tokens = estimate_prompt_tokens({"messages": messages})
    return prompt_tokens >= int(context_window * config.context_summarization_trigger_ratio)


def context_window_tokens(config: AppConfig, model: str) -> int:
    try:
        return config.effective_model_config(model).ctx
    except KeyError:
        return config.thread_history_min_prompt_tokens


def summary_prompt_messages(previous_summary: str | None, messages: list[dict[str, Any]]) -> list[dict[str, Any]]:
    prior_summary = previous_summary.strip() if isinstance(previous_summary, str) else ""
    transcript = _render_transcript(messages)
    instructions = (
        "Summarize the earlier conversation for continuation in a long-running chat. "
        "Preserve user goals, constraints, decisions, named entities, unresolved tasks, and important assistant answers. "
        "Do not invent details. Do not include pleasantries. Write compact bullet points."
    )
    if prior_summary:
        instructions = f"{instructions}\n\nExisting summary to update:\n{prior_summary}"
    return [
        {"role": "system", "content": instructions},
        {"role": "user", "content": f"Conversation turns to summarize:\n\n{transcript}"},
    ]


def summary_system_message(summary: str) -> dict[str, str]:
    return {"role": "system", "content": f"Earlier conversation summary:\n{summary.strip()}"}


def assistant_summary_content(response: dict[str, Any]) -> str:
    try:
        content = response["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as exc:
        raise ValueError(f"Summary response did not include choices[0].message.content: {response!r}") from exc
    if not isinstance(content, str) or not content.strip():
        raise ValueError(f"Summary response content was empty or not a string: {response!r}")
    return content.strip()


def context_management_metadata(
    summary_event_id: str,
    prompt_tokens_before: int,
    prompt_tokens_after: int,
) -> dict[str, Any]:
    return {
        "summarized": True,
        "summary_event_id": summary_event_id,
        "prompt_tokens_before": prompt_tokens_before,
        "prompt_tokens_after": prompt_tokens_after,
    }


def _render_transcript(messages: list[dict[str, Any]]) -> str:
    lines: list[str] = []
    for message in messages:
        role = str(message.get("role", "user"))
        content = message.get("content", "")
        lines.append(f"{role}: {_content_text(content)}")
    return "\n\n".join(lines)


def _content_text(content: Any) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for block in content:
            if isinstance(block, dict) and block.get("type") == "text":
                parts.append(str(block.get("text", "")))
            else:
                parts.append(str(block))
        return " ".join(parts)
    return str(content)
