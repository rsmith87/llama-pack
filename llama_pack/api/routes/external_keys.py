from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field, HttpUrl

from llama_pack.api.routes.auth.common import get_auth_store, require_admin_session


router = APIRouter(prefix="/external-keys")


class CreateExternalKeyRequest(BaseModel):
    site_name: str = Field(min_length=1, max_length=120)
    site_url: str = Field(min_length=1, max_length=512)


@router.get("")
def list_external_keys(request: Request):
    require_admin_session(request)
    return {"keys": get_auth_store(request).list_external_keys()}


@router.post("")
def create_external_key(body: CreateExternalKeyRequest, request: Request):
    session = require_admin_session(request)
    created = get_auth_store(request).create_external_key(body.site_name, body.site_url)
    request.app.state.audit_store.create_event(
        actor=session.get("username", "unknown"),
        event_type="external_key_create",
        dry_run=False,
        target=body.site_name,
        route="external-keys",
        payload={"key_id": created["id"], "site_url": body.site_url},
    )
    return created


@router.post("/{key_id}/revoke")
def revoke_external_key(key_id: str, request: Request):
    session = require_admin_session(request)
    ok = get_auth_store(request).revoke_key(key_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Key not found")
    request.app.state.audit_store.create_event(
        actor=session.get("username", "unknown"),
        event_type="external_key_revoke",
        dry_run=False,
        target=key_id,
        route="external-keys",
        payload={},
    )
    return {"ok": True}


@router.get("/{key_id}/analytics")
def external_key_analytics(key_id: str, request: Request):
    require_admin_session(request)
    matching = [key for key in get_auth_store(request).list_external_keys() if key.get("id") == key_id]
    if not matching:
        raise HTTPException(status_code=404, detail="Key not found")

    events = request.app.state.audit_store.list_events(event_type="external_chat_completion", limit=1000)
    calls = [
        event
        for event in events
        if isinstance(event.get("payload"), dict) and event["payload"].get("key_id") == key_id
    ]

    def counts(field: str) -> dict[str, int]:
        out: dict[str, int] = {}
        for event in calls:
            payload = event["payload"]
            value = payload.get(field) if isinstance(payload, dict) else None
            if value:
                out[str(value)] = out.get(str(value), 0) + 1
        return dict(sorted(out.items()))

    recent_calls = []
    for event in calls[:20]:
        payload = event["payload"] if isinstance(event.get("payload"), dict) else {}
        recent_calls.append(
            {
                "created_at": event.get("created_at"),
                "endpoint": payload.get("endpoint"),
                "request_type": payload.get("request_type"),
                "route": event.get("route"),
                "node": payload.get("node"),
                "model": payload.get("model"),
                "stream": payload.get("stream"),
            }
        )

    return {
        "key_id": key_id,
        "site_name": matching[0].get("site_name"),
        "total_calls": len(calls),
        "endpoint_counts": counts("endpoint"),
        "model_counts": counts("model"),
        "route_counts": {
            str(event["route"]): sum(1 for call in calls if call.get("route") == event["route"])
            for event in calls
            if event.get("route")
        },
        "request_type_counts": counts("request_type"),
        "recent_calls": recent_calls,
    }
