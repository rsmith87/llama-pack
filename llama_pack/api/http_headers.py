from __future__ import annotations

LLAMA_PACK_API_KEY_HEADER = "X-Llama-Pack-Key"
LEGACY_LLAMA_MANAGER_API_KEY_HEADER = "X-Llama-Manager-Key"

LLAMA_PACK_ROUTE_HEADER = "X-Llama-Pack-Route"
LEGACY_LLAMA_MANAGER_ROUTE_HEADER = "X-Llama-Manager-Route"

LLAMA_PACK_THREAD_ID_HEADER = "X-Llama-Pack-Thread-Id"
LEGACY_LLAMA_MANAGER_THREAD_ID_HEADER = "X-Llama-Manager-Thread-Id"

LLAMA_PACK_NODE_HEADER = "X-Llama-Pack-Node"
LEGACY_LLAMA_MANAGER_NODE_HEADER = "X-Llama-Manager-Node"

LLAMA_PACK_MODEL_HEADER = "X-Llama-Pack-Model"
LEGACY_LLAMA_MANAGER_MODEL_HEADER = "X-Llama-Manager-Model"

LLAMA_PACK_RESOLVED_MODEL_HEADER = "X-Llama-Pack-Resolved-Model"
LEGACY_LLAMA_MANAGER_RESOLVED_MODEL_HEADER = "X-Llama-Manager-Resolved-Model"

LLAMA_PACK_MODEL_FAMILY_HEADER = "X-Llama-Pack-Model-Family"
LEGACY_LLAMA_MANAGER_MODEL_FAMILY_HEADER = "X-Llama-Manager-Model-Family"

LLAMA_PACK_CONTEXT_PROFILE_HEADER = "X-Llama-Pack-Context-Profile"
LEGACY_LLAMA_MANAGER_CONTEXT_PROFILE_HEADER = "X-Llama-Manager-Context-Profile"


def request_api_key_headers() -> list[str]:
    return [LLAMA_PACK_API_KEY_HEADER, LEGACY_LLAMA_MANAGER_API_KEY_HEADER]


def response_route_headers() -> list[str]:
    return [
        LLAMA_PACK_ROUTE_HEADER,
        LEGACY_LLAMA_MANAGER_ROUTE_HEADER,
        LLAMA_PACK_THREAD_ID_HEADER,
        LEGACY_LLAMA_MANAGER_THREAD_ID_HEADER,
        LLAMA_PACK_NODE_HEADER,
        LEGACY_LLAMA_MANAGER_NODE_HEADER,
        LLAMA_PACK_MODEL_HEADER,
        LEGACY_LLAMA_MANAGER_MODEL_HEADER,
        LLAMA_PACK_MODEL_FAMILY_HEADER,
        LEGACY_LLAMA_MANAGER_MODEL_FAMILY_HEADER,
        LLAMA_PACK_CONTEXT_PROFILE_HEADER,
        LEGACY_LLAMA_MANAGER_CONTEXT_PROFILE_HEADER,
        LLAMA_PACK_RESOLVED_MODEL_HEADER,
        LEGACY_LLAMA_MANAGER_RESOLVED_MODEL_HEADER,
    ]


def get_request_api_key(headers: object) -> str:
    get = getattr(headers, "get")
    return get(LLAMA_PACK_API_KEY_HEADER) or get(LEGACY_LLAMA_MANAGER_API_KEY_HEADER) or ""


def get_route_header(headers: object) -> str | None:
    get = getattr(headers, "get")
    return get(LLAMA_PACK_ROUTE_HEADER) or get(LEGACY_LLAMA_MANAGER_ROUTE_HEADER)


def get_node_header(headers: object) -> str | None:
    get = getattr(headers, "get")
    return get(LLAMA_PACK_NODE_HEADER) or get(LEGACY_LLAMA_MANAGER_NODE_HEADER)


def get_model_header(headers: object) -> str | None:
    get = getattr(headers, "get")
    return get(LLAMA_PACK_MODEL_HEADER) or get(LEGACY_LLAMA_MANAGER_MODEL_HEADER)


def compatibility_header_pairs(primary: str, legacy: str, value: str | None) -> dict[str, str]:
    if value is None:
        return {}
    return {primary: value, legacy: value}
