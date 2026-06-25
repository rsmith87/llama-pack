"""
Tests for the ChromaMemoryStore and the /memory write-back endpoint.

chromadb and sentence_transformers are mocked at the sys.modules level so
these tests run without installing the optional controller-memory extras.
"""
from __future__ import annotations

import sys
import time
import types
import uuid
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


# ---------------------------------------------------------------------------
# Lightweight in-process fakes for chromadb + sentence_transformers
# ---------------------------------------------------------------------------

class _FakeCollection:
    """Minimal in-memory ChromaDB collection stub."""

    def __init__(self):
        self._entries: dict[str, dict[str, Any]] = {}  # id -> {doc, meta, embedding}

    def count(self) -> int:
        return len(self._entries)

    def get(self, ids: list[str] | None = None, include: list[str] | None = None) -> dict:
        if ids is not None:
            entries = {k: v for k, v in self._entries.items() if k in ids}
        else:
            entries = dict(self._entries)
        result: dict[str, Any] = {"ids": list(entries.keys())}
        if include and "metadatas" in include:
            result["metadatas"] = [v["meta"] for v in entries.values()]
        if include and "documents" in include:
            result["documents"] = [v["doc"] for v in entries.values()]
        if include and "embeddings" in include:
            result["embeddings"] = [v["embedding"] for v in entries.values()]
        return result

    def add(self, ids, embeddings, documents, metadatas):
        for eid, emb, doc, meta in zip(ids, embeddings, documents, metadatas):
            self._entries[eid] = {"doc": doc, "meta": meta, "embedding": emb}

    def update(self, ids, embeddings, documents, metadatas):
        for eid, emb, doc, meta in zip(ids, embeddings, documents, metadatas):
            self._entries[eid] = {"doc": doc, "meta": meta, "embedding": emb}

    def delete(self, ids: list[str]):
        for eid in ids:
            self._entries.pop(eid, None)

    def query(self, query_embeddings, n_results, include=None):
        """Return nearest neighbours by cosine similarity (dot product on unit vectors)."""
        import math
        q = query_embeddings[0]

        def dot(a, b):
            return sum(x * y for x, y in zip(a, b))

        def norm(v):
            return math.sqrt(sum(x * x for x in v))

        scored = []
        for eid, entry in self._entries.items():
            emb = entry["embedding"]
            n_q = norm(q)
            n_e = norm(emb)
            sim = dot(q, emb) / (n_q * n_e) if n_q and n_e else 0.0
            scored.append((eid, entry, sim))

        scored.sort(key=lambda x: x[2], reverse=True)
        top = scored[:n_results]

        result: dict[str, Any] = {
            "ids": [[x[0] for x in top]],
            "distances": [[1.0 - x[2] for x in top]],
        }
        if include and "documents" in include:
            result["documents"] = [[x[1]["doc"] for x in top]]
        if include and "metadatas" in include:
            result["metadatas"] = [[x[1]["meta"] for x in top]]
        return result


class _FakeClient:
    def __init__(self, path=None):
        self._collections: dict[str, _FakeCollection] = {}

    def get_or_create_collection(self, name, metadata=None):
        if name not in self._collections:
            self._collections[name] = _FakeCollection()
        return self._collections[name]


class _FakeModel:
    """Minimal sentence_transformers.SentenceTransformer stub."""

    def __init__(self, model_name_or_path: str = ""):
        pass

    def encode(self, text: str, normalize_embeddings: bool = True):
        import hashlib
        # Deterministic 384-dim unit vector from MD5 bytes — no NaN/Inf risk
        digest = hashlib.md5(text.encode()).digest()  # 16 bytes
        # Tile the digest to get 384 values in [-1, 1]
        repeated = (digest * 24)[:384]  # 384 bytes
        vec = [(b / 127.5) - 1.0 for b in repeated]
        magnitude = sum(x * x for x in vec) ** 0.5
        return [x / magnitude for x in vec] if magnitude else vec

    def save(self, path: str):
        pass


