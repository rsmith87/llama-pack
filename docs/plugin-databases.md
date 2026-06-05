# Plugin Database Contract

This design defines how Neuraxis plugins store durable data without coupling
core to plugin-owned schemas or models.

Plugins may need persistent data for usage accounting, identity mappings,
policy state, paid-feature configuration, reporting, connectors, or other
domain-specific workflows. Core should provide a stable database and migration
contract, but it should not import plugin ORM models, define plugin tables, or
mix plugin data into core databases.

## Goals

- Keep core databases focused on core runtime state.
- Give each plugin isolated durable storage under the runtime `log_dir`.
- Let plugins own their schemas, migrations, stores, and ORM/domain models.
- Let core expose operator-visible migration status and explicit migration
  execution.
- Make backup, restore, removal, and support workflows simpler by keeping plugin
  data separate from core data.

## Non-Goals

- Core does not inspect or validate plugin table definitions.
- Core does not import plugin ORM metadata.
- Core does not auto-run plugin migrations at startup by default.
- Core does not provide cross-plugin joins or shared plugin tables.
- Core does not put plugin tables into `controller_state.db`, `auth_store.db`,
  or other core-owned databases.

## Storage Location

Each enabled plugin receives a private state directory:

```text
{log_dir}/plugins/{plugin_id}/state/
```

Plugin databases live inside that directory. A plugin with one primary database
should use:

```text
{log_dir}/plugins/{plugin_id}/state/{plugin_id}.db
```

Plugins that need multiple independent stores may use additional database names:

```text
{log_dir}/plugins/{plugin_id}/state/{database_name}.db
```

Database names should use the same safe identifier style as plugin ids:
lowercase letters, numbers, and underscores. Core should reject path separators
and traversal segments in database names.

## Core Contract

Core exposes a narrow `PluginContext` database API:

```python
database = context.get_database("main")

context.add_migration_target(
    "main",
    directory="neuraxis_business/migrations/main",
    database=database,
)
```

The database handle should expose only core-owned plumbing:

- `name`: configured plugin-local database name.
- `path`: resolved database file path under the plugin state directory.
- `url`: SQLAlchemy-compatible SQLite URL.

Plugins remain responsible for creating stores, engines, sessions, ORM models,
and domain APIs from that URL. Core provides the location and migration
lifecycle, not the schema.

## Migration Contract

Plugins define schema changes as versioned migration files in the plugin package
or repository. Alembic-style migrations are preferred because they are explicit,
reviewable, ordered, and compatible with the existing Neuraxis persistence
tooling.

Core should extend the existing plugin migration metadata into an executable
contract:

```text
GET  /lm-api/v1/plugins/{plugin_id}/migrations/status
POST /lm-api/v1/plugins/{plugin_id}/migrations/{target_id}/upgrade
```

A later CLI can wrap the same service:

```bash
uv run neuraxis plugins migrate {plugin_id} {target_id}
```

Migration status should include:

- plugin id
- target id
- database URL or redacted database path
- migration directory
- current revision
- head revision
- status: `current`, `missing`, `pending`, `unknown`, or `failed`
- last migration error, when available

Startup should continue to report missing or pending plugin migrations as health
warnings. Startup should not silently mutate plugin databases unless an explicit
operator setting is added later.

## Ownership Boundary

Core owns:

- Resolving plugin database paths safely.
- Ensuring plugin database files stay under the plugin state directory.
- Providing SQLAlchemy-compatible URLs.
- Registering migration targets.
- Reporting migration status in plugin status endpoints.
- Running explicit migration commands when requested.
- Emitting migration lifecycle events such as pending, started, completed, and
  failed.

Plugins own:

- Tables, indexes, constraints, and migrations.
- ORM models and store classes.
- Reads, writes, validation, and domain behavior.
- Plugin data retention and export semantics.
- Tests that prove plugin migrations and stores work.

This boundary keeps core generic. A paid add-on such as `neuraxis_business` can
store business identity, usage, quota, audit, and reporting data without making
core aware of those models.

## Backup And Restore

Separate plugin databases make backup and restore more predictable:

- Core backups can include only core databases when operators want a clean core
  restore.
- Full-instance backups can include `logs/plugins/` when operators want plugin
  data restored too.
- Paid/private plugin support can inspect plugin-owned databases without
  touching core runtime databases.
- Plugin uninstall or reset workflows can remove a plugin state directory
  without schema surgery in core databases.

The backup tooling should eventually expose plugin databases as named units, for
example:

```text
core:controller
core:auth
plugin:neuraxis_business:main
```

## Failure Handling

Plugin database failures should degrade the plugin, not the core runtime.

- If a plugin migration is missing or pending, the plugin remains enabled unless
  the plugin marks that migration as required for registration.
- If explicit migration execution fails, core records the failure in plugin
  health/status and returns an operator-visible error.
- If plugin store initialization fails during registration, that plugin should
  fail or disable itself through normal plugin registration error handling.
- Core routes, auth, chat, and node management should continue to work when a
  plugin database is broken.

## Testing Expectations

Core tests should cover:

- Database path resolution stays inside plugin state directories.
- Invalid database names are rejected.
- Migration targets can be registered with plugin database URLs.
- Migration status reports current, pending, missing, and failed targets.
- Explicit migration execution affects only the selected plugin database.
- Plugin database failures are reported in plugin status without breaking core
  startup.

Plugin tests should cover:

- Fresh database creation.
- Migration from older revisions.
- Store read/write behavior.
- Plugin registration with missing, pending, and current schemas.
- Backup/restore expectations for plugin-owned state when applicable.
