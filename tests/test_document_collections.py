from __future__ import annotations

import hashlib
import math
from pathlib import Path
import sys
import types
from typing import Any

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from llama_pack.core.config.models import MemoryConfig
from tests.persistence_db_setup import prepare_projects_db


class _FakeDocumentCollection:
    def __init__(self) -> None:
        self._entries: dict[str, dict[str, object]] = {}

    def add(self, ids: list[str], embeddings: list[list[float]], documents: list[str], metadatas: list[dict[str, object]]) -> None:
        for entry_id, embedding, document, metadata in zip(ids, embeddings, documents, metadatas):
            self._entries[entry_id] = {"embedding": embedding, "document": document, "metadata": metadata}

    def delete(self, ids: list[str] | None = None, where: dict[str, object] | None = None) -> None:
        if ids is not None:
            for entry_id in ids:
                self._entries.pop(entry_id, None)
            return
        if where is None:
            return
        matching = [entry_id for entry_id, entry in self._entries.items() if _metadata_matches(entry["metadata"], where)]
        for entry_id in matching:
            self._entries.pop(entry_id, None)

    def query(
        self,
        query_embeddings: list[list[float]],
        n_results: int,
        include: list[str],
        where: dict[str, object] | None = None,
    ) -> dict[str, list[Any]]:
        query_embedding = query_embeddings[0]
        scored: list[tuple[str, dict[str, object], float]] = []
        for entry_id, entry in self._entries.items():
            metadata = entry["metadata"]
            if where is not None and not _metadata_matches(metadata, where):
                continue
            embedding = entry["embedding"]
            distance = 1.0 - sum(float(a) * float(b) for a, b in zip(query_embedding, embedding))
            scored.append((entry_id, entry, distance))
        scored.sort(key=lambda item: item[2])
        selected = scored[:n_results]
        return {
            "ids": [[entry_id for entry_id, _, _ in selected]],
            "documents": [[str(entry["document"]) for _, entry, _ in selected]],
            "metadatas": [[entry["metadata"] for _, entry, _ in selected]],
            "distances": [[distance for _, _, distance in selected]],
        }


class _FakeDocumentCollectionClient:
    def __init__(self, path: str) -> None:
        self.path = path
        self._collections: dict[str, _FakeDocumentCollection] = {}

    def get_or_create_collection(self, name: str, metadata: dict[str, object]) -> _FakeDocumentCollection:
        if name not in self._collections:
            self._collections[name] = _FakeDocumentCollection()
        return self._collections[name]


class _FakeDocumentEmbeddingModel:
    def __init__(self, model_path: str) -> None:
        self.model_path = model_path

    def encode(self, text: str, normalize_embeddings: bool) -> list[float]:
        digest = hashlib.md5(text.encode("utf-8"), usedforsecurity=False).digest()
        values = [float(byte) / 255.0 for byte in digest]
        norm = math.sqrt(sum(value * value for value in values))
        if normalize_embeddings:
            return [value / norm for value in values]
        return values


def _metadata_matches(metadata: object, where: dict[str, object]) -> bool:
    if not isinstance(metadata, dict):
        return False
    for key, expected in where.items():
        actual = metadata.get(key)
        if isinstance(expected, dict) and "$in" in expected:
            allowed = expected["$in"]
            if not isinstance(allowed, list) or actual not in allowed:
                return False
        elif actual != expected:
            return False
    return True


@pytest.fixture
def fake_document_vector_modules(monkeypatch: pytest.MonkeyPatch) -> None:
    fake_chromadb = types.ModuleType("chromadb")
    fake_chromadb.PersistentClient = _FakeDocumentCollectionClient
    fake_sentence_transformers = types.ModuleType("sentence_transformers")
    fake_sentence_transformers.SentenceTransformer = _FakeDocumentEmbeddingModel
    monkeypatch.setitem(sys.modules, "chromadb", fake_chromadb)
    monkeypatch.setitem(sys.modules, "sentence_transformers", fake_sentence_transformers)


def _projects_db_url(tmp_path: Path) -> str:
    db_path = tmp_path / "projects.db"
    prepare_projects_db(db_path)
    return f"sqlite+pysqlite:///{db_path}"


def _memory_config(tmp_path: Path) -> MemoryConfig:
    model_dir = tmp_path / "embedding-model"
    model_dir.mkdir()
    return MemoryConfig(
        enabled=True,
        path=tmp_path / "chroma",
        embedding_model_path=model_dir,
        auto_inject=True,
        top_k=3,
        soft_cap=500,
        ephemeral_ttl_days=7,
        durable_ttl_days=90,
    )


