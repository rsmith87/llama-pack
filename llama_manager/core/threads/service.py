from __future__ import annotations

import asyncio
import json
from collections.abc import AsyncIterator
from typing import Any
from uuid import uuid4

from llama_manager.core.config.models import AppConfig
from llama_manager.core.threads.routing import ModelArtifactPresence, ModelAvailable, ModelRunning, NodeStartupAllowed, RoutingPolicy
from llama_manager.core.threads.store import ThreadStore


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

        self.store.append_event(
            thread_id=thread_id,
            event_type="user_message",
            role="user",
            content={"text": user_text, "metadata": request_metadata, "messages": messages},
            public=True,
            turn_id=turn_id,
        )

        try:
            decision = await self.routing_policy.choose(
                request_type=request_type,
                requested_model=requested_model or thread.get("default_model"),
                explicit_target=target,
                previous_route=previous_route,
            )
        except ValueError as exc:
            self._append_error(thread_id, "ROUTING_ERROR", exc, turn_id=turn_id)
            raise ThreadChatError(thread_id, "ROUTING_ERROR", str(exc)) from exc

        route = {
            "node": decision.node,
            "model": decision.model,
            "family": model_family,
            "profile": context_profile,
            "strategy": decision.strategy,
            "reason": decision.reason,
        }
        self.store.append_event(
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
        return {
            "thread_id": thread_id,
            "model": decision.model,
            "target": f"node:{decision.node}",
            "route": route,
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

    def post_message(
        self,
        thread_id: str,
        role: str,
        content: str,
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
        content: str,
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
        messages = [
            *self._public_messages(thread_id),
            {"role": "user", "content": content},
        ]
        turn_id = str(uuid4())

        self.store.append_event(
            thread_id=thread_id,
            event_type="user_message",
            role="user",
            content={"text": content, "metadata": request_metadata},
            public=True,
            turn_id=turn_id,
        )

        try:
            decision = await self.routing_policy.choose(
                request_type=request_type,
                requested_model=requested_model or thread.get("default_model"),
                explicit_target=target,
                previous_route=previous_route,
            )
        except ValueError as exc:
            self._append_error(thread_id, "ROUTING_ERROR", exc, turn_id=turn_id)
            raise

        route = {
            "node": decision.node,
            "model": decision.model,
            "family": model_family,
            "profile": context_profile,
            "strategy": decision.strategy,
            "reason": decision.reason,
        }

        self.store.append_event(
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

        return {
            "thread": thread,
            "request_metadata": request_metadata,
            "messages": messages,
            "turn_id": turn_id,
            "route": route,
            "decision": decision,
            "model_family": model_family,
            "context_profile": context_profile,
        }

    async def post_message_async(
        self,
        thread_id: str,
        role: str,
        content: str,
        model: str | None,
        target: str,
        metadata: dict[str, Any] | None,
        model_family: str | None = None,
        context_profile: str | None = None,
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
                    "target": f"node:{decision.node}",
                    **self._profile_payload(prepared),
                },
            )
            assistant_content = raw_response["choices"][0]["message"]["content"]
        except Exception as exc:
            self._append_error(thread_id, "CHAT_PROXY_ERROR", exc, turn_id=turn_id)
            raise

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
            turn_id=turn_id,
            route=route,
            agent_node=decision.node,
            model=decision.model,
        )

        return {
            "thread_id": thread_id,
            "message": {"role": "assistant", "content": assistant_content},
            "route": route,
        }

    async def stream_message_async(
        self,
        thread_id: str,
        role: str,
        content: str,
        model: str | None,
        target: str,
        metadata: dict[str, Any] | None,
        model_family: str | None = None,
        context_profile: str | None = None,
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
                {"messages": messages, "target": f"node:{decision.node}", **self._profile_payload(prepared)},
            )
        except Exception as exc:
            self._append_error(thread_id, "CHAT_PROXY_ERROR", exc, turn_id=turn_id)
            raise

        async def _generate() -> AsyncIterator[bytes]:
            route_event = json.dumps({"type": "route", "route": route})
            yield f"data: {route_event}\n\n".encode()

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
                self._append_error(thread_id, "CHAT_PROXY_ERROR", exc, turn_id=turn_id)
                err_event = json.dumps({"type": "error", "error": str(exc)})
                yield f"data: {err_event}\n\n".encode()
                yield b"data: [DONE]\n\n"
                return

            self.store.append_event(
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
            self._append_agent_request(
                thread_id=thread_id,
                turn_id=turn_id,
                node=target.node,
                model=target.model,
                messages=messages,
            )
            try:
                raw_response, response_meta = await self.chat_proxy.chat_with_meta(
                    target.model,
                    {"messages": messages, "target": f"node:{target.node}"},
                )
                content = raw_response["choices"][0]["message"]["content"]
                self._append_agent_response(
                    thread_id=thread_id,
                    turn_id=turn_id,
                    node=target.node,
                    model=target.model,
                    content=content,
                    route=target_route,
                )
                agent_outputs.append({"node": target.node, "model": target.model, "content": content})
            except Exception as exc:
                self._append_agent_response(
                    thread_id=thread_id,
                    turn_id=turn_id,
                    node=target.node,
                    model=target.model,
                    content=f"[error: {exc}]",
                    route=target_route,
                )
                agent_outputs.append({"node": target.node, "model": target.model, "error": str(exc)})

        self.store.append_event(
            thread_id=thread_id,
            event_type="aggregation",
            role=None,
            content={"outputs": agent_outputs},
            public=False,
            turn_id=turn_id,
        )

        successful = [o["content"] for o in agent_outputs if "content" in o]
        aggregated = "\n\n---\n\n".join(successful) if successful else "[no successful agent responses]"

        self.store.append_event(
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

    def _public_messages(self, thread_id: str) -> list[dict[str, str]]:
        messages = []
        for event in self.store.list_events(thread_id, include_internal=False):
            if event["event_type"] not in {"user_message", "assistant_message"}:
                continue
            text = event["content"].get("text")
            role = event.get("role")
            if isinstance(text, str) and role in {"user", "assistant"}:
                messages.append({"role": role, "content": text})
        return messages

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

        self.store.append_event(
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
                self._append_error(thread_id, "WORKFLOW_ROUTING_ERROR", exc, turn_id=turn_id)
                raise

            self.store.append_event(
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
                    {"messages": messages, "target": f"node:{decision.node}"},
                )
                step_output = raw_response["choices"][0]["message"]["content"]
            except Exception as exc:
                self.store.append_event(
                    thread_id=thread_id,
                    event_type="workflow_step",
                    role=None,
                    content={"label": step.label, "step_index": i, "status": "failed", "error": str(exc)},
                    public=False,
                    turn_id=turn_id,
                )
                self._append_error(thread_id, "WORKFLOW_STEP_ERROR", exc, turn_id=turn_id)
                raise

            self.store.append_event(
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

        self.store.append_event(
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
