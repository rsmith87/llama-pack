from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import StreamingResponse

from llama_pack.api.chat_error_contract import is_no_eligible_route_message, no_eligible_route_detail, thread_chat_error_detail
from llama_pack.api.dependencies import get_thread_service
from llama_pack.core.chat.proxy import ProjectRoutingError
from llama_pack.core.threads.models import CompactThreadRequest, CreateThreadRequest, ThreadMessageRequest, WorkflowRunRequest
from llama_pack.core.threads.service import ThreadChatError, ThreadService


router = APIRouter(prefix="/threads")


@router.post("", status_code=201)
def create_thread(
    body: CreateThreadRequest,
    request: Request,
    service: ThreadService = Depends(get_thread_service),
):
    try:
        return service.create_thread(
            title=body.title,
            default_model=body.default_model,
            metadata=body.metadata.model_dump(),
            created_by=getattr(request.state, "ui_user", None),
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.get("/{thread_id}/events")
def list_events(
    thread_id: str,
    request: Request,
    include_internal: bool = Query(default=False),
    service: ThreadService = Depends(get_thread_service),
):
    if include_internal and getattr(request.state, "ui_role", None) != "admin":
        raise HTTPException(status_code=403, detail="Forbidden")
    try:
        return service.list_events(thread_id, include_internal=include_internal)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.post("/{thread_id}/compact")
async def compact_thread(
    thread_id: str,
    body: CompactThreadRequest,
    service: ThreadService = Depends(get_thread_service),
):
    lock = await service.acquire_turn_lock(thread_id)
    try:
        return await service.compact_thread_async(
            thread_id=thread_id,
            model=body.model,
            model_family=body.model_family,
            context_profile=body.context_profile,
            target=body.target,
            recent_message_count=body.recent_message_count,
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ThreadChatError as exc:
        raise HTTPException(status_code=409, detail=thread_chat_error_detail(exc)) from exc
    except ValueError as exc:
        if is_no_eligible_route_message(str(exc)):
            raise HTTPException(status_code=409, detail=no_eligible_route_detail(str(exc))) from exc
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    finally:
        lock.release()


@router.post("/{thread_id}/messages")
async def post_message(
    thread_id: str,
    body: ThreadMessageRequest,
    service: ThreadService = Depends(get_thread_service),
):
    lock = await service.acquire_turn_lock(thread_id)
    try:
        generation_payload = body.generation_payload()
        return await service.post_message_async(
            thread_id=thread_id,
            role=body.role,
            content=body.content,
            model=body.model,
            model_family=body.model_family,
            context_profile=body.context_profile,
            target=body.target,
            metadata=body.metadata.model_dump() if body.metadata is not None else None,
            generation_payload=generation_payload,
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ProjectRoutingError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
    except ThreadChatError as exc:
        raise HTTPException(status_code=409, detail=thread_chat_error_detail(exc)) from exc
    except ValueError as exc:
        if is_no_eligible_route_message(str(exc)):
            raise HTTPException(status_code=409, detail=no_eligible_route_detail(str(exc))) from exc
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    finally:
        lock.release()


@router.post("/{thread_id}/messages/stream")
async def post_message_stream(
    thread_id: str,
    body: ThreadMessageRequest,
    service: ThreadService = Depends(get_thread_service),
):
    lock = await service.acquire_turn_lock(thread_id)
    try:
        generation_payload = body.generation_payload()
        stream, _route = await service.stream_message_async(
            thread_id=thread_id,
            role=body.role,
            content=body.content,
            model=body.model,
            model_family=body.model_family,
            context_profile=body.context_profile,
            target=body.target,
            metadata=body.metadata.model_dump() if body.metadata is not None else None,
            generation_payload=generation_payload,
        )
    except KeyError as exc:
        lock.release()
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ThreadChatError as exc:
        lock.release()
        raise HTTPException(status_code=409, detail=thread_chat_error_detail(exc)) from exc
    except ValueError as exc:
        lock.release()
        if is_no_eligible_route_message(str(exc)):
            raise HTTPException(status_code=409, detail=no_eligible_route_detail(str(exc))) from exc
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return StreamingResponse(_release_lock_after_stream(stream, lock), media_type="text/event-stream")


async def _release_lock_after_stream(stream, lock):
    try:
        async for chunk in stream:
            yield chunk
    finally:
        lock.release()


@router.post("/{thread_id}/workflow")
async def run_workflow(
    thread_id: str,
    body: WorkflowRunRequest,
    service: ThreadService = Depends(get_thread_service),
):
    try:
        return await service.run_workflow_async(
            thread_id=thread_id,
            content=body.content,
            steps=body.steps,
            model=body.model,
            target=body.target,
            metadata=body.metadata.model_dump() if body.metadata is not None else None,
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