def test_document_collection_store_creates_and_lists_collections(tmp_path: Path) -> None:
    from llama_pack.core.persistence.document_collection_store_orm import DocumentCollectionStoreOrm

    store = DocumentCollectionStoreOrm(_projects_db_url(tmp_path))

    created = store.create_collection(name="Home Repairs", description="Manuals and contractor notes")
    listed = store.list_collections(include_archived=False)

    assert created["id"]
    assert created["name"] == "Home Repairs"
    assert created["description"] == "Manuals and contractor notes"
    assert created["archived"] is False
    assert listed == [created]


def test_document_collection_store_updates_collection(tmp_path: Path) -> None:
    from llama_pack.core.persistence.document_collection_store_orm import DocumentCollectionStoreOrm

    store = DocumentCollectionStoreOrm(_projects_db_url(tmp_path))
    created = store.create_collection(name="Bills", description=None)

    updated = store.update_collection(
        collection_id=str(created["id"]),
        name="Household Bills",
        description="Utilities and receipts",
    )

    assert updated is not None
    assert updated["id"] == created["id"]
    assert updated["name"] == "Household Bills"
    assert updated["description"] == "Utilities and receipts"
    assert updated["updated_at"] != created["updated_at"]


def test_document_collection_store_archives_collection(tmp_path: Path) -> None:
    from llama_pack.core.persistence.document_collection_store_orm import DocumentCollectionStoreOrm

    store = DocumentCollectionStoreOrm(_projects_db_url(tmp_path))
    created = store.create_collection(name="Recipes", description=None)

    archived = store.archive_collection(str(created["id"]))

    assert archived is not None
    assert archived["archived"] is True
    assert store.list_collections(include_archived=False) == []
    assert store.list_collections(include_archived=True) == [archived]


def test_document_collection_store_loads_collection_with_documents(tmp_path: Path) -> None:
    from llama_pack.core.persistence.document_collection_store_orm import DocumentCollectionStoreOrm

    store = DocumentCollectionStoreOrm(_projects_db_url(tmp_path))
    collection = store.create_collection(name="School", description="Forms")
    document = store.create_document(
        collection_id=str(collection["id"]),
        filename="field-trip.md",
        content_type="text/markdown",
    )

    loaded = store.get_collection(str(collection["id"]), include_documents=True)

    assert loaded is not None
    assert loaded["id"] == collection["id"]
    assert loaded["documents"] == [document]


def test_document_collection_store_records_document_chunks(tmp_path: Path) -> None:
    from llama_pack.core.persistence.document_collection_store_orm import DocumentCollectionStoreOrm

    store = DocumentCollectionStoreOrm(_projects_db_url(tmp_path))
    collection = store.create_collection(name="Medical", description=None)
    document = store.create_document(
        collection_id=str(collection["id"]),
        filename="visit.txt",
        content_type="text/plain",
    )

    chunks = store.replace_document_chunks(
        document_id=str(document["id"]),
        collection_id=str(collection["id"]),
        texts=["first chunk", "second chunk"],
    )
    updated_document = store.get_document(str(document["id"]))

    assert [chunk["chunk_index"] for chunk in chunks] == [0, 1]
    assert [chunk["text"] for chunk in chunks] == ["first chunk", "second chunk"]
    assert updated_document is not None
    assert updated_document["status"] == "indexed"
    assert updated_document["chunk_count"] == 2


def test_document_collection_store_requires_existing_collection_for_document(tmp_path: Path) -> None:
    from llama_pack.core.persistence.document_collection_store_orm import DocumentCollectionStoreOrm

    store = DocumentCollectionStoreOrm(_projects_db_url(tmp_path))

    with pytest.raises(ValueError, match="Document collection not found"):
        store.create_document(
            collection_id="missing",
            filename="missing.txt",
            content_type="text/plain",
        )


def test_chunk_document_text_splits_with_overlap() -> None:
    from llama_pack.core.document_collections.chunking import chunk_document_text

    chunks = chunk_document_text(
        text="alpha beta gamma delta epsilon",
        max_chars=16,
        overlap_chars=6,
    )

    assert chunks == [
        "alpha beta gamma",
        "gamma delta",
        "delta epsilon",
    ]


