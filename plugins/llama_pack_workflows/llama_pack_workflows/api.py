from __future__ import annotations

from fastapi import APIRouter, HTTPException

from llama_pack_workflows.models import WorkflowDefinitionCreate
from llama_pack_workflows.runner import WorkflowRunner
from llama_pack_workflows.store import WorkflowStore
from llama_pack_workflows.templates import builtin_templates, get_template


def create_router(store: WorkflowStore, runner: WorkflowRunner) -> APIRouter:
    router = APIRouter()

    @router.get("/health")
    async def health():
        return {"ok": True, "plugin": "llama_pack_workflows"}

    @router.get("/templates")
    async def list_templates():
        return {"templates": [template.model_dump(mode="json") for template in builtin_templates()]}

    @router.get("/workflows")
    async def list_workflows():
        return {"workflows": [item.model_dump(mode="json") for item in store.list_definitions()]}

    @router.post("/workflows")
    async def create_workflow(body: WorkflowDefinitionCreate):
        try:
            get_template(body.template_id)
            created = store.create_definition(body)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        return created.model_dump(mode="json")

    @router.put("/workflows/{workflow_id}")
    async def update_workflow(workflow_id: str, body: WorkflowDefinitionCreate):
        try:
            get_template(body.template_id)
            updated = store.update_definition(workflow_id, body)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        except KeyError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        return updated.model_dump(mode="json")

    @router.post("/workflows/{workflow_id}/enable")
    async def enable_workflow(workflow_id: str):
        try:
            return store.set_definition_enabled(workflow_id, True).model_dump(mode="json")
        except KeyError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc

    @router.post("/workflows/{workflow_id}/disable")
    async def disable_workflow(workflow_id: str):
        try:
            return store.set_definition_enabled(workflow_id, False).model_dump(mode="json")
        except KeyError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc

    @router.post("/workflows/{workflow_id}/runs")
    async def run_workflow(workflow_id: str):
        try:
            run = await runner.run_manual(workflow_id)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        return run.model_dump(mode="json")

    @router.get("/runs")
    async def list_runs(workflow_id: str | None = None):
        return {"runs": [run.model_dump(mode="json") for run in store.list_runs(workflow_id)]}

    @router.get("/runs/{run_id}")
    async def get_run(run_id: str):
        try:
            return store.get_run_detail(run_id).model_dump(mode="json")
        except KeyError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc

    return router
