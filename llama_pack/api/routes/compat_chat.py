from __future__ import annotations

from collections.abc import AsyncIterator
import json
from typing import TYPE_CHECKING, Any

from fastapi import Request

from llama_pack.api.chat_error_contract import thread_chat_http_detail
from llama_pack.api.http_headers import (
    LEGACY_LLAMA_MANAGER_CONTEXT_PROFILE_HEADER,
    LEGACY_LLAMA_MANAGER_MODEL_FAMILY_HEADER,
    LEGACY_LLAMA_MANAGER_MODEL_HEADER,
    LEGACY_LLAMA_MANAGER_NODE_HEADER,
    LEGACY_LLAMA_MANAGER_ROUTE_HEADER,
    LEGACY_LLAMA_MANAGER_THREAD_ID_HEADER,
    LLAMA_PACK_CONTEXT_PROFILE_HEADER,
    LLAMA_PACK_MODEL_FAMILY_HEADER,
    LLAMA_PACK_MODEL_HEADER,
    LLAMA_PACK_NODE_HEADER,
    LLAMA_PACK_ROUTE_HEADER,
    LLAMA_PACK_THREAD_ID_HEADER,
    compatibility_header_pairs,
)
from llama_pack.core.chat.scheduler import ChatAdmissionError
from llama_pack.core.chat.internal_payload import TRUSTED_CONTROLLER_TARGET_KEY
from llama_pack.core.config import AppConfig
from llama_pack.core.threads.service import ThreadChatError, ThreadService

if TYPE_CHECKING:
    from llama_pack.core.memory.store import ChromaMemoryStore


class CompatChatHTTPError(RuntimeError):
    def __init__(self, status_code: int, detail: str | dict[str, str], headers: dict[str, str]) -> None:
        super().__init__(str(detail))
        self.status_code = status_code
        self.detail = detail
        self.headers = headers


def compatibility_headers(thread_id: str | None, route: dict[str, Any] | None, response_meta: dict[str, Any] | None = None) -> dict[str, str]:
    headers: dict[str, str] = {}
    if thread_id:
        headers.update(compatibility_header_pairs(LLAMA_PACK_THREAD_ID_HEADER, LEGACY_LLAMA_MANAGER_THREAD_ID_HEADER, thread_id))
    if route:
        headers.update(compatibility_header_pairs(LLAMA_PACK_NODE_HEADER, LEGACY_LLAMA_MANAGER_NODE_HEADER, str(route["node"])))
        headers.update(compatibility_header_pairs(LLAMA_PACK_MODEL_HEADER, LEGACY_LLAMA_MANAGER_MODEL_HEADER, str(route["model"])))
        headers.update(compatibility_header_pairs(LLAMA_PACK_ROUTE_HEADER, LEGACY_LLAMA_MANAGER_ROUTE_HEADER, f"node:{route['node']}"))
        if route.get("family"):
            headers.update(
                compatibility_header_pairs(
                    LLAMA_PACK_MODEL_FAMILY_HEADER,
                    LEGACY_LLAMA_MANAGER_MODEL_FAMILY_HEADER,
                    str(route["family"]),
                )
            )
        if route.get("profile"):
            headers.update(
                compatibility_header_pairs(
                    LLAMA_PACK_CONTEXT_PROFILE_HEADER,
                    LEGACY_LLAMA_MANAGER_CONTEXT_PROFILE_HEADER,
                    str(route["profile"]),
                )
            )
        return headers
    if response_meta:
        headers.update(
            compatibility_header_pairs(
                LLAMA_PACK_ROUTE_HEADER,
                LEGACY_LLAMA_MANAGER_ROUTE_HEADER,
                str(response_meta.get("route", "unknown")),
            )
        )
    return headers