def test_chunk_document_text_rejects_empty_text() -> None:
    from llama_pack.core.document_collections.chunking import chunk_document_text

    with pytest.raises(ValueError, match="Document text must contain non-whitespace content"):
        chunk_document_text(text="   \n\t", max_chars=100, overlap_chars=10)


def test_chunk_document_text_rejects_invalid_sizes() -> None:
    from llama_pack.core.document_collections.chunking import chunk_document_text

    with pytest.raises(ValueError, match="max_chars must be greater than 0"):
        chunk_document_text(text="hello", max_chars=0, overlap_chars=0)
    with pytest.raises(ValueError, match="overlap_chars must be less than max_chars"):
        chunk_document_text(text="hello", max_chars=10, overlap_chars=10)


def test_chunk_document_text_keeps_chunks_under_max_chars() -> None:
    from llama_pack.core.document_collections.chunking import chunk_document_text

    chunks = chunk_document_text(
        text="one two three four five six seven eight nine ten",
        max_chars=14,
        overlap_chars=4,
    )

    assert chunks
    assert all(len(chunk) <= 14 for chunk in chunks)


def test_document_collection_vector_store_adds_and_filters_chunks(
    tmp_path: Path,
    fake_document_vector_modules: None,
) -> None:
    from llama_pack.core.document_collections.vector_store import DocumentChunkInput, DocumentCollectionVectorStore

    store = DocumentCollectionVectorStore(_memory_config(tmp_path))
    store.add_chunks(
        [
            DocumentChunkInput(
                chunk_id="chunk-home",
                document_id="doc-home",
                collection_id="home",
                filename="dishwasher.txt",
                chunk_index=0,
                text="dishwasher warranty lasts two years",
            ),
            DocumentChunkInput(
                chunk_id="chunk-bills",
                document_id="doc-bills",
                collection_id="bills",
                filename="power.txt",
                chunk_index=0,
                text="electric bill due next friday",
            ),
        ]
    )

    results = store.search(query="dishwasher warranty", collection_ids=["home"], top_k=5)

    assert [result.chunk_id for result in results] == ["chunk-home"]
    assert results[0].collection_id == "home"
    assert results[0].filename == "dishwasher.txt"
    assert results[0].score > 0


def test_document_collection_vector_store_filters_low_similarity_results(
    tmp_path: Path,
    fake_document_vector_modules: None,
) -> None:
    from llama_pack.core.document_collections.vector_store import DocumentCollectionVectorStore

    store = DocumentCollectionVectorStore(_memory_config(tmp_path))
    results = store._search_results(
        {
            "documents": [["dishwasher warranty lasts two years"]],
            "metadatas": [
                [
                    {
                        "chunk_id": "chunk-home",
                        "document_id": "doc-home",
                        "collection_id": "home",
                        "filename": "dishwasher.txt",
                        "chunk_index": 0,
                    }
                ]
            ],
            "distances": [[0.74]],
        },
        collection_ids=["home"],
        top_k=5,
    )

    assert results == []


def test_document_collection_vector_store_deletes_document_chunks(
    tmp_path: Path,
    fake_document_vector_modules: None,
) -> None:
    from llama_pack.core.document_collections.vector_store import DocumentChunkInput, DocumentCollectionVectorStore

    store = DocumentCollectionVectorStore(_memory_config(tmp_path))
    store.add_chunks(
        [
            DocumentChunkInput(
                chunk_id="chunk-home",
                document_id="doc-home",
                collection_id="home",
                filename="dishwasher.txt",
                chunk_index=0,
                text="dishwasher warranty lasts two years",
            )
        ]
    )

    store.delete_document_chunks(document_id="doc-home")

    assert store.search(query="dishwasher warranty", collection_ids=["home"], top_k=5) == []


def test_document_collection_vector_store_requires_embedding_model(tmp_path: Path) -> None:
    from llama_pack.core.document_collections.vector_store import DocumentCollectionVectorStore

    config = MemoryConfig(
        enabled=True,
        path=tmp_path / "chroma",
        embedding_model_path=tmp_path / "missing-model",
        auto_inject=True,
        top_k=3,
        soft_cap=500,
        ephemeral_ttl_days=7,
        durable_ttl_days=90,
    )

    with pytest.raises(FileNotFoundError, match="Document collection embedding model not found"):
        DocumentCollectionVectorStore(config)


