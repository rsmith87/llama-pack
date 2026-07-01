from __future__ import annotations

import asyncio
import sys
from pathlib import Path

from llama_pack.core.config import load_config
from llama_pack.core.threads.models import WorkflowStep
from llama_pack.main import create_app
from tests.helpers import authenticated_client
from tests.persistence_db_setup import prepare_all_persistence_dbs

REPO_ROOT = Path(__file__).resolve().parents[1]
PLUGIN_ROOT = REPO_ROOT / "plugins" / "llama_pack_workflows"
if str(PLUGIN_ROOT) not in sys.path:
    sys.path.insert(0, str(PLUGIN_ROOT))

from llama_pack_workflows.store import WorkflowStore


class FakeRouteRegistry:
    def list_nodes(self) -> list[dict[str, object]]:
        return [
            {"name": "gpu-box", "heartbeat_fresh": True},
            {"name": "offline-box", "heartbeat_fresh": False},
        ]

    async def request_node(self, node_name: str, method: str, path: str) -> object:
        if method != "GET":
            raise AssertionError(f"Unexpected node request: {method} {path}")
        if node_name == "gpu-box" and path == "/lm-api/v1/models":
            return [{"name": "qwen", "running": True}, {"name": "mistral", "running": False}]
        if node_name == "gpu-box" and path == "/lm-api/v1/library/ggufs":
            return [{"filename": "deepseek-r1.gguf", "registered_as": "deepseek"}]
        raise AssertionError(f"Unexpected node request: {node_name}")


class FakeEligibilityRouteRegistry:
    def list_nodes(self) -> list[dict[str, object]]:
        return [
            {"name": "mac-mini", "heartbeat_fresh": True},
            {"name": "linux-2080ti", "heartbeat_fresh": False},
        ]

    async def request_node(self, node_name: str, method: str, path: str) -> object:
        if method != "GET":
            raise AssertionError(f"Unexpected node request: {method} {path}")
        if node_name == "mac-mini" and path == "/lm-api/v1/models":
            return [{"name": "qwen", "running": True}, {"name": "mistral", "running": False}]
        if node_name == "mac-mini" and path == "/lm-api/v1/library/ggufs":
            return [{"registered_as": "deepseek"}]
        if node_name == "linux-2080ti" and path == "/lm-api/v1/models":
            raise AssertionError("Unavailable nodes must not be queried for live models")
        if node_name == "linux-2080ti" and path == "/lm-api/v1/library/ggufs":
            raise AssertionError("Unavailable nodes must not be queried for GGUFs")
        raise AssertionError(f"Unexpected node request: {node_name} {path}")


def workflows_config(tmp_path: Path):
    log_dir = tmp_path / "logs"
    prepare_all_persistence_dbs(log_dir)
    plugin_dir = PLUGIN_ROOT
    return load_config(
        {
            "mode": "controller",
            "log_dir": str(log_dir),
            "enabled_plugins": ["llama_pack_workflows"],
            "plugins": {"llama_pack_workflows": {"path": str(plugin_dir), "enabled": True}},
        }
    )


def test_workflows_plugin_loads_and_exposes_metadata(tmp_path: Path):
    with authenticated_client(create_app(config=workflows_config(tmp_path))) as client:
        status = client.get("/lm-api/v1/plugins/status").json()["plugins"][0]
        assert status["id"] == "llama_pack_workflows"
        assert status["status"] == "enabled"
        assert status["errors"] == []

        enabled = client.get("/lm-api/v1/plugins/enabled").json()
        metadata = enabled[0]
        assert metadata["id"] == "llama_pack_workflows"
        assert metadata["frontend"]["style_entries"] == ["/plugin-assets/llama_pack_workflows/workflows.css"]
        assert metadata["ui_routes"] == [{"path": "/ui/plugins/llama_pack_workflows", "label": "Workflows"}]

        page = metadata["frontend"]["pages"][0]
        assert page["route"] == "/ui/plugins/llama_pack_workflows"
        assert page["template"] == "/plugin-assets/llama_pack_workflows/templates/workflows.html"
        assert page["controller"] == "/plugin-assets/llama_pack_workflows/controllers/workflows.js"


