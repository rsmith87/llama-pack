from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field

from llama_pack.api.dependencies import get_orchestrator, get_project_graph_store, get_project_store
from llama_pack.core.orchestration.orchestrator import Orchestrator
from llama_pack.core.persistence.project_graph_store_orm import ProjectGraphStoreOrm
from llama_pack.core.persistence.project_store_orm import ProjectStoreOrm

router = APIRouter(prefix="/projects")

SAFE_ROOT_STATUSES = {"unknown", "allowed", "blocked"}


class CreateProjectRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=160)
    root_hint: str | None = Field(default=None, max_length=4096)


class UpdateProjectRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=160)
    root_hint: str | None = Field(default=None, max_length=4096)
    archived: bool


class UpsertProjectNodeRootRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    node_name: str = Field(min_length=1, max_length=160)
    root_path: str = Field(min_length=1, max_length=4096)
    safe_root_status: str = Field(min_length=1, max_length=32)


class IndexProjectGraphRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    node_name: str = Field(min_length=1, max_length=160)
    root_path: str = Field(min_length=1, max_length=4096)
    force: bool = False


class ProjectGraphQueryRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    type: str = Field(min_length=1, max_length=64)
    payload: dict[str, Any] = Field(default_factory=dict)


@router.get("")
async def list_projects(
    include_archived: bool = Query(default=False),
    store: ProjectStoreOrm = Depends(get_project_store),
):
    return {"projects": store.list_projects(include_archived=include_archived)}


@router.post("", status_code=201)
async def create_project(
    body: CreateProjectRequest,
    store: ProjectStoreOrm = Depends(get_project_store),
):
    return store.create_project(name=body.name.strip(), root_hint=_clean_optional_string(body.root_hint))


@router.get("/{project_id}")
async def get_project(
    project_id: str,
    store: ProjectStoreOrm = Depends(get_project_store),
):
    project = store.get_project(project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.patch("/{project_id}")
async def update_project(
    project_id: str,
    body: UpdateProjectRequest,
    store: ProjectStoreOrm = Depends(get_project_store),
):
    project = store.update_project(project_id=project_id, name=body.name.strip(), root_hint=_clean_optional_string(body.root_hint), archived=body.archived)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.get("/{project_id}/node-roots")
async def list_project_node_roots(
    project_id: str,
    store: ProjectStoreOrm = Depends(get_project_store),
):
    roots = store.list_node_roots(project_id)
    if roots is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return {"node_roots": roots}


@router.put("/{project_id}/node-roots")
async def upsert_project_node_root(
    project_id: str,
    body: UpsertProjectNodeRootRequest,
    store: ProjectStoreOrm = Depends(get_project_store),
):
    status = body.safe_root_status.strip()
    if status not in SAFE_ROOT_STATUSES:
        expected = ", ".join(sorted(SAFE_ROOT_STATUSES))
        raise HTTPException(status_code=422, detail=f"safe_root_status must be one of: {expected}")
    root = store.upsert_node_root(project_id=project_id, node_name=body.node_name.strip(), root_path=body.root_path.strip(), safe_root_status=status)
    if root is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return root


@router.post("/{project_id}/graph/index", status_code=201)
async def index_project_graph(
    project_id: str,
    body: IndexProjectGraphRequest,
    store: ProjectStoreOrm = Depends(get_project_store),
    orchestrator: Orchestrator = Depends(get_orchestrator),
):
    root = _require_project_root(store, project_id, body.node_name.strip(), body.root_path.strip())
    if root["safe_root_status"] != "allowed":
        raise HTTPException(status_code=409, detail=f"Project root is not allowed for graph indexing: {body.root_path.strip()}")
    payload = {
        "project_id": project_id,
        "node_name": body.node_name.strip(),
        "root_path": body.root_path.strip(),
        "force": body.force,
    }
    return orchestrator.create_job(
        job_type="project.graph.index",
        payload=payload,
        priority=0,
        target=f"node:{body.node_name.strip()}",
        requested_by=None,
    )


@router.get("/{project_id}/graph/status")
async def get_project_graph_status(
    project_id: str,
    store: ProjectStoreOrm = Depends(get_project_store),
    graph_store: ProjectGraphStoreOrm = Depends(get_project_graph_store),
):
    if store.get_project(project_id) is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return graph_store.status(project_id)


@router.get("/{project_id}/graph/overview")
async def get_project_graph_overview(
    project_id: str,
    store: ProjectStoreOrm = Depends(get_project_store),
    graph_store: ProjectGraphStoreOrm = Depends(get_project_graph_store),
):
    if store.get_project(project_id) is None:
        raise HTTPException(status_code=404, detail="Project not found")
    active = graph_store.get_active_snapshot(project_id)
    if active is None:
        raise HTTPException(status_code=409, detail="Project graph is not indexed")
    return {
        "project_id": project_id,
        "snapshot": active,
        "status": "ready",
        "summary": {
            "file_count": active["file_count"],
            "symbol_count": active["symbol_count"],
            "relation_count": active["relation_count"],
        },
    }


@router.post("/{project_id}/graph/query")
async def query_project_graph(
    project_id: str,
    body: ProjectGraphQueryRequest,
    store: ProjectStoreOrm = Depends(get_project_store),
    graph_store: ProjectGraphStoreOrm = Depends(get_project_graph_store),
):
    if store.get_project(project_id) is None:
        raise HTTPException(status_code=404, detail="Project not found")
    if body.type == "overview":
        active = graph_store.get_active_snapshot(project_id)
        if active is None:
            raise HTTPException(status_code=409, detail="Project graph is not indexed")
        return {"type": body.type, "result": active}
    if body.type == "find_symbol":
        query = str(body.payload.get("query") or "").strip()
        if not query:
            raise HTTPException(status_code=422, detail="find_symbol query requires payload.query")
        kind_value = body.payload.get("kind")
        kind = kind_value if isinstance(kind_value, str) and kind_value.strip() else None
        return {"type": body.type, "result": graph_store.find_symbols(project_id=project_id, query=query, kind=kind)}
    raise HTTPException(status_code=422, detail=f"Unsupported project graph query type: {body.type}")


def _clean_optional_string(value: str | None) -> str | None:
    if value is None:
        return None
    stripped = value.strip()
    return stripped if stripped else None


def _require_project_root(store: ProjectStoreOrm, project_id: str, node_name: str, root_path: str) -> dict[str, object]:
    roots = store.list_node_roots(project_id)
    if roots is None:
        raise HTTPException(status_code=404, detail="Project not found")
    for root in roots:
        if root["node_name"] == node_name and root["root_path"] == root_path:
            return root
    raise HTTPException(status_code=409, detail=f"Project root is not registered for node {node_name}: {root_path}")