def test_document_collection_service_uploads_and_searches_with_citations(
    tmp_path: Path,
    fake_document_vector_modules: None,
) -> None:
    from llama_pack.core.document_collections.service import DocumentCollectionService
    from llama_pack.core.document_collections.vector_store import DocumentCollectionVectorStore
    from llama_pack.core.persistence.document_collection_store_orm import DocumentCollectionStoreOrm

    metadata_store = DocumentCollectionStoreOrm(_projects_db_url(tmp_path))
    vector_store = DocumentCollectionVectorStore(_memory_config(tmp_path))
    service = DocumentCollectionService(
        metadata_store=metadata_store,
        vector_store=vector_store,
        max_chunk_chars=80,
        chunk_overlap_chars=20,
    )
    collection = service.create_collection(name="Home Repairs", description="House work notes")

    document = service.upload_text_document(
        collection_id=collection.id,
        filename="dishwasher.md",
        content_type="text/markdown",
        text="The dishwasher warranty lasts two years. Keep the receipt in the kitchen binder.",
    )
    results = service.search(
        query="How long is the dishwasher warranty?",
        collection_ids=[collection.id],
        top_k=3,
    )

    assert document.status == "indexed"
    assert document.chunk_count == 1
    assert len(results) == 1
    assert results[0].collection_id == collection.id
    assert results[0].collection_name == "Home Repairs"
    assert results[0].document_id == document.id
    assert results[0].filename == "dishwasher.md"
    assert "dishwasher warranty" in results[0].text
    assert results[0].score > 0


def test_document_collection_service_rejects_unsupported_content_type(
    tmp_path: Path,
    fake_document_vector_modules: None,
) -> None:
    from llama_pack.core.document_collections.service import DocumentCollectionService
    from llama_pack.core.document_collections.vector_store import DocumentCollectionVectorStore
    from llama_pack.core.persistence.document_collection_store_orm import DocumentCollectionStoreOrm

    service = DocumentCollectionService(
        metadata_store=DocumentCollectionStoreOrm(_projects_db_url(tmp_path)),
        vector_store=DocumentCollectionVectorStore(_memory_config(tmp_path)),
        max_chunk_chars=80,
        chunk_overlap_chars=20,
    )
    collection = service.create_collection(name="Bills", description=None)

    with pytest.raises(ValueError, match="Unsupported document content type"):
        service.upload_text_document(
            collection_id=collection.id,
            filename="invoice.pdf",
            content_type="application/pdf",
            text="invoice text",
        )


def test_document_collection_service_delete_collection_removes_vector_chunks(
    tmp_path: Path,
    fake_document_vector_modules: None,
) -> None:
    from llama_pack.core.document_collections.service import DocumentCollectionService
    from llama_pack.core.document_collections.vector_store import DocumentCollectionVectorStore
    from llama_pack.core.persistence.document_collection_store_orm import DocumentCollectionStoreOrm

    metadata_store = DocumentCollectionStoreOrm(_projects_db_url(tmp_path))
    vector_store = DocumentCollectionVectorStore(_memory_config(tmp_path))
    service = DocumentCollectionService(
        metadata_store=metadata_store,
        vector_store=vector_store,
        max_chunk_chars=80,
        chunk_overlap_chars=20,
    )
    collection = service.create_collection(name="Recipes", description=None)
    service.upload_text_document(
        collection_id=collection.id,
        filename="bread.txt",
        content_type="text/plain",
        text="Bread recipe uses flour, water, yeast, and salt.",
    )

    deleted = service.delete_collection(collection.id)

    assert deleted is True
    assert service.search(query="bread recipe", collection_ids=[collection.id], top_k=3) == []
    assert metadata_store.get_collection(collection.id, include_documents=True) is None


def _document_collection_client(tmp_path: Path, fake_document_vector_modules: None) -> TestClient:
    from llama_pack.api.dependencies import get_document_collection_service
    from llama_pack.api.routes import document_collections
    from llama_pack.core.document_collections.service import DocumentCollectionService
    from llama_pack.core.document_collections.vector_store import DocumentCollectionVectorStore
    from llama_pack.core.persistence.document_collection_store_orm import DocumentCollectionStoreOrm

    service = DocumentCollectionService(
        metadata_store=DocumentCollectionStoreOrm(_projects_db_url(tmp_path)),
        vector_store=DocumentCollectionVectorStore(_memory_config(tmp_path)),
        max_chunk_chars=80,
        chunk_overlap_chars=20,
    )
    app = FastAPI()
    app.include_router(document_collections.router, prefix="/lm-api/v1")
    app.dependency_overrides[get_document_collection_service] = lambda: service
    return TestClient(app)


