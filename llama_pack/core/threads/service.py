from __future__ import annotations

import asyncio
import json
from collections.abc import AsyncIterator
from typing import Any
from uuid import uuid4

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
from llama_pack.core.plugins.events import EventBus
from llama_pack.core.threads.routing import ModelArtifactPresence, ModelAvailable, ModelRunning, NodeStartupAllowed, RoutingPolicy
from llama_pack.core.threads.store import ThreadStore


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
        )
        self._turn_locks: dict[str, asyncio.Lock] = {}
        self._turn_locks_guard = asyncio.Lock()
        self.event_bus = event_bus

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
        event = self.store.append_event(
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
        await self._publish_thread_event(event)
        return event

    async def _publish_thread_event(self, event: dict[str, Any]) -> None:
        if self.event_bus is None:
            return
        await self.event_bus.emit(
            _plugin_thread_event_type(str(event["event_type"]), event.get("content")),
            payload=_plugin_thread_event_payload(event),
            correlation_id=str(event.get("turn_id") or event["id"]),
        )

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
        """Shared first half of a thread message turn: validate, load thread, build
        history, append user event, choose route, append routing event.

        Returns a dict with keys: thread, request_metadata, messages, turn_id, route, decision.
        Raises ValueError (ROUTING_ERROR) and re-appends the public error event on failure.
        """
        if role != "user":
            raise ValueError("ThreadService only accepts user messages")

        thread = self.store.get_thread(thread_id)
        request_metadata = {**thread.get("metadata", {}), **(metadata or {})}
        request_type = request_metadata.get("request_type") or "general"
        previous_route = self._previous_route(thread_id, model_family=model_family, context_profile=context_profile)
        requested_model = self._requested_model(model, model_family, context_profile)
        display_text = self._message_display_text(content)
        messages = [
            *self._public_messages(thread_id),
            {"role": "user", "content": content},
        ]
        turn_id = str(uuid4())

        await self._append_event_async(
            thread_id=thread_id,
            event_type="user_message",
            role="user",
            content={"text": display_text, "request_content": self._json_content(content), "metadata": request_metadata},
            public=True,
            turn_id=turn_id,
        )
        try:
            self._require_thread_node_target(thread_id, target)
        except ValueError as exc:
            await self._append_error_async(thread_id, "ROUTING_ERROR", exc, turn_id=turn_id)
            raise

        try:
            decision = await self.routing_policy.choose(
                request_type=request_type,
                requested_model=requested_model or thread.get("default_model"),
                explicit_target=target,
                previous_route=previous_route,
            )
        except ValueError as exc:
            await self._append_error_async(thread_id, "ROUTING_ERROR", exc, turn_id=turn_id)
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
            messages=messages,
            model=decision.model,
            route=route,
        )

        return {
            "thread": thread,
            "request_metadata": request_metadata,
            "messages": managed_messages["messages"],
            "turn_id": turn_id,
            "route": route,
            "decision": decision,
            "model_family": model_family,
            "context_profile": context_profile,
            "context_management": managed_messages["metadata"],
        }

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
        messages = prepared["messages"]
        turn_id = prepared["turn_id"]
        route = prepared["route"]
        decision = prepared["decision"]

        if decision.fanout_targets:
            return await self._post_message_fanout(
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
        messages = prepared["messages"]
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

    async def _post_message_fanout(
        self,
        thread_id: str,
        turn_id: str,
        messages: list[dict[str, Any]],
        primary: Any,
        route: dict[str, Any],
    ) -> dict[str, Any]:
        all_targets = [primary, *primary.fanout_targets]
        agent_outputs: list[dict[str, Any]] = []

        for target in all_targets:
            target_route = {
                "node": target.node,
                "model": target.model,
                "strategy": target.strategy,
                "reason": target.reason,
            }
            await self._append_event_async(
                thread_id=thread_id,
                event_type="agent_request",
                role=None,
                content={"node": target.node, "model": target.model, "messages": messages},
                public=False,
                turn_id=turn_id,
                agent_node=target.node,
                model=target.model,
            )
            try:
                raw_response, response_meta = await self.chat_proxy.chat_with_meta(
                    target.model,
                    {"messages": messages, "target": f"node:{target.node}", TRUSTED_CONTROLLER_TARGET_KEY: True},
                )
                content = raw_response["choices"][0]["message"]["content"]
                await self._append_event_async(
                    thread_id=thread_id,
                    event_type="agent_response",
                    role=None,
                    content={"text": content},
                    public=False,
                    turn_id=turn_id,
                    route=target_route,
                    agent_node=target.node,
                    model=target.model,
                )
                agent_outputs.append({"node": target.node, "model": target.model, "content": content})
            except Exception as exc:
                await self._append_event_async(
                    thread_id=thread_id,
                    event_type="agent_response",
                    role=None,
                    content={"text": f"[error: {exc}]"},
                    public=False,
                    turn_id=turn_id,
                    route=target_route,
                    agent_node=target.node,
                    model=target.model,
                )
                agent_outputs.append({"node": target.node, "model": target.model, "error": str(exc)})

        await self._append_event_async(
            thread_id=thread_id,
            event_type="aggregation",
            role=None,
            content={"outputs": agent_outputs},
            public=False,
            turn_id=turn_id,
        )

        successful = [o["content"] for o in agent_outputs if "content" in o]
        aggregated = "\n\n---\n\n".join(successful) if successful else "[no successful agent responses]"

        await self._append_event_async(
            thread_id=thread_id,
            event_type="assistant_message",
            role="assistant",
            content={"text": aggregated},
            public=True,
            turn_id=turn_id,
            route=route,
            agent_node=primary.node,
            model=primary.model,
        )

        return {
            "thread_id": thread_id,
            "message": {"role": "assistant", "content": aggregated},
            "route": route,
        }

    def _requested_model(self, model: str | None, model_family: str | None, context_profile: str | None) -> str | None:
        if model_family and context_profile:
            return f"{model_family}:{context_profile}"
        return model

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
        if isinstance(content, str):
            return content
        if isinstance(content, list):
            text_parts: list[str] = []
            for block in content:
                block_payload = self._json_content(block)
                if isinstance(block_payload, dict) and block_payload.get("type") == "text":
                    text = block_payload.get("text")
                    if isinstance(text, str):
                        text_parts.append(text)
            return "\n".join(text_parts)
        return str(content)

    def _json_content(self, content: Any) -> Any:
        if hasattr(content, "model_dump"):
            return content.model_dump()
        if isinstance(content, list):
            return [self._json_content(item) for item in content]
        return content

    def _previous_route(
        self,
        thread_id: str,
        model_family: str | None = None,
        context_profile: str | None = None,
    ) -> dict[str, Any] | None:
        for event in reversed(self.store.list_events(thread_id, include_internal=True)):
            if event["event_type"] != "assistant_message":
                continue
            if event.get("agent_node") and event.get("model"):
                route = event.get("route") or {}
                if model_family or context_profile:
                    if route.get("family") != model_family or route.get("profile") != context_profile:
                        continue
                return {"node": event["agent_node"], "model": event["model"]}
        return None

    def _assigned_node(self, thread_id: str) -> str | None:
        for event in reversed(self.store.list_events(thread_id, include_internal=True)):
            if event["event_type"] == "assistant_message" and event.get("agent_node"):
                return str(event["agent_node"])
        return None

    def _require_thread_node_target(self, thread_id: str, target: str) -> None:
        target_value = target.strip()
        if not target_value.startswith("node:"):
            return
        requested_node = target_value.removeprefix("node:").strip()
        if not requested_node:
            return
        assigned_node = self._assigned_node(thread_id)
        if assigned_node is None or assigned_node == requested_node:
            return
        raise ValueError(
            f"This thread is already routed to node '{assigned_node}'. "
            f"Start a new thread to use node '{requested_node}'."
        )

    def _public_messages(self, thread_id: str) -> list[dict[str, str]]:
        messages = []
        for event in self._public_message_events(thread_id):
            messages.append(self._event_message(event))
        return messages

    def _public_message_events(self, thread_id: str) -> list[dict[str, Any]]:
        events: list[dict[str, Any]] = []
        for event in self.store.list_events(thread_id, include_internal=False):
            if event["event_type"] not in {"user_message", "assistant_message"}:
                continue
            text = event["content"].get("text")
            role = event.get("role")
            if isinstance(text, str) and role in {"user", "assistant"}:
                events.append(event)
        return events

    def _event_message(self, event: dict[str, Any]) -> dict[str, str]:
        return {"role": str(event["role"]), "content": str(event["content"]["text"])}

    def _latest_history_summary(self, thread_id: str) -> dict[str, Any] | None:
        for event in reversed(self.store.list_events(thread_id, include_internal=True)):
            if event["event_type"] != "history_summary":
                continue
            content = event.get("content") or {}
            summary = content.get("summary")
            covered_event_ids = content.get("covered_event_ids")
            if isinstance(summary, str) and isinstance(covered_event_ids, list):
                return {"summary": summary, "covered_event_ids": [str(item) for item in covered_event_ids]}
        return None

    def _preview_thread_messages(
        self,
        thread_id: str,
        incoming_messages: list[dict[str, Any]],
        model: str,
    ) -> list[dict[str, Any]]:
        public_events = self._public_message_events(thread_id)
        latest_summary = self._latest_history_summary(thread_id)
        covered_event_ids = list(latest_summary.get("covered_event_ids", [])) if latest_summary else []
        covered_event_id_set = set(covered_event_ids)
        unsummarized_events = [event for event in public_events if event["id"] not in covered_event_id_set]
        messages = [self._event_message(event) for event in unsummarized_events]
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

    async def _managed_thread_messages(
        self,
        thread_id: str,
        turn_id: str,
        messages: list[dict[str, Any]],
        model: str,
        route: dict[str, Any],
    ) -> dict[str, Any]:
        if not self.config.context_summarization_enabled:
            return {"messages": list(messages), "metadata": None}

        public_events = self._public_message_events(thread_id)
        if not public_events:
            return {"messages": list(messages), "metadata": None}

        latest_summary = self._latest_history_summary(thread_id)
        covered_event_ids = list(latest_summary.get("covered_event_ids", [])) if latest_summary else []
        covered_event_id_set = set(covered_event_ids)
        unsummarized_events = [event for event in public_events if event["id"] not in covered_event_id_set]
        previous_summary = str(latest_summary.get("summary", "")) if latest_summary else None
        current_messages = [self._event_message(event) for event in unsummarized_events]
        if previous_summary:
            current_messages = [summary_system_message(previous_summary), *current_messages]

        if not should_summarize_messages(self.config, model, current_messages):
            return {"messages": current_messages, "metadata": None}

        return await self._compact_thread_history(
            thread_id=thread_id,
            turn_id=turn_id,
            model=model,
            route=route,
            recent_message_count=self.config.context_summarization_recent_messages,
            source="auto",
        )

    async def _compact_thread_history(
        self,
        thread_id: str,
        turn_id: str | None,
        model: str,
        route: dict[str, Any],
        recent_message_count: int,
        source: str,
    ) -> dict[str, Any]:
        public_events = self._public_message_events(thread_id)
        latest_summary = self._latest_history_summary(thread_id)
        covered_event_ids = list(latest_summary.get("covered_event_ids", [])) if latest_summary else []
        covered_event_id_set = set(covered_event_ids)
        unsummarized_events = [event for event in public_events if event["id"] not in covered_event_id_set]
        previous_summary = str(latest_summary.get("summary", "")) if latest_summary else None
        current_messages = [self._event_message(event) for event in unsummarized_events]
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
        messages_to_summarize = [self._event_message(event) for event in events_to_summarize]
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
            await self._append_error_async(thread_id, "CONTEXT_SUMMARY_ERROR", exc, turn_id=turn_id)
            raise ThreadChatError(
                thread_id,
                "CONTEXT_SUMMARY_ERROR",
                f"Failed to summarize thread {thread_id} for model {model}: {exc}",
            ) from exc

        all_covered_event_ids = [*covered_event_ids, *[event["id"] for event in events_to_summarize]]
        compacted_messages = [summary_system_message(summary), *[self._event_message(event) for event in recent_events]]
        prompt_tokens_after = estimate_prompt_tokens({"messages": compacted_messages})
        summary_event = await self._append_event_async(
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

    def _history_prompt_token_budget(self, model: str) -> int:
        try:
            context_window = self.config.effective_model_config(model).ctx
        except KeyError:
            return self.config.thread_history_min_prompt_tokens
        ratio_budget = int(context_window * self.config.thread_history_context_ratio)
        return min(self.config.thread_history_min_prompt_tokens, ratio_budget)

    def _append_agent_request(
        self,
        thread_id: str,
        turn_id: str,
        node: str,
        model: str,
        messages: list[dict[str, Any]],
    ) -> dict[str, Any]:
        return self.store.append_event(
            thread_id=thread_id,
            event_type="agent_request",
            role=None,
            content={"node": node, "model": model, "messages": messages},
            public=False,
            turn_id=turn_id,
            agent_node=node,
            model=model,
        )

    def _append_agent_response(
        self,
        thread_id: str,
        turn_id: str,
        node: str,
        model: str,
        content: str,
        route: dict[str, Any],
    ) -> dict[str, Any]:
        return self.store.append_event(
            thread_id=thread_id,
            event_type="agent_response",
            role=None,
            content={"text": content},
            public=False,
            turn_id=turn_id,
            route=route,
            agent_node=node,
            model=model,
        )

    def _append_error(self, thread_id: str, error_code: str, exc: Exception, turn_id: str | None = None) -> None:
        self.store.append_event(
            thread_id=thread_id,
            event_type="error",
            role=None,
            content={"text": str(exc)},
            public=True,
            turn_id=turn_id,
            error_code=error_code,
            error_detail=str(exc),
        )

    async def _append_error_async(self, thread_id: str, error_code: str, exc: Exception, turn_id: str | None = None) -> None:
        await self._append_event_async(
            thread_id=thread_id,
            event_type="error",
            role=None,
            content={"text": str(exc)},
            public=True,
            turn_id=turn_id,
            error_code=error_code,
            error_detail=str(exc),
        )

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
        thread = self.store.get_thread(thread_id)
        request_metadata = {**thread.get("metadata", {}), **(metadata or {})}
        turn_id = str(uuid4())

        await self._append_event_async(
            thread_id=thread_id,
            event_type="user_message",
            role="user",
            content={"text": content, "metadata": request_metadata},
            public=True,
            turn_id=turn_id,
        )

        current_input = content
        step_results: list[dict[str, Any]] = []

        for i, step in enumerate(steps):
            step_model = step.model or model or thread.get("default_model")
            step_target = step.target if step.target != "auto" else target

            try:
                decision = await self.routing_policy.choose(
                    request_type=request_metadata.get("request_type") or "general",
                    requested_model=step_model,
                    explicit_target=step_target,
                    previous_route=None,
            )
            except ValueError as exc:
                await self._append_error_async(thread_id, "WORKFLOW_ROUTING_ERROR", exc, turn_id=turn_id)
                raise

            await self._append_event_async(
                thread_id=thread_id,
                event_type="workflow_step",
                role=None,
                content={
                    "label": step.label,
                    "step_index": i,
                    "status": "running",
                    "model": decision.model,
                    "node": decision.node,
                },
                public=False,
                turn_id=turn_id,
                agent_node=decision.node,
                model=decision.model,
            )

            messages = [
                {"role": "system", "content": step.instructions},
                {"role": "user", "content": current_input},
            ]

            try:
                raw_response, _response_meta = await self.chat_proxy.chat_with_meta(
                    decision.model,
                    {"messages": messages, "target": f"node:{decision.node}", TRUSTED_CONTROLLER_TARGET_KEY: True},
                )
                step_output = raw_response["choices"][0]["message"]["content"]
            except Exception as exc:
                await self._append_event_async(
                    thread_id=thread_id,
                    event_type="workflow_step",
                    role=None,
                    content={"label": step.label, "step_index": i, "status": "failed", "error": str(exc)},
                    public=False,
                    turn_id=turn_id,
                )
                await self._append_error_async(thread_id, "WORKFLOW_STEP_ERROR", exc, turn_id=turn_id)
                raise

            await self._append_event_async(
                thread_id=thread_id,
                event_type="workflow_step",
                role=None,
                content={
                    "label": step.label,
                    "step_index": i,
                    "status": "complete",
                    "output": step_output,
                    "model": decision.model,
                    "node": decision.node,
                },
                public=False,
                turn_id=turn_id,
                agent_node=decision.node,
                model=decision.model,
            )

            step_results.append({"label": step.label, "model": decision.model, "node": decision.node, "output": step_output})
            current_input = step_output

        last = step_results[-1]
        route = {"node": last["node"], "model": last["model"], "strategy": "workflow", "reason": "workflow_final_step"}

        await self._append_event_async(
            thread_id=thread_id,
            event_type="assistant_message",
            role="assistant",
            content={"text": last["output"], "workflow_steps": step_results},
            public=True,
            turn_id=turn_id,
            route=route,
            agent_node=last["node"],
            model=last["model"],
        )

        return {
            "thread_id": thread_id,
            "message": {"role": "assistant", "content": last["output"]},
            "route": route,
            "workflow_steps": step_results,
        }


def _history_summary_content(messages: list[dict[str, Any]], max_chars: int, item_max_chars: int) -> str:
    lines: list[str] = ["Earlier thread history summary:"]
    for message in messages:
        role = str(message.get("role") or "message")
        content = _history_summary_text(message.get("content", ""), item_max_chars)
        if not content:
            continue
        lines.append(f"- {role}: {content}")
    summary = "\n".join(lines)
    return summary[:max_chars]


def _history_summary_text(content: Any, max_chars: int) -> str:
    if isinstance(content, str):
        text = content
    else:
        text = str(content)
    collapsed = " ".join(text.split())
    return collapsed[:max_chars]


def _plugin_thread_event_type(event_type: str, content: dict[str, Any] | None) -> str:
    if event_type == "workflow_step":
        status = (content or {}).get("status")
        if status == "running":
            return "llama_pack.thread.workflow_step.started"
        if status == "complete":
            return "llama_pack.thread.workflow_step.completed"
        if status == "failed":
            return "llama_pack.thread.workflow_step.failed"
    return f"llama_pack.thread.{event_type}.created"


def _plugin_thread_event_payload(event: dict[str, Any]) -> dict[str, Any]:
    return {
        "event_id": event["id"],
        "thread_id": event["thread_id"],
        "event_type": event["event_type"],
        "turn_id": event.get("turn_id"),
        "role": event.get("role"),
        "public": bool(event.get("public")),
        "route": event.get("route"),
        "agent_node": event.get("agent_node"),
        "model": event.get("model"),
        "error_code": event.get("error_code"),
        "error_detail": event.get("error_detail"),
        "content": _bounded_plugin_content(event.get("content") or {}),
        "created_at": event["created_at"],
    }


def _bounded_plugin_content(content: dict[str, Any]) -> dict[str, Any]:
    bounded: dict[str, Any] = {}
    for key, value in content.items():
        if key in {"raw_response", "messages"}:
            continue
        if isinstance(value, str):
            bounded[key] = value[:1000]
        elif isinstance(value, list):
            bounded[key] = value[:20]
        elif isinstance(value, dict):
            bounded[key] = {str(item_key): item_value for item_key, item_value in list(value.items())[:20]}
        else:
            bounded[key] = value
    return bounded
