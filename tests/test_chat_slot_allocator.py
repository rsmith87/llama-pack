import pytest

from llama_pack.core.chat.slot_allocator import ChatSlotAllocator, ChatSlotOwnershipError


def test_slot_allocator_assigns_stable_slots_per_account_and_route():
    allocator = ChatSlotAllocator()

    first = allocator.assign_slot(
        route_key="target:auto:model:qwen",
        account_id="alice-key",
        requested_slot_id=None,
        admin=False,
    )
    second = allocator.assign_slot(
        route_key="target:auto:model:qwen",
        account_id="alice-key",
        requested_slot_id=None,
        admin=False,
    )
    other = allocator.assign_slot(
        route_key="target:auto:model:qwen",
        account_id="bob-key",
        requested_slot_id=None,
        admin=False,
    )

    assert first == 0
    assert second == 0
    assert other == 1


def test_slot_allocator_rejects_manual_foreign_slot_for_non_admin_account():
    allocator = ChatSlotAllocator()
    allocator.assign_slot(
        route_key="target:auto:model:qwen",
        account_id="alice-key",
        requested_slot_id=None,
        admin=False,
    )

    with pytest.raises(ChatSlotOwnershipError):
        allocator.assign_slot(
            route_key="target:auto:model:qwen",
            account_id="bob-key",
            requested_slot_id=0,
            admin=False,
        )


def test_slot_allocator_allows_admin_manual_slot_without_claiming_it():
    allocator = ChatSlotAllocator()
    allocator.assign_slot(
        route_key="target:auto:model:qwen",
        account_id="alice-key",
        requested_slot_id=None,
        admin=False,
    )

    assert allocator.assign_slot(
        route_key="target:auto:model:qwen",
        account_id="admin-key",
        requested_slot_id=0,
        admin=True,
    ) == 0
    assert allocator.assign_slot(
        route_key="target:auto:model:qwen",
        account_id="bob-key",
        requested_slot_id=None,
        admin=False,
    ) == 1


def test_slot_allocator_does_not_auto_assign_without_account():
    allocator = ChatSlotAllocator()

    assert allocator.assign_slot(
        route_key="target:auto:model:qwen",
        account_id="",
        requested_slot_id=None,
        admin=False,
    ) is None
    assert allocator.assign_slot(
        route_key="target:auto:model:qwen",
        account_id="",
        requested_slot_id=4,
        admin=False,
    ) == 4
