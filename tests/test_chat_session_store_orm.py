from llama_pack.core.persistence.chat_session_store_orm import ChatSessionStoreOrm
from tests.persistence_db_setup import prepare_chat_sessions_db


def _exercise_store(store):
    listed = store.list_sessions()
    assert listed == []

    saved = store.save_session(
        name="run-1",
        model="qwen",
        target_selector="auto",
        messages=[{"role": "user", "content": "hello"}],
        request_defaults={"temperature": 0.2},
    )
    sid = saved["id"]
    assert saved["name"] == "run-1"
    assert saved["messages"][0]["content"] == "hello"

    listed_after = store.list_sessions()
    assert len(listed_after) == 1
    assert listed_after[0]["id"] == sid

    loaded = store.get_session(sid)
    assert loaded is not None
    assert loaded["request_defaults"]["temperature"] == 0.2

    updated = store.save_session(
        session_id=sid,
        name="run-1-updated",
        model="qwen",
        target_selector="auto",
        messages=[{"role": "user", "content": "hello again"}],
        request_defaults={"temperature": 0.5},
    )
    assert updated["id"] == sid
    assert updated["name"] == "run-1-updated"
    assert updated["messages"][0]["content"] == "hello again"

    assert store.delete_session(sid) is True
    assert store.delete_session(sid) is False
    assert store.get_session(sid) is None


def test_chat_session_store_orm_behavior(tmp_path):
    prepare_chat_sessions_db(tmp_path / "orm-chat.db")
    store = ChatSessionStoreOrm(db_path=tmp_path / "orm-chat.db")
    _exercise_store(store)


def test_chat_session_store_filters_and_protects_visitor_sessions(tmp_path):
    prepare_chat_sessions_db(tmp_path / "visitor-chat.db")
    store = ChatSessionStoreOrm(db_path=tmp_path / "visitor-chat.db")

    first = store.save_session(
        name="Visitor A",
        model="qwen",
        target_selector="auto",
        messages=[],
        request_defaults={},
        visitor_id="visitor-a",
    )
    second = store.save_session(
        name="Visitor B",
        model="qwen",
        target_selector="auto",
        messages=[],
        request_defaults={},
        visitor_id="visitor-b",
    )

    assert [item["id"] for item in store.list_sessions(visitor_id="visitor-a")] == [first["id"]]
    assert [item["id"] for item in store.list_sessions(visitor_id="visitor-b")] == [second["id"]]
    assert store.get_session(first["id"], visitor_id="visitor-b") is None
    assert store.delete_session(first["id"], visitor_id="visitor-b") is False

    try:
        store.save_session(
            session_id=first["id"],
            name="Overwrite",
            model="qwen",
            target_selector="auto",
            messages=[],
            request_defaults={},
            visitor_id="visitor-b",
        )
    except PermissionError:
        pass
    else:
        raise AssertionError("visitor-b should not overwrite visitor-a's session")

    assert store.get_session(first["id"], visitor_id="visitor-a")["name"] == "Visitor A"
