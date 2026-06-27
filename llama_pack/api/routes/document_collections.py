from __future__ import annotations

from dataclasses import asdict

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from pydantic import BaseModel, ConfigDict, Field

from llama_pack.api.dependencies import get_document_collection_service
from llama_pack.core.document_collections.service import DocumentCollectionService

router = APIRouter(prefix="/document-collections")


class DocumentCollectionCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=1000)


class DocumentCollectionUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=1000)


class DocumentCollectionSearchRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    query: str = Field(min_length=1, max_length=4096)
    collection_ids: list[str] = Field(min_length=1, max_length=20)
    top_k: int = Field(ge=1, le=20)


@router.get("")
async def list_collections(
    include_archived: bool = Query(default=False),
    service: DocumentCollectionService = Depends(get_document_collection_service),
) -> dict[str, object]:
    collections = service.list_collections(include_archived=include_archived)
    return {"collections": [asdict(collection) for collection in collections]}


@router.post("", status_code=201)
async def create_collection(
    body: DocumentCollectionCreateRequest,
    service: DocumentCollectionService = Depends(get_document_collection_service),
) -> dict[str, object]:
    collection = service.create_collection(name=body.name.strip(), description=_clean_optional_string(body.description))
    return asdict(collection)


@router.get("/{collection_id}")
async def get_collection(
    collection_id: str,
    service: DocumentCollectionService = Depends(get_document_collection_service),
) -> dict[str, object]:
    payload = service.metadata_store.get_collection(collection_id, include_documents=True)
    if payload is None:
        raise HTTPException(status_code=404, detail=f"Document collection not found: {collection_id}")
    return payload


@router.patch("/{collection_id}")
async def update_collection(
    collection_id: str,
    body: DocumentCollectionUpdateRequest,
    service: DocumentCollectionService = Depends(get_document_collection_service),
) -> dict[str, object]:
    collection = service.update_collection(collection_id, body.name.strip(), _clean_optional_string(body.description))
    if collection is None:
        raise HTTPException(status_code=404, detail=f"Document collection not found: {collection_id}")
    return asdict(collection)


@router.delete("/{collection_id}")
async def delete_collection(
    collection_id: str,
    service: DocumentCollectionService = Depends(get_document_collection_service),
) -> dict[str, object]:
    deleted = service.delete_collection(collection_id)
    if not deleted:
        raise HTTPException(status_code=404, detail=f"Document collection not found: {collection_id}")
    return {"ok": True, "deleted": True, "id": collection_id}


@router.get("/{collection_id}/documents")
async def list_documents(
    collection_id: str,
    service: DocumentCollectionService = Depends(get_document_collection_service),
) -> dict[str, object]:
    documents = service.metadata_store.list_documents(collection_id)
    if documents is None:
        raise HTTPException(status_code=404, detail=f"Document collection not found: {collection_id}")
    return {"documents": documents}


@router.post("/{collection_id}/documents", status_code=201)
async def upload_document(
    collection_id: str,
    file: UploadFile = File(...),
    service: DocumentCollectionService = Depends(get_document_collection_service),
) -> dict[str, object]:
    body = await file.read()
    try:
        text = body.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise HTTPException(status_code=422, detail=f"Document {file.filename} is not valid UTF-8 text") from exc
    try:
        document = service.upload_text_document(
            collection_id=collection_id,
            filename=file.filename or "document.txt",
            content_type=file.content_type or "application/octet-stream",
            text=text,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return asdict(document)


@router.post("/search")
async def search_collections(
    body: DocumentCollectionSearchRequest,
    service: DocumentCollectionService = Depends(get_document_collection_service),
) -> dict[str, object]:
    results = service.search(body.query, body.collection_ids, body.top_k)
    return {"results": [asdict(result) for result in results], "count": len(results)}


def _clean_optional_string(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = value.strip()
    return cleaned or None
