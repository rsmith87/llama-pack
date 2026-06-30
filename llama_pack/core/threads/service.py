from __future__ import annotations

import asyncio
import json
from collections.abc import AsyncIterator
from typing import Any
from uuid import uuid4

from llama_pack.core.chat.internal_payload import TRUSTED_CONTROLLER_TARGET_KEY
from llama_pack.core.config.models import AppConfig
from llama_pack.core.model_lifecycle import ManagedModelLifecycle
from llama_pack.core.plugins.events import EventBus
from llama_pack.core.threads.context import ThreadContextError, ThreadContextManager, event_message
from llama_pack.core.threads.events import ThreadEventPublisher
from llama_pack.core.threads.fanout import ThreadFanoutRunner
from llama_pack.core.threads.routing import ModelArtifactPresence, ModelAvailable, ModelRunning, NodeConfigs, NodeStartupAllowed, RoutingPolicy
from llama_pack.core.threads.store import ThreadStore
from llama_pack.core.threads.turns import (
    ThreadTurnPreparer,
    json_content,
    message_display_text,
    requested_model_name,
)
from llama_pack.core.threads.workflows import ThreadWorkflowRunner


class ThreadChatError(RuntimeError):
    def __init__(self, thread_id: str, error_code: str, message: str) -> None:
        super().__init__(message)
        self.thread_id = thread_id
        self.error_code = error_code


