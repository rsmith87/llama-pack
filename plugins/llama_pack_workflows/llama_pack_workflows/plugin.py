from __future__ import annotations

import sqlite3

from llama_pack_workflows.api import create_router
from llama_pack_workflows.runner import WorkflowRunner
from llama_pack_workflows.scheduler import WorkflowEventDispatcher, WorkflowScheduler
from llama_pack_workflows.store import WorkflowStore


class WorkflowsPlugin:
    id = "llama_pack_workflows"
    name = "Llama Pack Workflows"
    version = "0.1.0"

    def register(self, context) -> None:
        database = context.get_database("main")
        store = WorkflowStore(database.path)
        _run_migrations(store, "001_workflows")
        app_ref = {"app": None}
        runner = WorkflowRunner(store, app_provider=lambda: app_ref["app"])
        scheduler = WorkflowScheduler(store, runner, 60)
        dispatcher = WorkflowEventDispatcher(store, runner)

        async def health_check():
            return {"level": "ok", "message": "Llama Pack Workflows ready"}

        async def start(app):
            app_ref["app"] = app
            scheduler.start()

        async def stop(app):
            await scheduler.stop()
            app_ref["app"] = None

        context.add_api_router(create_router(store, runner))
        context.add_health_check(health_check)
        context.add_background_task("scheduler", start=start, stop=stop)
        context.subscribe("llama_pack.chat.completed", dispatcher.handle)
        context.subscribe("llama_pack.chat.failed", dispatcher.handle)
        context.add_migration_target(
            "main",
            directory="llama_pack_workflows/migrations",
            database=database,
            current_revision="001_workflows",
            head_revision="001_workflows",
            runner=lambda: _run_migrations(store, "001_workflows"),
        )


plugin = WorkflowsPlugin()


def _run_migrations(store: WorkflowStore, revision: str) -> None:
    store.migrate()
    with sqlite3.connect(store.db_path) as connection:
        connection.execute("CREATE TABLE IF NOT EXISTS alembic_version (version_num VARCHAR(32) NOT NULL)")
        current = connection.execute("SELECT version_num FROM alembic_version LIMIT 1").fetchone()
        if current is None:
            connection.execute("INSERT INTO alembic_version (version_num) VALUES (?)", (revision,))
