from __future__ import annotations

from collections.abc import AsyncIterator, Awaitable, Callable
import inspect
import logging
from typing import Any

import httpx

from llama_pack.core.chat import CapabilityInspector, ModelNotRunningError, PromptTemplateAdapter, TargetResolver, TransportBuilder
from llama_pack.core.chat.context_budget import ContextBudgetEstimator, estimate_prompt_tokens
from llama_pack.core.chat.context_management import (
    assistant_summary_content,
    should_summarize_messages,
    summary_prompt_messages,
    summary_system_message,
)
from llama_pack.core.chat.internal_payload import SKIP_CONTEXT_MANAGEMENT_KEY, TRUSTED_CONTROLLER_TARGET_KEY
from llama_pack.core.config import AppConfig
from llama_pack.core.nodes.registry import NodeRegistry
from llama_pack.core.persistence.project_graph_store_orm import ProjectGraphStoreOrm
from llama_pack.core.persistence.project_store_orm import ProjectStoreOrm
from llama_pack.core.runtime.process_manager import ProcessManager


ChatRequest = Callable[..., Awaitable[dict[str, Any]]]
ChatStreamRequest = Callable[..., AsyncIterator[bytes]]
logger = logging.getLogger(__name__)


class ProjectRoutingError(Exception):
    def __init__(self, status_code: int, detail: str) -> None:
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail


class ChatSummarizationError(RuntimeError):
    def __init__(self, model_name: str, detail: str) -> None:
        super().__init__(
            f"Failed to summarize chat request for model {model_name}: {detail}. "
            "Estimated prompt tokens exceeded the configured context summarization trigger."
        )
        self.model_name = model_name
        self.detail = detail


