from __future__ import annotations

from typing import Any

from llama_pack.core.config import AppConfig
from llama_pack.core.runtime.process_manager import ProcessManager


class ProfileActivationError(RuntimeError):
    pass


class ProfileBusyError(ProfileActivationError):
    pass


class ProfileActivationService:
    def __init__(self, config: AppConfig, process_manager: ProcessManager):
        self.config = config
        self.process_manager = process_manager

    def activate(self, family: str, profile: str, target: str = "local") -> dict[str, Any]:
        if target not in {"", "auto", "local"}:
            raise ProfileActivationError("Only local profile activation is supported in this endpoint")
        identity = f"{family}:{profile}"
        self.config.effective_model_config(identity)
        statuses = self.process_manager.list_statuses()
        desired = self._status_for_identity(statuses, identity)
        if desired and desired.get("running") is True:
            return self._response(identity, desired, activated=False)

        for sibling in self._running_siblings(statuses, family, profile):
            sibling_name = str(sibling["name"])
            if self.process_manager.active_count(sibling_name) > 0:
                raise ProfileBusyError(f"Profile sibling is busy: {sibling_name}")

        for sibling in self._running_siblings(statuses, family, profile):
            self.process_manager.stop(str(sibling["name"]))

        started = self.process_manager.start(identity)
        payload = started.to_dict() if hasattr(started, "to_dict") else dict(started)
        return self._response(identity, payload, activated=True)

    def _status_for_identity(self, statuses: list[dict[str, Any]], identity: str) -> dict[str, Any] | None:
        return next((status for status in statuses if status.get("name") == identity), None)

    def _running_siblings(self, statuses: list[dict[str, Any]], family: str, profile: str) -> list[dict[str, Any]]:
        siblings = []
        for status in statuses:
            if status.get("family") != family or status.get("profile") == profile:
                continue
            if status.get("running") is True and status.get("name"):
                siblings.append(status)
        return siblings

    def _response(self, identity: str, status: dict[str, Any], activated: bool) -> dict[str, Any]:
        return {
            "identity": identity,
            "family": status.get("family") or identity.split(":", 1)[0],
            "profile": status.get("profile") or identity.split(":", 1)[1],
            "activated": activated,
            "status": status,
        }
