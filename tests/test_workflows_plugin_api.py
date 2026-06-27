from __future__ import annotations

from pathlib import Path

from llama_pack.core.config import load_config
from llama_pack.core.threads.models import WorkflowStep
from llama_pack.main import create_app
from tests.helpers import authenticated_client
from tests.persistence_db_setup import prepare_all_persistence_dbs

REPO_ROOT = Path(__file__).resolve().parents[1]


def workflows_config(tmp_path: Path):
    log_dir = tmp_path / "logs"
    prepare_all_persistence_dbs(log_dir)
    plugin_dir = REPO_ROOT / "plugins" / "llama_pack_workflows"
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
        assert "data-workflow-action" in controller.text
        assert "data-workflow-action=\"cancel-edit\"" in template.text
        assert "export function mountPage" in controller.text
        assert 'data-workflow-action="edit"' in controller.text
        assert "populateForm" in controller.text
        assert "buildTriggers" in controller.text
        assert "host.apiGet" in controller.text
        assert "host.apiPost" in controller.text
        assert "fetch(" not in controller.text
        assert migration_status.json()["targets"][0]["head_revision"] == "001_workflows"
        assert migration_upgrade.json()["target"]["status"] == "current"
