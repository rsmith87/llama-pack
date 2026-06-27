from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from llama_pack.api.dependencies import get_config, get_download_manager
from llama_pack.core.config import AppConfig
from llama_pack.core.model_assets.downloads import DownloadManager
from llama_pack.core.runtime.health_check import health_payload
from llama_pack.core.runtime.log_stream import stream_log_file
from llama_pack.core.runtime.network_security import OfflineNetworkBlockedError


class StartDownloadRequest(BaseModel):
    revision: str | None = None
    include_file: str | None = None
    mmproj_file: str | None = None


router = APIRouter(prefix="/downloads")


@router.get("/models")
def list_download_models(manager: DownloadManager = Depends(get_download_manager)):
    return manager.list_models()


@router.get("/history")
def download_history(
    status: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    manager: DownloadManager = Depends(get_download_manager),
):
    return manager.history(status=status, limit=limit)


@router.get("/quants")
def remote_quants_by_query(
    repo_id: str = Query(...),
    revision: str | None = Query(default=None),
    manager: DownloadManager = Depends(get_download_manager),
):
    try:
        return manager.list_remote_quants(repo_id, revision=revision)
    except OfflineNetworkBlockedError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/recommendations")
def download_recommendations(
    config: AppConfig = Depends(get_config),
    manager: DownloadManager = Depends(get_download_manager),
):
    health = health_payload(config)
    system = health.get("system") if isinstance(health, dict) else None
    return manager.recommendations(system if isinstance(system, dict) else None)


@router.get("/{repo_id:path}/quants")
def remote_quants(
    repo_id: str,
    revision: str | None = Query(default=None),
    manager: DownloadManager = Depends(get_download_manager),
):
    try:
        return manager.list_remote_quants(repo_id, revision=revision)
    except OfflineNetworkBlockedError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/{repo_id:path}/start")
def start_download(
    repo_id: str,
    request: Request,
    body: StartDownloadRequest | None = None,
    manager: DownloadManager = Depends(get_download_manager),
):
    try:
        actor = getattr(request.state, "ui_user", "unknown")
        revision = body.revision if body else None
        include_file = body.include_file if body else None
        mmproj_file = body.mmproj_file if body else None
        return manager.start(repo_id, triggered_by=actor, revision=revision, include_file=include_file, mmproj_file=mmproj_file)
    except OfflineNetworkBlockedError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.get("/{download_id}")
def get_download(download_id: str, manager: DownloadManager = Depends(get_download_manager)):
    try:
        return manager.status(download_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/{download_id}/logs")
def download_logs(download_id: str, lines: int = 200, manager: DownloadManager = Depends(get_download_manager)):
    try:
        return {"id": download_id, "text": manager.tail_logs(download_id, lines=lines)}
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/{download_id}/logs/stream")
def stream_download_logs(
    download_id: str,
    lines: int = 200,
    manager: DownloadManager = Depends(get_download_manager),
):
    try:
        log_path = manager.log_path(download_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return StreamingResponse(stream_log_file(log_path, lines=lines), media_type="text/event-stream")


@router.post("/{download_id}/cancel")
def cancel_download(download_id: str, manager: DownloadManager = Depends(get_download_manager)):
    try:
        return manager.cancel(download_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.delete("/{download_id}")
def delete_download(download_id: str, manager: DownloadManager = Depends(get_download_manager)):
    try:
        manager.delete(download_id)
        return {"id": download_id, "deleted": True}
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
