from __future__ import annotations

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse

from llama_pack.api.http_headers import LEGACY_LLAMA_MANAGER_ROUTE_HEADER, LLAMA_PACK_ROUTE_HEADER
from llama_pack.api.dependencies import get_chat_proxy
from llama_pack.api.routes.chat.common import SlotActionRequest
from llama_pack.core.chat.proxy import ChatProxy


router = APIRouter(prefix="/chat")


def _route_headers(route: str) -> dict[str, str]:
    return {
        LLAMA_PACK_ROUTE_HEADER: route,
        LEGACY_LLAMA_MANAGER_ROUTE_HEADER: route,
    }


@router.get("/{model_name}/kv/slots")
async def list_kv_slots(
    model_name: str,
    target: str = "auto",
    proxy: ChatProxy = Depends(get_chat_proxy),
):
    payload, meta = await proxy.kv_slots_with_meta(model_name, target)
    return JSONResponse(content=payload, headers=_route_headers(meta.get("route", "unknown")))


@router.post("/{model_name}/kv/slots/{slot_id}")
async def kv_slot_action(
    model_name: str,
    slot_id: int,
    body: SlotActionRequest,
    proxy: ChatProxy = Depends(get_chat_proxy),
):
    payload, meta = await proxy.kv_slot_action_with_meta(model_name, slot_id, body.action, body.target)
    return JSONResponse(content=payload, headers=_route_headers(meta.get("route", "unknown")))


@router.get("/{model_name}/kv/capabilities")
async def kv_capabilities(
    model_name: str,
    target: str = "auto",
    proxy: ChatProxy = Depends(get_chat_proxy),
):
    payload, meta = await proxy.kv_capabilities_with_meta(model_name, target)
    return JSONResponse(content=payload, headers=_route_headers(meta.get("route", "unknown")))
