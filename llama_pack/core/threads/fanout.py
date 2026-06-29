from __future__ import annotations

from typing import Any

from llama_pack.core.chat.internal_payload import TRUSTED_CONTROLLER_TARGET_KEY
from llama_pack.core.threads.events import ThreadEventPublisher
from llama_pack.core.threads.routing import RouteDecision


class ThreadFanoutRunner:
    def __init__(
        self,
        chat_proxy: Any,
        event_publisher: ThreadEventPublisher,
    ) -> None:
        self.chat_proxy = chat_proxy
        self.event_publisher = event_publisher

    async def post_message_fanout(
        self,
        thread_id: str,
        turn_id: str,
        messages: list[dict[str, Any]],
        primary: RouteDecision,
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
            await self.event_publisher.append_event(
                thread_id=thread_id,
                event_type="agent_request",
                role=None,
                content={"node": target.node, "model": target.model, "messages": messages},
                public=False,
                turn_id=turn_id,
                route=None,
                agent_node=target.node,
                model=target.model,
                error_code=None,
                error_detail=None,
            )
            try:
                raw_response, _response_meta = await self.chat_proxy.chat_with_meta(
                    target.model,
                    {"messages": messages, "target": f"node:{target.node}", TRUSTED_CONTROLLER_TARGET_KEY: True},
                )
                content = raw_response["choices"][0]["message"]["content"]
                await self.event_publisher.append_event(
                    thread_id=thread_id,
                    event_type="agent_response",
                    role=None,
                    content={"text": content},
                    public=False,
                    turn_id=turn_id,
                    route=target_route,
                    agent_node=target.node,
                    model=target.model,
                    error_code=None,
                    error_detail=None,
                )
                agent_outputs.append({"node": target.node, "model": target.model, "content": content})
            except Exception as exc:
                await self.event_publisher.append_event(
                    thread_id=thread_id,
                    event_type="agent_response",
                    role=None,
                    content={"text": f"[error: {exc}]"},
                    public=False,
                    turn_id=turn_id,
                    route=target_route,
                    agent_node=target.node,
                    model=target.model,
                    error_code=None,
                    error_detail=None,
                )
                agent_outputs.append({"node": target.node, "model": target.model, "error": str(exc)})

        await self.event_publisher.append_event(
            thread_id=thread_id,
            event_type="aggregation",
            role=None,
            content={"outputs": agent_outputs},
            public=False,
            turn_id=turn_id,
            route=None,
            agent_node=None,
            model=None,
            error_code=None,
            error_detail=None,
        )

        successful = [output["content"] for output in agent_outputs if "content" in output]
        aggregated = "\n\n---\n\n".join(successful) if successful else "[no successful agent responses]"

        await self.event_publisher.append_event(
            thread_id=thread_id,
            event_type="assistant_message",
            role="assistant",
            content={"text": aggregated},
            public=True,
            turn_id=turn_id,
            route=route,
            agent_node=primary.node,
            model=primary.model,
            error_code=None,
            error_detail=None,
        )

        return {
            "thread_id": thread_id,
            "message": {"role": "assistant", "content": aggregated},
            "route": route,
        }
