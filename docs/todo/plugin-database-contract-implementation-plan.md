# Plugin Database Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a first-class plugin database contract so plugins can safely own isolated SQLite databases and executable migration targets without core importing plugin models.

**Architecture:** Core will expose safe plugin-local database handles through `PluginContext`, store migration target metadata with enough information to refresh and execute Alembic migrations explicitly, and add an authenticated API endpoint for per-target upgrades. Plugin schemas remain fully plugin-owned; core only resolves paths, reports status, runs explicit migration commands, and records health.

**Tech Stack:** Python 3.13, FastAPI, SQLAlchemy, Alembic, pytest, existing `llama_pack.core.plugins` runtime, existing `llama_pack.core.persistence.db_infra` helpers.

---

## File Structure

- Create `llama_pack/core/plugins/databases.py`
  - Owns `PluginDatabase`, safe database-name validation, and state-dir path resolution.
- Modify `llama_pack/core/plugins/context.py`
  - Adds `get_database(name="main")`.
  - Keeps `get_state_dir()` for non-database plugin state.
  - Allows `add_migration_target(..., database=database)` or `database_url=database.url`.
- Modify `llama_pack/core/plugins/migrations.py`
  - Adds migration status refresh fields and explicit runner support.
  - Adds Alembic command execution helper for plugin migration directories.
- Modify `llama_pack/core/plugins/registry.py`
  - Adds `upgrade_migration_target(plugin_id, target_id)`.
  - Refreshes target status before payload generation when possible.
  - Records migration execution health.
- Modify `llama_pack/api/routes/plugins.py`
  - Adds `POST /lm-api/v1/plugins/{plugin_id}/migrations/{target_id}/upgrade`.
- Modify `tests/test_plugins.py`
  - Adds core tests for safe database handles, invalid names, migration registration, and explicit migration execution.
- Modify `plugins/hello_plugin/hello_plugin/plugin.py`
  - Updates sample plugin to use `context.get_database("main")` for migration metadata.
- Modify `docs/plugins.md`, `docs/architecture.md`, and `docs/plugin-databases.md`
  - Align docs with the implemented API shape.

## Handoff Notes For Implementing Agent

- Read `AGENTS.md` first. This repo expects commands to be prefixed with `rtk`
  so large output is truncated before it consumes context.
- This plan is intentionally duplicated:
  - `docs/superpowers/plans/2026-06-05-plugin-database-contract.md` is the
    required writing-plans skill location, but `docs/superpowers/` is ignored.
  - `docs/todo/plugin-database-contract-implementation-plan.md` is the tracked
    copy to keep in the repository.
  - Keep both copies synchronized if the plan changes.
- Current doc groundwork already exists:
  - `docs/plugin-databases.md` defines the design contract.
  - `docs/plugins.md` and `docs/architecture.md` link to that contract.
  - `.gitignore` has a narrow exception for the tracked plan file under
    `docs/todo/`.
- `plugins/llama_pack_business_plugin/` is ignored and is a local/private
  development copy. Do not rely on it as core contract coverage and do not make
  core depend on business plugin code. Use `plugins/hello_plugin/` and generated
  fixture plugins in `tests/test_plugins.py` for core plugin runtime tests.
- `get_state_dir()` must remain supported. Existing plugins may already use it
  for files or databases. `get_database()` is additive and should not break the
  current state-dir contract.
- Plugin database handles should not create the SQLite file by themselves. They
  should only resolve a safe path and SQLAlchemy URL. The plugin store or
  migration execution creates the file when needed.
- Be careful with Alembic script directories. Plugin migration directories are
  relative to the configured plugin root, not the Llama Pack repository root.
  Store the plugin root on `PluginRecord` during loading so status refresh and
  upgrade execution can resolve relative migration directories correctly.
- Existing `PluginMigrationTarget.runner` is currently metadata-only plumbing.
  Prefer implementing the explicit Alembic path described in this plan first;
  keep `runner` only if preserving compatibility is simpler than removing it.