def _install_fake_deps(tmp_path):
    """Inject fake chromadb + sentence_transformers into sys.modules."""
    fake_chromadb = types.ModuleType("chromadb")
    fake_chromadb.PersistentClient = _FakeClient  # type: ignore[attr-defined]
    sys.modules["chromadb"] = fake_chromadb

    fake_st = types.ModuleType("sentence_transformers")
    fake_st.SentenceTransformer = _FakeModel  # type: ignore[attr-defined]
    sys.modules["sentence_transformers"] = fake_st


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_memory_config(tmp_path, *, enabled=True, top_k=3):
    from llama_pack.core.config.models import MemoryConfig
    model_dir = tmp_path / "model"
    model_dir.mkdir()
    return MemoryConfig(
        enabled=enabled,
        path=tmp_path / "chroma",
        embedding_model_path=model_dir,
        auto_inject=True,
        top_k=top_k,
        soft_cap=10,
        ephemeral_ttl_days=7,
        durable_ttl_days=90,
    )


# ---------------------------------------------------------------------------
# ChromaMemoryStore unit tests
# ---------------------------------------------------------------------------

class TestChromaMemoryStore:
    @pytest.fixture(autouse=True)
    def _patch_deps(self, tmp_path):
        _install_fake_deps(tmp_path)
        yield

    def _make_store(self, tmp_path, **kwargs):
        from llama_pack.core.memory.store import ChromaMemoryStore
        return ChromaMemoryStore(_make_memory_config(tmp_path, **kwargs))

    @pytest.mark.asyncio
    async def test_disabled_store_returns_empty_search(self, tmp_path):
        store = self._make_store(tmp_path, enabled=False)
        assert store.disabled
        results = await store.search("anything")
        assert results == []

    @pytest.mark.asyncio
    async def test_disabled_store_write_returns_none(self, tmp_path):
        store = self._make_store(tmp_path, enabled=False)
        result = await store.write("remember me")
        assert result is None

    @pytest.mark.asyncio
    async def test_write_and_search_returns_entry(self, tmp_path):
        store = self._make_store(tmp_path)
        entry_id = await store.write("user prefers dark mode", tier="durable")
        assert entry_id is not None
        results = await store.search("user interface preferences")
        assert len(results) >= 1
        assert any("dark mode" in r["text"] for r in results)

    @pytest.mark.asyncio
    async def test_write_deduplicates_similar_entries(self, tmp_path):
        store = self._make_store(tmp_path)
        id1 = await store.write("user works in Python", tier="durable")
        id2 = await store.write("user works in Python", tier="durable")
        # Same text → same embedding → should update in place, not create new entry
        assert id1 == id2

    @pytest.mark.asyncio
    async def test_write_empty_string_returns_none(self, tmp_path):
        store = self._make_store(tmp_path)
        result = await store.write("   ")
        assert result is None

    @pytest.mark.asyncio
    async def test_cleanup_removes_expired_ephemeral(self, tmp_path):
        store = self._make_store(tmp_path)
        # Write an entry with a very old last_accessed timestamp
        entry_id = await store.write("old task note", tier="ephemeral")
        assert entry_id is not None
        # Manually age the entry
        col = store._collection
        entry = col.get(ids=[entry_id], include=["metadatas", "documents", "embeddings"])
        meta = entry["metadatas"][0]
        meta["last_accessed"] = time.time() - (8 * 86400)  # 8 days ago
        col.update(
            ids=[entry_id],
            embeddings=entry["embeddings"][0] if "embeddings" in entry else [store._embed("old task note")],
            documents=[entry["documents"][0]],
            metadatas=[meta],
        )
        deleted = await store.cleanup()
        assert deleted >= 1

    @pytest.mark.asyncio
    async def test_cleanup_preserves_permanent_entries(self, tmp_path):
        store = self._make_store(tmp_path)
        entry_id = await store.write("never forget this", tier="permanent")
        assert entry_id is not None
        # Age it
        col = store._collection
        entry = col.get(ids=[entry_id], include=["metadatas", "documents", "embeddings"])
        meta = entry["metadatas"][0]
        meta["last_accessed"] = time.time() - (365 * 86400)
        col.update(
            ids=[entry_id],
            embeddings=[store._embed("never forget this")],
            documents=["never forget this"],
            metadatas=[meta],
        )
        deleted = await store.cleanup()
        assert deleted == 0
        assert col.count() == 1

    @pytest.mark.asyncio
    async def test_soft_cap_evicts_ephemeral_entries(self, tmp_path):
        store = self._make_store(tmp_path)  # soft_cap=10
        # Fill past the cap with ephemeral entries
        for i in range(12):
            await store.write(f"ephemeral note {i} with unique content xyz{i}", tier="ephemeral")
        assert store._collection.count() <= 10


