from pathlib import Path
import configparser
import pytest

from llama_pack.core.config import load_config
from llama_pack.core.persistence.alembic_config import (
    Base,
    NAMING_CONVENTION,
    head_revision_for,
    parse_alembic_target,
    resolve_target_url_from_config,
    target_metadata_for,
    version_locations,
)
from llama_pack.core.persistence import models as _models  # noqa: F401


def test_parse_alembic_target_defaults_to_controller():
    assert parse_alembic_target(None) == "controller"
    assert parse_alembic_target([]) == "controller"


def test_parse_alembic_target_reads_x_argument():
    assert parse_alembic_target(["db=auth"]) == "auth"


def test_parse_alembic_target_rejects_unknown_target():
    with pytest.raises(ValueError):
        parse_alembic_target(["db=unknown"])


def test_resolve_target_url_from_config_uses_overrides(tmp_path):
    config = load_config(
        {
            "log_dir": str(tmp_path),
            "controller_db_url": "sqlite+pysqlite:///tmp/controller.db",
            "auth_db_url": "sqlite+pysqlite:///tmp/auth.db",
            "audit_db_url": "sqlite+pysqlite:///tmp/audit.db",
            "chat_sessions_db_url": "sqlite+pysqlite:///tmp/chat.db",
            "downloads_db_url": "sqlite+pysqlite:///tmp/downloads.db",
            "benchmarks_db_url": "sqlite+pysqlite:///tmp/benchmarks.db",
            "settings_db_url": "sqlite+pysqlite:///tmp/settings.db",
            "projects_db_url": "sqlite+pysqlite:///tmp/projects.db",
        }
    )

    assert resolve_target_url_from_config(config, "controller") == "sqlite+pysqlite:///tmp/controller.db"
    assert resolve_target_url_from_config(config, "auth") == "sqlite+pysqlite:///tmp/auth.db"
    assert resolve_target_url_from_config(config, "audit") == "sqlite+pysqlite:///tmp/audit.db"
    assert resolve_target_url_from_config(config, "chat_sessions") == "sqlite+pysqlite:///tmp/chat.db"
    assert resolve_target_url_from_config(config, "downloads") == "sqlite+pysqlite:///tmp/downloads.db"
    assert resolve_target_url_from_config(config, "benchmarks") == "sqlite+pysqlite:///tmp/benchmarks.db"
    assert resolve_target_url_from_config(config, "settings") == "sqlite+pysqlite:///tmp/settings.db"
    assert resolve_target_url_from_config(config, "projects") == "sqlite+pysqlite:///tmp/projects.db"


def test_base_metadata_uses_locked_naming_convention():
    assert Base.metadata.naming_convention == NAMING_CONVENTION
    assert NAMING_CONVENTION["pk"] == "pk_%(table_name)s"


def test_version_locations_include_all_targets(tmp_path):
    locations = version_locations(tmp_path)
    rendered = [str(path) for path in locations]

    assert str(Path(tmp_path) / "migrations" / "versions" / "controller") in rendered
    assert str(Path(tmp_path) / "migrations" / "versions" / "auth") in rendered
    assert str(Path(tmp_path) / "migrations" / "versions" / "audit") in rendered
    assert str(Path(tmp_path) / "migrations" / "versions" / "chat_sessions") in rendered
    assert str(Path(tmp_path) / "migrations" / "versions" / "downloads") in rendered
    assert str(Path(tmp_path) / "migrations" / "versions" / "benchmarks") in rendered
    assert str(Path(tmp_path) / "migrations" / "versions" / "models") in rendered
    assert str(Path(tmp_path) / "migrations" / "versions" / "settings") in rendered
    assert str(Path(tmp_path) / "migrations" / "versions" / "projects") in rendered


def test_alembic_ini_lists_models_version_location():
    parser = configparser.ConfigParser()
    parser.read("alembic.ini")
    version_locations = parser.get("alembic", "version_locations", raw=True)

    assert "%(here)s/migrations/versions/models" in version_locations


def test_alembic_ini_lists_settings_version_location():
    parser = configparser.ConfigParser()
    parser.read("alembic.ini")
    version_locations = parser.get("alembic", "version_locations", raw=True)

    assert "%(here)s/migrations/versions/settings" in version_locations


def test_alembic_ini_lists_projects_version_location():
    parser = configparser.ConfigParser()
    parser.read("alembic.ini")
    version_locations = parser.get("alembic", "version_locations", raw=True)

    assert "%(here)s/migrations/versions/projects" in version_locations


def test_target_metadata_for_returns_only_selected_target_tables():
    assert set(target_metadata_for("auth").tables) == {"api_keys"}
    assert set(target_metadata_for("audit").tables) == {"audit_events"}
    assert set(target_metadata_for("chat_sessions").tables) == {"chat_sessions"}
    assert set(target_metadata_for("downloads").tables) == {"model_downloads"}
    assert set(target_metadata_for("benchmarks").tables) == {
        "benchmark_definitions",
        "benchmark_run_samples",
        "benchmark_runs",
        "tool_loop_eval_cases",
        "tool_loop_eval_runs",
    }
    assert set(target_metadata_for("models").tables) == {
        "model_assets",
        "model_asset_provenance",
        "model_deployments",
        "model_profiles",
        "models",
    }
    assert set(target_metadata_for("settings").tables) == {"settings_entries"}
    assert set(target_metadata_for("projects").tables) == {"project_node_roots", "projects"}
    assert set(target_metadata_for("controller").tables) == {
        "artifacts",
        "controller_leases",
        "job_attempts",
        "job_events",
        "jobs",
        "node_leases",
        "schema_meta",
    }


def test_head_revision_for_returns_target_branch_head():
    assert head_revision_for("controller") == "controller@head"
    assert head_revision_for("auth") == "auth@head"
    assert head_revision_for("audit") == "audit@head"
    assert head_revision_for("chat_sessions") == "chat_sessions@head"
    assert head_revision_for("downloads") == "downloads@head"
    assert head_revision_for("benchmarks") == "benchmarks@head"
    assert head_revision_for("models") == "models@head"
    assert head_revision_for("settings") == "settings@head"
    assert head_revision_for("projects") == "projects@head"


def test_settings_migrations_include_initial_revision():
    migration_path = Path("migrations/versions/settings/20260617_0001_create_settings_entries.py")
    assert migration_path.exists()

    import importlib.util

    spec = importlib.util.spec_from_file_location("settings_entries", migration_path)
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)

    assert module.revision == "20260617_0001"


def test_projects_migrations_include_initial_revision():
    migration_path = Path("migrations/versions/projects/20260618_0001_create_projects.py")
    assert migration_path.exists()

    import importlib.util

    spec = importlib.util.spec_from_file_location("projects_initial", migration_path)
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)

    assert module.revision == "20260618_0001"


def test_models_migrations_include_catalog_expansion_revision():
    migration_path = Path("migrations/versions/models/20260614_0002_expand_model_catalog_for_db_authority.py")
    assert migration_path.exists()

    import importlib.util

    spec = importlib.util.spec_from_file_location("models_catalog_expansion", migration_path)
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)

    assert module.revision == "20260614_0002"
    assert module.down_revision == "20260613_0002"
    assert module.branch_labels is None
