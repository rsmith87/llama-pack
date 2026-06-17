from sqlalchemy import text

from llama_pack.core.config import load_config
from llama_pack.core.persistence.db_infra import (
    create_persistence_engine,
    create_session_factory,
    default_state_dir,
    resolve_persistence_urls,
    session_scope,
)


def test_resolve_persistence_urls_defaults_to_state_dir_paths(tmp_path):
    config = load_config({"log_dir": str(tmp_path / "logs")})

    urls = resolve_persistence_urls(config)

    state_dir = tmp_path / "state"
    assert urls.controller == f"sqlite+pysqlite:///{state_dir / 'controller_state.db'}"
    assert urls.auth == f"sqlite+pysqlite:///{state_dir / 'auth_store.db'}"
    assert urls.audit == f"sqlite+pysqlite:///{state_dir / 'audit_events.db'}"
    assert urls.chat_sessions == f"sqlite+pysqlite:///{state_dir / 'chat_sessions.db'}"
    assert urls.downloads == f"sqlite+pysqlite:///{state_dir / 'downloads.db'}"
    assert urls.benchmarks == f"sqlite+pysqlite:///{state_dir / 'benchmarks.db'}"
    assert urls.settings == f"sqlite+pysqlite:///{state_dir / 'settings.db'}"


def test_default_state_dir_stays_inside_non_logs_dir(tmp_path):
    config = load_config({"log_dir": str(tmp_path)})

    assert default_state_dir(config) == tmp_path / "state"


def test_resolve_persistence_urls_respects_overrides(tmp_path):
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
        }
    )

    urls = resolve_persistence_urls(config)

    assert urls.controller == "sqlite+pysqlite:///tmp/controller.db"
    assert urls.auth == "sqlite+pysqlite:///tmp/auth.db"
    assert urls.audit == "sqlite+pysqlite:///tmp/audit.db"
    assert urls.chat_sessions == "sqlite+pysqlite:///tmp/chat.db"
    assert urls.downloads == "sqlite+pysqlite:///tmp/downloads.db"
    assert urls.benchmarks == "sqlite+pysqlite:///tmp/benchmarks.db"
    assert urls.settings == "sqlite+pysqlite:///tmp/settings.db"


def test_create_persistence_engine_enables_sqlite_foreign_keys(tmp_path):
    db_url = f"sqlite+pysqlite:///{tmp_path / 'infra-test.db'}"
    engine = create_persistence_engine(db_url)

    with engine.connect() as conn:
        foreign_keys = conn.execute(text("PRAGMA foreign_keys")).scalar_one()

    assert foreign_keys == 1


def test_session_scope_commits_changes(tmp_path):
    db_url = f"sqlite+pysqlite:///{tmp_path / 'session-scope.db'}"
    engine = create_persistence_engine(db_url)

    with engine.begin() as conn:
        conn.execute(text("CREATE TABLE entries (id INTEGER PRIMARY KEY, value TEXT NOT NULL)"))

    session_factory = create_session_factory(engine)
    with session_scope(session_factory) as session:
        session.execute(text("INSERT INTO entries(value) VALUES ('ok')"))

    with engine.connect() as conn:
        count = conn.execute(text("SELECT COUNT(*) FROM entries")).scalar_one()

    assert count == 1