def test_workflows_plugin_lists_builtin_templates(tmp_path: Path):
    with authenticated_client(create_app(config=workflows_config(tmp_path))) as client:
        response = client.get("/lm-api/v1/plugins/llama_pack_workflows/templates")

        assert response.status_code == 200
        payload = response.json()
        ids = {item["id"] for item in payload["templates"]}
        assert "thread_prompt_chain" in ids
        assert "scheduled_benchmark" in ids
        prompt_chain = next(item for item in payload["templates"] if item["id"] == "thread_prompt_chain")
        assert prompt_chain["parameters"][0]["name"] == "content"
        assert prompt_chain["parameters"][0]["required"] is True


def test_create_and_list_workflow_definition(tmp_path: Path):
    with authenticated_client(create_app(config=workflows_config(tmp_path))) as client:
        body = {
            "name": "Daily summary",
            "description": "Summarize recent thread activity",
            "template_id": "thread_prompt_chain",
            "enabled": True,
            "parameters": {
                "content": "Summarize the day",
                "steps": [{"label": "summarize", "instructions": "Summarize in five bullets."}],
                "model": "qwen",
                "target": "auto",
            },
            "triggers": [{"type": "manual", "schedule": None, "event_type": None}],
        }

        create_response = client.post("/lm-api/v1/plugins/llama_pack_workflows/workflows", json=body)
        assert create_response.status_code == 200
        created = create_response.json()
        assert created["name"] == "Daily summary"

        list_response = client.get("/lm-api/v1/plugins/llama_pack_workflows/workflows")
        assert list_response.status_code == 200
        assert list_response.json()["workflows"][0]["id"] == created["id"]


def test_create_and_list_event_triggered_workflow_definition(tmp_path: Path):
    with authenticated_client(create_app(config=workflows_config(tmp_path))) as client:
        body = {
            "name": "Chat failure follow-up",
            "description": "Runs after a chat request fails",
            "template_id": "thread_prompt_chain",
            "enabled": True,
            "parameters": {
                "content": "Summarize the failed request.",
                "steps": [{"label": "triage", "instructions": "Summarize the failure."}],
                "model": "qwen",
                "target": "auto",
            },
            "triggers": [{"type": "event", "schedule": None, "event_type": "llama_pack.chat.failed"}],
        }

        create_response = client.post("/lm-api/v1/plugins/llama_pack_workflows/workflows", json=body)
        assert create_response.status_code == 200
        created = create_response.json()

        list_response = client.get("/lm-api/v1/plugins/llama_pack_workflows/workflows")
        assert list_response.status_code == 200
        listed = list_response.json()["workflows"][0]
        assert listed["id"] == created["id"]
        assert listed["triggers"] == [{"type": "event", "schedule": None, "event_type": "llama_pack.chat.failed"}]


def test_thread_error_event_triggers_workflow(tmp_path: Path):
    app = create_app(config=workflows_config(tmp_path))
    fake_thread_service = FakeThreadService()
    app.state.thread_service = fake_thread_service

    with authenticated_client(app) as client:
        create_response = client.post(
            "/lm-api/v1/plugins/llama_pack_workflows/workflows",
            json={
                "name": "Thread error follow-up",
                "description": "Runs after a thread error event",
                "template_id": "thread_prompt_chain",
                "enabled": True,
                "parameters": {
                    "content": "Summarize the failed thread.",
                    "steps": [{"label": "triage", "instructions": "Summarize the failure."}],
                    "model": "qwen",
                    "target": "auto",
                },
                "triggers": [{"type": "event", "schedule": None, "event_type": "llama_pack.thread.error.created"}],
            },
        )
        assert create_response.status_code == 200

        async def emit_thread_error_event() -> None:
            await app.state.plugin_registry.events.emit(
                "llama_pack.thread.error.created",
                payload={"thread_id": "thread-1", "error_code": "CHAT_PROXY_ERROR"},
                correlation_id="turn-1",
            )

        asyncio.run(emit_thread_error_event())

        runs_response = client.get("/lm-api/v1/plugins/llama_pack_workflows/runs")
        assert runs_response.status_code == 200
        runs = runs_response.json()["runs"]
        assert len(runs) == 1
        assert runs[0]["trigger_detail"] == "llama_pack.thread.error.created"


