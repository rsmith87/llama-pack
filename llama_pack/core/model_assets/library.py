from __future__ import annotations

from pathlib import Path
from typing import Literal

from llama_pack.core.config import AppConfig
from llama_pack.core.model_assets.models_db import ModelAssetInventoryService
from llama_pack.core.persistence.model_asset_store_orm import ModelAssetStoreOrm


ReasoningMode = Literal["on", "off", "auto"]


def compute_file_id(path: Path) -> str:
    """Compute a stable file identifier for a GGUF file path."""
    resolved = str(path)
    import hashlib
    return hashlib.sha256(resolved.encode("utf-8")).hexdigest()[:16]


class GgufLibrary:
    def __init__(self, config: AppConfig, inventory_service: ModelAssetInventoryService):
        self.config = config
        self.inventory_service = inventory_service
        self._backfill_config_models_done = False
        self._backfill_config_models()

    @property
    def store(self) -> ModelAssetStoreOrm:
        return self.inventory_service.store

    def list_files(
        self,
        recent_transfers: list[dict[str, object]] | None = None,
        model_statuses: list[dict[str, object]] | None = None,
    ) -> list[dict[str, object]]:
        self._backfill_config_models()
        received_by_path = self._received_by_path(recent_transfers or [])
        status_by_name = self._status_by_name(model_statuses or [])
        mmproj_by_dir = self._mmproj_by_dir()
        paths = self._gguf_paths()
        persisted_assets = self._assets_by_path(paths)
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

        # DB is the source of truth — check for duplicate in DB, not config.models
        existing = self.store.get_model_by_name(model_name)
        if existing is not None:
            raise ValueError(f"Model already exists: {model_name}")

        # Look up the asset record for this file
        asset = self._asset_for_path(path)
        model_line = asset.get("model_line") if asset else None

        # Determine mmproj_asset_id from mmproj path if provided
        mmproj_asset_id = None
        if mmproj:
            mmproj_asset = self.store.get_asset_by_path(str(Path(mmproj).resolve()))
            if mmproj_asset is not None:
                mmproj_asset_id = mmproj_asset["asset_id"]

        # Determine mtp_draft_asset_id from draft_model_path if provided
        mtp_draft_asset_id = None
        if supports_mtp and draft_model_path:
            draft_asset = self.store.get_asset_by_path(str(Path(draft_model_path).resolve()))
            if draft_asset is None:
                draft_asset = self.store.upsert_asset(
                    canonical_path=str(Path(draft_model_path).resolve()),
                    filename=Path(draft_model_path).name,
                    display_name=Path(draft_model_path).stem,
                    size_bytes=0,
                    asset_kind="gguf",
                    source_type="config",
                )
            mtp_draft_asset_id = draft_asset["asset_id"]

        # Also auto-associate mmproj sidecar from same directory if not explicitly provided
        if not mmproj and not mmproj_asset_id:
            inferred_mmproj = self._infer_mmproj_for_model(path)
            if inferred_mmproj:
                mmproj_asset = self.store.get_asset_by_path(str(inferred_mmproj.resolve()))
                if mmproj_asset is not None:
                    mmproj_asset_id = mmproj_asset["asset_id"]
                    vision = True

        persisted_model = self.store.upsert_model(
            model_name=model_name,
            asset_id=asset["asset_id"] if asset else None,
            config_source="db",
            model_line=model_line,
            ctx=ctx,
            gpu_layers=gpu_layers,
            vision=vision,
            mmproj=mmproj,
            mmproj_asset_id=mmproj_asset_id,
            mtp_draft_asset_id=mtp_draft_asset_id,
            supports_mtp=supports_mtp or None,
            reasoning=reasoning,
            reasoning_budget=reasoning_budget,
            prompt_template=prompt_template,
            favorite=bool(favorite),
        )
        model_id = str(persisted_model["model_id"])

        self.store.upsert_model_profile(
            model_id=model_id,
            profile_key="default",
            label="Default",
            order=0,
            kind="default",
        )
        self.store.upsert_model_deployment(
            model_id=model_id,
            deployment_name="default",
            node_name=None,
            host=host,
            port=port,
            ctx_override=None,
            gpu_layers_override=None,
            mmproj_override=None,
            extra_args_override=[],
            profile_key="default",
            enabled=True,
        )

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
        existing = self.store.get_model_by_name(model_name)
        if existing is None:
            raise KeyError(f"Unknown model: {model_name}")

        # Build updated field values from existing DB row + overrides
        updated_vision = vision if vision is not None else existing["vision"]
        updated_mmproj = mmproj if mmproj is not None else existing["mmproj"]
        if mmproj is not None:
            updated_mmproj = mmproj or None  # empty string → None
        updated_ctx = ctx if ctx is not None else existing["ctx"]
        updated_gpu_layers = gpu_layers if gpu_layers is not None else existing["gpu_layers"]
        updated_port = port if port is not None else None
        updated_prompt_template = prompt_template if prompt_template is not None else existing["prompt_template"]
        if prompt_template is not None:
            updated_prompt_template = prompt_template or None
        updated_reasoning = reasoning if reasoning is not None else existing["reasoning"]
        updated_reasoning_budget = reasoning_budget if reasoning_budget is not None else existing["reasoning_budget"]

        updated_supports_mtp = supports_mtp if supports_mtp is not None else existing["supports_mtp"]
        if supports_mtp is not None:
            updated_supports_mtp = supports_mtp or None

        # Handle mmproj_asset_id
        mmproj_asset_id = existing.get("mmproj_asset_id")
        if mmproj is not None:
            mmproj_asset_id = None
            if mmproj:
                mmproj_asset = self.store.get_asset_by_path(str(Path(mmproj).resolve()))
                if mmproj_asset is not None:
                    mmproj_asset_id = mmproj_asset["asset_id"]

        # Handle mtp_draft_asset_id
        mtp_draft_asset_id = existing.get("mtp_draft_asset_id")
        if draft_model_path is not None:
            mtp_draft_asset_id = None
            if updated_supports_mtp and draft_model_path:
                draft_asset = self.store.get_asset_by_path(str(Path(draft_model_path).resolve()))
                if draft_asset is None:
                    # Create stub asset for non-existent draft model path
                    draft_asset = self.store.upsert_asset(
                        canonical_path=str(Path(draft_model_path).resolve()),
                        filename=Path(draft_model_path).name,
                        display_name=Path(draft_model_path).stem,
                        size_bytes=0,
                        asset_kind="gguf",
                        source_type="config",
                    )
                mtp_draft_asset_id = draft_asset["asset_id"]

        self.store.upsert_model(
            model_name=model_name,
            asset_id=existing["asset_id"],
            config_source=existing.get("config_source") or "db",
            model_line=existing["model_line"],
            ctx=updated_ctx,
            gpu_layers=updated_gpu_layers,
            vision=updated_vision,
            mmproj=updated_mmproj,
            mmproj_asset_id=mmproj_asset_id,
            mtp_draft_asset_id=mtp_draft_asset_id,
            mtp_draft_model_id=existing.get("mtp_draft_model_id"),
            supports_json_schema=existing["supports_json_schema"],
            supports_grammar=existing["supports_grammar"],
            supports_mtp=updated_supports_mtp,
            reasoning=updated_reasoning,
            reasoning_budget=updated_reasoning_budget,
            prompt_template=updated_prompt_template,
            favorite=existing["favorite"],
            strengths=list(existing["strengths"] or []),
            cost_tier=existing["cost_tier"],
            extra_args=list(existing["extra_args"] or []),
        )

        # Update deployment if port changed
        if updated_port is not None:
            model_id = str(existing["model_id"])
            deployments = self.store.list_model_deployments(model_id)
            default_dep = next(
                (d for d in deployments if d["deployment_name"] == "default"),
                deployments[0] if deployments else None,
            )
            if default_dep:
                self.store.upsert_model_deployment(
                    model_id=model_id,
                    deployment_name=default_dep["deployment_name"],
                    node_name=default_dep.get("node_name"),
                    host=default_dep["host"],
                    port=updated_port,
                    ctx_override=default_dep.get("ctx_override"),
                    gpu_layers_override=default_dep.get("gpu_layers_override"),
                    mmproj_override=default_dep.get("mmproj_override"),
                    extra_args_override=list(default_dep.get("extra_args_override") or []),
                    profile_key=default_dep.get("profile_key"),
                    enabled=default_dep.get("enabled", True),
                )

        return self._model_payload(model_name)

    def _model_payload(self, name: str) -> dict[str, object]:
        model_row = self.store.get_model_by_name(name)
        if model_row is None:
            raise KeyError(f"Unknown model: {name}")
        model_id = str(model_row["model_id"])
        asset_path = self._asset_path_for_model(model_row)
        profiles = self.store.list_model_profiles(model_id)
        deployments = self.store.list_model_deployments(model_id)
        deployment = next(
            (d for d in deployments if d["deployment_name"] == "default"),
            deployments[0] if deployments else None,
        )
        port = int(deployment["port"]) if deployment else 8080
        host = str(deployment.get("host") or "127.0.0.1") if deployment else "127.0.0.1"

        profile_map = {}
        for profile in profiles:
            pk = str(profile["profile_key"])
            profile_map[pk] = {
                "label": profile.get("label") or pk,
                "order": profile.get("order") or 0,
                "kind": profile.get("kind"),
            }

        # Build speculative config
        speculative = None
        if model_row.get("supports_mtp"):
            draft_path = self._asset_path_by_id(model_row.get("mtp_draft_asset_id"))
            if draft_path:
                speculative = {"mode": "mtp", "draft_model_path": draft_path, "draft_max": None, "draft_min": None}

        mmproj_path = self._asset_path_by_id(model_row.get("mmproj_asset_id"))
        if mmproj_path is None:
            mmproj_path = model_row.get("mmproj")

        return {
            "name": name,
            "path": asset_path,
            "port": port,
            "ctx": model_row.get("ctx"),
            "gpu_layers": model_row.get("gpu_layers"),
            "host": host,
            "reasoning": model_row.get("reasoning"),
            "reasoning_budget": model_row.get("reasoning_budget"),
            "prompt_template": model_row.get("prompt_template"),
            "favorite": model_row.get("favorite"),
            "vision": model_row.get("vision"),
            "mmproj": mmproj_path,
            "supports_mtp": model_row.get("supports_mtp"),
            "speculative": speculative,
            "profiles": profile_map,
        }

    def remove_model(self, name: str) -> dict[str, object]:
        model_name = name.strip()
        if not model_name:
            raise ValueError("Model name is required")
        existing = self.store.get_model_by_name(model_name)
        if existing is None:
            raise KeyError(f"Unknown model: {model_name}")
        asset_path = self._asset_path_for_model(existing)
        self.store.delete_model_by_name(model_name)
        return {"removed": True, "name": model_name, "path": asset_path}

    def delete_file(self, file_id: str) -> dict[str, object]:
        path = self._path_for_id(file_id)
        registered_names = self._registered_names(path)

        path.unlink()
        for name in registered_names:
            self.store.delete_model_by_name(name)

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
        asset = self._find_asset(asset_ref)
        updated = self.store.update_asset_metadata(asset["asset_id"], model_line=model_line)

        # Update model_line on any model rows referencing this asset
        for model in self.store.list_models():
            if model.get("asset_id") == updated["asset_id"]:
                self.store.upsert_model(
                    model_name=str(model["model_name"]),
                    asset_id=model["asset_id"],
                    config_source=str(model.get("config_source") or "db"),
                    model_line=model_line,
                    ctx=model.get("ctx"),
                    gpu_layers=model.get("gpu_layers"),
                    vision=bool(model.get("vision")),
                    mmproj=model.get("mmproj"),
                    mmproj_asset_id=model.get("mmproj_asset_id"),
                    mtp_draft_asset_id=model.get("mtp_draft_asset_id"),
                    mtp_draft_model_id=model.get("mtp_draft_model_id"),
                    supports_json_schema=model.get("supports_json_schema"),
                    supports_grammar=model.get("supports_grammar"),
                    supports_mtp=model.get("supports_mtp"),
                    reasoning=model.get("reasoning"),
                    reasoning_budget=model.get("reasoning_budget"),
                    prompt_template=model.get("prompt_template"),
                    favorite=bool(model.get("favorite")),
                    strengths=list(model.get("strengths") or []),
                    cost_tier=model.get("cost_tier"),
                    extra_args=list(model.get("extra_args") or []),
                )
        return updated

    def file_id(self, path: Path) -> str:
        return compute_file_id(path)

    # -- YAML→DB backfill (runs once, loads config.models into DB if not present) --

    def _backfill_config_models(self) -> None:
        """Load YAML-defined config.models into DB if not already present.

        This runs once on first access.  After this, the DB is authoritative.
        """
        if self._backfill_config_models_done:
            return
        self._backfill_config_models_done = True
        if not hasattr(self.config, "models") or not self.config.models:
            return
        for model_name, model_cfg in self.config.models.items():
            if self.store.get_model_by_name(model_name) is not None:
                continue
            # Upsert the asset for this path (create stub asset even if missing on disk)
            path = Path(model_cfg.path)
            asset = None
            if self.inventory_service is not None:
                if path.exists():
                    assets = self.inventory_service.reconcile_scan([path])
                    asset = assets[0] if assets else None
                else:
                    # Create a stub asset record for non-existent paths (e.g. config-only models)
                    from datetime import UTC, datetime
                    now = datetime.now(UTC).isoformat()
                    existing_asset = self.store.get_asset_by_path(str(path.resolve()))
                    if existing_asset is None:
                        asset = self.store.upsert_asset(
                            canonical_path=str(path.resolve()),
                            filename=path.name,
                            display_name=path.stem,
                            size_bytes=0,
                            asset_kind="gguf",
                            source_type="config",
                        )
                    else:
                        asset = existing_asset
            self.store.upsert_model(
                model_name=model_name,
                asset_id=asset["asset_id"] if asset else None,
                config_source="yaml",
                model_line=getattr(model_cfg, "model_line", None),
                ctx=model_cfg.ctx,
                gpu_layers=model_cfg.gpu_layers,
                vision=model_cfg.vision,
                mmproj=model_cfg.mmproj,
                supports_json_schema=getattr(model_cfg, "supports_json_schema", None),
                supports_grammar=getattr(model_cfg, "supports_grammar", None),
                supports_mtp=getattr(model_cfg, "supports_mtp", None),
                reasoning=getattr(model_cfg, "reasoning", None),
                reasoning_budget=getattr(model_cfg, "reasoning_budget", None),
                prompt_template=model_cfg.prompt_template,
                favorite=model_cfg.favorite,
                strengths=list(getattr(model_cfg, "strengths", []) or []),
                cost_tier=getattr(model_cfg, "cost_tier", None),
                extra_args=list(getattr(model_cfg, "extra_args", []) or []),
            )
            db_model = self.store.get_model_by_name(model_name)
            model_id = str(db_model["model_id"])
            # Backfill profiles
            profiles = getattr(model_cfg, "profiles", {}) or {}
            for pk, profile_cfg in profiles.items():
                self.store.upsert_model_profile(
                    model_id=model_id,
                    profile_key=pk,
                    label=profile_cfg.label_or_default(pk) if hasattr(profile_cfg, "label_or_default") else (getattr(profile_cfg, "label", None) or pk),
                    order=getattr(profile_cfg, "order", 0) or 0,
                    kind=getattr(profile_cfg, "kind", None),
                    ctx=getattr(profile_cfg, "ctx", None),
                    gpu_layers=getattr(profile_cfg, "gpu_layers", None),
                    host=getattr(profile_cfg, "host", None),
                    extra_args=list(getattr(profile_cfg, "extra_args", []) or []),
                    intended_ctx=getattr(profile_cfg, "intended_ctx", None),
                    kv_cache_policy=getattr(profile_cfg, "kv_cache_policy", None),
                    resource_tier=getattr(profile_cfg, "resource_tier", None),
                    strengths=list(getattr(profile_cfg, "strengths", []) or []),
                    cost_tier=getattr(profile_cfg, "cost_tier", None),
                )
            # Backfill deployments for each profile that has an explicit port
            default_profile_key = "default" if "default" in profiles else None
            self.store.upsert_model_deployment(
                model_id=model_id,
                deployment_name="default",
                node_name=None,
                host=model_cfg.host,
                port=model_cfg.port,
                ctx_override=None,
                gpu_layers_override=None,
                mmproj_override=None,
                extra_args_override=[],
                profile_key=default_profile_key,
                enabled=True,
            )
            for pk, profile_cfg in profiles.items():
                if pk == "default":
                    continue
                profile_port = getattr(profile_cfg, "port", None)
                if profile_port is not None:
                    self.store.upsert_model_deployment(
                        model_id=model_id,
                        deployment_name=f"profile:{pk}",
                        node_name=None,
                        host=getattr(profile_cfg, "host", model_cfg.host) or model_cfg.host,
                        port=profile_port,
                        ctx_override=None,
                        gpu_layers_override=None,
                        mmproj_override=None,
                        extra_args_override=[],
                        profile_key=pk,
                        enabled=True,
                    )

    # -- Path and filesystem helpers (unchanged, filesystem is scan-only) --

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

    # -- DB-backed registration queries --

    def _registered_name(self, path: Path) -> str | None:
        names = self._registered_names(path)
        return names[0] if names else None

    def _registered_names(self, path: Path) -> list[str]:
        """Find all model names whose GGUF asset matches the given path."""
        target = str(path.resolve())
        asset = self.store.get_asset_by_path(target)
        if asset is None:
            return []
        asset_id = str(asset["asset_id"])
        return [
            str(m["model_name"])
            for m in self.store.list_models()
            if m.get("asset_id") == asset_id
        ]

    def _asset_path_for_model(self, model_row: dict[str, object]) -> str | None:
        """Return the canonical path of the model's primary asset."""
        asset_id = model_row.get("asset_id")
        if not asset_id:
            return None
        return self._asset_path_by_id(asset_id)

    def _asset_path_by_id(self, asset_id: object) -> str | None:
        if not isinstance(asset_id, str) or not asset_id:
            return None
        try:
            return str(self.store.get_asset(asset_id)["canonical_path"])
        except KeyError:
            return None

    def _infer_mmproj_for_model(self, path: Path) -> Path | None:
        """If a mmproj sidecar exists in the same directory, return it."""
        for candidate in path.parent.glob("*.gguf"):
            if candidate.is_file() and "mmproj" in candidate.name.lower():
                return candidate
        return None

    # -- Asset reconciliation (filesystem scan → DB asset rows) --

    def _assets_by_path(self, paths: list[Path]) -> dict[str, dict[str, object]]:
        if self.inventory_service is None:
            return {}
        assets = self.inventory_service.reconcile_scan(paths)
        return {str(Path(str(asset["canonical_path"])).resolve()): asset for asset in assets}

    def _asset_for_path(self, path: Path) -> dict[str, object] | None:
        if self.inventory_service is not None:
            self.inventory_service.reconcile_scan(self._gguf_paths())
        return self.store.get_asset_by_path(str(path.resolve()))

    def _find_asset(self, asset_ref: str) -> dict[str, object]:
        try:
            return self.store.get_asset(asset_ref)
        except KeyError:
            path = self._path_for_id(asset_ref)
            asset = self._asset_for_path(path)
            if asset is None:
                raise KeyError(f"Unknown GGUF asset: {asset_ref}")
            return asset

    # -- Payload builders --

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

        # Read registered model state from DB instead of config.models
        registered_model = None
        if registered_as:
            registered_model = self.store.get_model_by_name(registered_as)

        # Resolve mmproj path
        mmproj_path = None
        if registered_model:
            mmproj_path = self._asset_path_by_id(registered_model.get("mmproj_asset_id"))
            if mmproj_path is None:
                mmproj_path = registered_model.get("mmproj")
        elif inferred_mmproj:
            mmproj_path = str(inferred_mmproj)

        # Resolve draft model path
        draft_path = None
        if registered_model:
            draft_path = self._asset_path_by_id(registered_model.get("mtp_draft_asset_id"))

        # Build speculative info
        speculative_info = None
        if registered_model and registered_model.get("supports_mtp") and draft_path:
            speculative_info = {"draft_model_path": draft_path}

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
            "vision": bool(registered_model["vision"]) if registered_model else (inferred_mmproj is not None),
            "mmproj": mmproj_path,
            "model_supports_mtp": registered_model.get("supports_mtp") if registered_model else None,
            "model_draft_model_path": draft_path,
            "model_ctx": registered_model.get("ctx") if registered_model else None,
            "model_gpu_layers": registered_model.get("gpu_layers") if registered_model else None,
            "model_port": None,
            "model_prompt_template": registered_model.get("prompt_template") if registered_model else None,
            "model_reasoning": registered_model.get("reasoning") if registered_model else None,
            "model_reasoning_budget": registered_model.get("reasoning_budget") if registered_model else None,
            "model_line": (
                registered_model.get("model_line")
                if registered_model and registered_model.get("model_line") is not None
                else persisted_asset.get("model_line") if persisted_asset else None
            ),
            "model_catalog": None,
            "model_profiles": [],
            "model_deployments": [],
        }

        # Get port from deployment
        if registered_model:
            deployments = self.store.list_model_deployments(str(registered_model["model_id"]))
            default_dep = next(
                (d for d in deployments if d["deployment_name"] == "default"),
                deployments[0] if deployments else None,
            )
            if default_dep:
                payload["model_port"] = default_dep["port"]

        if persisted_asset is not None:
            payload["asset_id"] = persisted_asset["asset_id"]
        if registered_as and registered_model:
            payload["model_catalog"] = registered_model
            model_id = str(registered_model["model_id"])
            payload["model_profiles"] = self.store.list_model_profiles(model_id)
            payload["model_deployments"] = self.store.list_model_deployments(model_id)
        return payload

    def _mmproj_by_dir(self) -> dict[Path, Path]:
        result: dict[Path, Path] = {}
        for path in self._gguf_paths():
            if self._is_mmproj(path):
                result.setdefault(path.parent, path)
        return result

    def _is_mmproj(self, path: Path) -> bool:
        return "mmproj" in path.name.lower()

    def _received_by_path(self, transfers: list[dict[str, object]]) -> dict[dict[str, object]]:
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
