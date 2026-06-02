from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request

from llama_manager.api.dependencies import get_chat_session_store
from llama_manager.api.routes.chat.common import SaveChatSessionRequest


router = APIRouter(prefix="/chat")


def _session_visitor_id(request: Request) -> str | None:
    if getattr(request.state, "ui_role", None) != "test_chat":
        return None
    return getattr(request.state, "test_chat_visitor_id", None)


@router.get("/sessions")
async def list_chat_sessions(request: Request, store: Any = Depends(get_chat_session_store)):
    return store.list_sessions(visitor_id=_session_visitor_id(request))


@router.get("/sessions/{session_id}")
async def get_chat_session(session_id: str, request: Request, store: Any = Depends(get_chat_session_store)):
    payload = store.get_session(session_id, visitor_id=_session_visitor_id(request))
    if payload is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return payload


@router.post("/sessions")
async def save_chat_session(
    body: SaveChatSessionRequest,
    request: Request,
    store: Any = Depends(get_chat_session_store),
):
    try:
        return store.save_session(
            session_id=body.id,
            name=body.name,
            model=body.model,
            target_selector=body.target,
            messages=[item.model_dump() for item in body.messages],
            request_defaults=body.request_defaults,
            visitor_id=_session_visitor_id(request),
        )
    except PermissionError as exc:
        raise HTTPException(status_code=404, detail="Session not found") from exc


@router.delete("/sessions/{session_id}")
async def delete_chat_session(
    session_id: str,
    request: Request,
    store: Any = Depends(get_chat_session_store),
):
    deleted = store.delete_session(session_id, visitor_id=_session_visitor_id(request))
    if not deleted:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"deleted": True, "id": session_id}
