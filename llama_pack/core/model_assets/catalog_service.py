from __future__ import annotations

from llama_pack.core.config.models import ModelConfig, ModelProfileConfig, SpeculativeConfig
from llama_pack.core.persistence.model_asset_store_orm import ModelAssetStoreOrm


class ModelCatalogService:
    def __init__(self, store: ModelAssetStoreOrm):
        self.store = store

    def list_registered_models(self) -> list[dict[str, object]]:
        return self.store.list_models()

    def get_model(self, name: str) -> dict[str, object]:
        row = self.store.get_model_by_name(name)
        if row is None:
            raise KeyError(f"Unknown model: {name}")
        return row

    def runtime_model(self, name: str) -> ModelConfig:
        base_name, _, profile_key = name.partition(":")
        row = self.get_model(base_name)
        asset_id = str(row.get("asset_id") or "")
        if not asset_id:
            raise KeyError(f"Model has no registered asset: {base_name}")
        asset = self.store.get_asset(asset_id)
        deployments = self.store.list_model_deployments(str(row["model_id"]))
        profiles = self.store.list_model_profiles(str(row["model_id"]))
        profile_map = {
            str(profile["profile_key"]): ModelProfileConfig(
                ctx=profile.get("ctx"),
                port=self._deployment_port_for_profile(deployments, str(profile["profile_key"])),
                gpu_layers=profile.get("gpu_layers"),
                host=profile.get("host"),
                extra_args=list(profile.get("extra_args") or []),
                label=profile.get("label"),
                order=int(profile["order"]) if profile.get("order") is not None else 100,
                kind=profile.get("kind"),
                intended_ctx=profile.get("intended_ctx"),
                kv_cache_policy=profile.get("kv_cache_policy"),
                resource_tier=profile.get("resource_tier"),
                strengths=list(profile.get("strengths") or []),
                cost_tier=profile.get("cost_tier"),
            )
            for profile in profiles
        }

        mmproj_path = self._asset_path(row.get("mmproj_asset_id"))
        if mmproj_path is None:
            mmproj_path = row.get("mmproj")

        draft_path = self._asset_path(row.get("mtp_draft_asset_id"))
        speculative = None
        if bool(row.get("supports_mtp")) and draft_path:
            speculative = SpeculativeConfig(mode="mtp", draft_model_path=draft_path)

        deployment = self._deployment_for_identity(deployments, profile_key or None)
        host = str(deployment.get("host") or "127.0.0.1") if deployment else "127.0.0.1"
        port = int(deployment.get("port") or 8080) if deployment else 8080

        config = ModelConfig(
            path=str(asset["canonical_path"]),
            port=port,
            ctx=int(row.get("ctx") or 4096),
            gpu_layers=int(row.get("gpu_layers") or 0),
            host=host,
            reasoning=row.get("reasoning"),
            reasoning_budget=row.get("reasoning_budget"),
            vision=bool(row.get("vision")),
            mmproj=str(mmproj_path) if mmproj_path else None,
            extra_args=list(row.get("extra_args") or []),
            supports_json_schema=row.get("supports_json_schema"),
            supports_grammar=row.get("supports_grammar"),
            supports_mtp=row.get("supports_mtp"),
            speculative=speculative,
            model_line=row.get("model_line"),
            favorite=bool(row.get("favorite")),
            prompt_template=row.get("prompt_template"),
            strengths=list(row.get("strengths") or []),
            cost_tier=row.get("cost_tier"),
            profiles=profile_map,
        )
        if not profile_key:
            return config
        try:
            profile = config.profiles[profile_key]
        except KeyError as exc:
            raise KeyError(f"Unknown model: {name}") from exc
        data = config.model_dump()
        data["profiles"] = {}
        for field in ("ctx", "gpu_layers", "host", "extra_args", "cost_tier"):
            value = getattr(profile, field)
            if value is not None:
                data[field] = value
        if profile.strengths:
            data["strengths"] = list(profile.strengths)
        data["port"] = profile.port if profile.port is not None else config.port + profile.order
        return ModelConfig(**data)

    def validate_ready(self) -> None:
        self.store.list_models()

    def list_model_identities(self) -> list[str]:
        identities: list[str] = []
        for row in sorted(
            self.list_registered_models(),
            key=lambda item: (not bool(item.get("favorite")), str(item.get("model_name", "")).lower()),
        ):
            model_name = str(row["model_name"])
            profiles = self.store.list_model_profiles(str(row["model_id"]))
            if profiles:
                identities.extend(
                    f"{model_name}:{profile['profile_key']}"
                    for profile in sorted(
                        profiles,
                        key=lambda item: (int(item.get("order") or 100), str(item.get("profile_key", "")).lower()),
                    )
                )
            else:
                identities.append(model_name)
        return identities

    def set_favorite(self, name: str, favorite: bool) -> dict[str, object]:
        base_name, _, profile_key = name.partition(":")
        row = self.get_model(base_name)
        if profile_key:
            profile_keys = {str(item["profile_key"]) for item in self.store.list_model_profiles(str(row["model_id"]))}
            if profile_key not in profile_keys:
                raise KeyError(f"Unknown model: {name}")
        return self.store.upsert_model(
            model_name=base_name,
            asset_id=row.get("asset_id"),
            config_source=str(row.get("config_source") or "db"),
            model_line=row.get("model_line"),
            ctx=row.get("ctx"),
            gpu_layers=row.get("gpu_layers"),
            vision=bool(row.get("vision")),
            mmproj=row.get("mmproj"),
            mmproj_asset_id=row.get("mmproj_asset_id"),
            mtp_draft_asset_id=row.get("mtp_draft_asset_id"),
            mtp_draft_model_id=row.get("mtp_draft_model_id"),
            supports_json_schema=row.get("supports_json_schema"),
            supports_grammar=row.get("supports_grammar"),
            supports_mtp=row.get("supports_mtp"),
            reasoning=row.get("reasoning"),
            reasoning_budget=row.get("reasoning_budget"),
            prompt_template=row.get("prompt_template"),
            favorite=favorite,
            strengths=list(row.get("strengths") or []),
            cost_tier=row.get("cost_tier"),
            extra_args=list(row.get("extra_args") or []),
        )

    def _asset_path(self, asset_id: object) -> str | None:
        if not isinstance(asset_id, str) or not asset_id:
            return None
        return str(self.store.get_asset(asset_id)["canonical_path"])

    def _deployment_port_for_profile(self, deployments: list[dict[str, object]], profile_key: str) -> int | None:
        for deployment in deployments:
            if deployment.get("profile_key") == profile_key:
                port = deployment.get("port")
                return int(port) if isinstance(port, int) else None
        return None

    def _deployment_for_identity(
        self,
        deployments: list[dict[str, object]],
        profile_key: str | None,
    ) -> dict[str, object] | None:
        if profile_key:
            for deployment in deployments:
                if deployment.get("profile_key") == profile_key:
                    return deployment
        for deployment in deployments:
            if deployment.get("deployment_name") == "default":
                return deployment
        return deployments[0] if deployments else None
