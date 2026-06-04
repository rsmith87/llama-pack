from __future__ import annotations

LM_API_PREFIX = "/lm-api/v1"


def should_bypass_middleware(path: str, method: str) -> bool:
    if path.startswith("/ui") or path in {"/", "/favicon.ico"}:
        return True
    if method == "GET" and path.startswith("/plugin-assets/"):
        return True
    if path == f"{LM_API_PREFIX}/setup/status" and method == "GET":
        return True
    if path == f"{LM_API_PREFIX}/setup/bootstrap-admin" and method == "POST":
        return True
    if path == f"{LM_API_PREFIX}/test-chat/bootstrap":
        return True
    if path.startswith("/health") or path.startswith(f"{LM_API_PREFIX}/health"):
        return True
    if path.startswith(f"{LM_API_PREFIX}/auth/login"):
        return True
    if path.startswith(f"{LM_API_PREFIX}/nodes/") and path.endswith("/heartbeat"):
        return True
    if path.startswith(f"{LM_API_PREFIX}/nodes/register"):
        return True
    if "/work/" in path or path.endswith("/work/claim"):
        return True
    if method == "GET" and path.startswith(f"{LM_API_PREFIX}/transfer-source/"):
        return True
    if (method == "GET" and path.startswith(f"{LM_API_PREFIX}/auth/me")) or path.startswith(f"{LM_API_PREFIX}/auth/logout"):
        return True
    return False


def should_validate_ui_session(auth_enabled: bool, method: str) -> bool:
    return auth_enabled


def is_viewer_forbidden(path: str, role: str) -> bool:
    if role != "viewer":
        return False
    if path in {f"{LM_API_PREFIX}/auth/logout"}:
        return False
    if path.startswith(f"{LM_API_PREFIX}/audit") or path.startswith(f"{LM_API_PREFIX}/auth"):
        return False
    if path.startswith(f"{LM_API_PREFIX}/threads/") and path.endswith("/events"):
        return False
    return True


def is_external_key_forbidden(path: str, role: str) -> bool:
    """External API keys (role='external') may only call consumer chat endpoints."""
    if role != "external":
        return False
    return not (path.startswith("/v1/") or path == "/api/chat")


def is_test_chat_key_forbidden(path: str, method: str) -> bool:
    safe_exact = {
        ("GET", f"{LM_API_PREFIX}/models"),
        ("GET", f"{LM_API_PREFIX}/nodes"),
        ("GET", f"{LM_API_PREFIX}/nodes/models"),
        ("GET", f"{LM_API_PREFIX}/nodes/status"),
        ("GET", f"{LM_API_PREFIX}/chat/sessions"),
    }
    if (method, path) in safe_exact:
        return False
    if path.startswith(f"{LM_API_PREFIX}/chat/sessions/") and method in {"GET", "DELETE"}:
        return False
    if path == f"{LM_API_PREFIX}/chat/sessions" and method == "POST":
        return False
    if path.startswith(f"{LM_API_PREFIX}/chat/") and method in {"GET", "POST"}:
        return False
    if path == f"{LM_API_PREFIX}/threads" and method == "POST":
        return False
    if path.startswith(f"{LM_API_PREFIX}/threads/") and path.endswith("/events") and method == "GET":
        return False
    if path.startswith(f"{LM_API_PREFIX}/threads/") and path.endswith(("/messages", "/messages/stream")) and method == "POST":
        return False
    if path.startswith("/v1/") and method == "POST":
        return False
    if path == "/api/chat" and method == "POST":
        return False
    return True


def should_enforce_agent_key(mode: str, configured_key: str | None, path: str) -> bool:
    if mode != "agent":
        return False
    if not configured_key:
        return False
    if path in {"/health", f"{LM_API_PREFIX}/health"}:
        return False
    return True
