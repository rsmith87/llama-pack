from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from typing import Literal

from pydantic import BaseModel

from llama_pack.api.dependencies import get_gguf_library, get_process_manager
from llama_pack.core.model_assets.library import GgufLibrary
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
