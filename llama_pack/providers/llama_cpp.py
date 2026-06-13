from __future__ import annotations

from llama_pack.core.config import ModelConfig


def build_llama_server_command(binary: str, model: ModelConfig) -> list[str]:
    command = [
        binary,
        "--model",
        model.path,
        "--host",
        model.host,
        "--port",
        str(model.port),
        "--ctx-size",
        str(model.ctx),
        "--n-gpu-layers",
        str(model.gpu_layers),
    ]
    if model.reasoning is not None:
        command.extend(["--reasoning", model.reasoning])
    if model.reasoning_budget is not None:
        command.extend(["--reasoning-budget", str(model.reasoning_budget)])
    if model.mmproj:
        command.extend(["--mmproj", model.mmproj])
    if model.speculative and model.speculative.mode == "mtp":
        command.extend(["--spec-type", "draft-mtp"])
        if model.speculative.draft_model_path:
            command.extend(["--model-draft", model.speculative.draft_model_path])
        if model.speculative.draft_max is not None:
            command.extend(["--spec-draft-n-max", str(model.speculative.draft_max)])
        if model.speculative.draft_min is not None:
            command.extend(["--spec-draft-n-min", str(model.speculative.draft_min)])
    command.extend(model.extra_args)
    return command
