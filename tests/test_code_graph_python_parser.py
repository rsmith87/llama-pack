from __future__ import annotations

from llama_pack.core.code_graph.python_parser import parse_python_file


def test_python_parser_extracts_fastapi_route_and_calls(tmp_path):
    path = tmp_path / "api.py"
    path.write_text(
        "from fastapi import APIRouter\n"
        "router = APIRouter()\n"
        "def helper():\n"
        "    return 'ok'\n"
        "@router.get('/items')\n"
        "def list_items():\n"
        "    return helper()\n",
        encoding="utf-8",
    )

    parsed = parse_python_file(path, root=tmp_path)

    names = {symbol.qualified_name for symbol in parsed.symbols}
    assert "api.helper" in names
    assert "api.list_items" in names
    assert any(relation.relation_type == "route_handles" for relation in parsed.relations)
    assert any(relation.relation_type == "calls_best_effort" for relation in parsed.relations)


def test_python_parser_extracts_class_method_import_and_inheritance(tmp_path):
    package = tmp_path / "pkg"
    package.mkdir()
    path = package / "service.py"
    path.write_text(
        "import os as operating_system\n"
        "from pathlib import Path\n"
        "class Base:\n"
        "    pass\n"
        "class Service(Base):\n"
        "    def run(self):\n"
        "        return Path(os.getcwd())\n",
        encoding="utf-8",
    )

    parsed = parse_python_file(path, root=tmp_path)

    names = {symbol.qualified_name for symbol in parsed.symbols}
    assert "pkg.service.Base" in names
    assert "pkg.service.Service" in names
    assert "pkg.service.Service.run" in names
    assert any(record.module == "os" and record.alias == "operating_system" for record in parsed.imports)
    assert any(record.module == "pathlib" and record.imported_name == "Path" for record in parsed.imports)
    assert any(relation.relation_type == "inherits" for relation in parsed.relations)


def test_python_parser_generates_unique_call_relation_ids_for_chained_calls(tmp_path):
    path = tmp_path / "factory.py"
    path.write_text(
        "def build_manager():\n"
        "    return type('PM', (), {'status': lambda self: 'ok'})()\n",
        encoding="utf-8",
    )

    parsed = parse_python_file(path, root=tmp_path)

    relation_ids = [relation.id for relation in parsed.relations if relation.relation_type == "calls_best_effort"]
    assert len(relation_ids) == 2
    assert len(set(relation_ids)) == 2