async def controller_chat(
    request: Request,
    config: AppConfig,
    service: ThreadService,
    proxy: Any,
    model: str,
    messages: list[dict[str, Any]],
    payload: dict[str, Any],
    thread_id: str | None,
    request_type: str | None,
    metadata: dict[str, Any] | None,
    target: str,
) -> tuple[dict[str, Any], dict[str, str]]:
    payload = _with_admission_session(payload, request)
    if config.mode != "controller":
        try:
            response, meta = await proxy.chat_with_meta(model, payload)
        except ChatAdmissionError as exc:
            raise CompatChatHTTPError(exc.status_code, str(exc), {}) from exc
        return response, compatibility_headers(None, None, meta)

    try:
        compat = await service.prepare_compat_chat_async(
            thread_id=thread_id,
            messages=messages,
            model=model,
            model_family=_optional_str(payload.get("model_family")),
            context_profile=_optional_str(payload.get("context_profile")),
            target=target,
            metadata=_request_metadata(request_type, metadata),
            created_by=getattr(request.state, "ui_user", None),
        )
    except ThreadChatError as exc:
        raise CompatChatHTTPError(409, thread_chat_http_detail(exc), compatibility_headers(exc.thread_id, None)) from exc
    request_payload = {
        **payload,
        "messages": compat["messages"],
        "target": compat["target"],
        TRUSTED_CONTROLLER_TARGET_KEY: True,
    }
    request_payload = await _inject_memories(request.app.state.memory_store, config, request_payload)
    try:
        response, meta = await proxy.chat_with_meta(compat["model"], request_payload)
    except ChatAdmissionError as exc:
        raise CompatChatHTTPError(exc.status_code, str(exc), compatibility_headers(compat["thread_id"], compat["route"])) from exc
    except Exception as exc:
        service.record_compat_error(compat["thread_id"], exc)
        raise CompatChatHTTPError(502, str(exc), compatibility_headers(compat["thread_id"], compat["route"])) from exc
    service.record_compat_assistant(
        thread_id=compat["thread_id"],
        assistant_content=assistant_content(response),
        raw_response=response,
        response_meta=meta,
        route=compat["route"],
    )
    response_with_thread = {**response, "thread_id": compat["thread_id"]}
    if compat.get("context_management") is not None:
        response_with_thread["context_management"] = compat["context_management"]
    return response_with_thread, compatibility_headers(compat["thread_id"], compat["route"], meta)


async def controller_stream(
    request: Request,
    config: AppConfig,
    service: ThreadService,
    proxy: Any,
    model: str,
    messages: list[dict[str, Any]],
    payload: dict[str, Any],
    thread_id: str | None,
    request_type: str | None,
    metadata: dict[str, Any] | None,
    target: str,
    include_thread_event: bool,
) -> tuple[AsyncIterator[bytes], dict[str, str]]:
    payload = _with_admission_session(payload, request)
    if config.mode != "controller":
        try:
            stream, meta = await proxy.stream_with_meta(model, payload)
        except ChatAdmissionError as exc:
            raise CompatChatHTTPError(exc.status_code, str(exc), {}) from exc
        return stream, compatibility_headers(None, None, meta)

    try:
        compat = await service.prepare_compat_chat_async(
            thread_id=thread_id,
            messages=messages,
            model=model,
            model_family=_optional_str(payload.get("model_family")),
            context_profile=_optional_str(payload.get("context_profile")),
            target=target,
            metadata=_request_metadata(request_type, metadata),
            created_by=getattr(request.state, "ui_user", None),
        )
    except ThreadChatError as exc:
        raise CompatChatHTTPError(409, thread_chat_http_detail(exc), compatibility_headers(exc.thread_id, None)) from exc
    request_payload = {
        **payload,
        "messages": compat["messages"],
        "target": compat["target"],
        TRUSTED_CONTROLLER_TARGET_KEY: True,
    }
    request_payload = await _inject_memories(request.app.state.memory_store, config, request_payload)
    try:
        stream, meta = await proxy.stream_with_meta(compat["model"], request_payload)
    except ChatAdmissionError as exc:
        raise CompatChatHTTPError(exc.status_code, str(exc), compatibility_headers(compat["thread_id"], compat["route"])) from exc
    except Exception as exc:
        service.record_compat_error(compat["thread_id"], exc)
        raise CompatChatHTTPError(502, str(exc), compatibility_headers(compat["thread_id"], compat["route"])) from exc

    async def _recording_stream() -> AsyncIterator[bytes]:
        parts: list[str] = []
        if include_thread_event:
            thread_event = json.dumps({"type": "thread", "thread_id": compat["thread_id"]})
            yield f"data: {thread_event}\n\n".encode()
        if compat.get("context_management") is not None:
            context_event = json.dumps({"type": "context_management", **compat["context_management"]})
            yield f"data: {context_event}\n\n".encode()
        try:
            async for chunk in stream:
                parts.extend(extract_openai_sse_content(chunk))
                yield chunk
            content = "".join(parts)
            service.record_compat_assistant(
                thread_id=compat["thread_id"],
                assistant_content=content,
                raw_response={"stream": True, "content": content},
                response_meta=meta,
                route=compat["route"],
            )
        except Exception as exc:
            service.record_compat_error(compat["thread_id"], exc)
            raise

    return _recording_stream(), compatibility_headers(compat["thread_id"], compat["route"], meta)


