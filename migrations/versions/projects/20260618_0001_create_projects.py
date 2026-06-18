"""create projects

Revision ID: 20260618_0001
Revises:
Create Date: 2026-06-18 00:00:00.000000
"""

from __future__ import annotations

from alembic import context, op
import sqlalchemy as sa


revision = "20260618_0001"
down_revision = None
branch_labels = ("projects",)
depends_on = None


def _target() -> str:
    return context.get_x_argument(as_dictionary=True).get("db", "controller")


def upgrade() -> None:
    if _target() != "projects":
        return

    op.create_table(
        "projects",
        sa.Column("id", sa.Text(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("root_hint", sa.Text(), nullable=True),
        sa.Column("created_at", sa.Text(), nullable=False),
        sa.Column("updated_at", sa.Text(), nullable=False),
        sa.Column("archived", sa.Integer(), server_default="0", nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_projects"),
    )
    op.create_index("idx_projects_updated_at", "projects", ["updated_at"], unique=False)
    op.create_index("idx_projects_archived", "projects", ["archived"], unique=False)
    op.create_table(
        "project_node_roots",
        sa.Column("id", sa.Text(), nullable=False),
        sa.Column("project_id", sa.Text(), nullable=False),
        sa.Column("node_name", sa.Text(), nullable=False),
        sa.Column("root_path", sa.Text(), nullable=False),
        sa.Column("safe_root_status", sa.Text(), nullable=False),
        sa.Column("created_at", sa.Text(), nullable=False),
        sa.Column("updated_at", sa.Text(), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], name="fk_project_node_roots_project_id_projects"),
        sa.PrimaryKeyConstraint("id", name="pk_project_node_roots"),
        sa.UniqueConstraint("project_id", "node_name", "root_path", name="uq_project_node_roots_project_node_path"),
    )
    op.create_index("idx_project_node_roots_project_id", "project_node_roots", ["project_id"], unique=False)
    op.create_index("idx_project_node_roots_node_name", "project_node_roots", ["node_name"], unique=False)


def downgrade() -> None:
    if _target() != "projects":
        return

    op.drop_index("idx_project_node_roots_node_name", table_name="project_node_roots")
    op.drop_index("idx_project_node_roots_project_id", table_name="project_node_roots")
    op.drop_table("project_node_roots")
    op.drop_index("idx_projects_archived", table_name="projects")
    op.drop_index("idx_projects_updated_at", table_name="projects")
    op.drop_table("projects")
