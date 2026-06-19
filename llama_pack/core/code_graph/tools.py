from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from llama_pack.core.persistence.project_graph_store_orm import ProjectGraphStoreOrm


GRAPH_TOOL_NAMES = {
    "graph_overview",
    "graph_find_symbol",
    "graph_symbol_context",
    "graph_trace_callers",
    "graph_trace_callees",
    "graph_find_references",
    "graph_find_routes",
    "graph_find_components",
}


@dataclass(frozen=True)
class ProjectGraphToolContext:
    project_id: str
    store: ProjectGraphStoreOrm


def project_graph_tool_definitions() -> list[dict[str, Any]]:
    return [
        _tool("graph_overview", "Summarize the indexed project code graph.", _empty_schema()),
        _tool(
            "graph_find_symbol",
            "Find code symbols by name or qualified name in the indexed project graph.",
            _object_schema({"query": _string("Symbol name or qualified-name fragment."), "kind": _string("Optional symbol kind filter.")}, ["query"]),
        ),
        _tool(
            "graph_symbol_context",
            "Load file, line, and signature context for a symbol id from the indexed project graph.",
            _object_schema({"symbol_id": _string("Symbol id returned by another graph tool.")}, ["symbol_id"]),
        ),
        _tool(
            "graph_trace_callers",
            "Find symbols that call the supplied symbol id.",
            _object_schema({"symbol_id": _string("Symbol id to trace."), "relation_type": _string("Optional relation type. Defaults to calls_best_effort.")}, ["symbol_id"]),
        ),
        _tool(
            "graph_trace_callees",
            "Find symbols called by the supplied symbol id.",
            _object_schema({"symbol_id": _string("Symbol id to trace."), "relation_type": _string("Optional relation type. Defaults to calls_best_effort.")}, ["symbol_id"]),
        ),
        _tool(
            "graph_find_references",
            "Find graph references to a symbol id.",
            _object_schema({"symbol_id": _string("Symbol id to find references for.")}, ["symbol_id"]),
        ),
        _tool("graph_find_routes", "Find indexed API or UI route symbols.", _empty_schema()),
        _tool("graph_find_components", "Find indexed React component symbols.", _empty_schema()),
    ]


async def execute_project_graph_tool(context: ProjectGraphToolContext, name: str, arguments: dict[str, Any]) -> dict[str, Any]:
    if name == "graph_overview":
        active = context.store.get_active_snapshot(context.project_id)
        if active is None:
            return {"ok": False, "error": "Project graph is not indexed"}
        return {"ok": True, "snapshot": active}
    if name == "graph_find_symbol":
        query = _required_string(arguments, "query")
        kind = _optional_string(arguments, "kind")
        return {"ok": True, "symbols": context.store.find_symbols(project_id=context.project_id, query=query, kind=kind)}
    if name == "graph_symbol_context":
        symbol_id = _required_string(arguments, "symbol_id")
        symbol = context.store.symbol_context(project_id=context.project_id, symbol_id=symbol_id)
        if symbol is None:
            return {"ok": False, "error": f"Symbol not found: {symbol_id}"}
        return {"ok": True, "symbol": symbol}
    if name == "graph_trace_callers":
        symbol_id = _required_string(arguments, "symbol_id")
        relation_type = _optional_string(arguments, "relation_type") or "calls_best_effort"
        return {"ok": True, "relations": context.store.relations(project_id=context.project_id, symbol_id=symbol_id, direction="in", relation_type=relation_type, depth=1)}
    if name == "graph_trace_callees":
        symbol_id = _required_string(arguments, "symbol_id")
        relation_type = _optional_string(arguments, "relation_type") or "calls_best_effort"
        return {"ok": True, "relations": context.store.relations(project_id=context.project_id, symbol_id=symbol_id, direction="out", relation_type=relation_type, depth=1)}
    if name == "graph_find_references":
        symbol_id = _required_string(arguments, "symbol_id")
        return {"ok": True, "relations": context.store.relations(project_id=context.project_id, symbol_id=symbol_id, direction="in", relation_type="component_uses", depth=1)}
    if name == "graph_find_routes":
        return {"ok": True, "symbols": context.store.find_symbols(project_id=context.project_id, query="", kind="route")}
    if name == "graph_find_components":
        return {"ok": True, "symbols": context.store.find_symbols(project_id=context.project_id, query="", kind="component")}
    return {"ok": False, "error": f"Unknown project graph tool {name!r}"}


def _tool(name: str, description: str, parameters: dict[str, Any]) -> dict[str, Any]:
    return {"type": "function", "function": {"name": name, "description": description, "parameters": parameters}}


def _empty_schema() -> dict[str, Any]:
    return {"type": "object", "properties": {}, "additionalProperties": False}


def _object_schema(properties: dict[str, Any], required: list[str]) -> dict[str, Any]:
    return {"type": "object", "properties": properties, "required": required, "additionalProperties": False}


def _string(description: str) -> dict[str, str]:
    return {"type": "string", "description": description}


def _required_string(arguments: dict[str, Any], key: str) -> str:
    value = arguments.get(key)
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{key} must be a non-empty string")
    return value.strip()


def _optional_string(arguments: dict[str, Any], key: str) -> str | None:
    value = arguments.get(key)
    if value is None:
        return None
    if not isinstance(value, str):
        raise ValueError(f"{key} must be a string")
    normalized = value.strip()
    return normalized or None