- Migration status refresh should degrade gracefully. A missing migration
  directory or unreadable database should set `last_error` and report health,
  not crash `/lm-api/v1/plugins/status`.
- Explicit migration execution should be scoped to one enabled plugin and one
  target. It must not run all plugin migrations implicitly and must not touch
  core Alembic branches.
- The project currently uses SQLite URLs from
  `llama_pack.core.persistence.db_infra.sqlite_url_for_path()`. Use that
  helper for plugin database URLs to stay consistent with core persistence.
- The exact current loader root variable is `path` in
  `llama_pack/core/plugins/loader.py::_load_one(...)`.

## Task 1: Plugin Database Handles

**Files:**
- Create: `llama_pack/core/plugins/databases.py`
- Modify: `llama_pack/core/plugins/context.py`
- Test: `tests/test_plugins.py`

- [ ] **Step 1: Write failing tests for database handle resolution**

Append these tests near the plugin migration tests in `tests/test_plugins.py`:

```python
def test_plugin_context_provides_isolated_database_handle(tmp_path: Path):
    plugin_dir = write_plugin(
        tmp_path,
        "database_plugin",
        body="""
        from pathlib import Path

        from fastapi import APIRouter

        class Plugin:
            def register(self, context):
                database = context.get_database("main")
                router = APIRouter()

                @router.get("/db")
                async def db():
                    return {
                        "name": database.name,
                        "path": str(database.path),
                        "url": database.url,
                        "exists": database.path.exists(),
                    }

                context.add_api_router(router)

        plugin = Plugin()
        """,
    )
    app = create_app(config=plugin_config(tmp_path, plugin_dir))
    client = authenticated_client(app)

    payload = client.get("/lm-api/v1/plugins/database_plugin/db").json()

    assert payload["name"] == "main"
    assert payload["path"].endswith("/logs/plugins/database_plugin/state/database_plugin.db")
    assert payload["url"].startswith("sqlite+pysqlite:///")
    assert payload["url"].endswith("/logs/plugins/database_plugin/state/database_plugin.db")
    assert payload["exists"] is False


def test_plugin_context_rejects_unsafe_database_names(tmp_path: Path):
    plugin_dir = write_plugin(
        tmp_path,
        "bad_database_plugin",
        body="""
        class Plugin:
            def register(self, context):
                context.get_database("../core")

        plugin = Plugin()
        """,
    )
    app = create_app(config=plugin_config(tmp_path, plugin_dir))
    client = authenticated_client(app)

    status = client.get("/lm-api/v1/plugins/status").json()["plugins"][0]

    assert status["status"] == "failed"
    assert "Invalid plugin database name" in status["errors"][0]
```

- [ ] **Step 2: Run tests and verify they fail**

Run:

```bash
rtk uv run pytest tests/test_plugins.py::test_plugin_context_provides_isolated_database_handle tests/test_plugins.py::test_plugin_context_rejects_unsafe_database_names -q
```

Expected: both tests fail because `PluginContext` has no `get_database()`.

- [ ] **Step 3: Add database handle implementation**

Create `llama_pack/core/plugins/databases.py`:

```python
from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path

from llama_pack.core.persistence.db_infra import sqlite_url_for_path


_DATABASE_NAME_RE = re.compile(r"^[a-z][a-z0-9_]*$")


@dataclass(frozen=True)
class PluginDatabase:
    name: str
    path: Path
    url: str


def resolve_plugin_database(plugin_id: str, state_dir: Path, name: str = "main") -> PluginDatabase:
    if not _DATABASE_NAME_RE.fullmatch(name):
        raise ValueError(f"Invalid plugin database name: {name!r}")

    state_root = state_dir.resolve()
    filename = f"{plugin_id}.db" if name == "main" else f"{name}.db"
    database_path = (state_root / filename).resolve()
    try:
        database_path.relative_to(state_root)
    except ValueError as exc:
        raise ValueError(f"Invalid plugin database path for {name!r}") from exc

    return PluginDatabase(name=name, path=database_path, url=sqlite_url_for_path(database_path))
```

