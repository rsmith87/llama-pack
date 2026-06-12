from __future__ import annotations

import httpx
from fastapi import APIRouter, Depends

from llama_pack.api.dependencies import get_config
from llama_pack.core.config import AppConfig
from llama_pack.core.network.tls_diagnostics import network_error_text
from llama_pack.core.runtime.health_check import health_payload


router = APIRouter()


@router.get("/health")
def health(config: AppConfig = Depends(get_config)) -> dict[str, object]:
    return health_payload(config)


@router.get("/health/controller")
async def controller_health(config: AppConfig = Depends(get_config)) -> dict[str, object]:
    if not config.controller_url:
        return {"reachable": False}
    url = f"{config.controller_url.rstrip('/')}/health"
    try:
        async with httpx.AsyncClient(timeout=5, verify=True) as client:
            resp = await client.get(url)
            return {"reachable": resp.status_code < 500, "status_code": resp.status_code}
    except Exception as exc:
        return {"reachable": False, "error": network_error_text(exc)}
