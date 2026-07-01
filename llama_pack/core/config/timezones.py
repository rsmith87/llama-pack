from __future__ import annotations

from zoneinfo import ZoneInfo, ZoneInfoNotFoundError


def validate_iana_timezone(value: str, field_name: str) -> str:
    try:
        ZoneInfo(value)
    except ZoneInfoNotFoundError as exc:
        raise ValueError(f"{field_name} must be a valid IANA timezone, got {value!r}") from exc
    return value
