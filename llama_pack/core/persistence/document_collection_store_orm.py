from __future__ import annotations

from datetime import UTC, datetime
import uuid

from sqlalchemy import delete, select

from llama_pack.core.persistence.db_infra import create_persistence_engine, create_session_factory, require_sqlite_tables, session_scope, sqlite_path_from_url
from llama_pack.core.persistence.models.document_collections import (
    DocumentCollectionChunkOrm,
    DocumentCollectionDocumentOrm,
    DocumentCollectionOrm,
)


class DocumentCollectionStoreOrm:
    def __init__(self, db_url: str) -> None:
        sqlite_path = sqlite_path_from_url(db_url)
        if sqlite_path is not None:
            sqlite_path.parent.mkdir(parents=True, exist_ok=True)
            require_sqlite_tables(
                db_path=sqlite_path,
                required_tables={
                    "document_collections",
                    "document_collection_documents",
                    "document_collection_chunks",
                    "alembic_version",
                },
                target_name="projects",
            )
        self.engine = create_persistence_engine(db_url)
        self.session_factory = create_session_factory(self.engine)

    def list_collections(self, include_archived: bool) -> list[dict[str, object]]:
        with session_scope(self.session_factory) as session:
            stmt = select(DocumentCollectionOrm)
            if not include_archived:
                stmt = stmt.where(DocumentCollectionOrm.archived == 0)
            rows = session.execute(stmt.order_by(DocumentCollectionOrm.updated_at.desc())).scalars().all()
            return [self._collection_payload(row) for row in rows]

    def get_collection(self, collection_id: str, include_documents: bool) -> dict[str, object] | None:
        with session_scope(self.session_factory) as session:
            row = session.get(DocumentCollectionOrm, collection_id)
            if row is None:
                return None
            payload = self._collection_payload(row)
            if include_documents:
                documents = session.execute(
                    select(DocumentCollectionDocumentOrm)
                    .where(DocumentCollectionDocumentOrm.collection_id == collection_id)
                    .order_by(DocumentCollectionDocumentOrm.created_at.asc())
                ).scalars().all()
                payload["documents"] = [self._document_payload(document) for document in documents]
            return payload

    def create_collection(self, name: str, description: str | None) -> dict[str, object]:
        now = self._now()
        collection = DocumentCollectionOrm(
            id=str(uuid.uuid4()),
            name=name,
            description=description,
            created_at=now,
            updated_at=now,
            archived=0,
        )
        with session_scope(self.session_factory) as session:
            session.add(collection)
        created = self.get_collection(collection.id, include_documents=False)
        if created is None:
            raise RuntimeError(f"Created document collection {collection.id} could not be loaded")
        return created

    def update_collection(self, collection_id: str, name: str, description: str | None) -> dict[str, object] | None:
        with session_scope(self.session_factory) as session:
            row = session.get(DocumentCollectionOrm, collection_id)
            if row is None:
                return None
            row.name = name
            row.description = description
            row.updated_at = self._now()
        return self.get_collection(collection_id, include_documents=False)

    def archive_collection(self, collection_id: str) -> dict[str, object] | None:
        with session_scope(self.session_factory) as session:
            row = session.get(DocumentCollectionOrm, collection_id)
            if row is None:
                return None
            row.archived = 1
            row.updated_at = self._now()
        return self.get_collection(collection_id, include_documents=False)

    def delete_collection(self, collection_id: str) -> bool:
        with session_scope(self.session_factory) as session:
            row = session.get(DocumentCollectionOrm, collection_id)
            if row is None:
                return False
            session.execute(delete(DocumentCollectionChunkOrm).where(DocumentCollectionChunkOrm.collection_id == collection_id))
            session.execute(delete(DocumentCollectionDocumentOrm).where(DocumentCollectionDocumentOrm.collection_id == collection_id))
            session.delete(row)
            return True

    def create_document(self, collection_id: str, filename: str, content_type: str) -> dict[str, object]:
        now = self._now()
        document = DocumentCollectionDocumentOrm(
            id=str(uuid.uuid4()),
            collection_id=collection_id,
            filename=filename,
            content_type=content_type,
            status="pending",
            chunk_count=0,
            error_message=None,
            created_at=now,
            updated_at=now,
        )
        with session_scope(self.session_factory) as session:
            collection = session.get(DocumentCollectionOrm, collection_id)
            if collection is None:
                raise ValueError(f"Document collection not found: {collection_id}")
            session.add(document)
        created = self.get_document(document.id)
        if created is None:
            raise RuntimeError(f"Created document {document.id} could not be loaded")
        return created

    def get_document(self, document_id: str) -> dict[str, object] | None:
        with session_scope(self.session_factory) as session:
            row = session.get(DocumentCollectionDocumentOrm, document_id)
            if row is None:
                return None
            return self._document_payload(row)

    def mark_document_failed(self, document_id: str, error_message: str) -> dict[str, object] | None:
        with session_scope(self.session_factory) as session:
            row = session.get(DocumentCollectionDocumentOrm, document_id)
            if row is None:
                return None
            row.status = "failed"
            row.error_message = error_message
            row.updated_at = self._now()
        return self.get_document(document_id)

    def list_documents(self, collection_id: str) -> list[dict[str, object]] | None:
        with session_scope(self.session_factory) as session:
            if session.get(DocumentCollectionOrm, collection_id) is None:
                return None
            rows = session.execute(
                select(DocumentCollectionDocumentOrm)
                .where(DocumentCollectionDocumentOrm.collection_id == collection_id)
                .order_by(DocumentCollectionDocumentOrm.created_at.asc())
            ).scalars().all()
            return [self._document_payload(row) for row in rows]

    def replace_document_chunks(self, document_id: str, collection_id: str, texts: list[str]) -> list[dict[str, object]]:
        now = self._now()
        chunks = [
            DocumentCollectionChunkOrm(
                id=str(uuid.uuid4()),
                document_id=document_id,
                collection_id=collection_id,
                chunk_index=index,
                text=text,
                created_at=now,
            )
            for index, text in enumerate(texts)
        ]
        with session_scope(self.session_factory) as session:
            document = session.get(DocumentCollectionDocumentOrm, document_id)
            if document is None:
                raise ValueError(f"Document not found: {document_id}")
            if document.collection_id != collection_id:
                raise ValueError(f"Document {document_id} does not belong to collection {collection_id}")
            session.execute(delete(DocumentCollectionChunkOrm).where(DocumentCollectionChunkOrm.document_id == document_id))
            session.add_all(chunks)
            document.status = "indexed"
            document.chunk_count = len(chunks)
            document.error_message = None
            document.updated_at = now
        return self.list_chunks_for_document(document_id)

    def list_chunks_for_document(self, document_id: str) -> list[dict[str, object]]:
        with session_scope(self.session_factory) as session:
            rows = session.execute(
                select(DocumentCollectionChunkOrm)
                .where(DocumentCollectionChunkOrm.document_id == document_id)
                .order_by(DocumentCollectionChunkOrm.chunk_index.asc())
            ).scalars().all()
            return [self._chunk_payload(row) for row in rows]

    def close(self) -> None:
        self.engine.dispose()

    def _collection_payload(self, row: DocumentCollectionOrm) -> dict[str, object]:
        return {
            "id": row.id,
            "name": row.name,
            "description": row.description,
            "created_at": row.created_at,
            "updated_at": row.updated_at,
            "archived": bool(row.archived),
        }

    def _document_payload(self, row: DocumentCollectionDocumentOrm) -> dict[str, object]:
        return {
            "id": row.id,
            "collection_id": row.collection_id,
            "filename": row.filename,
            "content_type": row.content_type,
            "status": row.status,
            "chunk_count": row.chunk_count,
            "error_message": row.error_message,
            "created_at": row.created_at,
            "updated_at": row.updated_at,
        }

    def _chunk_payload(self, row: DocumentCollectionChunkOrm) -> dict[str, object]:
        return {
            "id": row.id,
            "document_id": row.document_id,
            "collection_id": row.collection_id,
            "chunk_index": row.chunk_index,
            "text": row.text,
            "created_at": row.created_at,
        }

    def _now(self) -> str:
        return datetime.now(UTC).isoformat()
