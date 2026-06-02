from __future__ import annotations

import asyncio
import re

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, model_validator

from llama_manager.api.dependencies import get_benchmark_runner, get_benchmark_store
from llama_manager.core.benchmarks.runner import BenchmarkRunner
from llama_manager.core.persistence.benchmark_store_orm import BenchmarkStoreOrm

router = APIRouter(prefix="/benchmarks")

_SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


class CreateBenchmarkDefinitionRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    slug: str | None = Field(default=None, min_length=1, max_length=80)
    description: str | None = None
    prompt_text: str = Field(min_length=1)
    system_prompt: str | None = None
    request_defaults: dict = Field(default_factory=dict)
    sample_count: int = Field(default=3, ge=1, le=20)
    max_tokens: int = Field(default=256, ge=1, le=4096)
    tags: list[str] = Field(default_factory=list)


class StartBenchmarkRunsRequest(BaseModel):
    definition_id: str
    models: list[str] = Field(min_length=1)
    target_selector: str = "auto"
    target_node: str | None = None
    managed_load: bool = False
    restore_after: bool = False

    @model_validator(mode="after")
    def require_target_node_for_managed_load(self) -> "StartBenchmarkRunsRequest":
        if self.managed_load and not (self.target_node or "").strip():
            raise ValueError("target_node is required when managed_load=true")
        return self


class CompareBenchmarkRunsRequest(BaseModel):
    run_ids: list[str] = Field(min_length=2)


def _derive_slug(name: str) -> str:
    slug = name.lower()
    slug = re.sub(r"[^a-z0-9]+", "-", slug)
    slug = slug.strip("-")
    return slug or "definition"


@router.get("/definitions")
async def list_definitions(
    include_archived: bool = Query(default=False),
    store: BenchmarkStoreOrm = Depends(get_benchmark_store),
):
    return {"definitions": store.list_definitions(include_archived=include_archived)}


@router.post("/definitions", status_code=201)
async def create_definition(
    body: CreateBenchmarkDefinitionRequest,
    store: BenchmarkStoreOrm = Depends(get_benchmark_store),
):
    slug = body.slug or _derive_slug(body.name)
    if not _SLUG_RE.match(slug):
        raise HTTPException(status_code=422, detail="slug must be lowercase alphanumeric with hyphens")
    return store.create_definition(
        name=body.name,
        slug=slug,
        description=body.description,
        prompt_text=body.prompt_text,
        system_prompt=body.system_prompt,
        request_defaults=body.request_defaults,
        sample_count=body.sample_count,
        max_tokens=body.max_tokens,
        tags=body.tags,
    )


@router.get("/runs")
async def list_runs(
    definition_id: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    store: BenchmarkStoreOrm = Depends(get_benchmark_store),
):
    return {"runs": store.list_runs(definition_id=definition_id, limit=limit)}


@router.get("/runs/{run_id}")
async def get_run(
    run_id: str,
    store: BenchmarkStoreOrm = Depends(get_benchmark_store),
):
    run = store.get_run(run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Run not found")
    return run


@router.post("/runs", status_code=202)
async def start_runs(
    body: StartBenchmarkRunsRequest,
    store: BenchmarkStoreOrm = Depends(get_benchmark_store),
    runner: BenchmarkRunner = Depends(get_benchmark_runner),
):
    defn = store.get_definition(body.definition_id)
    if defn is None:
        raise HTTPException(status_code=404, detail="Benchmark definition not found")

    runs = []
    for model in body.models:
        run = store.create_run(
            benchmark_definition_id=body.definition_id,
            model=model,
            target_selector=f"node:{body.target_node}" if body.managed_load else body.target_selector,
            target_node=body.target_node.strip() if body.target_node else None,
            managed_load=body.managed_load,
            restore_after=body.restore_after,
            status="pending",
        )
        runs.append(run)
        asyncio.create_task(runner.execute_run(run["id"]))

    return {"runs": runs}


@router.post("/runs/compare")
async def compare_runs(
    body: CompareBenchmarkRunsRequest,
    store: BenchmarkStoreOrm = Depends(get_benchmark_store),
):
    runs = []
    for run_id in body.run_ids:
        run = store.get_run(run_id)
        if run is None:
            raise HTTPException(status_code=404, detail=f"Run {run_id} not found")
        runs.append(run)

    def_ids = {r["benchmark_definition_id"] for r in runs}
    if len(def_ids) > 1:
        raise HTTPException(
            status_code=422,
            detail="Cannot compare runs from different benchmark definitions",
        )

    return {"definition_id": next(iter(def_ids)), "runs": runs}
