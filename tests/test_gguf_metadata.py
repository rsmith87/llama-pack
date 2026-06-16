"""Tests for the native GGUF metadata reader."""

from __future__ import annotations

import struct
from pathlib import Path

import pytest

from llama_pack.core.model_assets.gguf_metadata import (
    read_gguf_context_length,
    read_gguf_metadata,
)

# ---------------------------------------------------------------------------
# Helpers to build minimal GGUF files in memory / on disk
# ---------------------------------------------------------------------------

_MAGIC = b"GGUF"
_UINT32 = struct.Struct("<I")
_UINT64 = struct.Struct("<Q")

_VTYPE_UINT64 = 10
_VTYPE_STRING = 8
_VTYPE_FLOAT32 = 6


def _write_string(f, s: str) -> None:
    encoded = s.encode("utf-8")
    f.write(_UINT64.pack(len(encoded)))
    f.write(encoded)


def _write_kv_uint64(f, key: str, value: int) -> None:
    _write_string(f, key)
    f.write(_UINT32.pack(_VTYPE_UINT64))
    f.write(_UINT64.pack(value))


def _write_kv_string(f, key: str, value: str) -> None:
    _write_string(f, key)
    f.write(_UINT32.pack(_VTYPE_STRING))
    _write_string(f, value)


def _write_kv_float32(f, key: str, value: float) -> None:
    _write_string(f, key)
    f.write(_UINT32.pack(_VTYPE_FLOAT32))
    f.write(struct.pack("<f", value))


def _build_gguf(
    kv_pairs: list[tuple[str, str, object]],
    version: int = 3,
) -> bytes:
    """Build a minimal GGUF file with the given KV pairs."""
    import io

    buf = io.BytesIO()
    buf.write(_MAGIC)
    buf.write(_UINT32.pack(version))
    buf.write(_UINT64.pack(0))  # n_tensors
    buf.write(_UINT64.pack(len(kv_pairs)))

    for key, vtype, value in kv_pairs:
        if vtype == "uint64":
            _write_kv_uint64(buf, key, int(value))
        elif vtype == "string":
            _write_kv_string(buf, key, str(value))
        elif vtype == "float32":
            _write_kv_float32(buf, key, float(value))
        else:
            raise ValueError(f"Unknown test vtype: {vtype}")

    return buf.getvalue()


def _write_gguf(path: Path, kv_pairs: list[tuple[str, str, object]], version: int = 3) -> Path:
    path.write_bytes(_build_gguf(kv_pairs, version=version))
    return path


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


class TestReadGgufMetadata:
    def test_reads_all_kv_pairs(self, tmp_path: Path) -> None:
        path = _write_gguf(tmp_path / "model.gguf", [
            ("general.name", "string", "test-model"),
            ("context_length", "uint64", 8192),
            ("tokenizer.ggml.context_length", "uint64", 32768),
        ])
        meta = read_gguf_metadata(path)
        assert meta["general.name"] == "test-model"
        assert meta["context_length"] == 8192
        assert meta["tokenizer.ggml.context_length"] == 32768

    def test_reads_only_requested_keys(self, tmp_path: Path) -> None:
        path = _write_gguf(tmp_path / "model.gguf", [
            ("general.name", "string", "test"),
            ("context_length", "uint64", 16384),
            ("tokenizer.ggml.context_length", "uint64", 65536),
        ])
        meta = read_gguf_metadata(path, keys=frozenset({"context_length"}))
        assert "context_length" in meta
        assert "general.name" not in meta

    def test_returns_empty_dict_for_no_matching_keys(self, tmp_path: Path) -> None:
        path = _write_gguf(tmp_path / "model.gguf", [
            ("general.name", "string", "test"),
        ])
        meta = read_gguf_metadata(path, keys=frozenset({"nonexistent"}))
        assert meta == {}

    def test_raises_for_invalid_file(self, tmp_path: Path) -> None:
        bad = tmp_path / "bad.gguf"
        bad.write_bytes(b"NOT_GGUF")
        with pytest.raises(ValueError, match="Not a GGUF file"):
            read_gguf_metadata(bad)

    def test_v2_format(self, tmp_path: Path) -> None:
        """GGUF v2 uses uint32 for tensor count."""
        path = _write_gguf(tmp_path / "v2.gguf", [
            ("context_length", "uint64", 4096),
        ], version=2)
        meta = read_gguf_metadata(path)
        assert meta["context_length"] == 4096


class TestReadGgufContextLength:
    def test_returns_context_length_from_tokenizer_key(self, tmp_path: Path) -> None:
        path = _write_gguf(tmp_path / "model.gguf", [
            ("tokenizer.ggml.context_length", "uint64", 131072),
        ])
        assert read_gguf_context_length(path) == 131072

    def test_returns_context_length_from_general_key(self, tmp_path: Path) -> None:
        path = _write_gguf(tmp_path / "model.gguf", [
            ("general.context_length", "uint64", 65536),
        ])
        assert read_gguf_context_length(path) == 65536

    def test_returns_context_length_from_bare_key(self, tmp_path: Path) -> None:
        path = _write_gguf(tmp_path / "model.gguf", [
            ("context_length", "uint64", 8192),
        ])
        assert read_gguf_context_length(path) == 8192

    def test_returns_context_length_from_arch_specific_key(self, tmp_path: Path) -> None:
        path = _write_gguf(tmp_path / "model.gguf", [
            ("llama.context_length", "uint64", 32768),
        ])
        assert read_gguf_context_length(path) == 32768

    def test_returns_context_length_from_unknown_arch_suffix(self, tmp_path: Path) -> None:
        path = _write_gguf(tmp_path / "model.gguf", [
            ("customarch.context_length", "uint64", 12288),
        ])
        assert read_gguf_context_length(path) == 12288

    def test_returns_none_for_missing_keys(self, tmp_path: Path) -> None:
        path = _write_gguf(tmp_path / "model.gguf", [
            ("general.name", "string", "test"),
        ])
        assert read_gguf_context_length(path) is None

    def test_returns_none_for_invalid_file(self, tmp_path: Path) -> None:
        bad = tmp_path / "bad.gguf"
        bad.write_bytes(b"junk")
        assert read_gguf_context_length(bad) is None

    def test_returns_none_for_nonexistent_file(self) -> None:
        assert read_gguf_context_length("/nonexistent/path.gguf") is None

    def test_tokenizer_key_takes_priority(self, tmp_path: Path) -> None:
        path = _write_gguf(tmp_path / "model.gguf", [
            ("tokenizer.ggml.context_length", "uint64", 131072),
            ("general.context_length", "uint64", 65536),
        ])
        assert read_gguf_context_length(path) == 131072