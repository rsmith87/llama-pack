from __future__ import annotations

from fastapi import APIRouter


class NeuraxisBusinessPlugin:
    id = "neuraxis_business"
    name = "Neuraxis Business"
    version = "0.1.0"

    def register(self, context) -> None:
        router = APIRouter()

        @router.get("/status")
        async def status():
            plugin_config = context.get_plugin_config()
            return {
                "plugin_id": self.id,
                "organization_name": plugin_config.get("organization_name"),
                "features": [],
            }

        async def health_check():
            return {"level": "ok", "message": "Business plugin skeleton ready"}

        context.add_api_router(router)
        context.add_health_check(health_check)
        context.add_migration_target(
            "neuraxis_business",
            directory="neuraxis_business/migrations",
            current_revision="001_business_skeleton",
            head_revision="001_business_skeleton",
        )


plugin = NeuraxisBusinessPlugin()