class ChatProxy:
    def __init__(
        self,
        process_manager: ProcessManager,
        config: AppConfig,
        node_registry: NodeRegistry,
        request: ChatRequest | None = None,
        stream_request: ChatStreamRequest | None = None,
        project_store: ProjectStoreOrm | None = None,
        project_graph_store: ProjectGraphStoreOrm | None = None,
    ):
        self.process_manager = process_manager
        self.config = config
        self.node_registry = node_registry
        self.project_store = project_store
        self.project_graph_store = project_graph_store
        self._request = self._adapt_request_callable(request or self._default_request)
        self._stream_request = self._adapt_stream_request_callable(stream_request or self._default_stream_request)
        self._resolver = TargetResolver(process_manager, node_registry, config)
        self._transport = TransportBuilder(node_registry)
        self._capabilities = CapabilityInspector(process_manager, config)
        self._context_budget = ContextBudgetEstimator(process_manager, config)
        self._prompt_templates = PromptTemplateAdapter()

    async def chat(self, model_name: str, payload: dict[str, Any]) -> dict[str, Any]:
        response, _ = await self.chat_with_meta(model_name, payload)
        return response

    async def chat_with_meta(self, model_name: str, payload: dict[str, Any]) -> tuple[dict[str, Any], dict[str, str]]:
        url, request_payload, headers, verify_tls, route_meta = await self._build_request(model_name, payload, stream=False)
        response = await self._call_request(url, request_payload, headers, verify_tls)
        return response, route_meta

    def stream(self, model_name: str, payload: dict[str, Any]) -> AsyncIterator[bytes]:
        async def _stream() -> AsyncIterator[bytes]:
            stream, _ = await self.stream_with_meta(model_name, payload)
            async for chunk in stream:
                yield chunk
        return _stream()

    async def stream_with_meta(self, model_name: str, payload: dict[str, Any]) -> tuple[AsyncIterator[bytes], dict[str, str]]:
        url, request_payload, headers, verify_tls, route_meta = await self._build_request(model_name, payload, stream=True)

        async def _stream() -> AsyncIterator[bytes]:
            async for chunk in self._call_stream_request(url, request_payload, headers, verify_tls):
                yield chunk

        return _stream(), route_meta

    async def embeddings_with_meta(self, model_name: str, inputs: list[str], target_selector: str = "auto") -> tuple[dict[str, Any], dict[str, str]]:
        if not inputs:
            return {"data": [], "model": model_name}, {"route": "unknown"}
        payload = {"input": inputs, "model": model_name}
        if self.config.mode == "controller":
            target = await self._resolver.resolve_controller_target(model_name, target_selector)
            url, headers, verify_tls, route_meta = self._transport.embedding_transport_for_target(target)
            response = await self._call_request(url, payload, headers, verify_tls)
            return response, route_meta
        local_target = self._resolver.resolve_local_target(model_name)
        url = local_target["url"].replace("/v1/chat/completions", "/v1/embeddings")
        response = await self._call_request(url, payload, {}, True)
        return response, {"route": "local"}

    async def kv_slots_with_meta(self, model_name: str, target_selector: str = "auto") -> tuple[dict[str, Any], dict[str, str]]:
        url, headers, verify_tls, route_meta = await self._build_slots_request(model_name, target_selector, "")
        async with httpx.AsyncClient(timeout=None, verify=verify_tls) as client:
            response = await client.get(url, headers=headers or None)
            response.raise_for_status()
            return response.json(), route_meta

    async def kv_slot_action_with_meta(self, model_name: str, slot_id: int, action: str, target_selector: str = "auto") -> tuple[dict[str, Any], dict[str, str]]:
        suffix = f"/{slot_id}" if action == "clear" else f"/{slot_id}/{action}"
        url, headers, verify_tls, route_meta = await self._build_slots_request(model_name, target_selector, suffix)
        response = await self._call_request(url, {}, headers, verify_tls)
        return response, route_meta

    async def kv_capabilities_with_meta(self, model_name: str, target_selector: str = "auto") -> tuple[dict[str, Any], dict[str, str]]:
        checks = {
            "list_slots": ("GET", "/slots"),
            "clear_slot": ("POST", "/slots/0"),
            "save_slot": ("POST", "/slots/0/save"),
            "restore_slot": ("POST", "/slots/0/restore"),
            "erase_slot": ("POST", "/slots/0/erase"),
            "cancel_slot": ("POST", "/slots/0/cancel"),
        }
        supports: dict[str, bool] = {}
        details: dict[str, Any] = {}
        route_meta: dict[str, str] = {"route": "unknown"}
        for key, (method, path_suffix) in checks.items():
            ok, status, route_meta = await self._probe_slot_path(model_name, target_selector, method, path_suffix)
            supports[key] = ok
            details[key] = {"status_code": status}
        return {"supports": supports, "probe": details}, route_meta

    def capabilities(self, model_name: str) -> dict[str, Any]:
        return self._capabilities.capabilities(model_name)

    def context_budget(self, model_name: str, payload: dict[str, Any]) -> dict[str, object]:
        return self._context_budget.estimate(model_name, payload).to_dict()

    def inspect_prompt(self, model_name: str, payload: dict[str, Any]) -> dict[str, Any]:
        messages = payload.get("messages", [])
        joined = []
        for msg in messages:
            if not isinstance(msg, dict):
                continue
            role = str(msg.get("role", "user"))
            content = msg.get("content", "")
            joined.append(f"{role}: {content}")
        rendered = "\n".join(joined).strip() or "(empty)"
        estimated_tokens = max(1, len(rendered) // 4)
        return {
            "model": model_name,
            "rendered_prompt_preview": rendered,
            "estimated_prompt_tokens": estimated_tokens,
            "estimation_method": "approx_chars_div_4",
        }

    async def _build_request(self, model_name: str, payload: dict[str, Any], stream: bool) -> tuple[str, dict[str, Any], dict[str, str], bool, dict[str, str]]:
        payload = await self._summarize_ad_hoc_payload(model_name, payload)
        self._context_budget.require_fits(model_name, payload)
        request_payload = {
            "messages": payload["messages"],
            "temperature": payload.get("temperature", 0.7),
            "max_tokens": payload.get("max_tokens", 512),
            "stream": stream,
            "chat_template_kwargs": {"enable_thinking": bool(payload.get("reasoning", False))},
        }
        model_template = None
        try:
            model_template = self.process_manager.catalog_service.runtime_model(model_name).prompt_template
        except Exception:
            model_template = None
        request_payload = self._prompt_templates.apply(model_name, model_template, request_payload, payload)
        for key in (
            "top_p",
            "top_k",
            "min_p",
            "repeat_penalty",
            "seed",
            "stop",
            "json_schema",
            "grammar",
            "tools",
            "tool_choice",
            "tool_runtime",
            "agent_tool_max_iterations",
            "project_id",
        ):
            if payload.get(key) is not None:
                request_payload[key] = payload[key]
        for key in ("cache_prompt", "slot_id"):
            if payload.get(key) is not None:
                request_payload[key] = payload[key]

        if self.config.mode == "controller":
            target_selector = str(payload.get("target", "auto"))
            if bool(payload.get(TRUSTED_CONTROLLER_TARGET_KEY)) and target_selector.strip().lower().startswith("node:"):
                target = self._resolver.resolve_known_node_target(target_selector.split(":", 1)[1].strip())
            else:
                target = await self._resolver.resolve_controller_target(model_name, target_selector)
            use_openai_endpoint = request_payload.get("tool_runtime") == "agent"
            if use_openai_endpoint:
                self._require_project_ready_for_node(payload.get("project_id"), target)
                request_payload["model"] = model_name
            url, headers, verify_tls, route_meta = self._transport.chat_transport_for_target(
                target,
                model_name,
                stream,
                use_openai_endpoint,
            )
            return url, request_payload, headers, verify_tls, route_meta

        local_target = self._resolver.resolve_local_target(model_name)
        return local_target["url"], request_payload, {}, True, {"route": "local"}

    def _require_project_ready_for_node(self, project_id: object, target: dict[str, str]) -> None:
        if project_id is None or target["kind"] != "remote":
            return
        if self.project_store is None or self.project_graph_store is None:
            raise ProjectRoutingError(409, "Project routing stores are not configured")
        project_id_value = str(project_id)
        node_name = target["node_name"]
        roots = self.project_store.list_node_roots(project_id_value)
        if roots is None:
            raise ProjectRoutingError(404, "Project node roots not found")
        allowed_roots = [
            root for root in roots
            if root["node_name"] == node_name and root["safe_root_status"] == "allowed"
        ]
        if not allowed_roots:
            raise ProjectRoutingError(409, f"Project has no allowed root for node {node_name}")
        active_snapshot = self.project_graph_store.get_active_snapshot_for_node(project_id_value, node_name)
        if active_snapshot is None:
            raise ProjectRoutingError(409, f"Project graph is not indexed for node {node_name}")

    async def _summarize_ad_hoc_payload(self, model_name: str, payload: dict[str, Any]) -> dict[str, Any]:
        if bool(payload.get(SKIP_CONTEXT_MANAGEMENT_KEY)):
            return payload
        messages = payload.get("messages")
        if not isinstance(messages, list):
            return payload
        typed_messages = [message for message in messages if isinstance(message, dict)]
        if len(typed_messages) != len(messages):
            return payload
        if not self._should_summarize_payload(model_name, {**payload, "messages": typed_messages}):
            return payload
        recent_message_count = self.config.context_summarization_recent_messages
        if len(typed_messages) <= recent_message_count:
            return payload
        older_messages = typed_messages[:-recent_message_count]
        recent_messages = typed_messages[-recent_message_count:]
        prompt_tokens_before = estimate_prompt_tokens({"messages": typed_messages})
        summary_payload = {
            "messages": summary_prompt_messages(None, older_messages),
            "temperature": 0.0,
            "max_tokens": self.config.context_summarization_max_tokens,
            SKIP_CONTEXT_MANAGEMENT_KEY: True,
        }
        if payload.get("target") is not None:
            summary_payload["target"] = payload["target"]
        url, request_payload, headers, verify_tls = await self._summary_request(model_name, summary_payload)
        logger.info(
            "ChatProxy summary request prepared model=%s mode=%s target=%s url=%s message_count=%d older_message_count=%d recent_message_count=%d prompt_tokens_before=%d summary_prompt_tokens=%d max_tokens=%s request_keys=%s verify_tls=%s",
            model_name,
            self.config.mode,
            summary_payload.get("target", "auto"),
            url,
            len(typed_messages),
            len(older_messages),
            len(recent_messages),
            prompt_tokens_before,
            estimate_prompt_tokens({"messages": request_payload["messages"]}),
            request_payload.get("max_tokens"),
            sorted(request_payload.keys()),
            verify_tls,
        )
        try:
            response = await self._call_request(url, request_payload, headers, verify_tls)
            summary = assistant_summary_content(response)
        except Exception as exc:
            logger.exception(
                "ChatProxy summary request failed model=%s mode=%s target=%s url=%s error_type=%s http_detail=%s",
                model_name,
                self.config.mode,
                summary_payload.get("target", "auto"),
                url,
                type(exc).__name__,
                _http_exception_detail(exc),
            )
            raise ChatSummarizationError(model_name, str(exc)) from exc
        return {**payload, "messages": [summary_system_message(summary), *recent_messages]}

    def _should_summarize_payload(self, model_name: str, payload: dict[str, Any]) -> bool:
        if not self.config.context_summarization_enabled or not self.config.thread_history_compaction_enabled:
            return False
        try:
            budget = self._context_budget.estimate(model_name, payload)
        except KeyError:
            messages = payload.get("messages")
            if not isinstance(messages, list):
                return False
            typed_messages = [message for message in messages if isinstance(message, dict)]
            return len(typed_messages) == len(messages) and should_summarize_messages(self.config, model_name, typed_messages)
        return budget.usage_ratio >= self.config.context_summarization_trigger_ratio

    async def _summary_request(self, model_name: str, payload: dict[str, Any]) -> tuple[str, dict[str, Any], dict[str, str], bool]:
        request_payload = {
            "messages": payload["messages"],
            "temperature": payload["temperature"],
            "max_tokens": payload["max_tokens"],
            "stream": False,
        }
        if self.config.mode == "controller":
            target_selector = str(payload.get("target", "auto"))
            target = await self._resolver.resolve_controller_target(model_name, target_selector)
            url, headers, verify_tls, _route_meta = self._transport.chat_transport_for_target(
                target,
                model_name,
                False,
                False,
            )
            logger.info(
                "ChatProxy summary request routed model=%s target_selector=%s node=%s url=%s verify_tls=%s header_keys=%s",
                model_name,
                target_selector,
                target.get("node_name", target.get("kind", "unknown")),
                url,
                verify_tls,
                sorted(headers.keys()),
            )
            return url, request_payload, headers, verify_tls
        local_target = self._resolver.resolve_local_target(model_name)
        logger.info(
            "ChatProxy summary request routed model=%s target_selector=local url=%s verify_tls=%s header_keys=%s",
            model_name,
            local_target["url"],
            True,
            [],
        )
        return local_target["url"], request_payload, {}, True

    async def _build_slots_request(self, model_name: str, target_selector: str, suffix: str) -> tuple[str, dict[str, str], bool, dict[str, str]]:
        if self.config.mode == "controller":
            target = await self._resolver.resolve_controller_target(model_name, target_selector)
            return self._transport.slot_transport_for_target(target, suffix)
        local_target = self._resolver.resolve_local_target(model_name)
        return local_target["url"].replace("/v1/chat/completions", f"/slots{suffix}"), {}, True, {"route": "local"}

    async def _probe_slot_path(self, model_name: str, target_selector: str, method: str, path_suffix: str) -> tuple[bool, int | None, dict[str, str]]:
        url, headers, verify_tls, route_meta = await self._build_slots_request(model_name, target_selector, path_suffix.replace("/slots", ""))
        async with httpx.AsyncClient(timeout=5.0, verify=verify_tls) as client:
            opt = await client.request("OPTIONS", url, headers=headers or None)
            allow = (opt.headers.get("allow") or "").upper()
            wanted = method.upper()
            if opt.status_code < 400 and allow and wanted in {item.strip() for item in allow.split(",")}:
                return True, opt.status_code, route_meta
            if method.upper() in {"GET", "HEAD"}:
                resp = await client.request(method.upper(), url, headers=headers or None)
                return resp.status_code < 400, resp.status_code, route_meta
            return False, opt.status_code, route_meta

    async def _call_request(self, url: str, payload: dict[str, Any], headers: dict[str, str], verify_tls: bool) -> dict[str, Any]:
        return await self._request(url, payload, headers, verify_tls)

    async def _call_stream_request(self, url: str, payload: dict[str, Any], headers: dict[str, str], verify_tls: bool) -> AsyncIterator[bytes]:
        async for chunk in self._stream_request(url, payload, headers, verify_tls):
            yield chunk

    @staticmethod
    async def _default_request(url: str, payload: dict[str, Any], headers: dict[str, str] | None = None, verify_tls: bool = True) -> dict[str, Any]:
        async with httpx.AsyncClient(timeout=None, verify=verify_tls) as client:
            response = await client.post(url, json=payload, headers=headers or None)
            try:
                response.raise_for_status()
            except httpx.HTTPStatusError as exc:
                logger.warning(
                    "ChatProxy HTTP request failed url=%s status_code=%s response_body=%s request_keys=%s",
                    url,
                    response.status_code,
                    _response_body_preview(response),
                    sorted(payload.keys()),
                )
                raise exc
            if not response.content:
                return {"ok": True}
            return response.json()

    @staticmethod
    async def _default_stream_request(url: str, payload: dict[str, Any], headers: dict[str, str] | None = None, verify_tls: bool = True) -> AsyncIterator[bytes]:
        async with httpx.AsyncClient(timeout=None, verify=verify_tls) as client:
            async with client.stream("POST", url, json=payload, headers=headers or None) as response:
                response.raise_for_status()
                async for chunk in response.aiter_bytes():
                    yield chunk

    @staticmethod
    def _adapt_request_callable(fn: ChatRequest) -> Callable[[str, dict[str, Any], dict[str, str], bool], Awaitable[dict[str, Any]]]:
        param_count = len(inspect.signature(fn).parameters)
        if param_count >= 4:
            return fn

        async def _wrapped(url: str, payload: dict[str, Any], headers: dict[str, str], verify_tls: bool) -> dict[str, Any]:
            return await fn(url, payload)

        return _wrapped

    @staticmethod
    def _adapt_stream_request_callable(fn: ChatStreamRequest) -> Callable[[str, dict[str, Any], dict[str, str], bool], AsyncIterator[bytes]]:
        param_count = len(inspect.signature(fn).parameters)
        if param_count >= 4:
            return fn

        async def _wrapped(url: str, payload: dict[str, Any], headers: dict[str, str], verify_tls: bool) -> AsyncIterator[bytes]:
            async for chunk in fn(url, payload):
                yield chunk

        return _wrapped


def _http_exception_detail(exc: Exception) -> str:
    if isinstance(exc, httpx.HTTPStatusError):
        return (
            f"status_code={exc.response.status_code} "
            f"url={exc.request.url} "
            f"response_body={_response_body_preview(exc.response)}"
        )
    return str(exc)


def _response_body_preview(response: httpx.Response) -> str:
    text = response.text.strip()
    if len(text) <= 1000:
        return text
    return f"{text[:1000]}...<truncated>"