def test_workflow_run_detail_includes_failed_step_debug_fields(tmp_path: Path):
    app = create_app(config=workflows_config(tmp_path))

    with authenticated_client(app) as client:
        create_response = client.post(
            "/lm-api/v1/plugins/llama_pack_workflows/workflows",
            json={
                "name": "Failure inspector",
                "description": "Exposes failed run details",
                "template_id": "thread_prompt_chain",
                "enabled": True,
                "parameters": {
                    "content": "Debug this failure.",
                    "steps": [{"label": "triage", "instructions": "Find the failure."}],
                    "model": "qwen",
                    "target": "auto",
                },
                "triggers": [{"type": "manual", "schedule": None, "event_type": None}],
            },
        )
        workflow_id = create_response.json()["id"]
        store = WorkflowStore(tmp_path / "logs" / "plugins" / "llama_pack_workflows" / "state" / "llama_pack_workflows.db")
        run = store.create_run(workflow_id, "manual", "api", "job-9")
        store.mark_run_running(run.id)
        store.add_step(
            run.id,
            "triage",
            "failed",
            "user prompt",
            None,
            "job-9",
            "thread-7",
            "model qwen unavailable",
        )
        store.mark_run_failed(run.id, "model qwen unavailable")

        response = client.get(f"/lm-api/v1/plugins/llama_pack_workflows/runs/{run.id}")

        assert response.status_code == 200
        payload = response.json()
        assert payload["run"]["id"] == run.id
        assert payload["run"]["status"] == "failed"
        assert payload["run"]["error_detail"] == "model qwen unavailable"
        assert payload["run"]["correlation_id"] == "job-9"
        assert payload["run"]["started_at"] is not None
        assert payload["run"]["finished_at"] is not None
        assert payload["steps"] == [
            {
                "id": payload["steps"][0]["id"],
                "run_id": run.id,
                "label": "triage",
                "status": "failed",
                "input_summary": "user prompt",
                "output_summary": None,
                "linked_job_id": "job-9",
                "linked_thread_id": "thread-7",
                "error_detail": "model qwen unavailable",
                "created_at": payload["steps"][0]["created_at"],
            }
        ]


def test_update_workflow_definition(tmp_path: Path):
    with authenticated_client(create_app(config=workflows_config(tmp_path))) as client:
        create_response = client.post(
            "/lm-api/v1/plugins/llama_pack_workflows/workflows",
            json={
                "name": "Daily summary",
                "description": "Summarize recent thread activity",
                "template_id": "thread_prompt_chain",
                "enabled": True,
                "parameters": {
                    "content": "Summarize the day",
                    "steps": [{"label": "summarize", "instructions": "Summarize in five bullets."}],
                    "model": "qwen",
                    "target": "auto",
                },
                "triggers": [{"type": "manual", "schedule": None, "event_type": None}],
            },
        )
        workflow_id = create_response.json()["id"]

        update_response = client.put(
            f"/lm-api/v1/plugins/llama_pack_workflows/workflows/{workflow_id}",
            json={
                "name": "Benchmark every hour",
                "description": "Updated workflow",
                "template_id": "scheduled_benchmark",
                "enabled": False,
                "parameters": {"benchmark_id": "bench-1", "models": ["qwen"]},
                "triggers": [
                    {
                        "type": "schedule",
                        "schedule": {"kind": "interval_minutes", "value": "60"},
                        "event_type": None,
                    }
                ],
            },
        )

        assert update_response.status_code == 200
        updated = update_response.json()
        assert updated["id"] == workflow_id
        assert updated["name"] == "Benchmark every hour"
        assert updated["enabled"] is False
        assert updated["triggers"][0]["schedule"]["kind"] == "interval_minutes"
        assert updated["triggers"][0]["schedule"]["value"] == "60"


def test_create_workflow_rejects_unknown_template(tmp_path: Path):
    with authenticated_client(create_app(config=workflows_config(tmp_path))) as client:
        response = client.post(
            "/lm-api/v1/plugins/llama_pack_workflows/workflows",
            json={
                "name": "Bad workflow",
                "description": "Invalid template test",
                "template_id": "missing",
                "enabled": True,
                "parameters": {},
                "triggers": [{"type": "manual", "schedule": None, "event_type": None}],
            },
        )

        assert response.status_code == 400
        assert response.json()["detail"] == "Unknown workflow template: missing"


