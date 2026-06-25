from __future__ import annotations

from typing import Any, Literal

from fastapi import APIRouter, Request
from pydantic import BaseModel, Field

from llama_pack.api.http_headers import LLAMA_PACK_API_KEY_HEADER


router = APIRouter(prefix="/client-discovery", tags=["client-discovery"])


class ClientCapabilities(BaseModel):
    openaiChatCompletions: bool = True
    streaming: bool = True
    localChatSessions: bool = False
    projectContext: bool = True
    setupDiagnostics: bool = True
    pluginAuth: bool = False


class ClientAuthDiscovery(BaseModel):
    methods: list[str] = Field(default_factory=lambda: ["llama_pack_api_key", "external_api_key"])
    sessionHeader: str = "X-UI-Session"
    apiKeyHeader: str = LLAMA_PACK_API_KEY_HEADER


class ClientEndpointDiscovery(BaseModel):
    openaiChatCompletions: str = "/v1/chat/completions"
    openaiModels: str = "/v1/models"
    clientSession: str = "/v1/client/session"
    clientSetupDiagnostics: str = "/v1/client/diagnostics/setup"
    clientChatDiagnostics: str = "/v1/client/diagnostics/chat"
    clientProjectContext: str = "/v1/client/project-context/{action}"
    clientProjects: str = "/v1/client/projects"
    clientProject: str = "/v1/client/projects/{project_id}"
    clientProjectNodeRoots: str = "/v1/client/projects/{project_id}/node-roots"
    models: str = "/lm-api/v1/models"
    pluginsStatus: str = "/lm-api/v1/plugins/status"
    docs: str = "/ui/docs"


class ClientSetupDiscovery(BaseModel):
    recommendedApp: str = "campfire"
    authMethod: str = "external_api_key"
    diagnosticsEndpoint: str = "/v1/client/diagnostics/setup"
    modelsEndpoint: str = "/v1/models"
    chatEndpoint: str = "/v1/chat/completions"
    requiredHeaders: list[str] = Field(default_factory=lambda: [LLAMA_PACK_API_KEY_HEADER])


class ClientDiscoveryResponse(BaseModel):
    product: Literal["llama-pack"] = "llama-pack"
    version: str
    mode: str
    capabilities: ClientCapabilities
    auth: ClientAuthDiscovery
    endpoints: dict[str, str]
    setup: ClientSetupDiscovery


@router.get("")
async def client_discovery(request: Request) -> ClientDiscoveryResponse:
    config = request.app.state.config
    auth_methods = ["llama_pack_api_key", "external_api_key"]
    endpoints = ClientEndpointDiscovery()
    plugin_auth_endpoints = await _plugin_client_auth_endpoints(request)

    for method, endpoint_key, endpoint in plugin_auth_endpoints:
        auth_methods.append(method)

    return ClientDiscoveryResponse(
        version=_config_version(config),
        mode=config.mode,
        capabilities=ClientCapabilities(pluginAuth=bool(plugin_auth_endpoints)),
        auth=ClientAuthDiscovery(methods=auth_methods),
        setup=ClientSetupDiscovery(),
        endpoints={
            **{key: str(value) for key, value in endpoints.model_dump(exclude_none=True).items()},
            **{endpoint_key: endpoint for _method, endpoint_key, endpoint in plugin_auth_endpoints},
        },
    )


async def _plugin_client_auth_endpoints(request: Request) -> list[tuple[str, str, str]]:
    registry = getattr(request.app.state, "plugin_registry", None)
    if registry is None:
        return []
    status_payload = await registry.status_payload_async()
    status_by_id = {item.get("id"): item for item in status_payload.get("plugins", [])}
    endpoints: list[tuple[str, str, str]] = []
    for record in registry.records.values():
        client_auth = record.manifest.client_auth if record.manifest else None
        status = status_by_id.get(record.id, {})
        if client_auth is None or status.get("status") != "enabled":
            continue
        if list(status.get("errors", []) or []):
            continue
        endpoints.append((client_auth.method, client_auth.endpoint_key, client_auth.endpoint))
    return endpoints


def _config_version(config: Any) -> str:
    return str(getattr(config, "version", None) or "unknown")