Modify `llama_pack/core/plugins/context.py`:

```python
from llama_pack.core.plugins.databases import PluginDatabase, resolve_plugin_database
```

Add this method to `PluginContext` after `get_state_dir()`:

```python
    def get_database(self, name: str = "main") -> PluginDatabase:
        """Return a plugin-owned SQLite database handle inside the state directory."""
        return resolve_plugin_database(self.record.id, self._state_dir, name)
```

- [ ] **Step 4: Run tests and verify they pass**

Run:

```bash
rtk uv run pytest tests/test_plugins.py::test_plugin_context_provides_isolated_database_handle tests/test_plugins.py::test_plugin_context_rejects_unsafe_database_names -q
```

Expected: `2 passed`.

- [ ] **Step 5: Run plugin suite**

Run:

```bash
rtk uv run pytest tests/test_plugins.py -q
```

Expected: all plugin tests pass.

- [ ] **Step 6: Commit**

```bash
git add llama_pack/core/plugins/databases.py llama_pack/core/plugins/context.py tests/test_plugins.py
git commit -m "feat: add plugin database handles"
```

## Task 2: Migration Targets Use Plugin Databases

**Files:**
- Modify: `llama_pack/core/plugins/context.py`
- Modify: `llama_pack/core/plugins/migrations.py`
- Modify: `tests/test_plugins.py`

- [ ] **Step 1: Write failing test for database-backed migration registration**

Append this test near `test_plugin_migration_target_status_endpoint_reports_registered_target`:

```python
def test_plugin_migration_target_accepts_plugin_database_handle(tmp_path: Path):
    plugin_dir = write_plugin(
        tmp_path,
        "database_migration_plugin",
        body="""
        class Plugin:
            def register(self, context):
                database = context.get_database("analytics")
                context.add_migration_target(
                    "analytics",
                    directory="migrations/analytics",
                    database=database,
                    current_revision="001_initial",
                    head_revision="001_initial",
                )

        plugin = Plugin()
        """,
    )
    app = create_app(config=plugin_config(tmp_path, plugin_dir))
    client = authenticated_client(app)

    target = client.get("/lm-api/v1/plugins/database_migration_plugin/migrations/status").json()["targets"][0]

    assert target["id"] == "analytics"
    assert target["database_name"] == "analytics"
    assert target["database_path"].endswith("/logs/plugins/database_migration_plugin/state/analytics.db")
    assert target["database_url"].endswith("/logs/plugins/database_migration_plugin/state/analytics.db")
    assert target["status"] == "current"
```

- [ ] **Step 2: Run test and verify it fails**

Run:

```bash
rtk uv run pytest tests/test_plugins.py::test_plugin_migration_target_accepts_plugin_database_handle -q
```

Expected: fail with unexpected keyword argument `database`.

- [ ] **Step 3: Extend migration target data**

Modify `llama_pack/core/plugins/migrations.py`:

```python
from pathlib import Path
```

Update `PluginMigrationTarget` fields:

```python
    database_name: str | None = None
    database_path: Path | None = None
```

Update `payload()`:

```python
    def payload(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "directory": self.directory,
            "database_name": self.database_name,
            "database_path": str(self.database_path) if self.database_path else None,
            "database_url": self.database_url,
            "current_revision": self.current_revision,
            "head_revision": self.head_revision,
            "status": self.status,
            "pending": self.pending,
        }
```

- [ ] **Step 4: Extend `add_migration_target()`**

Modify `llama_pack/core/plugins/context.py` imports:

```python
from llama_pack.core.plugins.databases import PluginDatabase, resolve_plugin_database
```

Update `add_migration_target()` signature:

```python
        database: PluginDatabase | None = None,
```

Inside `add_migration_target()` before appending:

```python
        resolved_database_url = database.url if database else database_url
        database_name = database.name if database else None
        database_path = database.path if database else None
```

Update `PluginMigrationTarget(...)` construction:

```python
                database_name=database_name,
                database_path=database_path,
                database_url=resolved_database_url,
```

- [ ] **Step 5: Run focused test**

Run:

```bash
rtk uv run pytest tests/test_plugins.py::test_plugin_migration_target_accepts_plugin_database_handle -q
```

Expected: `1 passed`.

- [ ] **Step 6: Update existing migration status test expectations**

In `test_plugin_migration_target_status_endpoint_reports_registered_target`, add these expected keys to the target payload:

```python
"database_name": None,
"database_path": None,
```

- [ ] **Step 7: Run plugin tests**

Run:

```bash
rtk uv run pytest tests/test_plugins.py -q
```

Expected: all plugin tests pass.

- [ ] **Step 8: Commit**

```bash
git add llama_pack/core/plugins/context.py llama_pack/core/plugins/migrations.py tests/test_plugins.py
git commit -m "feat: attach migration targets to plugin databases"
```

## Task 3: Refresh Migration Status From Alembic

**Files:**
- Modify: `llama_pack/core/plugins/migrations.py`
- Modify: `llama_pack/core/plugins/registry.py`
- Modify: `tests/test_plugins.py`

- [ ] **Step 1: Write failing test for status refresh**

Append this test near other migration tests:

```python
def test_plugin_migration_status_refreshes_from_alembic_database(tmp_path: Path):
    plugin_dir = write_plugin(
        tmp_path,
        "refresh_migration_plugin",
        body="""
        class Plugin:
            def register(self, context):
                database = context.get_database("main")
                context.add_migration_target(
                    "main",
                    directory="migrations/main",
                    database=database,
                    head_revision="abc123",
                )

        plugin = Plugin()
        """,
    )
    migrations_dir = plugin_dir / "migrations" / "main"
    migrations_dir.mkdir(parents=True)
    (migrations_dir / "abc123_initial.py").write_text(
        '''
revision = "abc123"
down_revision = None
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa

def upgrade():
    op.create_table("sample_rows", sa.Column("id", sa.Integer(), primary_key=True))

def downgrade():
    op.drop_table("sample_rows")
''',
        encoding="utf-8",
    )
    app = create_app(config=plugin_config(tmp_path, plugin_dir))
    client = authenticated_client(app)

    target = client.get("/lm-api/v1/plugins/refresh_migration_plugin/migrations/status").json()["targets"][0]

    assert target["current_revision"] is None
    assert target["head_revision"] == "abc123"
    assert target["status"] == "missing"
```

- [ ] **Step 2: Run test and verify it fails or reports unknown**

Run:

```bash
rtk uv run pytest tests/test_plugins.py::test_plugin_migration_status_refreshes_from_alembic_database -q
```

Expected: fail until status refresh can inspect the plugin database.

- [ ] **Step 3: Add Alembic status helpers**

Modify `llama_pack/core/plugins/migrations.py` imports:

```python
from alembic.migration import MigrationContext
from alembic.script import ScriptDirectory
from sqlalchemy import create_engine
```

Add mutable fields to `PluginMigrationTarget`:

```python
    last_error: str | None = None
```

Add this method:

```python
    def refresh_status(self, *, plugin_root: Path | None = None) -> None:
        if self.database_url is None or self.directory is None:
            return
        migration_dir = Path(self.directory)
        if not migration_dir.is_absolute() and plugin_root is not None:
            migration_dir = plugin_root / migration_dir
        try:
            script = ScriptDirectory(str(migration_dir))
            heads = script.get_heads()
            if len(heads) == 1:
                self.head_revision = heads[0]
            engine = create_engine(self.database_url, future=True, pool_pre_ping=True)
            try:
                with engine.connect() as connection:
                    context = MigrationContext.configure(connection)
                    self.current_revision = context.get_current_revision()
            finally:
                engine.dispose()
            self.last_error = None
        except Exception as exc:
            self.last_error = str(exc)
```

Update `payload()` with:

```python
"last_error": self.last_error,
```

- [ ] **Step 4: Store plugin root in records**