def assistant_content(response: dict[str, Any]) -> str:
    try:
        content = response["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError):
        return ""
    return content if isinstance(content, str) else str(content)


def extract_openai_sse_json(chunk: bytes) -> list[dict[str, Any]]:
    payloads: list[dict[str, Any]] = []
    for line in chunk.decode("utf-8", errors="ignore").splitlines():
        if not line.startswith("data:"):
            continue
        data = line.removeprefix("data:").strip()
        if not data or data == "[DONE]":
            continue
        try:
            payload = json.loads(data)
        except json.JSONDecodeError:
            continue
        if isinstance(payload, dict):
            payloads.append(payload)
    return payloads


def stream_payload_has_tool_call(payload: dict[str, Any]) -> bool:
    for choice in payload.get("choices") or []:
        if not isinstance(choice, dict):
            continue
        delta = choice.get("delta") or {}
        if isinstance(delta, dict) and delta.get("tool_calls"):
            return True
        if choice.get("finish_reason") == "tool_calls":
            return True
    return False


def extract_openai_sse_content(chunk: bytes) -> list[str]:
    parts: list[str] = []
    for payload in extract_openai_sse_json(chunk):
        for choice in payload.get("choices", []):
            delta = choice.get("delta", {}) if isinstance(choice, dict) else {}
            content = delta.get("content") if isinstance(delta, dict) else None
            if isinstance(content, str):
                parts.append(content)
    return parts


def _request_metadata(request_type: str | None, metadata: dict[str, Any] | None) -> dict[str, Any]:
    values = dict(metadata or {})
    if request_type:
        values["request_type"] = request_type
    return values


def _with_admission_session(payload: dict[str, Any], request: Request) -> dict[str, Any]:
    session_id = getattr(request.state, "test_chat_visitor_id", None)
    if not session_id:
        return payload
    return {**payload, "_admission_session_id": session_id}


async def _inject_memories(
    store: ChromaMemoryStore,
    config: AppConfig,
    payload: dict[str, Any],
) -> dict[str, Any]:
    """Prepend relevant memories as a system message block, if auto_inject is enabled."""
    if store.disabled or not config.memory.auto_inject:
        return payload

    messages: list[dict[str, Any]] = list(payload.get("messages") or [])
    # Find the last user message to use as the search query
    query = ""
    for msg in reversed(messages):
        if msg.get("role") == "user":
            content = msg.get("content", "")
            query = content if isinstance(content, str) else str(content)
            break
    if not query:
        return payload

    memories = await store.search(query, top_k=config.memory.top_k)
    if not memories:
        return payload

    memory_text = "[Memory]\n" + "\n".join(f"- {m['text']}" for m in memories)

    # Prepend to existing system message or insert a new one at position 0
    new_messages: list[dict[str, Any]] = []
    injected = False
    for msg in messages:
        if not injected and msg.get("role") == "system":
            existing = msg.get("content", "")
            new_messages.append({**msg, "content": f"{memory_text}\n\n{existing}".strip()})
            injected = True
        else:
            new_messages.append(msg)
    if not injected:
        new_messages.insert(0, {"role": "system", "content": memory_text})

    return {**payload, "messages": new_messages}
    return values


def _optional_str(value: Any) -> str | None:
    return value if isinstance(value, str) and value else None
