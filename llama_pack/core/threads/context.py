from __future__ import annotations

from typing import Any

from llama_pack.core.chat.context_budget import estimate_prompt_tokens
from llama_pack.core.chat.context_management import (
    assistant_summary_content,
    context_management_metadata,
    should_summarize_messages,
    summary_prompt_messages,
    summary_system_message,
)
from llama_pack.core.chat.internal_payload import SKIP_CONTEXT_MANAGEMENT_KEY, TRUSTED_CONTROLLER_TARGET_KEY
from llama_pack.core.config.models import AppConfig
from llama_pack.core.threads.events import ThreadEventPublisher
from llama_pack.core.threads.store import ThreadStore


class ThreadContextError(RuntimeError):
    def __init__(self, thread_id: str, error_code: str, message: str) -> None:
        super().__init__(message)
        self.thread_id = thread_id
        self.error_code = error_code


class ThreadContextManager:
    def __init__(
        self,
        config: AppConfig,
        store: ThreadStore,
        chat_proxy: Any,
        event_publisher: ThreadEventPublisher,
    ) -> None:
        self.config = config
        self.store = store
        self.chat_proxy = chat_proxy
        self.event_publisher = event_publisher

    def public_messages(self, thread_id: str) -> list[dict[str, str]]:
        messages = []
        for event in self.public_message_events(thread_id):
            messages.append(event_message(event))
        return messages

    def public_message_events(self, thread_id: str) -> list[dict[str, Any]]:
        events: list[dict[str, Any]] = []
        for event in self.store.list_events(thread_id, include_internal=False):
            if event["event_type"] not in {"user_message", "assistant_message"}:
                continue
            text = event["content"].get("text")
            role = event.get("role")
            if isinstance(text, str) and role in {"user", "assistant"}:
                events.append(event)
        return events

    def latest_history_summary(self, thread_id: str) -> dict[str, Any] | None:
        for event in reversed(self.store.list_events(thread_id, include_internal=True)):
            if event["event_type"] != "history_summary":
                continue
            content = event.get("content") or {}
            summary = content.get("summary")
            covered_event_ids = content.get("covered_event_ids")
            if isinstance(summary, str) and isinstance(covered_event_ids, list):
                return {"summary": summary, "covered_event_ids": [str(item) for item in covered_event_ids]}
        return None

    def preview_thread_messages(
        self,
        thread_id: str,
        incoming_messages: list[dict[str, Any]],
        model: str,
    ) -> list[dict[str, Any]]:
        public_events = self.public_message_events(thread_id)
        latest_summary = self.latest_history_summary(thread_id)
        covered_event_ids = list(latest_summary.get("covered_event_ids", [])) if latest_summary else []
        covered_event_id_set = set(covered_event_ids)
        unsummarized_events = [event for event in public_events if event["id"] not in covered_event_id_set]
        messages = [event_message(event) for event in unsummarized_events]
        previous_summary = str(latest_summary.get("summary", "")) if latest_summary else None
        if previous_summary:
            messages = [summary_system_message(previous_summary), *messages]
        messages = [*messages, *incoming_messages]
        if not should_summarize_messages(self.config, model, messages):
            return messages
        recent_message_count = self.config.context_summarization_recent_messages
        return [
            summary_system_message(previous_summary or "A summary will be generated before the next model response."),
            *messages[-recent_message_count:],
        ]

    async def managed_thread_messages(
        self,
        thread_id: str,
        turn_id: str,
        messages: list[dict[str, Any]],
        model: str,
        route: dict[str, Any],
    ) -> dict[str, Any]:
        if not self.config.context_summarization_enabled:
            return {"messages": list(messages), "metadata": None}

        public_events = self.public_message_events(thread_id)
        if not public_events:
            return {"messages": list(messages), "metadata": None}

        latest_summary = self.latest_history_summary(thread_id)
        covered_event_ids = list(latest_summary.get("covered_event_ids", [])) if latest_summary else []
        covered_event_id_set = set(covered_event_ids)
        unsummarized_events = [event for event in public_events if event["id"] not in covered_event_id_set]
        previous_summary = str(latest_summary.get("summary", "")) if latest_summary else None
        current_messages = [event_message(event) for event in unsummarized_events]
        if previous_summary:
            current_messages = [summary_system_message(previous_summary), *current_messages]

        if not should_summarize_messages(self.config, model, current_messages):
            return {"messages": current_messages, "metadata": None}

        return await self.compact_thread_history(
            thread_id=thread_id,
            turn_id=turn_id,
            model=model,
            route=route,
            recent_message_count=self.config.context_summarization_recent_messages,
            source="auto",
        )

    async def compact_thread_history(
        self,
        thread_id: str,
        turn_id: str | None,
        model: str,
        route: dict[str, Any],
        recent_message_count: int,
        source: str,
    ) -> dict[str, Any]:
        public_events = self.public_message_events(thread_id)
        latest_summary = self.latest_history_summary(thread_id)
        covered_event_ids = list(latest_summary.get("covered_event_ids", [])) if latest_summary else []
        covered_event_id_set = set(covered_event_ids)
        unsummarized_events = [event for event in public_events if event["id"] not in covered_event_id_set]
        previous_summary = str(latest_summary.get("summary", "")) if latest_summary else None
        current_messages = [event_message(event) for event in unsummarized_events]
        if previous_summary:
            current_messages = [summary_system_message(previous_summary), *current_messages]
        if len(unsummarized_events) <= recent_message_count:
            return {
                "messages": current_messages,
                "metadata": {
                    "summarized": False,
                    "reason": "not_enough_unsummarized_events",
                    "unsummarized_event_count": len(unsummarized_events),
                },
            }

        events_to_summarize = unsummarized_events[:-recent_message_count]
        recent_events = unsummarized_events[-recent_message_count:]
        messages_to_summarize = [event_message(event) for event in events_to_summarize]
        prompt_tokens_before = estimate_prompt_tokens({"messages": current_messages})
        summary_payload = {
            "messages": summary_prompt_messages(previous_summary, messages_to_summarize),
            "temperature": 0.0,
            "max_tokens": self.config.context_summarization_max_tokens,
            "target": f"node:{route['node']}",
            TRUSTED_CONTROLLER_TARGET_KEY: True,
            SKIP_CONTEXT_MANAGEMENT_KEY: True,
        }
        try:
            response, response_meta = await self.chat_proxy.chat_with_meta(model, summary_payload)
            summary = assistant_summary_content(response)
        except Exception as exc:
            await self.event_publisher.append_error_async(thread_id, "CONTEXT_SUMMARY_ERROR", exc, turn_id)
            raise ThreadContextError(
                thread_id,
                "CONTEXT_SUMMARY_ERROR",
                f"Failed to summarize thread {thread_id} for model {model}: {exc}",
            ) from exc

        all_covered_event_ids = [*covered_event_ids, *[event["id"] for event in events_to_summarize]]
        compacted_messages = [summary_system_message(summary), *[event_message(event) for event in recent_events]]
        prompt_tokens_after = estimate_prompt_tokens({"messages": compacted_messages})
        summary_event = await self.event_publisher.append_event(
            thread_id=thread_id,
            event_type="history_summary",
            role=None,
            content={
                "summary": summary,
                "covered_event_ids": all_covered_event_ids,
                "source_event_ids": [event["id"] for event in events_to_summarize],
                "prompt_tokens_before": prompt_tokens_before,
                "prompt_tokens_after": prompt_tokens_after,
                "summary_tokens_estimated": estimate_prompt_tokens({"messages": [summary_system_message(summary)]}),
                "summary_model": model,
                "model": model,
                "route": route,
                "response_meta": response_meta,
                "source": source,
            },
            public=False,
            turn_id=turn_id,
            route=route,
            agent_node=route["node"],
            model=model,
            error_code=None,
            error_detail=None,
        )
        return {
            "messages": compacted_messages,
            "metadata": {
                **context_management_metadata(
                    summary_event_id=summary_event["id"],
                    prompt_tokens_before=prompt_tokens_before,
                    prompt_tokens_after=prompt_tokens_after,
                ),
                "summary": summary,
                "covered_event_count": len(events_to_summarize),
            },
        }


def event_message(event: dict[str, Any]) -> dict[str, str]:
    return {"role": str(event["role"]), "content": str(event["content"]["text"])}
