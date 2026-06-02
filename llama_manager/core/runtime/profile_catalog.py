from __future__ import annotations

from typing import Any


def build_profile_catalog(statuses: list[dict[str, Any]]) -> dict[str, Any]:
    families: dict[str, dict[str, Any]] = {}
    for status in statuses:
        family = str(status.get("family") or _family_from_name(status))
        profile = status.get("profile")
        profile_key = str(profile) if profile else "default"
        family_entry = families.setdefault(family, {"family": family, "profiles": []})
        family_entry["profiles"].append(_profile_payload(status, family, profile_key))

    ordered_families = sorted(families.values(), key=lambda item: str(item["family"]).lower())
    for family_entry in ordered_families:
        family_entry["profiles"] = sorted(
            family_entry["profiles"],
            key=lambda item: (
                item.get("order") if item.get("order") is not None else 100,
                str(item.get("node") or ""),
                str(item.get("profile") or "").lower(),
            ),
        )
    return {"families": ordered_families}


def _family_from_name(status: dict[str, Any]) -> str:
    name = str(status.get("name") or status.get("id") or status.get("model") or "")
    return name.split(":", 1)[0] if name else "unknown"


def _profile_payload(status: dict[str, Any], family: str, profile: str) -> dict[str, Any]:
    identity = str(status.get("name") or f"{family}:{profile}")
    label = status.get("profile_label") or profile[:1].upper() + profile[1:]
    node = status.get("node")
    route = status.get("route")
    if route is None:
        route = f"node:{node}" if node else "local"
    return {
        "family": family,
        "profile": profile,
        "label": label,
        "identity": identity,
        "node": node,
        "route": route,
        "running": bool(status.get("running")),
        "ctx": status.get("ctx"),
        "port": status.get("port"),
        "path": status.get("model_path") or status.get("path"),
        "file_id": status.get("file_id"),
        "order": status.get("profile_order"),
        "kind": status.get("profile_kind"),
        "kv_cache_policy": status.get("kv_cache_policy"),
        "resource_tier": status.get("resource_tier"),
    }