class ThreadService:
    def __init__(
        self,
        config: AppConfig,
        store: ThreadStore,
        chat_proxy: Any,
        model_running: ModelRunning,
        model_available: ModelAvailable | None = None,
        model_artifact_presence: ModelArtifactPresence | None = None,
        node_startup_allowed: NodeStartupAllowed | None = None,
        node_configs: NodeConfigs | None = None,
        event_bus: EventBus | None = None,
    ) -> None:
        self.config = config
        self.store = store
        self.chat_proxy = chat_proxy
        self.routing_policy = RoutingPolicy(
            config,
            model_running,
            model_available=model_available,
            model_artifact_presence=model_artifact_presence,
            node_startup_allowed=node_startup_allowed,
            node_configs=node_configs,
        )
        self._turn_locks: dict[str, asyncio.Lock] = {}
        self._turn_locks_guard = asyncio.Lock()
        self.event_bus = event_bus
        self.event_publisher = ThreadEventPublisher(store, event_bus)
        self.context_manager = ThreadContextManager(config, store, chat_proxy, self.event_publisher)
        self.turn_preparer = ThreadTurnPreparer(store, self.routing_policy, self.context_manager, self.event_publisher)
        self.fanout_runner = ThreadFanoutRunner(chat_proxy, self.event_publisher)
        self.workflow_runner = ThreadWorkflowRunner(
            store,
            self.routing_policy,
            chat_proxy,
            self.event_publisher,
            _managed_model_lifecycle(chat_proxy),
        )

    async def acquire_turn_lock(self, thread_id: str) -> asyncio.Lock:
        async with self._turn_locks_guard:
            lock = self._turn_locks.get(thread_id)
            if lock is None:
                lock = asyncio.Lock()
                self._turn_locks[thread_id] = lock
        await lock.acquire()
        return lock

    def create_thread(
        self,
        title: str | None,
        default_model: str | None,
        metadata: dict[str, Any],
        created_by: str | None,
    ) -> dict[str, Any]:
        return self.store.create_thread(
            title=title,
            default_model=default_model,
            metadata=metadata,
            created_by=created_by,
        )

    async def prepare_compat_chat_async(
        self,
        thread_id: str | None,
        messages: list[dict[str, Any]],
        model: str | None,
        model_family: str | None,
        context_profile: str | None,
        target: str,
        metadata: dict[str, Any] | None,
        created_by: str | None,
    ) -> dict[str, Any]:
        request_metadata = metadata or {}
        if thread_id is None:
            thread = self.create_thread(
                title=self._title_from_messages(messages),
                default_model=model,
                metadata=request_metadata,
                created_by=created_by,
            )
            thread_id = thread["id"]
        else:
            thread = self.store.get_thread(thread_id)
            request_metadata = {**thread.get("metadata", {}), **request_metadata}

        request_type = request_metadata.get("request_type") or "general"
        previous_route = self._previous_route(thread_id, model_family=model_family, context_profile=context_profile)
        user_text = self._latest_user_text(messages)
        turn_id = str(uuid4())
        requested_model = self._requested_model(model, model_family, context_profile)

        await self._append_event_async(
            thread_id=thread_id,
            event_type="user_message",
            role="user",
            content={"text": user_text, "metadata": request_metadata, "messages": messages},
            public=True,
            turn_id=turn_id,
        )
        try:
            self._require_thread_node_target(thread_id, target)
        except ValueError as exc:
            await self._append_error_async(thread_id, "ROUTING_ERROR", exc, turn_id=turn_id)
            raise ThreadChatError(thread_id, "ROUTING_ERROR", str(exc)) from exc

        try:
            decision = await self.routing_policy.choose(
                request_type=request_type,
                requested_model=requested_model or thread.get("default_model"),
                explicit_target=target,
                previous_route=previous_route,
            )
        except ValueError as exc:
            await self._append_error_async(thread_id, "ROUTING_ERROR", exc, turn_id=turn_id)
            raise ThreadChatError(thread_id, "ROUTING_ERROR", str(exc)) from exc

        route = {
            "node": decision.node,
            "model": decision.model,
            "family": model_family,
            "profile": context_profile,
            "strategy": decision.strategy,
            "reason": decision.reason,
        }
        await self._append_event_async(
            thread_id=thread_id,
            event_type="routing_decision",
            role=None,
            content={**route, "candidates": list(decision.candidates)},
            public=False,
            turn_id=turn_id,
            route=route,
            agent_node=decision.node,
            model=decision.model,
        )
        managed_messages = await self._managed_thread_messages(
            thread_id=thread_id,
            turn_id=turn_id,
            messages=self._public_messages(thread_id),
            model=decision.model,
            route=route,
        )
        return {
            "thread_id": thread_id,
            "model": decision.model,
            "target": f"node:{decision.node}",
            "route": route,
            "messages": managed_messages["messages"],
            "context_management": managed_messages["metadata"],
        }

    async def preview_compat_chat_async(
        self,
        thread_id: str | None,
        messages: list[dict[str, Any]],
        model: str | None,
        model_family: str | None,
        context_profile: str | None,
        target: str,
        metadata: dict[str, Any] | None,
    ) -> dict[str, Any]:
        request_metadata = metadata or {}
        thread: dict[str, Any] | None = None
        if thread_id is not None:
            thread = self.store.get_thread(thread_id)
            request_metadata = {**thread.get("metadata", {}), **request_metadata}

        request_type = request_metadata.get("request_type") or "general"
        previous_route = self._previous_route(thread_id, model_family=model_family, context_profile=context_profile) if thread_id else None
        requested_model = self._requested_model(model, model_family, context_profile)
        try:
            decision = await self.routing_policy.choose(
                request_type=request_type,
                requested_model=requested_model or (thread.get("default_model") if thread else None),
                explicit_target=target,
                previous_route=previous_route,
            )
        except ValueError as exc:
            raise ThreadChatError(thread_id or "", "ROUTING_ERROR", str(exc)) from exc

        route = {
            "node": decision.node,
            "model": decision.model,
            "family": model_family,
            "profile": context_profile,
            "strategy": decision.strategy,
            "reason": decision.reason,
        }
        history_messages = self._preview_thread_messages(thread_id, messages, decision.model) if thread_id else list(messages)
        return {
            "thread_id": thread_id,
            "model": decision.model,
            "target": f"node:{decision.node}",
            "route": route,
            "messages": history_messages,
        }

    def record_compat_assistant(
        self,
        thread_id: str,
        assistant_content: str,
        raw_response: dict[str, Any],
        response_meta: dict[str, Any],
        route: dict[str, Any],
    ) -> None:
        self.store.append_event(
            thread_id=thread_id,
            event_type="assistant_message",
            role="assistant",
            content={
                "text": assistant_content,
                "raw_response": raw_response,
                "response_meta": response_meta,
            },
            public=True,
            route=route,
            agent_node=route["node"],
            model=route["model"],
        )

    def record_compat_error(self, thread_id: str, exc: Exception) -> None:
        self._append_error(thread_id, "CHAT_PROXY_ERROR", exc)

    def list_events(self, thread_id: str, include_internal: bool = False) -> list[dict[str, Any]]:
        self.store.get_thread(thread_id)
        return self.store.list_events(thread_id, include_internal=include_internal)

    async def _append_event_async(
        self,
        *,
        thread_id: str,
        event_type: str,
        role: str | None,
        content: dict[str, Any],
        public: bool,
        turn_id: str | None = None,
        route: dict[str, Any] | None = None,
        agent_node: str | None = None,
        model: str | None = None,
        error_code: str | None = None,
        error_detail: str | None = None,
    ) -> dict[str, Any]:
        return await self.event_publisher.append_event(
            thread_id=thread_id,
            event_type=event_type,
            role=role,
            content=content,
            public=public,
            turn_id=turn_id,
            route=route,
            agent_node=agent_node,
            model=model,
            error_code=error_code,
            error_detail=error_detail,
        )

    async def _publish_thread_event(self, event: dict[str, Any]) -> None:
        await self.event_publisher.publish(event)

    async def compact_thread_async(
        self,
        thread_id: str,
        model: str | None,
        model_family: str | None,
        context_profile: str | None,
        target: str,
        recent_message_count: int | None,
    ) -> dict[str, Any]:
        thread = self.store.get_thread(thread_id)
        request_metadata = thread.get("metadata", {})
        request_type = request_metadata.get("request_type") or "general"
        previous_route = self._previous_route(thread_id, model_family=model_family, context_profile=context_profile)
        requested_model = self._requested_model(model, model_family, context_profile)
        try:
            self._require_thread_node_target(thread_id, target)
            decision = await self.routing_policy.choose(
                request_type=request_type,
                requested_model=requested_model or thread.get("default_model"),
                explicit_target=target,
                previous_route=previous_route,
            )
        except ValueError as exc:
            await self._append_error_async(thread_id, "ROUTING_ERROR", exc)
            raise

        route = {
            "node": decision.node,
            "model": decision.model,
            "family": model_family,
            "profile": context_profile,
            "strategy": decision.strategy,
            "reason": decision.reason,
        }
        await self._append_event_async(
            thread_id=thread_id,
            event_type="routing_decision",
            role=None,
            content={**route, "candidates": list(decision.candidates), "purpose": "manual_context_compaction"},
            public=False,
            route=route,
            agent_node=decision.node,
            model=decision.model,
        )
        compacted = await self._compact_thread_history(
            thread_id=thread_id,
            turn_id=None,
            model=decision.model,
            route=route,
            recent_message_count=recent_message_count or self.config.context_summarization_recent_messages,
            source="manual",
        )
        return {
            **compacted["metadata"],
            "messages": compacted["messages"],
            "route": route,
        }

    def post_message(
        self,
        thread_id: str,
        role: str,
        content: Any,
        model: str | None,
        target: str,
        metadata: dict[str, Any] | None,
        model_family: str | None = None,
        context_profile: str | None = None,
    ) -> dict[str, Any]:
        return asyncio.run(
            self.post_message_async(
                thread_id=thread_id,
                role=role,
                content=content,
                model=model,
                model_family=model_family,
                context_profile=context_profile,
                target=target,
                metadata=metadata,
            )
        )

    async def _prepare_message_route(
        self,
        thread_id: str,
        role: str,
        content: Any,
        model: str | None,
        model_family: str | None,
        context_profile: str | None,
        target: str,
        metadata: dict[str, Any] | None,
    ) -> dict[str, Any]:
        try:
            prepared = await self.turn_preparer.prepare_message_route(
                thread_id=thread_id,
                role=role,
                content=content,
                model=model,
                model_family=model_family,
                context_profile=context_profile,
                target=target,
                metadata=metadata,
            )
        except ThreadContextError as exc:
            raise ThreadChatError(exc.thread_id, exc.error_code, str(exc)) from exc
        return prepared.as_legacy_dict()

    async def post_message_async(
        self,
        thread_id: str,
        role: str,
        content: Any,
        model: str | None,
        target: str,
        metadata: dict[str, Any] | None,
        model_family: str | None = None,
        context_profile: str | None = None,
        generation_payload: dict[str, object] | None = None,
        document_context_messages: list[dict[str, Any]] | None = None,
        document_citations: list[dict[str, object]] | None = None,
    ) -> dict[str, Any]:
        prepared = await self._prepare_message_route(
            thread_id=thread_id,
            role=role,
            content=content,
            model=model,
            model_family=model_family,
            context_profile=context_profile,
            target=target,
            metadata=metadata,
        )
        messages = [
            *(document_context_messages or []),
            *prepared["messages"],
        ]
        turn_id = prepared["turn_id"]
        route = prepared["route"]
        decision = prepared["decision"]

        if decision.fanout_targets:
            return await self.fanout_runner.post_message_fanout(
                thread_id=thread_id,
                turn_id=turn_id,
                messages=messages,
                primary=decision,
                route=route,
            )

        try:
            raw_response, response_meta = await self.chat_proxy.chat_with_meta(
                decision.model,
                {
                    "messages": messages,
                    **(generation_payload or {}),
                    "target": f"node:{decision.node}",
                    TRUSTED_CONTROLLER_TARGET_KEY: True,
                    **self._profile_payload(prepared),
                },
            )
            assistant_content = raw_response["choices"][0]["message"]["content"]
        except Exception as exc:
            await self._append_error_async(thread_id, "CHAT_PROXY_ERROR", exc, turn_id=turn_id)
            raise

        await self._append_event_async(
            thread_id=thread_id,
            event_type="assistant_message",
            role="assistant",
            content={
                "text": assistant_content,
                "raw_response": raw_response,
                "response_meta": response_meta,
                **({"document_citations": document_citations} if document_citations else {}),
            },
            public=True,
            turn_id=turn_id,
            route=route,
            agent_node=decision.node,
            model=decision.model,
        )

        return {
            "thread_id": thread_id,
            "message": {"role": "assistant", "content": assistant_content},
            "route": route,
            "context_management": prepared["context_management"],
        }

    async def stream_message_async(
        self,
        thread_id: str,
        role: str,
        content: Any,
        model: str | None,
        target: str,
        metadata: dict[str, Any] | None,
        model_family: str | None = None,
        context_profile: str | None = None,
        generation_payload: dict[str, object] | None = None,
        document_context_messages: list[dict[str, Any]] | None = None,
        document_citations: list[dict[str, object]] | None = None,
    ) -> tuple[AsyncIterator[bytes], dict[str, Any]]:
        """Route a user message and return an SSE stream plus the route dict.

        The stream emits:
          1. A ``{"type":"route","route":{...}}`` event.
          2. Raw upstream SSE token chunks (reasoning and content deltas).
          3. ``data: [DONE]`` if the upstream did not already emit it.

        Persistence mirrors ``post_message_async``: user event, routing decision
        (internal), and final assistant_message event are all appended to the
        thread store.  On upstream error after routing, a public CHAT_PROXY_ERROR
        event is appended and an SSE error payload is emitted before ``[DONE]``.
        """
        prepared = await self._prepare_message_route(
            thread_id=thread_id,
            role=role,
            content=content,
            model=model,
            model_family=model_family,
            context_profile=context_profile,
            target=target,
            metadata=metadata,
        )
        messages = [
            *(document_context_messages or []),
            *prepared["messages"],
        ]
        turn_id = prepared["turn_id"]
        route = prepared["route"]
        decision = prepared["decision"]

        upstream_stream: AsyncIterator[bytes]
        try:
            upstream_stream, _ = await self.chat_proxy.stream_with_meta(
                decision.model,
                {
                    "messages": messages,
                    **(generation_payload or {}),
                    "target": f"node:{decision.node}",
                    TRUSTED_CONTROLLER_TARGET_KEY: True,
                    **self._profile_payload(prepared),
                },
            )
        except Exception as exc:
            await self._append_error_async(thread_id, "CHAT_PROXY_ERROR", exc, turn_id=turn_id)
            raise

        async def _generate() -> AsyncIterator[bytes]:
            route_event = json.dumps({"type": "route", "route": route})
            yield f"data: {route_event}\n\n".encode()
            if prepared["context_management"] is not None:
                context_event = json.dumps({"type": "context_management", **prepared["context_management"]})
                yield f"data: {context_event}\n\n".encode()
            if document_citations:
                citation_event = json.dumps({"type": "document_citations", "citations": document_citations})
                yield f"data: {citation_event}\n\n".encode()

            assistant_content = ""
            reasoning_content = ""
            saw_done = False

            try:
                async for chunk in upstream_stream:
                    text = chunk.decode("utf-8", errors="replace")
                    for line in text.splitlines(keepends=True):
                        if line.strip() == "data: [DONE]":
                            saw_done = True
                        elif line.startswith("data:"):
                            raw = line[5:].strip()
                            if raw:
                                try:
                                    parsed = json.loads(raw)
                                    choice = (parsed.get("choices") or [{}])[0]
                                    delta = choice.get("delta") or {}
                                    assistant_content += delta.get("content") or ""
                                    reasoning_content += (
                                        delta.get("reasoning_content") or delta.get("reasoning") or ""
                                    )
                                except (json.JSONDecodeError, IndexError, KeyError):
                                    pass
                    yield chunk
            except Exception as exc:
                await self._append_error_async(thread_id, "CHAT_PROXY_ERROR", exc, turn_id=turn_id)
                err_event = json.dumps({"type": "error", "error": str(exc)})
                yield f"data: {err_event}\n\n".encode()
                yield b"data: [DONE]\n\n"
                return

            await self._append_event_async(
                thread_id=thread_id,
                event_type="assistant_message",
                role="assistant",
                content={
                    "text": assistant_content,
                    "reasoning_text": reasoning_content,
                    "response_meta": {},
                    **({"document_citations": document_citations} if document_citations else {}),
                },
                public=True,
                turn_id=turn_id,
                route=route,
                agent_node=decision.node,
                model=decision.model,
            )

            if not saw_done:
                yield b"data: [DONE]\n\n"

        return _generate(), route
    def _requested_model(self, model: str | None, model_family: str | None, context_profile: str | None) -> str | None:
        return requested_model_name(model, model_family, context_profile)

    def _profile_payload(self, prepared: dict[str, Any]) -> dict[str, str]:
        payload: dict[str, str] = {}
        model_family = prepared.get("model_family")
        context_profile = prepared.get("context_profile")
        if isinstance(model_family, str) and model_family:
            payload["model_family"] = model_family
        if isinstance(context_profile, str) and context_profile:
            payload["context_profile"] = context_profile
        return payload

    def _message_display_text(self, content: Any) -> str:
        return message_display_text(content)

    def _json_content(self, content: Any) -> Any:
        return json_content(content)

    def _previous_route(
        self,
        thread_id: str,
        model_family: str | None = None,
        context_profile: str | None = None,
    ) -> dict[str, Any] | None:
        return self.turn_preparer.previous_route(
            thread_id,
            model_family=model_family,
            context_profile=context_profile,
        )

    def _assigned_node(self, thread_id: str) -> str | None:
        return self.turn_preparer.assigned_node(thread_id)

    def _require_thread_node_target(self, thread_id: str, target: str) -> None:
        self.turn_preparer.require_thread_node_target(thread_id, target)

    def _public_messages(self, thread_id: str) -> list[dict[str, str]]:
        return self.context_manager.public_messages(thread_id)

    def _public_message_events(self, thread_id: str) -> list[dict[str, Any]]:
        return self.context_manager.public_message_events(thread_id)

    def _event_message(self, event: dict[str, Any]) -> dict[str, str]:
        return event_message(event)

    def _latest_history_summary(self, thread_id: str) -> dict[str, Any] | None:
        return self.context_manager.latest_history_summary(thread_id)

    def _preview_thread_messages(
        self,
        thread_id: str,
        incoming_messages: list[dict[str, Any]],
        model: str,
    ) -> list[dict[str, Any]]:
        return self.context_manager.preview_thread_messages(thread_id, incoming_messages, model)

    async def _managed_thread_messages(
        self,
        thread_id: str,
        turn_id: str,
        messages: list[dict[str, Any]],
        model: str,
        route: dict[str, Any],
    ) -> dict[str, Any]:
        try:
            return await self.context_manager.managed_thread_messages(
                thread_id=thread_id,
                turn_id=turn_id,
                messages=messages,
                model=model,
                route=route,
            )
        except ThreadContextError as exc:
            raise ThreadChatError(exc.thread_id, exc.error_code, str(exc)) from exc

    async def _compact_thread_history(
        self,
        thread_id: str,
        turn_id: str | None,
        model: str,
        route: dict[str, Any],
        recent_message_count: int,
        source: str,
    ) -> dict[str, Any]:
        try:
            return await self.context_manager.compact_thread_history(
                thread_id=thread_id,
                turn_id=turn_id,
                model=model,
                route=route,
                recent_message_count=recent_message_count,
                source=source,
            )
        except ThreadContextError as exc:
            raise ThreadChatError(exc.thread_id, exc.error_code, str(exc)) from exc

    def _history_prompt_token_budget(self, model: str) -> int:
        try:
            context_window = self.config.effective_model_config(model).ctx
        except KeyError:
            return self.config.thread_history_min_prompt_tokens
        ratio_budget = int(context_window * self.config.thread_history_context_ratio)
        return min(self.config.thread_history_min_prompt_tokens, ratio_budget)

    def _append_error(self, thread_id: str, error_code: str, exc: Exception, turn_id: str | None = None) -> None:
        self.event_publisher.append_error(thread_id, error_code, exc, turn_id)

    async def _append_error_async(self, thread_id: str, error_code: str, exc: Exception, turn_id: str | None = None) -> None:
        await self.event_publisher.append_error_async(thread_id, error_code, exc, turn_id)

    def _latest_user_text(self, messages: list[dict[str, Any]]) -> str:
        for message in reversed(messages):
            if message.get("role") != "user":
                continue
            content = message.get("content")
            if isinstance(content, str):
                return content
            return str(content)
        return ""

    def _title_from_messages(self, messages: list[dict[str, Any]]) -> str | None:
        text = self._latest_user_text(messages).strip()
        if not text:
            return None
        return text[:80]

    async def run_workflow_async(
        self,
        thread_id: str,
        content: str,
        steps: list[Any],
        model: str | None,
        target: str,
        metadata: dict[str, Any] | None,
    ) -> dict[str, Any]:
        return await self.workflow_runner.run_workflow(
            thread_id=thread_id,
            content=content,
            steps=steps,
            model=model,
            target=target,
            metadata=metadata,
        )


def _managed_model_lifecycle(chat_proxy: Any) -> ManagedModelLifecycle | None:
    node_registry = getattr(chat_proxy, "node_registry", None)
    if node_registry is None:
        wrapped_proxy = getattr(chat_proxy, "proxy", None)
        node_registry = getattr(wrapped_proxy, "node_registry", None)
    if node_registry is None:
        return None
    return ManagedModelLifecycle(node_registry, 120.0)