def test_workflows_plugin_route_options_list_models_and_node_targets(tmp_path: Path):
    app = create_app(config=workflows_config(tmp_path))
    app.state.node_registry = FakeRouteRegistry()

    with authenticated_client(app) as client:
        response = client.get("/lm-api/v1/plugins/llama_pack_workflows/route-options")

        assert response.status_code == 200
        payload = response.json()
        assert [item["value"] for item in payload["models"]] == ["auto", "qwen", "mistral", "deepseek", "deepseek-r1"]
        assert [item["value"] for item in payload["targets"]] == ["auto", "node:gpu-box", "node:offline-box"]
        assert payload["models"][1]["reason"] == "Running on gpu-box."
        assert payload["models"][2]["reason"] == "Stopped on gpu-box; workflow routing can start it if capacity allows."
        assert payload["targets"][1]["selectable"] is True
        assert payload["targets"][2]["selectable"] is False


def test_workflows_plugin_route_options_explain_model_and_node_eligibility(tmp_path: Path):
    app = create_app(config=workflows_config(tmp_path))
    app.state.node_registry = FakeEligibilityRouteRegistry()

    with authenticated_client(app) as client:
        response = client.get("/lm-api/v1/plugins/llama_pack_workflows/route-options")

        assert response.status_code == 200
        payload = response.json()
        models = {item["value"]: item for item in payload["models"]}
        targets = {item["value"]: item for item in payload["targets"]}
        assert models["auto"]["selectable"] is True
        assert models["auto"]["reason"] == "Routing policy will choose an eligible running model."
        assert models["qwen"]["selectable"] is True
        assert models["qwen"]["reason"] == "Running on mac-mini."
        assert models["mistral"]["selectable"] is True
        assert models["mistral"]["reason"] == "Stopped on mac-mini; workflow routing can start it if capacity allows."
        assert models["deepseek"]["selectable"] is True
        assert models["deepseek"]["reason"] == "Registered on mac-mini but no running instance was reported."
        assert targets["node:mac-mini"]["selectable"] is True
        assert targets["node:mac-mini"]["reason"] == "Node mac-mini is reachable."
        assert targets["node:linux-2080ti"]["selectable"] is False
        assert targets["node:linux-2080ti"]["reason"] == "Node linux-2080ti is unavailable because its heartbeat is stale or missing."


class FakeThreadService:
    def __init__(self) -> None:
        self.calls: list[dict[str, object]] = []

    def create_thread(
        self,
        title: str | None,
        default_model: str | None,
        metadata: dict[str, object],
        created_by: str | None,
    ) -> dict[str, object]:
        return {"id": "thread-1", "title": title, "default_model": default_model, "metadata": metadata, "created_by": created_by}

    async def run_workflow_async(
        self,
        thread_id: str,
        content: str,
        steps: list[WorkflowStep],
        model: str | None,
        target: str,
        metadata: dict[str, object] | None,
    ) -> dict[str, object]:
        self.calls.append(
            {
                "thread_id": thread_id,
                "content": content,
                "steps": steps,
                "model": model,
                "target": target,
                "metadata": metadata,
            }
        )
        return {
            "thread_id": thread_id,
            "message": {"role": "assistant", "content": "done"},
            "route": {"node": "local", "model": model, "strategy": "workflow", "reason": "test"},
            "workflow_steps": [{"label": "summarize", "model": model, "node": "local", "output": "done"}],
        }