Modify `llama_pack/core/plugins/registry.py` `PluginRecord`:

```python
    root: Path | None = None
```

In the current loader, the plugin root parameter is named `path`, so the exact
line to add after `record = PluginRecord(...)` is:

```python
        record.root = path
```

- [ ] **Step 5: Refresh status in registry payload**

Modify `PluginRegistry.migration_status_payload()`:

```python
        for target in record.migration_targets:
            target.refresh_status(plugin_root=record.root)
        return {
            "plugin_id": plugin_id,
            "targets": [target.payload() for target in record.migration_targets],
        }
```

Modify `_migration_health()` before reading each warning:

```python
            target.refresh_status(plugin_root=record.root)
```

- [ ] **Step 6: Run focused test**

Run:

```bash
rtk uv run pytest tests/test_plugins.py::test_plugin_migration_status_refreshes_from_alembic_database -q
```

Expected: `1 passed`.

- [ ] **Step 7: Update existing payload expectations**

Add `"last_error": None` to expected migration target payloads in existing tests where the target can be inspected without error. For metadata-only relative directories that do not exist, expect a non-empty `last_error` only if the test calls status refresh.

- [ ] **Step 8: Run plugin tests**

Run:

```bash
rtk uv run pytest tests/test_plugins.py -q
```

Expected: all plugin tests pass.

- [ ] **Step 9: Commit**

```bash
git add llama_pack/core/plugins/migrations.py llama_pack/core/plugins/registry.py llama_pack/core/plugins/loader.py tests/test_plugins.py
git commit -m "feat: refresh plugin migration status"
```

## Task 4: Explicit Plugin Migration Upgrade Endpoint

**Files:**
- Modify: `llama_pack/core/plugins/migrations.py`
- Modify: `llama_pack/core/plugins/registry.py`
- Modify: `llama_pack/api/routes/plugins.py`
- Modify: `tests/test_plugins.py`

- [ ] **Step 1: Write failing endpoint test**

Append this test near migration tests:

```python
def test_plugin_migration_upgrade_endpoint_runs_selected_target(tmp_path: Path):
    plugin_dir = write_plugin(
        tmp_path,
        "upgrade_migration_plugin",
        body="""
        class Plugin:
            def register(self, context):
                database = context.get_database("main")
                context.add_migration_target("main", directory="migrations/main", database=database)

        plugin = Plugin()
        """,
    )
    migrations_dir = plugin_dir / "migrations" / "main"
    migrations_dir.mkdir(parents=True)
    (migrations_dir / "001_initial.py").write_text(
        '''
revision = "001"
down_revision = None
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa

def upgrade():
    op.create_table("sample_rows", sa.Column("id", sa.Integer(), primary_key=True))

def downgrade():
    op.drop_table("sample_rows")
''',
        encoding="utf-8",
    )
    app = create_app(config=plugin_config(tmp_path, plugin_dir))
    client = authenticated_client(app)

    response = client.post("/lm-api/v1/plugins/upgrade_migration_plugin/migrations/main/upgrade")

    assert response.status_code == 200
    payload = response.json()
    assert payload["plugin_id"] == "upgrade_migration_plugin"
    assert payload["target"]["id"] == "main"
    assert payload["target"]["current_revision"] == "001"
    assert payload["target"]["head_revision"] == "001"
    assert payload["target"]["status"] == "current"
```

- [ ] **Step 2: Run test and verify it fails**

Run:

```bash
rtk uv run pytest tests/test_plugins.py::test_plugin_migration_upgrade_endpoint_runs_selected_target -q
```

Expected: fail with `404` because the route does not exist.

- [ ] **Step 3: Add Alembic upgrade helper**

Modify `llama_pack/core/plugins/migrations.py` imports:

```python
from alembic import command
from alembic.config import Config
```

Add method to `PluginMigrationTarget`:

