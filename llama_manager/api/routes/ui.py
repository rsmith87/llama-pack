from __future__ import annotations

import secrets
from datetime import UTC, datetime, timedelta
from pathlib import Path

from fastapi import APIRouter, Request
from fastapi.responses import FileResponse, JSONResponse, PlainTextResponse, Response
from fastapi.staticfiles import StaticFiles


UI_DIR = Path(__file__).resolve().parents[2] / "ui"
TEST_CHAT_SESSION_COOKIE = "lm_test_chat_session"
TEST_CHAT_SESSION_SECONDS = 12 * 60 * 60

router = APIRouter()
api_router = APIRouter()
static_app = StaticFiles(directory=UI_DIR, check_dir=False)
REACT_ROUTE_PATHS = [
    "/ui/",
    "/ui/chat",
    "/ui/nodes",
    "/ui/gguf-library",
    "/ui/hf-to-gguf",
    "/ui/hf-downloads",
    "/ui/quantization",
    "/ui/controller-ops",
    "/ui/embeddings",
    "/ui/audit",
    "/ui/settings",
    "/ui/test-chat",
]


def index_path() -> Path:
    return UI_DIR / "index.html"


@router.get("/", include_in_schema=False)
def index():
    path = index_path()
    if not path.exists():
        return PlainTextResponse(
            "Llama Manager UI build not found. Run the frontend build or install a package that includes llama_manager/ui.",
            status_code=503,
        )
    return FileResponse(path)


for route_path in REACT_ROUTE_PATHS:
    router.add_api_route(route_path, index, methods=["GET"], include_in_schema=False)


@router.get("/favicon.ico", include_in_schema=False)
def favicon():
    return Response(status_code=204)


def key_hint(raw_key: str) -> str:
    return f"{raw_key[:6]}...{raw_key[-4:]}" if len(raw_key) > 10 else "configured"


def _active_test_chat_session(request: Request, token: str) -> dict[str, str] | None:
    session = request.app.state.test_chat_sessions.get(token)
    if not session:
        return None
    expires_at = session.get("expires_at")
    if not expires_at or datetime.now(UTC) > datetime.fromisoformat(expires_at):
        request.app.state.test_chat_sessions.pop(token, None)
        return None
    return session


@api_router.get("/test-chat/bootstrap")
def test_chat_bootstrap(request: Request):
    config = request.app.state.config
    if config.mode == "agent":
        controller_url = (config.controller_url or "").rstrip("/")
        return {
            "enabled": False,
            "mode": "agent",
            "controller_url": controller_url,
            "controller_test_chat_url": f"{controller_url}/ui/test-chat" if controller_url else "",
            "key_hint": "",
        }
    api_key = request.app.state.config.test_chat_api_key or ""
    resolved = request.app.state.auth_store.resolve_key(api_key) if api_key else None
    enabled = bool(resolved and resolved.get("role") == "test_chat")
    payload = {
        "enabled": enabled,
        "mode": request.app.state.config.mode,
        "key_hint": key_hint(api_key) if api_key else "",
    }
    response = JSONResponse(payload)
    if enabled:
        existing_token = request.cookies.get(TEST_CHAT_SESSION_COOKIE) or ""
        token = existing_token if _active_test_chat_session(request, existing_token) else secrets.token_urlsafe(32)
        expires_at = datetime.now(UTC) + timedelta(seconds=TEST_CHAT_SESSION_SECONDS)
        request.app.state.test_chat_sessions[token] = {
            "api_key": api_key,
            "expires_at": expires_at.isoformat(),
        }
        response.set_cookie(
            TEST_CHAT_SESSION_COOKIE,
            token,
            max_age=TEST_CHAT_SESSION_SECONDS,
            httponly=True,
            secure=request.url.scheme == "https",
            samesite="strict",
            path="/",
        )
    return response