def test_manual_run_executes_thread_prompt_chain(tmp_path: Path):
    app = create_app(config=workflows_config(tmp_path))
    fake_thread_service = FakeThreadService()
    app.state.thread_service = fake_thread_service

    with authenticated_client(app) as client:
        workflow_response = client.post(
            "/lm-api/v1/plugins/llama_pack_workflows/workflows",
            json={
                "name": "Daily summary",
                "description": "Summarize recent thread activity",
                "template_id": "thread_prompt_chain",
                "enabled": True,
                "parameters": {
                    "content": "Summarize the day",
                    "steps": [{"label": "summarize", "instructions": "Summarize in five bullets."}],
                    "model": "qwen",
                    "target": "auto",
                },
                "triggers": [{"type": "manual", "schedule": None, "event_type": None}],
            },
        )
        workflow_id = workflow_response.json()["id"]

        run_response = client.post(f"/lm-api/v1/plugins/llama_pack_workflows/workflows/{workflow_id}/runs")
        assert run_response.status_code == 200
        run = run_response.json()
        assert run["status"] == "completed"

        runs_response = client.get("/lm-api/v1/plugins/llama_pack_workflows/runs")
        assert runs_response.status_code == 200
        assert runs_response.json()["runs"][0]["id"] == run["id"]

    assert fake_thread_service.calls[0]["content"] == "Summarize the day"
    assert fake_thread_service.calls[0]["model"] == "qwen"


def test_workflows_plugin_static_assets_load(tmp_path: Path):
    with authenticated_client(create_app(config=workflows_config(tmp_path))) as client:
        style = client.get("/plugin-assets/llama_pack_workflows/workflows.css")
        template = client.get("/plugin-assets/llama_pack_workflows/templates/workflows.html")
        controller = client.get("/plugin-assets/llama_pack_workflows/controllers/workflows.js")
        migration_status = client.get("/lm-api/v1/plugins/llama_pack_workflows/migrations/status")
        migration_upgrade = client.post("/lm-api/v1/plugins/llama_pack_workflows/migrations/main/upgrade")

        assert style.status_code == 200
        assert template.status_code == 200
        assert controller.status_code == 200
        assert migration_status.status_code == 200
        assert migration_upgrade.status_code == 200
        assert "data-workflow-trigger-type" in template.text
        assert 'value="schedule_daily"' in template.text
        assert 'value="schedule_interval"' in template.text
        assert 'value="event"' in template.text
        assert 'name="event_type"' in template.text
        assert 'value="llama_pack.chat.completed"' in template.text
        assert 'value="llama_pack.chat.failed"' in template.text
        assert "data-workflow-parameter-panel" in template.text
        assert "data-workflow-content" in template.text
        assert "data-workflow-steps" in template.text
        assert "data-workflow-action=\"add-step\"" in template.text
        assert "data-workflow-action=\"toggle-advanced\"" in template.text
        assert "name=\"model\"" in template.text
        assert "data-workflow-model-select" in template.text
        assert "name=\"target\"" in template.text
        assert "data-workflow-target-select" in template.text
        assert "parameters_json" not in template.text
        assert "data-workflow-action" in controller.text
        assert "data-workflow-action=\"cancel-edit\"" in template.text
        assert "data-workflow-run-detail" in template.text
        assert "data-workflow-run-detail-body" in template.text
        assert "export function mountPage" in controller.text
        assert "buildParameters" in controller.text
        assert "addStepField" in controller.text
        assert "renderRunDetail" in controller.text
        assert "syncRouteSelects" in controller.text
        assert 'host.apiGet("/route-options")' in controller.text
        assert "option.title = option.reason" in controller.text
        assert "element.disabled = option.selectable === false" in controller.text
        assert "formatRouteOptionLabel" in controller.text
        assert "inspect-run" in controller.text
        assert "data-workflow-run-id" in controller.text
        assert "linked_thread_id" in controller.text
        assert "linked_job_id" in controller.text
        assert 'host.apiGet(`/runs/${encodeURIComponent(runId)}`)' in controller.text
        assert 'data-workflow-action="edit"' in controller.text
        assert "populateForm" in controller.text
        assert "buildTriggers" in controller.text
        assert 'triggerType === "event"' in controller.text
        assert "Unsupported workflow event type" in controller.text
        assert "host.apiGet" in controller.text
        assert "host.apiPost" in controller.text
        assert "fetch(" not in controller.text
        assert "var(--card)" in style.text
        assert "var(--line)" in style.text
        assert "var(--ink)" in style.text
        assert "var(--muted)" in style.text
        assert "#fff" not in style.text
        assert "#d5d8df" not in style.text
        assert "#5f6673" not in style.text
        assert migration_status.json()["targets"][0]["head_revision"] == "001_workflows"
        assert migration_upgrade.json()["target"]["status"] == "current"
