from __future__ import annotations

from llama_pack_workflows.models import TemplateParameter, WorkflowTemplate


def builtin_templates() -> list[WorkflowTemplate]:
    return [
        WorkflowTemplate(
            id="thread_prompt_chain",
            name="Thread prompt chain",
            description="Run a reusable multi-step prompt chain against a thread.",
            category="ai",
            parameters=[
                TemplateParameter(
                    name="content",
                    label="Content",
                    type="string",
                    required=True,
                    description="Seed input for the workflow.",
                ),
                TemplateParameter(
                    name="steps",
                    label="Steps",
                    type="step_list",
                    required=True,
                    description="Ordered workflow steps with label and instructions.",
                ),
                TemplateParameter(
                    name="model",
                    label="Model",
                    type="string",
                    required=True,
                    description="Default model for the workflow.",
                ),
                TemplateParameter(
                    name="target",
                    label="Target",
                    type="string",
                    required=True,
                    description="Routing target such as auto or node:name.",
                ),
            ],
        ),
        WorkflowTemplate(
            id="scheduled_benchmark",
            name="Scheduled benchmark",
            description="Run a benchmark suite for selected models on a schedule.",
            category="operator",
            parameters=[
                TemplateParameter(
                    name="benchmark_id",
                    label="Benchmark",
                    type="string",
                    required=True,
                    description="Benchmark definition id.",
                ),
                TemplateParameter(
                    name="models",
                    label="Models",
                    type="string_list",
                    required=True,
                    description="Models to benchmark.",
                ),
            ],
        ),
    ]


def get_template(template_id: str) -> WorkflowTemplate:
    for template in builtin_templates():
        if template.id == template_id:
            return template
    raise ValueError(f"Unknown workflow template: {template_id}")