def test_document_collection_routes_create_list_upload_search_and_delete(
    tmp_path: Path,
    fake_document_vector_modules: None,
) -> None:
    client = _document_collection_client(tmp_path, fake_document_vector_modules)

    create_response = client.post(
        "/lm-api/v1/document-collections",
        json={"name": "Home Repairs", "description": "House work notes"},
    )
    assert create_response.status_code == 201
    collection_id = create_response.json()["id"]

    list_response = client.get("/lm-api/v1/document-collections")
    assert list_response.status_code == 200
    assert list_response.json()["collections"][0]["name"] == "Home Repairs"

    upload_response = client.post(
        f"/lm-api/v1/document-collections/{collection_id}/documents",
        files={"file": ("dishwasher.md", b"The dishwasher warranty lasts two years.", "text/markdown")},
    )
    assert upload_response.status_code == 201
    assert upload_response.json()["status"] == "indexed"

    documents_response = client.get(f"/lm-api/v1/document-collections/{collection_id}/documents")
    assert documents_response.status_code == 200
    assert documents_response.json()["documents"][0]["filename"] == "dishwasher.md"

    search_response = client.post(
        "/lm-api/v1/document-collections/search",
        json={"query": "dishwasher warranty", "collection_ids": [collection_id], "top_k": 3},
    )
    assert search_response.status_code == 200
    assert search_response.json()["results"][0]["collection_name"] == "Home Repairs"

    delete_response = client.delete(f"/lm-api/v1/document-collections/{collection_id}")
    assert delete_response.status_code == 200
    assert delete_response.json() == {"ok": True, "deleted": True, "id": collection_id}


def test_document_collection_routes_validate_search_request(
    tmp_path: Path,
    fake_document_vector_modules: None,
) -> None:
    client = _document_collection_client(tmp_path, fake_document_vector_modules)

    response = client.post(
        "/lm-api/v1/document-collections/search",
        json={"query": "x", "collection_ids": [], "top_k": 3},
    )

    assert response.status_code == 422


class _FakeChatDocumentCollectionService:
    def __init__(self) -> None:
        from llama_pack.core.document_collections.service import DocumentCollectionSearchResult

        self.queries: list[tuple[str, list[str], int]] = []
        self.results = [
            DocumentCollectionSearchResult(
                collection_id="home",
                collection_name="Home Repairs",
                document_id="doc-1",
                filename="dishwasher.md",
                chunk_id="chunk-1",
                chunk_index=0,
                text="The dishwasher warranty lasts two years.",
                score=0.91,
            )
        ]

    def search(self, query: str, collection_ids: list[str], top_k: int):
        self.queries.append((query, collection_ids, top_k))
        return self.results


def test_openai_document_collection_context_injects_relevant_chunks() -> None:
    from llama_pack.api.routes.openai_compat import apply_document_collection_context

    service = _FakeChatDocumentCollectionService()
    payload = {
        "messages": [{"role": "user", "content": "How long is the dishwasher warranty?"}],
    }

    updated_payload, citations = apply_document_collection_context(
        payload=payload,
        document_collection_ids=["home"],
        document_collection_service=service,
    )

    assert service.queries == [("How long is the dishwasher warranty?", ["home"], 5)]
    assert updated_payload["messages"][0]["role"] == "system"
    assert "Relevant document collection context" in updated_payload["messages"][0]["content"]
    assert "dishwasher.md" in updated_payload["messages"][0]["content"]
    assert updated_payload["messages"][1] == payload["messages"][0]
    assert citations == [
        {
            "collection_id": "home",
            "collection_name": "Home Repairs",
            "document_id": "doc-1",
            "filename": "dishwasher.md",
            "chunk_id": "chunk-1",
            "chunk_index": 0,
            "text": "The dishwasher warranty lasts two years.",
            "score": 0.91,
        }
    ]


def test_openai_document_collection_context_without_collection_ids_is_noop() -> None:
    from llama_pack.api.routes.openai_compat import apply_document_collection_context

    service = _FakeChatDocumentCollectionService()
    payload = {
        "messages": [{"role": "user", "content": "Hello"}],
    }

    updated_payload, citations = apply_document_collection_context(
        payload=payload,
        document_collection_ids=None,
        document_collection_service=service,
    )

    assert updated_payload == payload
    assert citations == []
    assert service.queries == []
