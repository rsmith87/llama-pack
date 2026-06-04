from __future__ import annotations

from fastapi import APIRouter

received_events: list[str] = []


class HelloPlugin:
    id = "hello_plugin"
    name = "Hello Plugin"
    version = "1.0"

    def register(self, context) -> None:
        router = APIRouter()

        @router.get("/hello")
        async def hello():
            return {"message": "hello from plugin"}

        async def record_event(event) -> None:
            received_events.append(event.type)

        async def chat_admission(payload):
            plugin_config = context.get_plugin_config()
            if plugin_config.get("reject_chat"):
                return {"allowed": False, "message": "Hello plugin rejected chat"}
            return {"allowed": True}

        async def health_check():
            return {"level": "ok", "message": "Hello plugin ready"}

        context.add_api_router(router)
        context.subscribe("neuraxis.plugin.loaded", record_event)
        context.add_policy_hook("neuraxis.chat_admission", chat_admission)
        context.add_health_check(health_check)


plugin = HelloPlugin()
