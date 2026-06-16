"""Minimal native reader for GGUF file metadata headers.

Parses just the header KV pairs from a GGUF file to extract metadata like
context length without loading the full model weights.  The reader only
touches the first few kilobytes of the file.
"""

from __future__ import annotations

import struct
from pathlib import Path

# ---------------------------------------------------------------------------
# GGUF constants
# ---------------------------------------------------------------------------

_MAGIC = b"GGUF"

# Value types used in GGUF KV pairs.
_VTYPE_UINT8 = 0
_VTYPE_INT8 = 1
_VTYPE_UINT16 = 2
_VTYPE_INT16 = 3
_VTYPE_UINT32 = 4
_VTYPE_INT32 = 5
_VTYPE_FLOAT32 = 6
_VTYPE_BOOL = 7
_VTYPE_STRING = 8
_VTYPE_ARRAY = 9
_VTYPE_UINT64 = 10
_VTYPE_INT64 = 11
_VTYPE_FLOAT64 = 12

_UINT32 = struct.Struct("<I")
_UINT64 = struct.Struct("<Q")
_INT32 = struct.Struct("<i")
_INT64 = struct.Struct("<q")
_FLOAT32 = struct.Struct("<f")
_FLOAT64 = struct.Struct("<d")

# Keys that are known to contain the model's native context length.
# Order matters: prefer tokenizer-specific key first, then broader fallbacks.
_CONTEXT_KEY_PRIORITY = (
    "tokenizer.ggml.context_length",
    "general.context_length",
    "llama.context_length",
    "mistral.context_length",
    "qwen2.context_length",
    "qwen3.context_length",
    "phi2.context_length",
    "phi3.context_length",
    "gemma.context_length",
    "gptneox.context_length",
    "mpt.context_length",
    "falcon.context_length",
    "stablelm.context_length",
    "starcoder.context_length",
    "rwkv.context_length",
    "context_length",
)
_CONTEXT_KEYS = frozenset(_CONTEXT_KEY_PRIORITY)

# ---------------------------------------------------------------------------
# Public helpers
# ---------------------------------------------------------------------------


def read_gguf_context_length(path: str | Path) -> int | None:
    """Return the model's native context length from GGUF metadata, or *None*
    if the file cannot be read or does not contain the key."""
    try:
        meta = read_gguf_metadata(path, keys=_CONTEXT_KEYS)
    except Exception:  # noqa: BLE001 – intentionally broad for robustness
        return None
    for key in _CONTEXT_KEY_PRIORITY:
        val = meta.get(key)
        if val is not None:
            try:
                return int(val)  # type: ignore[call-overload]
            except (TypeError, ValueError):
                continue

    # Fallback for additional architectures that expose "<arch>.context_length".
    try:
        full_meta = read_gguf_metadata(path)
    except Exception:  # noqa: BLE001 – intentionally broad for robustness
        return None

    for key, val in full_meta.items():
        if key.endswith(".context_length"):
            try:
                return int(val)  # type: ignore[call-overload]
            except (TypeError, ValueError):
                continue

    return None


def read_gguf_metadata(
    path: str | Path,
    *,
    keys: frozenset[str] | None = None,
) -> dict[str, object]:
    """Read KV metadata from a GGUF file header.

    Parameters
    ----------
    path:
        Path to the ``.gguf`` file.
    keys:
        If provided, stop parsing once all requested keys have been found and
        return only those.  If *None*, return every KV pair encountered.

    Returns
    -------
    dict
        Mapping of GGUF metadata key names to their Python values.
    """
    p = Path(path)
    result: dict[str, object] = {}

    with p.open("rb") as fh:
        # --- header ----------------------------------------------------------
        magic = fh.read(4)
        if magic != _MAGIC:
            raise ValueError(f"Not a GGUF file: {p}")

        version = _UINT32.unpack(fh.read(4))[0]

        if version < 3:
            # v1/v2 use uint32 tensor count; v3+ use uint64.
            _tensor_count = _UINT64.unpack(fh.read(8))[0]
        else:
            _tensor_count = _UINT64.unpack(fh.read(8))[0]

        n_kv = _UINT64.unpack(fh.read(8))[0]

        # --- KV pairs --------------------------------------------------------
        for _ in range(n_kv):
            key = _read_string(fh)

            vtype_raw = _UINT32.unpack(fh.read(4))[0]
            value = _read_value(fh, vtype_raw)

            if keys is None or key in keys:
                result[key] = value
                if keys is not None and len(result) == len(keys):
                    break

    return result


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _read_string(fh) -> str:
    length = _UINT64.unpack(fh.read(8))[0]
    return fh.read(length).decode("utf-8", errors="replace")


def _read_value(fh, vtype: int) -> object:  # noqa: C901 – dispatch
    if vtype == _VTYPE_UINT8:
        return struct.unpack("<B", fh.read(1))[0]
    if vtype == _VTYPE_INT8:
        return struct.unpack("<b", fh.read(1))[0]
    if vtype == _VTYPE_UINT16:
        return struct.unpack("<H", fh.read(2))[0]
    if vtype == _VTYPE_INT16:
        return struct.unpack("<h", fh.read(2))[0]
    if vtype == _VTYPE_UINT32:
        return _UINT32.unpack(fh.read(4))[0]
    if vtype == _VTYPE_INT32:
        return _INT32.unpack(fh.read(4))[0]
    if vtype == _VTYPE_FLOAT32:
        return _FLOAT32.unpack(fh.read(4))[0]
    if vtype == _VTYPE_BOOL:
        return struct.unpack("<B", fh.read(1))[0] != 0
    if vtype == _VTYPE_STRING:
        return _read_string(fh)
    if vtype == _VTYPE_ARRAY:
        elem_type = _UINT32.unpack(fh.read(4))[0]
        length = _UINT64.unpack(fh.read(8))[0]
        return [_read_value(fh, elem_type) for _ in range(length)]
    if vtype == _VTYPE_UINT64:
        return _UINT64.unpack(fh.read(8))[0]
    if vtype == _VTYPE_INT64:
        return _INT64.unpack(fh.read(8))[0]
    if vtype == _VTYPE_FLOAT64:
        return _FLOAT64.unpack(fh.read(8))[0]
    raise ValueError(f"Unknown GGUF value type: {vtype}")