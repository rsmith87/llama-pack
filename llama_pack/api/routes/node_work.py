from __future__ import annotations

import secrets

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from llama_pack.api.dependencies import get_orchestrator, get_project_graph_store
from llama_pack.api.http_headers import get_request_api_key
from llama_pack.core.orchestration.orchestrator import Orchestrator
from llama_pack.core.persistence.project_graph_store_orm import ProjectGraphStoreOrm


router = APIRouter()


def _enforce_node_work_auth(request: Request, node: str) -> None:
    try:
        node_config = request.app.state.node_registry.get_node_config(node)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=f"Unknown node: {node}") from exc
    expected = node_config.api_key
    if not expected:
        raise HTTPException(status_code=401, detail="Node work API key is required")
    provided = get_request_api_key(request.headers)
    if not provided or not secrets.compare_digest(provided, expected):
        raise HTTPException(status_code=401, detail="Unauthorized")


class ClaimRequest(BaseModel):
    capacity: dict | None = None
    labels: dict | None = None
    max_jobs: int = Field(default=1, ge=1, le=20)


class ProgressRequest(BaseModel):
    progress: dict


class CompleteRequest(BaseModel):
    result: dict
    artifacts: list[dict] | None = None


class FailRequest(BaseModel):
    error_code: str
    error_detail: str | None = None
    retryable: bool = True


@router.get("/nodes/{node}/work/jobs/{job_id}/cancellation")
def work_job_cancellation(
    node: str,
    job_id: str,
    request: Request,
    orchestrator: Orchestrator = Depends(get_orchestrator),
):
    _enforce_node_work_auth(request, node)
    try:
        job = orchestrator.get_job(job_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {
        "id": job.get("id"),
        "cancellation_requested": bool(job.get("cancellation_requested")),
    }


@router.post("/nodes/{node}/work/claim")
def claim_work(
    node: str,
    body: ClaimRequest,
    request: Request,
    orchestrator: Orchestrator = Depends(get_orchestrator),
):
    _enforce_node_work_auth(request, node)
    return orchestrator.claim_jobs(
        node_name=node,
        max_jobs=body.max_jobs,
        capacity=body.capacity,
        labels=body.labels,
    )


@router.post("/nodes/{node}/work/{attempt_id}/progress")
def progress_work(
    node: str,
    attempt_id: str,
    body: ProgressRequest,
    request: Request,
    orchestrator: Orchestrator = Depends(get_orchestrator),
):
    _enforce_node_work_auth(request, node)
    try:
        orchestrator.progress(node_name=node, attempt_id=attempt_id, progress=body.progress)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return {"ok": True}


@router.post("/nodes/{node}/work/{attempt_id}/complete")
def complete_work(
    node: str,
    attempt_id: str,
    body: CompleteRequest,
    request: Request,
    orchestrator: Orchestrator = Depends(get_orchestrator),
    project_graph_store: ProjectGraphStoreOrm = Depends(get_project_graph_store),
):
    _enforce_node_work_auth(request, node)
    try:
        _import_project_graph_snapshot(body.result, project_graph_store)
        result = dict(body.result)
        result.pop("graph_snapshot", None)
        return orchestrator.complete(node_name=node, attempt_id=attempt_id, result=result, artifacts=body.artifacts)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.post("/nodes/{node}/work/{attempt_id}/fail")
def fail_work(
    node: str,
    attempt_id: str,
    body: FailRequest,
    request: Request,
    orchestrator: Orchestrator = Depends(get_orchestrator),
):
    _enforce_node_work_auth(request, node)
    try:
        return orchestrator.fail(
            node_name=node,
            attempt_id=attempt_id,
            error_code=body.error_code,
            error_detail=body.error_detail,
            retryable=body.retryable,
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


def _import_project_graph_snapshot(result: dict, project_graph_store: ProjectGraphStoreOrm) -> None:
    if result.get("status") != "ready":
        return
    graph_snapshot = result.get("graph_snapshot")
    if not isinstance(graph_snapshot, dict):
        return
    snapshot = graph_snapshot.get("snapshot")
    files = graph_snapshot.get("files")
    symbols = graph_snapshot.get("symbols")
    imports = graph_snapshot.get("imports")
    relations = graph_snapshot.get("relations")
    if not isinstance(snapshot, dict):
        raise ValueError("Project graph completion result graph_snapshot.snapshot must be an object")
    if not isinstance(files, list):
        raise ValueError("Project graph completion result graph_snapshot.files must be a list")
    if not isinstance(symbols, list):
        raise ValueError("Project graph completion result graph_snapshot.symbols must be a list")
    if not isinstance(imports, list):
        raise ValueError("Project graph completion result graph_snapshot.imports must be a list")
    if not isinstance(relations, list):
        raise ValueError("Project graph completion result graph_snapshot.relations must be a list")
    project_graph_store.import_snapshot_graph(
        snapshot=snapshot,
        files=files,
        symbols=symbols,
        imports=imports,
        relations=relations,
    )
