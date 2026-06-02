import pytest

from llama_manager.core.persistence.auth_store_orm import AuthStoreOrm
from tests.persistence_db_setup import prepare_auth_db


def _exercise_store(store):
    created = store.create_key("alice", "admin")
    assert created["username"] == "alice"
    assert created["role"] == "admin"
    assert created["key"].startswith("lm_")

    resolved = store.resolve_key(created["key"])
    assert resolved is not None
    assert resolved["username"] == "alice"
    assert resolved["role"] == "admin"

    listed = store.list_keys()
    assert any(item["id"] == created["id"] for item in listed)
    assert store.has_active_keys() is True

    assert store.revoke_key(created["id"]) is True
    assert store.resolve_key(created["key"]) is None


def test_auth_store_orm_behavior(tmp_path):
    prepare_auth_db(tmp_path / "orm-auth.db")
    store = AuthStoreOrm(db_path=tmp_path / "orm-auth.db")
    _exercise_store(store)


def test_auth_store_records_external_key_usage_metadata(tmp_path):
    prepare_auth_db(tmp_path / "orm-auth.db")
    store = AuthStoreOrm(db_path=tmp_path / "orm-auth.db")
    created = store.create_external_key("Docs App", "https://docs.local")

    assert store.record_external_key_usage(
        key_id=created["id"],
        endpoint="/v1/chat/completions",
        route="node:linux-2080ti",
        node="linux-2080ti",
        model="qwen",
        request_type="coding",
    ) is True

    listed = store.list_external_keys()
    key = next(item for item in listed if item["id"] == created["id"])
    assert key["last_used_at"]
    assert key["last_used_endpoint"] == "/v1/chat/completions"
    assert key["last_used_route"] == "node:linux-2080ti"
    assert key["last_used_node"] == "linux-2080ti"
    assert key["last_used_model"] == "qwen"
    assert key["last_used_request_type"] == "coding"


def test_auth_store_refuses_to_create_keys_in_real_repo_db_during_tests():
    repo_auth_db = AuthStoreOrm.PROJECT_ROOT / "logs" / "auth_store.db"
    store = AuthStoreOrm(db_path=repo_auth_db)

    with pytest.raises(RuntimeError, match="Refusing to create test API key"):
        store.create_key("alice", "admin")
