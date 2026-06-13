"""expand models schema for catalog fields, profiles, and deployments

Revision ID: 20260613_0002
Revises: 20260613_0001
Create Date: 2026-06-13 00:30:00.000000
"""

from __future__ import annotations

from alembic import context, op
import sqlalchemy as sa


revision = "20260613_0002"
down_revision = "20260613_0001"
branch_labels = None
depends_on = None


def _target() -> str:
    return context.get_x_argument(as_dictionary=True).get("db", "controller")


def _has_column(inspector: sa.Inspector, table_name: str, column_name: str) -> bool:
    return any(column["name"] == column_name for column in inspector.get_columns(table_name))


def upgrade() -> None:
    if _target() != "models":
        return

    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = set(inspector.get_table_names())

    model_columns: list[tuple[str, sa.types.TypeEngine, bool, str | None]] = [
        ("ctx", sa.Integer(), True, None),
        ("gpu_layers", sa.Integer(), True, None),
        ("vision", sa.Integer(), False, "0"),
        ("mmproj", sa.Text(), True, None),
        ("supports_json_schema", sa.Integer(), True, None),
        ("supports_grammar", sa.Integer(), True, None),
        ("supports_mtp", sa.Integer(), True, None),
        ("reasoning", sa.Text(), True, None),
        ("reasoning_budget", sa.Integer(), True, None),
        ("prompt_template", sa.Text(), True, None),
        ("favorite", sa.Integer(), False, "0"),
        ("strengths_json", sa.Text(), False, "[]"),
        ("cost_tier", sa.Text(), True, None),
        ("extra_args_json", sa.Text(), False, "[]"),
    ]
    for column_name, column_type, nullable, default in model_columns:
        if not _has_column(inspector, "models", column_name):
            op.add_column(
                "models",
                sa.Column(column_name, column_type, nullable=nullable, server_default=default),
            )

    if "model_profiles" not in existing_tables:
        op.create_table(
            "model_profiles",
            sa.Column("profile_id", sa.Text(), nullable=False),
            sa.Column("model_id", sa.Text(), nullable=False),
            sa.Column("profile_key", sa.Text(), nullable=False),
            sa.Column("label", sa.Text(), nullable=True),
            sa.Column("order", sa.Integer(), nullable=False, server_default="100"),
            sa.Column("kind", sa.Text(), nullable=True),
            sa.Column("ctx", sa.Integer(), nullable=True),
            sa.Column("gpu_layers", sa.Integer(), nullable=True),
            sa.Column("host", sa.Text(), nullable=True),
            sa.Column("extra_args_json", sa.Text(), nullable=False, server_default="[]"),
            sa.Column("intended_ctx", sa.Integer(), nullable=True),
            sa.Column("kv_cache_policy", sa.Text(), nullable=True),
            sa.Column("resource_tier", sa.Text(), nullable=True),
            sa.Column("strengths_json", sa.Text(), nullable=False, server_default="[]"),
            sa.Column("cost_tier", sa.Text(), nullable=True),
            sa.Column("created_at", sa.Text(), nullable=False),
            sa.Column("updated_at", sa.Text(), nullable=False),
            sa.PrimaryKeyConstraint("profile_id", name=op.f("pk_model_profiles")),
        )
        op.create_index(op.f("idx_model_profiles_model_id"), "model_profiles", ["model_id"], unique=False)
        op.create_index(op.f("idx_model_profiles_model_profile_key"), "model_profiles", ["model_id", "profile_key"], unique=True)
        op.create_index(op.f("idx_model_profiles_profile_key"), "model_profiles", ["profile_key"], unique=False)

    if "model_deployments" not in existing_tables:
        op.create_table(
            "model_deployments",
            sa.Column("deployment_id", sa.Text(), nullable=False),
            sa.Column("model_id", sa.Text(), nullable=False),
            sa.Column("deployment_name", sa.Text(), nullable=False),
            sa.Column("node_name", sa.Text(), nullable=True),
            sa.Column("host", sa.Text(), nullable=False),
            sa.Column("port", sa.Integer(), nullable=False),
            sa.Column("ctx_override", sa.Integer(), nullable=True),
            sa.Column("gpu_layers_override", sa.Integer(), nullable=True),
            sa.Column("mmproj_override", sa.Text(), nullable=True),
            sa.Column("extra_args_override_json", sa.Text(), nullable=False, server_default="[]"),
            sa.Column("profile_key", sa.Text(), nullable=True),
            sa.Column("enabled", sa.Integer(), nullable=False, server_default="1"),
            sa.Column("created_at", sa.Text(), nullable=False),
            sa.Column("updated_at", sa.Text(), nullable=False),
            sa.PrimaryKeyConstraint("deployment_id", name=op.f("pk_model_deployments")),
        )
        op.create_index(op.f("idx_model_deployments_model_id"), "model_deployments", ["model_id"], unique=False)
        op.create_index(
            op.f("idx_model_deployments_model_deployment_name"),
            "model_deployments",
            ["model_id", "deployment_name"],
            unique=True,
        )
        op.create_index(op.f("idx_model_deployments_node_name"), "model_deployments", ["node_name"], unique=False)
        op.create_index(op.f("idx_model_deployments_port"), "model_deployments", ["port"], unique=False)


def downgrade() -> None:
    if _target() != "models":
        return

    op.drop_index(op.f("idx_model_deployments_port"), table_name="model_deployments")
    op.drop_index(op.f("idx_model_deployments_node_name"), table_name="model_deployments")
    op.drop_index(op.f("idx_model_deployments_model_deployment_name"), table_name="model_deployments")
    op.drop_index(op.f("idx_model_deployments_model_id"), table_name="model_deployments")
    op.drop_table("model_deployments")

    op.drop_index(op.f("idx_model_profiles_profile_key"), table_name="model_profiles")
    op.drop_index(op.f("idx_model_profiles_model_profile_key"), table_name="model_profiles")
    op.drop_index(op.f("idx_model_profiles_model_id"), table_name="model_profiles")
    op.drop_table("model_profiles")

    for column_name in (
        "extra_args_json",
        "cost_tier",
        "strengths_json",
        "favorite",
        "prompt_template",
        "reasoning_budget",
        "reasoning",
        "supports_mtp",
        "supports_grammar",
        "supports_json_schema",
        "mmproj",
        "vision",
        "gpu_layers",
        "ctx",
    ):
        op.drop_column("models", column_name)
