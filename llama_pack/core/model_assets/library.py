from __future__ import annotations

import hashlib
from pathlib import Path
from typing import Literal

from llama_pack.core.config import AppConfig, ModelConfig, save_config
from llama_pack.core.config.models import ModelProfileConfig, SpeculativeConfig
from llama_pack.core.model_assets.models_db import ModelAssetInventoryService
from llama_pack.core.persistence.model_asset_store_orm import ModelAssetStoreOrm


ReasoningMode = Literal["on", "off", "auto"]


class GgufLibrary:
    def __init__(self, config: AppConfig, inventory_service: ModelAssetInventoryService | None = None):
        self.config = config
        self.inventory_service = inventory_service

    def list_files(
        self,
        recent_transfers: list[dict[str, object]] | None = None,
        model_statuses: list[dict[str, object]] | None = None,
    ) -> list[dict[str, object]]:
        received_by_path = self._received_by_path(recent_transfers or [])
        status_by_name = self._status_by_name(model_statuses or [])
        mmproj_by_dir = self._mmproj_by_dir()
        paths = self._gguf_paths()
        persisted_assets = self._assets_by_path(paths)
        self._sync_all_model_records()
        files = []
        for path in paths:
            files.append(
                self._file_payload(
                    path,
                    received_by_path.get(str(path)),
                    status_by_name,
                    mmproj_by_dir=mmproj_by_dir,
                    persisted_asset=persisted_assets.get(str(path.resolve())),
                )
            )
        return files

    def add_model(
        self,
        file_id: str,
        name: str,
        port: int,
        ctx: int,
        gpu_layers: int,
        host: str,
        reasoning: ReasoningMode | None = None,
        reasoning_budget: int | None = None,
        prompt_template: str | None = None,
        favorite: bool | None = False,
        vision: bool = False,
        mmproj: str | None = None,
        supports_mtp: bool = False,
        draft_model_path: str | None = None,
    ) -> dict[str, object]:
        path = self._path_for_id(file_id)
        model_name = name.strip()
        if not model_name:
            raise ValueError("Model name is required")
        if model_name in self.config.models:
            raise ValueError(f"Model already exists: {model_name}")

        self.config.models[model_name] = ModelConfig(
            path=str(path),
            port=port,
            ctx=ctx,
            gpu_layers=gpu_layers,
            host=host,
            reasoning=reasoning,
            reasoning_budget=reasoning_budget,
            prompt_template=prompt_template,
            favorite=favorite,
            vision=vision,
            mmproj=mmproj,
            supports_mtp=supports_mtp or None,
            model_line=self._asset_for_path(path).get("model_line") if self._asset_for_path(path) else None,
            speculative=SpeculativeConfig(mode="mtp", draft_model_path=draft_model_path) if supports_mtp else None,
            profiles={
                "default": ModelProfileConfig(
                    label="Default",
                    order=0,
                    kind="default",
                )
            },
        )
        if self.config.config_source not in {"(defaults)", "(in-memory)"}:
            save_config(self.config)
        self._sync_model_record(model_name)
        return self._model_payload(model_name)

    def update_model(
        self,
        name: str,
        *,
        vision: bool | None = None,
        mmproj: str | None = None,
        ctx: int | None = None,
        gpu_layers: int | None = None,
        port: int | None = None,
        prompt_template: str | None = None,
        reasoning: ReasoningMode | None = None,
        reasoning_budget: int | None = None,
        supports_mtp: bool | None = None,
        draft_model_path: str | None = None,
    ) -> dict[str, object]:
        model_name = name.strip()
        if model_name not in self.config.models:
            raise KeyError(f"Unknown model: {model_name}")
        model = self.config.models[model_name]
        if vision is not None:
            model.vision = vision
        if mmproj is not None:
            model.mmproj = mmproj or None  # empty string → None
        if ctx is not None:
            model.ctx = ctx
        if gpu_layers is not None:
            model.gpu_layers = gpu_layers
        if port is not None:
            model.port = port
        if prompt_template is not None:
            model.prompt_template = prompt_template or None
        if reasoning is not None:
            model.reasoning = reasoning
        if reasoning_budget is not None:
            model.reasoning_budget = reasoning_budget
        if supports_mtp is not None:
            model.supports_mtp = supports_mtp or None
            if not supports_mtp:
                model.speculative = None
            else:
                model.speculative = SpeculativeConfig(
                    mode="mtp",
                    draft_model_path=draft_model_path or (model.speculative.draft_model_path if model.speculative else None),
                    draft_max=model.speculative.draft_max if model.speculative else None,
                    draft_min=model.speculative.draft_min if model.speculative else None,
                )
        elif draft_model_path is not None and model.supports_mtp:
            model.speculative = SpeculativeConfig(
                mode="mtp",
                draft_model_path=draft_model_path,
                draft_max=model.speculative.draft_max if model.speculative else None,
                draft_min=model.speculative.draft_min if model.speculative else None,
            )
        if self.config.config_source not in {"(defaults)", "(in-memory)"}:
            save_config(self.config)
        self._sync_model_record(model_name)
        return self._model_payload(model_name)

    def _model_payload(self, name: str) -> dict[str, object]:
        model = self.config.models[name]
        return {
            "name": name,
            "path": model.path,
            "port": model.port,
            "ctx": model.ctx,
            "gpu_layers": model.gpu_layers,
            "host": model.host,
            "reasoning": model.reasoning,
            "reasoning_budget": model.reasoning_budget,
            "prompt_template": model.prompt_template,
            "favorite": model.favorite,
            "vision": model.vision,
            "mmproj": model.mmproj,
            "supports_mtp": model.supports_mtp,
            "speculative": model.speculative.model_dump() if model.speculative else None,
            "profiles": {
                profile_name: {
                    "label": profile.label_or_default(profile_name),
                    "order": profile.order,
                    "kind": profile.kind,
                }
                for profile_name, profile in model.profiles.items()
            },
        }

    def remove_model(self, name: str) -> dict[str, object]:
        model_name = name.strip()
        if not model_name:
            raise ValueError("Model name is required")
        if model_name not in self.config.models:
            raise KeyError(f"Unknown model: {model_name}")
        removed = self.config.models.pop(model_name)
        if self.config.config_source not in {"(defaults)", "(in-memory)"}:
            save_config(self.config)
        self._delete_model_record(model_name)
        return {"removed": True, "name": model_name, "path": removed.path}

    def delete_file(self, file_id: str) -> dict[str, object]:
        path = self._path_for_id(file_id)
        registered_names = self._registered_names(path)

        path.unlink()
        for name in registered_names:
            self.config.models.pop(name, None)
            self._delete_model_record(name)
        if registered_names and self.config.config_source not in {"(defaults)", "(in-memory)"}:
            save_config(self.config)

        return {
            "deleted": True,
            "id": file_id,
            "filename": path.name,
            "path": str(path),
            "unregistered_models": registered_names,
        }

    def update_asset_metadata(
        self,
        asset_ref: str,
        *,
        model_line: str | None = None,
    ) -> dict[str, object]:
        store = self._asset_store()
        if store is None:
            raise RuntimeError("Model asset inventory service is unavailable")
        asset = self._find_asset(asset_ref)
        updated = store.update_asset_metadata(asset["asset_id"], model_line=model_line)
        for model_name, model in self.config.models.items():
            if Path(model.path).resolve() == Path(str(updated["canonical_path"])).resolve():
                model.model_line = model_line
        return updated

    def file_id(self, path: Path) -> str:
        resolved = str(path)
        return hashlib.sha256(resolved.encode("utf-8")).hexdigest()[:16]

    def _path_for_id(self, file_id: str) -> Path:
        for path in self._gguf_paths():
            if self.file_id(path) == file_id:
                return path
        raise KeyError(f"Unknown GGUF file id: {file_id}")

    def _gguf_paths(self) -> list[Path]:
        paths: set[Path] = set()
        for root in self.config.model_roots:
            if root.exists():
                paths.update(path for path in root.rglob("*.gguf") if path.is_file())
        return sorted(paths, key=lambda item: str(item).lower())

    def _file_payload(
        self,
        path: Path,
        received: dict[str, object] | None = None,
        status_by_name: dict[str, dict[str, object]] | None = None,
        mmproj_by_dir: dict[Path, Path] | None = None,
        persisted_asset: dict[str, object] | None = None,
    ) -> dict[str, object]:
        registered_as = self._registered_name(path)
        size_bytes = path.stat().st_size
        received_payload = received or {}
        status = (status_by_name or {}).get(registered_as or "", {})
        inferred_mmproj = None if self._is_mmproj(path) else (mmproj_by_dir or {}).get(path.parent)
        registered_model = self.config.models[registered_as] if registered_as and registered_as in self.config.models else None
        payload = {
            "id": self.file_id(path),
            "name": path.stem,
            "filename": path.name,
            "model_dir": path.parent.name,
            "path": str(path),
            "size_bytes": size_bytes,
            "size_gb": round(size_bytes / (1024**3), 2),
            "registered": registered_as is not None,
            "registered_as": registered_as,
            "running": bool(status.get("running")) if registered_as else False,
            "pid": status.get("pid") if registered_as else None,
            "recently_received": bool(received_payload),
            "received_from_node": received_payload.get("source_node"),
            "received_transfer_id": received_payload.get("id"),
            "received_at": received_payload.get("completed_at"),
            "vision": registered_model.vision if registered_model else inferred_mmproj is not None,
            "mmproj": registered_model.mmproj if registered_model else str(inferred_mmproj) if inferred_mmproj else None,
            "model_supports_mtp": registered_model.supports_mtp if registered_model else None,
            "model_draft_model_path": registered_model.speculative.draft_model_path if registered_model and registered_model.speculative else None,
            "model_ctx": registered_model.ctx if registered_model else None,
            "model_gpu_layers": registered_model.gpu_layers if registered_model else None,
            "model_port": registered_model.port if registered_model else None,
            "model_prompt_template": registered_model.prompt_template if registered_model else None,
            "model_reasoning": registered_model.reasoning if registered_model else None,
            "model_reasoning_budget": registered_model.reasoning_budget if registered_model else None,
            "model_line": (
                registered_model.model_line
                if registered_model and registered_model.model_line is not None
                else persisted_asset.get("model_line") if persisted_asset else None
            ),
            "model_catalog": None,
            "model_profiles": [],
            "model_deployments": [],
        }
        if persisted_asset is not None:
            payload["asset_id"] = persisted_asset["asset_id"]
        if registered_as:
            persisted_model = self._persisted_model_for_name(registered_as)
            if persisted_model is not None:
                payload["model_catalog"] = persisted_model
                payload["model_profiles"] = self._persisted_profiles_for_model_id(str(persisted_model["model_id"]))
                payload["model_deployments"] = self._persisted_deployments_for_model_id(str(persisted_model["model_id"]))
        return payload

    def _assets_by_path(self, paths: list[Path]) -> dict[str, dict[str, object]]:
        if self.inventory_service is None:
            return {}
        assets = self.inventory_service.reconcile_scan(paths)
        return {str(Path(str(asset["canonical_path"])).resolve()): asset for asset in assets}

    def _asset_store(self) -> ModelAssetStoreOrm | None:
        if self.inventory_service is None:
            return None
        return self.inventory_service.store

    def _persisted_model_for_name(self, model_name: str) -> dict[str, object] | None:
        store = self._asset_store()
        if store is None:
            return None
        return store.get_model_by_name(model_name)

    def _persisted_profiles_for_model_id(self, model_id: str) -> list[dict[str, object]]:
        store = self._asset_store()
        if store is None:
            return []
        return store.list_model_profiles(model_id)

    def _persisted_deployments_for_model_id(self, model_id: str) -> list[dict[str, object]]:
        store = self._asset_store()
        if store is None:
            return []
        return store.list_model_deployments(model_id)

    def _asset_for_path(self, path: Path) -> dict[str, object] | None:
        if self.inventory_service is not None:
            self.inventory_service.reconcile_scan(self._gguf_paths())
        store = self._asset_store()
        if store is None:
            return None
        return store.get_asset_by_path(str(path.resolve()))

    def _find_asset(self, asset_ref: str) -> dict[str, object]:
        store = self._asset_store()
        if store is None:
            raise RuntimeError("Model asset inventory service is unavailable")
        try:
            return store.get_asset(asset_ref)
        except KeyError:
            path = self._path_for_id(asset_ref)
            asset = self._asset_for_path(path)
            if asset is None:
                raise KeyError(f"Unknown GGUF asset: {asset_ref}")
            return asset

    def _sync_model_record(self, model_name: str) -> None:
        store = self._asset_store()
        if store is None or model_name not in self.config.models:
            return
        model = self.config.models[model_name]
        asset = self._asset_for_path(Path(model.path))
        model.model_line = model.model_line or (asset.get("model_line") if asset else None)
        persisted_model = store.upsert_model(
            model_name=model_name,
            asset_id=asset["asset_id"] if asset else None,
            config_source="yaml",
            model_line=model.model_line,
            ctx=model.ctx,
            gpu_layers=model.gpu_layers,
            vision=model.vision,
            mmproj=model.mmproj,
            supports_json_schema=model.supports_json_schema,
            supports_grammar=model.supports_grammar,
            supports_mtp=model.supports_mtp,
            reasoning=model.reasoning,
            reasoning_budget=model.reasoning_budget,
            prompt_template=model.prompt_template,
            favorite=model.favorite,
            strengths=list(model.strengths),
            cost_tier=model.cost_tier,
            extra_args=list(model.extra_args),
        )
        model_id = str(persisted_model["model_id"])
        for profile_key, profile in model.profiles.items():
            store.upsert_model_profile(
                model_id=model_id,
                profile_key=profile_key,
                label=profile.label_or_default(profile_key),
                order=profile.order,
                kind=profile.kind,
                ctx=profile.ctx,
                gpu_layers=profile.gpu_layers,
                host=profile.host,
                extra_args=list(profile.extra_args or []),
                intended_ctx=profile.intended_ctx,
                kv_cache_policy=profile.kv_cache_policy,
                resource_tier=profile.resource_tier,
                strengths=list(profile.strengths),
                cost_tier=profile.cost_tier,
            )
        default_profile_key = "default" if "default" in model.profiles else None
        store.upsert_model_deployment(
            model_id=model_id,
            deployment_name="default",
            node_name=None,
            host=model.host,
            port=model.port,
            ctx_override=None,
            gpu_layers_override=None,
            mmproj_override=None,
            extra_args_override=[],
            profile_key=default_profile_key,
            enabled=True,
        )

    def _sync_all_model_records(self) -> None:
        store = self._asset_store()
        if store is None:
            return
        for model_name in sorted(self.config.models):
            self._sync_model_record(model_name)

    def _delete_model_record(self, model_name: str) -> None:
        store = self._asset_store()
        if store is None:
            return
        try:
            store.delete_model_by_name(model_name)
        except KeyError:
            return

    def _mmproj_by_dir(self) -> dict[Path, Path]:
        result: dict[Path, Path] = {}
        for path in self._gguf_paths():
            if self._is_mmproj(path):
                result.setdefault(path.parent, path)
        return result

    def _is_mmproj(self, path: Path) -> bool:
        return "mmproj" in path.name.lower()

    def _registered_name(self, path: Path) -> str | None:
        names = self._registered_names(path)
        return names[0] if names else None

    def _registered_names(self, path: Path) -> list[str]:
        target = str(path)
        names = []
        for name, model in self.config.models.items():
            if model.path == target:
                names.append(name)
        return names

    def _received_by_path(self, transfers: list[dict[str, object]]) -> dict[str, dict[str, object]]:
        result = {}
        for transfer in transfers:
            copied = transfer.get("copied", [])
            skipped = transfer.get("skipped", [])
            items = []
            if isinstance(copied, list):
                items.extend(copied)
            if isinstance(skipped, list):
                items.extend(skipped)
            for item in items:
                if isinstance(item, dict) and item.get("path"):
                    result[str(item["path"])] = transfer
        return result

    def _status_by_name(self, statuses: list[dict[str, object]]) -> dict[str, dict[str, object]]:
        result = {}
        for status in statuses:
            name = status.get("name")
            if isinstance(name, str):
                result[name] = status
        return result
