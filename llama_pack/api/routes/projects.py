from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field

from llama_pack.api.dependencies import get_project_store
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


def _clean_optional_string(value: str | None) -> str | None:
    if value is None:
        return None
    stripped = value.strip()
    return stripped if stripped else None