# ---------------------------------------------------------------------------
# Memory injection tests (compat_chat._inject_memories)
# ---------------------------------------------------------------------------

class TestInjectMemories:
    @pytest.fixture(autouse=True)
    def _patch_deps(self, tmp_path):
        _install_fake_deps(tmp_path)
        yield

    @pytest.mark.asyncio
    async def test_inject_prepends_system_message_when_no_existing(self, tmp_path):
        from llama_pack.api.routes.compat_chat import _inject_memories
        from llama_pack.core.memory.store import ChromaMemoryStore

        cfg = _make_memory_config(tmp_path)
        store = ChromaMemoryStore(cfg)
        await store.write("user prefers concise answers", tier="durable")

        from llama_pack.core.config.models import MemoryConfig
        app_config = MagicMock()
        app_config.memory = cfg

        payload = {"messages": [{"role": "user", "content": "how do I do X?"}], "model": "qwen"}
        result = await _inject_memories(store, app_config, payload)

        messages = result["messages"]
        assert messages[0]["role"] == "system"
        assert "[Memory]" in messages[0]["content"]

    @pytest.mark.asyncio
    async def test_inject_prepends_to_existing_system_message(self, tmp_path):
        from llama_pack.api.routes.compat_chat import _inject_memories
        from llama_pack.core.memory.store import ChromaMemoryStore

        cfg = _make_memory_config(tmp_path)
        store = ChromaMemoryStore(cfg)
        await store.write("user works in Python", tier="durable")

        app_config = MagicMock()
        app_config.memory = cfg

        payload = {
            "messages": [
                {"role": "system", "content": "You are a helpful assistant."},
                {"role": "user", "content": "help me with Python"},
            ],
            "model": "qwen",
        }
        result = await _inject_memories(store, app_config, payload)

        system_msg = result["messages"][0]
        assert "[Memory]" in system_msg["content"]
        assert "You are a helpful assistant." in system_msg["content"]

    @pytest.mark.asyncio
    async def test_inject_skips_when_disabled(self, tmp_path):
        from llama_pack.api.routes.compat_chat import _inject_memories
        from llama_pack.core.memory.store import ChromaMemoryStore

        cfg = _make_memory_config(tmp_path, enabled=False)
        store = ChromaMemoryStore(cfg)

        app_config = MagicMock()
        app_config.memory = cfg

        payload = {"messages": [{"role": "user", "content": "hello"}], "model": "qwen"}
        result = await _inject_memories(store, app_config, payload)
        assert result is payload  # unchanged

    @pytest.mark.asyncio
    async def test_inject_skips_when_auto_inject_false(self, tmp_path):
        from llama_pack.api.routes.compat_chat import _inject_memories
        from llama_pack.core.memory.store import ChromaMemoryStore

        cfg = _make_memory_config(tmp_path)
        cfg.auto_inject = False
        store = ChromaMemoryStore(cfg)
        await store.write("some memory", tier="durable")

        app_config = MagicMock()
        app_config.memory = cfg

        payload = {"messages": [{"role": "user", "content": "hello"}], "model": "qwen"}
        result = await _inject_memories(store, app_config, payload)
        assert result is payload

    @pytest.mark.asyncio
    async def test_inject_skips_when_no_memories_found(self, tmp_path):
        from llama_pack.api.routes.compat_chat import _inject_memories
        from llama_pack.core.memory.store import ChromaMemoryStore

        cfg = _make_memory_config(tmp_path)
        store = ChromaMemoryStore(cfg)
        # Empty store — no memories

        app_config = MagicMock()
        app_config.memory = cfg

        payload = {"messages": [{"role": "user", "content": "hello"}], "model": "qwen"}
        result = await _inject_memories(store, app_config, payload)
        assert result is payload


