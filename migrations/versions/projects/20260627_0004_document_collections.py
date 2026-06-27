"""document collections

Revision ID: 20260627_0004
Revises: 20260619_0003
Create Date: 2026-06-27 00:00:00.000000
"""

from __future__ import annotations

from alembic import context, op
import sqlalchemy as sa


revision = "20260627_0004"
down_revision = "20260619_0003"
branch_labels = None
depends_on = None


def _target() -> str:
    return context.get_x_argument(as_dictionary=True).get("db", "controller")


def upgrade() -> None:
    if _target() != "projects":
        return

    if not _table_exists("document_collections"):
        op.create_table(
            "document_collections",
            sa.Column("id", sa.Text(), nullable=False),
            sa.Column("name", sa.Text(), nullable=False),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("created_at", sa.Text(), nullable=False),
            sa.Column("updated_at", sa.Text(), nullable=False),
            sa.Column("archived", sa.Integer(), server_default="0", nullable=False),
            sa.PrimaryKeyConstraint("id", name="pk_document_collections"),
        )
    _create_index("document_collections", "idx_document_collections_updated_at", ["updated_at"])
    _create_index("document_collections", "idx_document_collections_archived", ["archived"])

    if not _table_exists("document_collection_documents"):
        op.create_table(
            "document_collection_documents",
            sa.Column("id", sa.Text(), nullable=False),
            sa.Column("collection_id", sa.Text(), nullable=False),
            sa.Column("filename", sa.Text(), nullable=False),
            sa.Column("content_type", sa.Text(), nullable=False),
            sa.Column("status", sa.Text(), nullable=False),
            sa.Column("chunk_count", sa.Integer(), server_default="0", nullable=False),
            sa.Column("error_message", sa.Text(), nullable=True),
            sa.Column("created_at", sa.Text(), nullable=False),
            sa.Column("updated_at", sa.Text(), nullable=False),
            sa.ForeignKeyConstraint(["collection_id"], ["document_collections.id"], name="fk_document_collection_documents_collection_id"),
            sa.PrimaryKeyConstraint("id", name="pk_document_collection_documents"),
        )
    _create_index("document_collection_documents", "idx_document_collection_documents_collection", ["collection_id"])
    _create_index("document_collection_documents", "idx_document_collection_documents_status", ["status"])

    if not _table_exists("document_collection_chunks"):
        op.create_table(
            "document_collection_chunks",
            sa.Column("id", sa.Text(), nullable=False),
            sa.Column("document_id", sa.Text(), nullable=False),
            sa.Column("collection_id", sa.Text(), nullable=False),
            sa.Column("chunk_index", sa.Integer(), nullable=False),
            sa.Column("text", sa.Text(), nullable=False),
            sa.Column("created_at", sa.Text(), nullable=False),
            sa.ForeignKeyConstraint(["document_id"], ["document_collection_documents.id"], name="fk_document_collection_chunks_document_id"),
            sa.ForeignKeyConstraint(["collection_id"], ["document_collections.id"], name="fk_document_collection_chunks_collection_id"),
            sa.PrimaryKeyConstraint("id", name="pk_document_collection_chunks"),
        )
    _create_index("document_collection_chunks", "idx_document_collection_chunks_document", ["document_id"])
    _create_index("document_collection_chunks", "idx_document_collection_chunks_collection", ["collection_id"])


def downgrade() -> None:
    if _target() != "projects":
        return

    _drop_index("document_collection_chunks", "idx_document_collection_chunks_collection")
    _drop_index("document_collection_chunks", "idx_document_collection_chunks_document")
    _drop_table("document_collection_chunks")

    _drop_index("document_collection_documents", "idx_document_collection_documents_status")
    _drop_index("document_collection_documents", "idx_document_collection_documents_collection")
    _drop_table("document_collection_documents")

    _drop_index("document_collections", "idx_document_collections_archived")
    _drop_index("document_collections", "idx_document_collections_updated_at")
    _drop_table("document_collections")


def _table_exists(table_name: str) -> bool:
    bind = op.get_bind()
    return sa.inspect(bind).has_table(table_name)


def _index_exists(table_name: str, index_name: str) -> bool:
    bind = op.get_bind()
    indexes = sa.inspect(bind).get_indexes(table_name) if _table_exists(table_name) else []
    return any(index["name"] == index_name for index in indexes)


def _create_index(table_name: str, index_name: str, columns: list[str]) -> None:
    if not _index_exists(table_name, index_name):
        op.create_index(index_name, table_name, columns, unique=False)


def _drop_index(table_name: str, index_name: str) -> None:
    if _index_exists(table_name, index_name):
        op.drop_index(index_name, table_name=table_name)


def _drop_table(table_name: str) -> None:
    if _table_exists(table_name):
        op.drop_table(table_name)
