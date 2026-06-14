from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from typing import Literal

from pydantic import BaseModel

from llama_pack.api.dependencies import get_gguf_library, get_process_manager
from llama_pack.core.model_assets.catalog_service import ModelCatalogService
from llama_pack.core.model_assets.library import GgufLibrary
from llama_pack.core.persistence.model_asset_store_orm import ModelAssetStoreOrm
from llama_pack.core.runtime.process_manager import ProcessManager


class AddModelRequest(BaseModel):
    name: str
    port: int
    ctx: int = 4096
    gpu_layers: int = 0
    host: str = "127.0.0.1"
    reasoning: Literal["on", "off", "auto"] | None = None
    reasoning_budget: int | None = None
    prompt_template: str | None = None
    vision: bool = False
    mmproj: str | None = None
    supports_mtp: bool = False
    draft_model_path: str | None = None


class UpdateModelRequest(BaseModel):
    vision: bool | None = None
    mmproj: str | None = None
    ctx: int | None = None
    gpu_layers: int | None = None
    port: int | None = None
    prompt_template: str | None = None
    reasoning: Literal["on", "off", "auto"] | None = None
    reasoning_budget: int | None = None
    supports_mtp: bool | None = None
    draft_model_path: str | None = None


class UpdateGgufAssetRequest(BaseModel):
    model_line: str | None = None


router = APIRouter(prefix="/library")


def _model_lookup(
    store: ModelAssetStoreOrm,
    *,
    model_name: str | None,
) -> dict[str, object] | None:
    if not model_name:
        return None
    row = store.get_model_by_name(model_name)
    if row is None:
        raise HTTPException(status_code=404, detail=f"Unknown model: {model_name}")
    return row


@router.get("/catalog/models")
def list_catalog_models(request: Request):
    catalog: ModelCatalogService = request.app.state.model_catalog_service
    return catalog.list_registered_models()


@router.get("/assets")
def list_assets(
    request: Request,
    source_repo_id: str | None = None,
    download_id: str | None = None,
    model_line: str | None = None,
    missing: bool | None = None,
):
    store: ModelAssetStoreOrm = request.app.state.model_asset_store
    assets = store.list_assets()
    if source_repo_id is not None:
        assets = [asset for asset in assets if asset.get("source_repo_id") == source_repo_id]
    if download_id is not None:
        assets = [asset for asset in assets if asset.get("download_id") == download_id]
    if model_line is not None:
        assets = [asset for asset in assets if asset.get("model_line") == model_line]
    if missing is not None:
        assets = [asset for asset in assets if bool(asset.get("missing")) is missing]
    return assets


@router.get("/assets/{asset_id}/provenance")
def list_asset_provenance(asset_id: str, request: Request):
    store: ModelAssetStoreOrm = request.app.state.model_asset_store
    try:
        store.get_asset(asset_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return store.list_asset_provenance(asset_id)


@router.delete("/assets/missing")
def delete_missing_assets(
    request: Request,
    older_than_days: int = 30,
):
    if older_than_days < 0:
        raise HTTPException(status_code=400, detail="older_than_days must be >= 0")
    store: ModelAssetStoreOrm = request.app.state.model_asset_store
    result = store.delete_stale_missing_assets(older_than_seconds=older_than_days * 86400)
    return {
        "deleted": len(result["deleted_asset_ids"]),
        **result,
    }


@router.get("/profiles")
def list_model_profiles(request: Request, model_name: str | None = None):
    store: ModelAssetStoreOrm = request.app.state.model_asset_store
    model = _model_lookup(store, model_name=model_name)
    if model is not None:
        return store.list_model_profiles(str(model["model_id"]))
    rows: list[dict[str, object]] = []
    for entry in store.list_models():
        rows.extend(store.list_model_profiles(str(entry["model_id"])))
    return sorted(rows, key=lambda item: (str(item.get("model_id") or ""), int(item.get("order") or 100), str(item.get("profile_key") or "")))


@router.get("/deployments")
def list_model_deployments(
    request: Request,
    model_name: str | None = None,
    node_name: str | None = None,
):
    store: ModelAssetStoreOrm = request.app.state.model_asset_store
    model = _model_lookup(store, model_name=model_name)
    if model is not None:
        rows = store.list_model_deployments(str(model["model_id"]))
    else:
        rows = []
        for entry in store.list_models():
            rows.extend(store.list_model_deployments(str(entry["model_id"])))
    if node_name is not None:
        rows = [row for row in rows if row.get("node_name") == node_name]
    return rows


@router.get("/ggufs")
def list_ggufs(
    library: GgufLibrary = Depends(get_gguf_library),
    manager: ProcessManager = Depends(get_process_manager),
):
    return library.list_files(model_statuses=manager.list_statuses())


@router.post("/ggufs/{file_id}/add-model")
def add_gguf_model(
    file_id: str,
    body: AddModelRequest,
    library: GgufLibrary = Depends(get_gguf_library),
):
    try:
        return library.add_model(
            file_id=file_id,
            name=body.name,
            port=body.port,
            ctx=body.ctx,
            gpu_layers=body.gpu_layers,
            host=body.host,
            reasoning=body.reasoning,
            reasoning_budget=body.reasoning_budget,
            prompt_template=body.prompt_template,
            vision=body.vision,
            mmproj=body.mmproj,
            supports_mtp=body.supports_mtp,
            draft_model_path=body.draft_model_path,
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.patch("/ggufs/{asset_ref}")
def update_gguf_asset(
    asset_ref: str,
    body: UpdateGgufAssetRequest,
    library: GgufLibrary = Depends(get_gguf_library),
):
    try:
        return library.update_asset_metadata(
            asset_ref,
            model_line=body.model_line,
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.delete("/ggufs/{file_id}")
def delete_gguf_file(
    file_id: str,
    library: GgufLibrary = Depends(get_gguf_library),
):
    try:
        return library.delete_file(file_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except OSError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.delete("/models/{name}")
def remove_model(
    name: str,
    library: GgufLibrary = Depends(get_gguf_library),
):
    try:
        return library.remove_model(name)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.patch("/models/{name}")
def update_model(
    name: str,
    body: UpdateModelRequest,
    library: GgufLibrary = Depends(get_gguf_library),
) -> dict[str, object]:
    try:
        return library.update_model(
            name,
            vision=body.vision,
            mmproj=body.mmproj,
            ctx=body.ctx,
            gpu_layers=body.gpu_layers,
            port=body.port,
            prompt_template=body.prompt_template,
            reasoning=body.reasoning,
            reasoning_budget=body.reasoning_budget,
            supports_mtp=body.supports_mtp,
            draft_model_path=body.draft_model_path,
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
