from __future__ import annotations

from datetime import UTC, datetime, time, timedelta

from llama_pack_workflows.models import WorkflowSchedule


def schedule_is_due(schedule: WorkflowSchedule, now: datetime, previous_run_at: datetime | None) -> bool:
    current = now.astimezone(UTC)
    if schedule.kind == "interval_minutes":
        minutes = _parse_interval_minutes(schedule.value)
        if previous_run_at is None:
            return True
        return current - previous_run_at.astimezone(UTC) >= timedelta(minutes=minutes)
    if schedule.kind == "daily":
        scheduled_time = _parse_daily_time(schedule.value)
        scheduled_today = datetime.combine(current.date(), scheduled_time)
        if current < scheduled_today:
            return False
        if previous_run_at is None:
            return True
        return previous_run_at.astimezone(UTC) < scheduled_today
    raise ValueError(f"Unsupported schedule kind: {schedule.kind}")


def _parse_daily_time(value: str) -> time:
    try:
        hour_text, minute_text = value.split(":", maxsplit=1)
        return time(hour=int(hour_text), minute=int(minute_text), tzinfo=UTC)
    except Exception as exc:
        raise ValueError(f"Daily schedule value must be HH:MM in UTC: {value}") from exc


def _parse_interval_minutes(value: str) -> int:
    try:
        minutes = int(value)
    except ValueError as exc:
        raise ValueError(f"Interval schedule minutes must be an integer: {value}") from exc
    if minutes < 1:
        raise ValueError(f"Interval schedule minutes must be >= 1: {value}")
    return minutes
