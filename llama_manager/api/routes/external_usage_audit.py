from __future__ import annotations

from fastapi import Request


def audit_external_chat_completion(
    *,
    request: Request,
    endpoint: str,
    model: str,
    request_type: str | None,
    stream: bool,
    headers: dict[str, str],
) -> None:
    if getattr(request.state, "ui_role", None) != "external":
        return
    key_id = getattr(request.state, "ui_key_id", None)
    node = headers.get("X-Llama-Manager-Node")
    routed_model = headers.get("X-Llama-Manager-Model") or model
    route = headers.get("X-Llama-Manager-Route")
    if key_id:
        request.app.state.auth_store.record_external_key_usage(
            key_id=key_id,
            endpoint=endpoint,
            route=route,
            node=node,
            model=routed_model,
            request_type=request_type,
        )
    request.app.state.audit_store.create_event(
        actor=getattr(request.state, "ui_user", "external-app"),
        event_type="external_chat_completion",
        dry_run=False,
        target=routed_model,
        route=route,
        payload={
            "key_id": key_id,
            "endpoint": endpoint,
            "request_type": request_type,
            "node": node,
            "model": routed_model,
            "stream": stream,
        },
    )