# ---------------------------------------------------------------------------
# Memory write-back endpoint tests
# ---------------------------------------------------------------------------

def _make_app(tmp_path, *, memory_enabled=True, app_config=None):
    """Build a test FastAPI app with a disabled memory store (endpoint still registered)."""
    from fastapi.testclient import TestClient
    from llama_pack.core.memory.store import ChromaMemoryStore
    from llama_pack.api.routes import memory as memory_routes
    from llama_pack.api.dependencies import get_config, get_memory_store
    from fastapi import FastAPI

    cfg = _make_memory_config(tmp_path, enabled=memory_enabled)
    store = ChromaMemoryStore(cfg)
    if app_config is None:
        from llama_pack.core.config import load_config
        app_config = load_config({"mode": "controller"})

    app = FastAPI()
    app.include_router(memory_routes.router, prefix="/lm-api/v1")
    app.dependency_overrides[get_memory_store] = lambda: store
    app.dependency_overrides[get_config] = lambda: app_config
    return TestClient(app), store


class TestMemoryEndpoint:
    @pytest.fixture(autouse=True)
    def _patch_deps(self, tmp_path):
        _install_fake_deps(tmp_path)
        yield

    def test_write_returns_created(self, tmp_path):
        client, _ = _make_app(tmp_path)
        resp = client.post("/lm-api/v1/memory/write", json={"text": "user likes dark mode", "tier": "durable"})
        assert resp.status_code == 201
        data = resp.json()
        assert data["ok"] is True
        assert data["id"] is not None

    def test_write_invalid_tier_rejected(self, tmp_path):
        client, _ = _make_app(tmp_path)
        resp = client.post("/lm-api/v1/memory/write", json={"text": "hello", "tier": "invalid"})
        assert resp.status_code == 422

    def test_write_rejects_ssn(self, tmp_path):
        client, _ = _make_app(tmp_path)
        resp = client.post("/lm-api/v1/memory/write", json={"text": "user ssn is 123-45-6789", "tier": "durable"})
        assert resp.status_code == 422
        assert resp.json()["detail"] == {
            "error_type": "prompt_safety_violation",
            "message": "Prompt contains sensitive data and was not sent to the model.",
            "violations": [{"kind": "ssn", "path": "text"}],
        }

    def test_write_when_disabled_returns_503(self, tmp_path):
        client, _ = _make_app(tmp_path, memory_enabled=False)
        resp = client.post("/lm-api/v1/memory/write", json={"text": "hello", "tier": "durable"})
        assert resp.status_code == 503

    def test_search_returns_results(self, tmp_path):
        client, store = _make_app(tmp_path)
        # Pre-populate via direct store call (sync equivalent)
        import asyncio
        asyncio.run(store.write("user prefers Python", tier="durable"))

        resp = client.post("/lm-api/v1/memory/search", json={"query": "programming language preference"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["ok"] is True
        assert isinstance(data["results"], list)

    def test_search_when_disabled_returns_503(self, tmp_path):
        client, _ = _make_app(tmp_path, memory_enabled=False)
        resp = client.post("/lm-api/v1/memory/search", json={"query": "anything"})
        assert resp.status_code == 503

    def test_entries_lists_written_memories(self, tmp_path):
        client, store = _make_app(tmp_path)
        import asyncio
        entry_id = asyncio.run(store.write("user prefers concise answers", tier="durable", topic="preferences", tags=["style"]))

        resp = client.get("/lm-api/v1/memory/entries")

        assert resp.status_code == 200
        data = resp.json()
        assert data["ok"] is True
        assert data["count"] == 1
        assert data["entries"] == [{
            "id": entry_id,
            "text": "user prefers concise answers",
            "tier": "durable",
            "topic": "preferences",
            "tags": ["style"],
        }]

    def test_delete_removes_memory_entry(self, tmp_path):
        client, store = _make_app(tmp_path)
        import asyncio
        entry_id = asyncio.run(store.write("temporary note", tier="ephemeral"))

        resp = client.delete(f"/lm-api/v1/memory/entries/{entry_id}")

        assert resp.status_code == 200
        assert resp.json() == {"ok": True, "id": entry_id, "deleted": True}
        list_resp = client.get("/lm-api/v1/memory/entries")
        assert list_resp.json()["entries"] == []

    def test_delete_missing_memory_entry_returns_404(self, tmp_path):
        client, _ = _make_app(tmp_path)
        resp = client.delete("/lm-api/v1/memory/entries/missing")
        assert resp.status_code == 404

    def test_embeddings_returns_vectors_from_memory_model(self, tmp_path):
        client, _ = _make_app(tmp_path)
        resp = client.post("/lm-api/v1/memory/embeddings", json={"input": ["alpha", "beta"]})
        assert resp.status_code == 200
        data = resp.json()
        assert data["model"] == "model"
        assert data["data"][0]["object"] == "embedding"
        assert data["data"][0]["index"] == 0
        assert len(data["data"][0]["embedding"]) == 384
        assert data["data"][1]["index"] == 1
        assert data["usage"] == {"prompt_tokens": 2, "total_tokens": 2}

    def test_embeddings_rejects_credit_card(self, tmp_path):
        client, _ = _make_app(tmp_path)
        resp = client.post("/lm-api/v1/memory/embeddings", json={"input": ["card 4111 1111 1111 1111"]})
        assert resp.status_code == 422
        assert resp.json()["detail"] == {
            "error_type": "prompt_safety_violation",
            "message": "Prompt contains sensitive data and was not sent to the model.",
            "violations": [{"kind": "credit_card", "path": "input[0]"}],
        }

    def test_embeddings_when_disabled_returns_503(self, tmp_path):
        client, _ = _make_app(tmp_path, memory_enabled=False)
        resp = client.post("/lm-api/v1/memory/embeddings", json={"input": ["alpha"]})
        assert resp.status_code == 503

    def test_agent_embeddings_proxy_to_controller(self, tmp_path, monkeypatch):
        from llama_pack.core.config import load_config

        calls = []

        class FakeResponse:
            def __init__(self):
                self.status_code = 200

            def json(self):
                return {
                    "model": "all-MiniLM-L6-v2",
                    "data": [{"object": "embedding", "index": 0, "embedding": [0.1, 0.2], "id": "memory-emb-0"}],
                    "usage": {"prompt_tokens": 1, "total_tokens": 1},
                }

            def raise_for_status(self):
                return None

        class FakeAsyncClient:
            def __init__(self, timeout, verify):
                calls.append(("init", timeout, verify))

            async def __aenter__(self):
                return self

            async def __aexit__(self, exc_type, exc, tb):
                return None

            async def post(self, url, json, headers):
                calls.append(("post", url, json, headers))
                return FakeResponse()

        monkeypatch.setattr("llama_pack.api.routes.memory.httpx.AsyncClient", FakeAsyncClient)
        client, _ = _make_app(
            tmp_path,
            app_config=load_config({
                "mode": "agent",
                "controller_url": "http://controller.local:9137",
                "agent_api_key": "agent-secret",
            }),
        )

        resp = client.post("/lm-api/v1/memory/embeddings", json={"input": ["alpha"]})

        assert resp.status_code == 200
        assert resp.json()["model"] == "all-MiniLM-L6-v2"
        assert calls == [
            ("init", 30, True),
            (
                "post",
                "http://controller.local:9137/lm-api/v1/memory/embeddings",
                {"input": ["alpha"]},
                {"X-Llama-Pack-Key": "agent-secret"},
            ),
        ]

    def test_agent_embeddings_without_controller_url_returns_503(self, tmp_path):
        from llama_pack.core.config import load_config

        client, _ = _make_app(tmp_path, app_config=load_config({"mode": "agent"}))
        resp = client.post("/lm-api/v1/memory/embeddings", json={"input": ["alpha"]})
        assert resp.status_code == 503
        assert resp.json()["detail"] == "Controller embeddings require controller_url in agent config"