```python
    def upgrade(self, *, plugin_root: Path | None = None, revision: str = "head") -> None:
        if self.database_url is None:
            raise RuntimeError(f"Plugin migration target {self.id} has no database URL")
        migration_dir = Path(self.directory)
        if not migration_dir.is_absolute() and plugin_root is not None:
            migration_dir = plugin_root / migration_dir
        config = Config()
        config.set_main_option("script_location", str(migration_dir))
        config.set_main_option("sqlalchemy.url", self.database_url)
        try:
            command.upgrade(config, revision)
            self.refresh_status(plugin_root=plugin_root)
        except Exception as exc:
            self.last_error = str(exc)
            raise
```

- [ ] **Step 4: Add registry method**

Modify `llama_pack/core/plugins/registry.py`:

```python
    def upgrade_migration_target(self, plugin_id: str, target_id: str) -> PluginMigrationTarget | None:
        record = self.records.get(plugin_id)
        if record is None or record.status != "enabled":
            return None
        for target in record.migration_targets:
            if target.id == target_id:
                target.upgrade(plugin_root=record.root)
                self.record_health(plugin_id, "ok", f"Plugin migration target {target_id} upgraded")
                return target
        return None
```

- [ ] **Step 5: Add route**

Modify `llama_pack/api/routes/plugins.py` after migration status route:

```python
@router.post("/{plugin_id}/migrations/{target_id}/upgrade")
async def upgrade_plugin_migration(plugin_id: str, target_id: str, request: Request):
    try:
        target = request.app.state.plugin_registry.upgrade_migration_target(plugin_id, target_id)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    if target is None:
        raise HTTPException(status_code=404, detail="Not Found")
    return {"plugin_id": plugin_id, "target": target.payload()}
```

- [ ] **Step 6: Run focused test**

Run:

```bash
rtk uv run pytest tests/test_plugins.py::test_plugin_migration_upgrade_endpoint_runs_selected_target -q
```

Expected: `1 passed`.

- [ ] **Step 7: Add failing test for unknown target**

Append:

```python
def test_plugin_migration_upgrade_endpoint_returns_404_for_unknown_target(tmp_path: Path):
    plugin_dir = write_plugin(
        tmp_path,
        "unknown_target_plugin",
        body="""
        class Plugin:
            def register(self, context):
                database = context.get_database("main")
                context.add_migration_target("main", directory="migrations/main", database=database)

        plugin = Plugin()
        """,
    )
    app = create_app(config=plugin_config(tmp_path, plugin_dir))
    client = authenticated_client(app)

    response = client.post("/lm-api/v1/plugins/unknown_target_plugin/migrations/missing/upgrade")

    assert response.status_code == 404
```

- [ ] **Step 8: Run migration endpoint tests**

Run:

```bash
rtk uv run pytest tests/test_plugins.py::test_plugin_migration_upgrade_endpoint_runs_selected_target tests/test_plugins.py::test_plugin_migration_upgrade_endpoint_returns_404_for_unknown_target -q
```

Expected: `2 passed`.

- [ ] **Step 9: Run plugin suite**

Run:

```bash
rtk uv run pytest tests/test_plugins.py -q
```

Expected: all plugin tests pass.

- [ ] **Step 10: Commit**

```bash
git add llama_pack/core/plugins/migrations.py llama_pack/core/plugins/registry.py llama_pack/api/routes/plugins.py tests/test_plugins.py
git commit -m "feat: run explicit plugin migrations"
```

## Task 5: Update Sample Plugin And Documentation

**Files:**
- Modify: `plugins/hello_plugin/hello_plugin/plugin.py`
- Modify: `docs/plugin-databases.md`
- Modify: `docs/plugins.md`
- Modify: `docs/architecture.md`
- Test: `tests/test_plugins.py`

- [ ] **Step 1: Update hello plugin to use database handle**

In `plugins/hello_plugin/hello_plugin/plugin.py`, replace its migration target registration with:

```python
        database = context.get_database("main")
        context.add_migration_target(
            "main",
            directory="hello_plugin/migrations",
            database=database,
        )
```

