from __future__ import annotations

from typing import Any


class PromptBuilder:
    def build_agent_messages(self, messages: list[dict[str, Any]], *, project_graph_enabled: bool) -> list[dict[str, Any]]:
        built = [dict(message) for message in messages]
        if project_graph_enabled:
            built.insert(
                0,
                {
                    "role": "system",
                    "content": (
                        "Project code graph tools are available for this chat. Use them to inspect indexed symbols, "
                        "relationships, routes, and React components before making codebase claims.\n\n"
                        "For runtime trace answers, every call-path edge must be backed by direct source evidence. "
                        "For each edge use this exact format: from_symbol=... to_symbol=... file=... statement='...'. "
                        "Answers without this exact edge evidence are unverified. "
                        "If a handoff is inferred but no direct source statement verifies it, mark that edge "
                        "unverified instead of presenting it as fact."
                    ),
                },
            )
        previous_answer = _previous_assistant_answer(built)
        if previous_answer and _latest_user_references_previous_answer(built):
            built.insert(
                len(built) - 1,
                {
                    "role": "system",
                    "content": (
                        "The user is referring to the previous assistant answer. Review this exact answer, not conversational memory:\n\n"
                        f"<previous_assistant_answer>\n{previous_answer}\n</previous_assistant_answer>"
                    ),
                },
            )
        return built


def _previous_assistant_answer(messages: list[dict[str, Any]]) -> str | None:
    for message in reversed(messages[:-1]):
        if message.get("role") != "assistant":
            continue
        content = message.get("content")
        if isinstance(content, str) and content.strip():
            return content
    return None


def _latest_user_references_previous_answer(messages: list[dict[str, Any]]) -> bool:
    if not messages:
        return False
    latest = messages[-1]
    if latest.get("role") != "user":
        return False
    content = latest.get("content")
    if not isinstance(content, str):
        return False
    normalized = " ".join(content.lower().split())
    previous_terms = ("previous answer", "last answer", "your previous", "your last", "that answer")
    review_terms = ("review", "verify", "correct", "check", "unsupported", "fix")
    return any(term in normalized for term in previous_terms) and any(term in normalized for term in review_terms)
