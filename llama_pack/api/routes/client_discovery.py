from __future__ import annotations

from typing import Any, Literal

from fastapi import APIRouter, Request
from pydantic import BaseModel, Field


router = APIRouter(prefix="/client-discovery", tags=["client-discovery"])


class ClientCapabilities(BaseModel):
    openaiChatCompletions: bool = True
    streaming: bool = True
    localChatSessions: bool = False
    businessPlugin: bool = False


class ClientAuthDiscovery(BaseModel):
    methods: list[str] = Field(default_factory=lambda: ["llama_pack_api_key", "external_api_key"])
    sessionHeader: str = "X-UI-Session"
    apiKeyHeader: str = "X-Llama-Manager-Key"


class ClientEndpointDiscovery(BaseModel):
    openaiChatCompletions: str = "/v1/chat/completions"
    openaiModels: str = "/v1/models"
    clientSession: str = "/v1/client/session"
    clientChatDiagnostics: str = "/v1/client/diagnostics/chat"
    models: str = "/lm-api/v1/models"
    pluginsStatus: str = "/lm-api/v1/plugins/status"
    docs: str = "/ui/docs"
    businessAuth: str | None = None


class ClientDiscoveryResponse(BaseModel):
    product: Literal["llama-pack"] = "llama-pack"
    version: str
    mode: str
    capabilities: ClientCapabilities
    auth: ClientAuthDiscovery
    endpoints: dict[str, str]


@router.get("")
async def client_discovery(request: Request) -> ClientDiscoveryResponse:
    config = request.app.state.config
    business_enabled = await _business_plugin_available(request)
    auth_methods = ["llama_pack_api_key", "external_api_key"]
    endpoints = ClientEndpointDiscovery()

    if business_enabled:
        auth_methods.append("llama_pack_business")
        endpoints.businessAuth = "/lm-api/v1/plugins/llama_pack_business/auth/login"

    return ClientDiscoveryResponse(
        version=_config_version(config),
        mode=config.mode,
        capabilities=ClientCapabilities(businessPlugin=business_enabled),
        auth=ClientAuthDiscovery(methods=auth_methods),
        endpoints={key: str(value) for key, value in endpoints.model_dump(exclude_none=True).items()},
    )


async def _business_plugin_available(request: Request) -> bool:
    registry = getattr(request.app.state, "plugin_registry", None)
    if registry is None:
        return False
    status_payload = await registry.status_payload_async()
    record = next(
        (item for item in status_payload.get("plugins", []) if item.get("id") == "llama_pack_business"),
        None,
    )
    if record is None or record.get("status") != "enabled":
        return False
    return not list(record.get("errors", []) or [])


def _config_version(config: Any) -> str:
    return str(getattr(config, "version", None) or "unknown")
