from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

from llama_pack.core.document_collections.chunking import chunk_document_text
from llama_pack.core.document_collections.vector_store import (
    DocumentChunkInput,
    DocumentChunkSearchResult,
    DocumentCollectionVectorStore,
)
from llama_pack.core.persistence.document_collection_store_orm import DocumentCollectionStoreOrm


@dataclass(frozen=True)
class DocumentCollection:
    id: str
    name: str
    description: str | None
    created_at: str
    updated_at: str
    archived: bool


@dataclass(frozen=True)
class DocumentCollectionDocument:
    id: str
    collection_id: str
    filename: str
    content_type: str
    status: str
    chunk_count: int
    error_message: str | None
    created_at: str
    updated_at: str


@dataclass(frozen=True)
class DocumentCollectionSearchResult:
    collection_id: str
    collection_name: str
    document_id: str
    filename: str
    chunk_id: str
    chunk_index: int
    text: str
    score: float


class _MetadataStore(Protocol):
    def list_collections(self, include_archived: bool) -> list[dict[str, object]]:
        ...

    def get_collection(self, collection_id: str, include_documents: bool) -> dict[str, object] | None:
        ...

    def create_collection(self, name: str, description: str | None) -> dict[str, object]:
        ...

    def update_collection(self, collection_id: str, name: str, description: str | None) -> dict[str, object] | None:
        ...

    def delete_collection(self, collection_id: str) -> bool:
        ...

    def create_document(self, collection_id: str, filename: str, content_type: str) -> dict[str, object]:
        ...

    def get_document(self, document_id: str) -> dict[str, object] | None:
        ...

    def replace_document_chunks(self, document_id: str, collection_id: str, texts: list[str]) -> list[dict[str, object]]:
        ...

    def mark_document_failed(self, document_id: str, error_message: str) -> dict[str, object] | None:
        ...

    def list_documents(self, collection_id: str) -> list[dict[str, object]] | None:
        ...


class _VectorStore(Protocol):
    def add_chunks(self, chunks: list[DocumentChunkInput]) -> None:
        ...

    def search(self, query: str, collection_ids: list[str], top_k: int) -> list[DocumentChunkSearchResult]:
        ...

    def delete_document_chunks(self, document_id: str) -> None:
        ...


class DocumentCollectionService:
    def __init__(
        self,
        metadata_store: DocumentCollectionStoreOrm,
        vector_store: DocumentCollectionVectorStore,
        max_chunk_chars: int,
        chunk_overlap_chars: int,
    ) -> None:
        self.metadata_store: _MetadataStore = metadata_store
        self.vector_store: _VectorStore = vector_store
        self.max_chunk_chars = max_chunk_chars
        self.chunk_overlap_chars = chunk_overlap_chars

    def list_collections(self, include_archived: bool) -> list[DocumentCollection]:
        return [self._collection_from_payload(payload) for payload in self.metadata_store.list_collections(include_archived)]

    def create_collection(self, name: str, description: str | None) -> DocumentCollection:
        return self._collection_from_payload(self.metadata_store.create_collection(name, description))

    def update_collection(self, collection_id: str, name: str, description: str | None) -> DocumentCollection | None:
        payload = self.metadata_store.update_collection(collection_id, name, description)
        if payload is None:
            return None
        return self._collection_from_payload(payload)

    def delete_collection(self, collection_id: str) -> bool:
        documents = self.metadata_store.list_documents(collection_id)
        if documents is None:
            return False
        for document in documents:
            self.vector_store.delete_document_chunks(str(document["id"]))
        return self.metadata_store.delete_collection(collection_id)

    def upload_text_document(
        self,
        collection_id: str,
        filename: str,
        content_type: str,
        text: str,
    ) -> DocumentCollectionDocument:
        normalized_content_type = self._normalize_content_type(filename, content_type)
        document_payload = self.metadata_store.create_document(collection_id, filename, normalized_content_type)
        document_id = str(document_payload["id"])
        try:
            chunk_texts = chunk_document_text(text, self.max_chunk_chars, self.chunk_overlap_chars)
            chunk_payloads = self.metadata_store.replace_document_chunks(document_id, collection_id, chunk_texts)
            self.vector_store.delete_document_chunks(document_id)
            self.vector_store.add_chunks(
                [
                    DocumentChunkInput(
                        chunk_id=str(chunk["id"]),
                        document_id=document_id,
                        collection_id=collection_id,
                        filename=filename,
                        chunk_index=int(chunk["chunk_index"]),
                        text=str(chunk["text"]),
                    )
                    for chunk in chunk_payloads
                ]
            )
        except Exception as exc:
            self.metadata_store.mark_document_failed(document_id, str(exc))
            raise
        updated = self.metadata_store.get_document(document_id)
        if updated is None:
            raise RuntimeError(f"Indexed document {document_id} could not be loaded")
        return self._document_from_payload(updated)

    def search(self, query: str, collection_ids: list[str], top_k: int) -> list[DocumentCollectionSearchResult]:
        collection_names = self._collection_names(collection_ids)
        vector_results = self.vector_store.search(query, collection_ids, top_k)
        return [
            DocumentCollectionSearchResult(
                collection_id=result.collection_id,
                collection_name=collection_names.get(result.collection_id, ""),
                document_id=result.document_id,
                filename=result.filename,
                chunk_id=result.chunk_id,
                chunk_index=result.chunk_index,
                text=result.text,
                score=result.score,
            )
            for result in vector_results
        ]

    def _normalize_content_type(self, filename: str, content_type: str) -> str:
        lowered_filename = filename.lower()
        lowered_content_type = content_type.lower()
        if lowered_content_type in {"text/plain", "text/markdown"}:
            return lowered_content_type
        if lowered_filename.endswith(".txt"):
            return "text/plain"
        if lowered_filename.endswith(".md"):
            return "text/markdown"
        raise ValueError(
            f"Unsupported document content type for {filename}: {content_type}. "
            "Only text/plain, text/markdown, .txt, and .md documents are supported."
        )

    def _collection_names(self, collection_ids: list[str]) -> dict[str, str]:
        names: dict[str, str] = {}
        for collection_id in collection_ids:
            payload = self.metadata_store.get_collection(collection_id, include_documents=False)
            if payload is not None:
                names[collection_id] = str(payload["name"])
        return names

    def _collection_from_payload(self, payload: dict[str, object]) -> DocumentCollection:
        return DocumentCollection(
            id=str(payload["id"]),
            name=str(payload["name"]),
            description=str(payload["description"]) if payload["description"] is not None else None,
            created_at=str(payload["created_at"]),
            updated_at=str(payload["updated_at"]),
            archived=bool(payload["archived"]),
        )

    def _document_from_payload(self, payload: dict[str, object]) -> DocumentCollectionDocument:
        return DocumentCollectionDocument(
            id=str(payload["id"]),
            collection_id=str(payload["collection_id"]),
            filename=str(payload["filename"]),
            content_type=str(payload["content_type"]),
            status=str(payload["status"]),
            chunk_count=int(payload["chunk_count"]),
            error_message=str(payload["error_message"]) if payload["error_message"] is not None else None,
            created_at=str(payload["created_at"]),
            updated_at=str(payload["updated_at"]),
        )