If the checked-in hello plugin currently has a different migration directory, keep that exact directory and only switch from a literal `database_url` to `database=database`.

- [ ] **Step 2: Update hello plugin test expectations**

In `tests/test_plugins.py::test_checked_in_hello_plugin_loads_as_sample_integration`, assert:

```python
    migration_status = client.get("/lm-api/v1/plugins/hello_plugin/migrations/status").json()
    target = migration_status["targets"][0]
    assert target["id"] == "main"
    assert target["database_name"] == "main"
    assert target["database_path"].endswith("/logs/plugins/hello_plugin/state/hello_plugin.db")
```

- [ ] **Step 3: Run hello plugin focused test**

Run:

```bash
rtk uv run pytest tests/test_plugins.py::test_checked_in_hello_plugin_loads_as_sample_integration -q
```

Expected: `1 passed`.

- [ ] **Step 4: Update `docs/plugin-databases.md` implemented API text**

Replace the current provisional API wording in the Core Contract section with
this text:

Core exposes a narrow `PluginContext` database API:

```python
database = context.get_database("main")

context.add_migration_target(
    "main",
    directory="llama_pack_business/migrations/main",
    database=database,
)
```

Ensure the route section includes:

```text
GET  /lm-api/v1/plugins/{plugin_id}/migrations/status
POST /lm-api/v1/plugins/{plugin_id}/migrations/{target_id}/upgrade
```

- [ ] **Step 5: Update `docs/plugins.md` author guide**

In the `PluginContext` methods list, change the migration/database bullets to:

```markdown
- `get_database(name="main")`: returns a plugin-owned SQLite database handle
  rooted under `{log_dir}/plugins/{plugin_id}/state/`.
- `add_migration_target(...)`: registers plugin migration metadata and optional
  explicit migration execution for a plugin-owned database.
```

In the migration example, use:

```python
database = context.get_database("main")
context.add_migration_target(
    "main",
    directory="hello_plugin/migrations",
    database=database,
)
```

- [ ] **Step 6: Update `docs/architecture.md`**

Replace “migration execution remains an explicit future command/workflow” with:

```markdown
Core does not run plugin migrations during startup; migration execution is
explicit through the plugin migration API.
```

- [ ] **Step 7: Run doc and plugin verification**

Run:

```bash
rtk rg -n "future command/workflow|database_url=\"sqlite:///usage.db\"|provisional API wording" docs plugins/hello_plugin
```

Expected: no matches.

Run:

```bash
rtk uv run pytest tests/test_plugins.py -q
```

Expected: all plugin tests pass.

- [ ] **Step 8: Commit**

```bash
git add plugins/hello_plugin/hello_plugin/plugin.py tests/test_plugins.py docs/plugin-databases.md docs/plugins.md docs/architecture.md
git commit -m "docs: document plugin database API"
```

## Final Verification

- [ ] **Step 1: Run focused plugin tests**

```bash
rtk uv run pytest tests/test_plugins.py -q
```

Expected: all tests pass.

- [ ] **Step 2: Run business plugin tests**

```bash
rtk uv run pytest plugins/llama_pack_business_plugin/tests/test_plugin_skeleton.py -q
```

Expected: all tests pass. If the checked-in development copy of `llama_pack_business` still uses direct state-dir paths, tests should still pass because `get_state_dir()` remains supported.

- [ ] **Step 3: Run full Python tests if time allows**

```bash
rtk uv run pytest tests/ -q
```

Expected: all tests pass.

- [ ] **Step 4: Inspect git status**

```bash
rtk git status --short
```

Expected: only intentional files are modified.

## Self-Review

- Spec coverage: This plan covers isolated plugin databases, core-owned path resolution, plugin-owned schemas, explicit migration status/execution, backup boundary documentation, failure handling, and tests.
- Placeholder scan: passed; no placeholder implementation steps remain.
- Type consistency: `PluginDatabase`, `context.get_database("main")`, `database=database`, `database_name`, `database_path`, `database_url`, and `upgrade_migration_target()` are used consistently across tasks.
