from __future__ import annotations

import secrets
from typing import Any, Protocol

from llama_pack.core.nodes.registry import NodeRegistry
from llama_pack.core.orchestration.job_contracts import validate_job_payload


class TransferOrchestrator(Protocol):
    def create_job(self, *, job_type: str, payload: dict[str, Any], target: str, requested_by: str | None) -> dict[str, Any]: ...


class OfflineSetupService:
    def __init__(self, registry: NodeRegistry, orchestrator: TransferOrchestrator | None):
        self.registry = registry
        self.orchestrator = orchestrator

    async def readiness(self, source_node: str, model: str, target_nodes: list[str]) -> dict[str, Any]:
        return {
            "source_node": source_node,
            "model": model,
            "nodes": [await self._node_readiness(node, model) for node in target_nodes],
        }

    async def distribute(self, source_node: str, source_file_id: str, target_nodes: list[str]) -> dict[str, Any]:
        if self.orchestrator is None:
            raise RuntimeError("Offline distribution requires controller mode with orchestration enabled")
        nodes = []
        for node in target_nodes:
            nodes.append(await self._create_transfer_job(source_node, source_file_id, node))
        return {
            "source_node": source_node,
            "source_file_id": source_file_id,
            "nodes": nodes,
        }

    async def _node_readiness(self, node: str, model: str) -> dict[str, Any]:
        try:
            models = await self.registry.request_node(node, "GET", "/lm-api/v1/models")
            registered = _model_registered(models, model)
            files = await self.registry.request_node(node, "GET", "/lm-api/v1/library/ggufs")
            artifact_present = registered or _artifact_present(files, model)
            return {
                "node": node,
                "reachable": True,
                "registered": registered,
                "artifact_present": artifact_present,
                "ready": registered and artifact_present,
                "error": None,
            }
        except Exception as exc:
            return {
                "node": node,
                "reachable": False,
                "registered": False,
                "artifact_present": False,
                "ready": False,
                "error": str(exc),
            }

    async def _create_transfer_job(self, source_node: str, source_file_id: str, destination_node: str) -> dict[str, Any]:
        try:
            source_config = self.registry.get_node_config(source_node)
            self.registry.get_node_config(destination_node)
            transfer_token = secrets.token_urlsafe(32)
            await self.registry.request_node(
                source_node,
                "POST",
                "/lm-api/v1/transfer-source/grants",
                {
                    "source_file_id": source_file_id,
                    "transfer_token": transfer_token,
                    "destination_node": destination_node,
                },
            )
            payload = validate_job_payload(
                "model.transfer",
                {
                    "source_node": source_node,
                    "destination_node": destination_node,
                    "source_file_id": source_file_id,
                    "include": "selected_with_sidecars",
                    "source_url": source_config.url,
                    "transfer_token": transfer_token,
                },
            )
            job = self.orchestrator.create_job(
                job_type="model.transfer",
                payload=payload,
                target=f"node:{destination_node}",
                requested_by=None,
            )
            return {
                "node": destination_node,
                "status": str(job.get("status") or "queued"),
                "transfer_id": str(job.get("id")),
                "error": None,
            }
        except Exception as exc:
            return {
                "node": destination_node,
                "status": "failed",
                "transfer_id": None,
                "error": str(exc),
            }


def _model_registered(models: object, model: str) -> bool:
    if not isinstance(models, list):
        raise TypeError(f"Model status response must be a list, got {type(models).__name__}")
    return any(isinstance(item, dict) and item.get("name") == model for item in models)


def _artifact_present(files: object, model: str) -> bool:
    if not isinstance(files, list):
        raise TypeError(f"GGUF library response must be a list, got {type(files).__name__}")
    for item in files:
        if not isinstance(item, dict):
            continue
        names = {str(item.get("name") or ""), str(item.get("filename") or ""), str(item.get("path") or "")}
        if model in names:
            return True
    return False
