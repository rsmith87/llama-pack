from __future__ import annotations


class ChatSlotOwnershipError(PermissionError):
    pass


class ChatSlotAllocator:
    def __init__(self) -> None:
        self._account_slots: dict[str, dict[str, int]] = {}
        self._slot_owners: dict[str, dict[int, str]] = {}

    def assign_slot(
        self,
        *,
        route_key: str,
        account_id: str,
        requested_slot_id: int | None,
        admin: bool,
    ) -> int | None:
        if not account_id:
            return requested_slot_id

        if admin:
            return requested_slot_id

        route_slots = self._account_slots.setdefault(route_key, {})
        slot_owners = self._slot_owners.setdefault(route_key, {})

        if requested_slot_id is not None:
            owner = slot_owners.get(requested_slot_id)
            if owner is not None and owner != account_id:
                raise ChatSlotOwnershipError(
                    f"KV slot {requested_slot_id} for {route_key} is assigned to another account"
                )
            route_slots[account_id] = requested_slot_id
            slot_owners[requested_slot_id] = account_id
            return requested_slot_id

        existing = route_slots.get(account_id)
        if existing is not None:
            return existing

        next_slot = self._next_available_slot(slot_owners)
        route_slots[account_id] = next_slot
        slot_owners[next_slot] = account_id
        return next_slot

    def _next_available_slot(self, slot_owners: dict[int, str]) -> int:
        slot_id = 0
        while slot_id in slot_owners:
            slot_id += 1
        return slot_id
