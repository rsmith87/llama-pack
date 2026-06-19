from __future__ import annotations

import ast
import hashlib
from pathlib import Path

from llama_pack.core.code_graph.models import GraphFileRecord, GraphImportRecord, GraphRelationRecord, GraphSymbolRecord, ParsedGraphFile


def parse_python_file(path: Path, root: Path) -> ParsedGraphFile:
    content = path.read_text(encoding="utf-8")
    relative_path = path.resolve().relative_to(root.resolve()).as_posix()
    module_name = _module_name(relative_path)
    stat = path.stat()
    file_id = _id("file", relative_path)
    tree = ast.parse(content, filename=str(path))
    visitor = _PythonGraphVisitor(module_name=module_name, file_id=file_id)
    visitor.visit(tree)
    file_record = GraphFileRecord(
        id=file_id,
        path=relative_path,
        language="python",
        content_hash=hashlib.sha256(content.encode("utf-8")).hexdigest(),
        size_bytes=stat.st_size,
        mtime_ns=stat.st_mtime_ns,
        parse_status="parsed",
        parse_error=None,
    )
    return ParsedGraphFile(file=file_record, symbols=visitor.symbols, imports=visitor.imports, relations=visitor.relations)


class _PythonGraphVisitor(ast.NodeVisitor):
    def __init__(self, module_name: str, file_id: str) -> None:
        self.module_name = module_name
        self.file_id = file_id
        self.symbols: list[GraphSymbolRecord] = []
        self.imports: list[GraphImportRecord] = []
        self.relations: list[GraphRelationRecord] = []
        self._scope: list[str] = []
        self._symbol_ids_by_name: dict[str, str] = {}

    def visit_Import(self, node: ast.Import) -> None:
        for alias in node.names:
            self.imports.append(
                GraphImportRecord(
                    id=_id("import", self.module_name, str(node.lineno), alias.name, alias.asname or ""),
                    file_id=self.file_id,
                    module=alias.name,
                    imported_name=None,
                    alias=alias.asname,
                    resolved_file_id=None,
                    confidence=1.0,
                )
            )

    def visit_ImportFrom(self, node: ast.ImportFrom) -> None:
        module = "." * int(node.level or 0) + str(node.module or "")
        for alias in node.names:
            self.imports.append(
                GraphImportRecord(
                    id=_id("import", self.module_name, str(node.lineno), module, alias.name, alias.asname or ""),
                    file_id=self.file_id,
                    module=module,
                    imported_name=alias.name,
                    alias=alias.asname,
                    resolved_file_id=None,
                    confidence=1.0,
                )
            )

    def visit_ClassDef(self, node: ast.ClassDef) -> None:
        qualified_name = self._qualified_name(node.name)
        symbol_id = self._add_symbol(node, qualified_name, node.name, "class", _class_signature(node), exported=not node.name.startswith("_"))
        for base in node.bases:
            base_name = _name_for_expr(base)
            if base_name is None:
                continue
            self.relations.append(
                GraphRelationRecord(
                    id=_id("relation", symbol_id, "inherits", base_name, str(node.lineno)),
                    source_symbol_id=symbol_id,
                    target_symbol_id=self._symbol_ids_by_name.get(base_name),
                    source_file_id=self.file_id,
                    target_file_id=self.file_id if base_name in self._symbol_ids_by_name else None,
                    relation_type="inherits",
                    start_line=node.lineno,
                    end_line=node.lineno,
                    confidence=0.8 if base_name in self._symbol_ids_by_name else 0.4,
                    evidence={"base": base_name},
                )
            )
        self._scope.append(node.name)
        for child in node.body:
            self.visit(child)
        self._scope.pop()

    def visit_FunctionDef(self, node: ast.FunctionDef) -> None:
        self._visit_function(node)

    def visit_AsyncFunctionDef(self, node: ast.AsyncFunctionDef) -> None:
        self._visit_function(node)

    def _visit_function(self, node: ast.FunctionDef | ast.AsyncFunctionDef) -> None:
        qualified_name = self._qualified_name(node.name)
        kind = "method" if self._scope else "function"
        symbol_id = self._add_symbol(node, qualified_name, node.name, kind, _function_signature(node), exported=not node.name.startswith("_"))
        for decorator in node.decorator_list:
            route = _route_for_decorator(decorator)
            if route is None:
                continue
            self.relations.append(
                GraphRelationRecord(
                    id=_id("relation", symbol_id, "route_handles", route, str(node.lineno)),
                    source_symbol_id=symbol_id,
                    target_symbol_id=None,
                    source_file_id=self.file_id,
                    target_file_id=None,
                    relation_type="route_handles",
                    start_line=node.lineno,
                    end_line=node.lineno,
                    confidence=1.0,
                    evidence={"route": route},
                )
            )
        self._scope.append(node.name)
        for child in node.body:
            self.visit(child)
        self._scope.pop()

    def visit_Call(self, node: ast.Call) -> None:
        if not self._scope:
            return
        name = _name_for_expr(node.func)
        if name is not None:
            current_qualified_name = ".".join([self.module_name, *self._scope])
            current_symbol_id = _id("symbol", current_qualified_name)
            self.relations.append(
                GraphRelationRecord(
                    id=_id("relation", current_symbol_id, "calls_best_effort", name, str(node.lineno), str(node.col_offset)),
                    source_symbol_id=current_symbol_id,
                    target_symbol_id=self._symbol_ids_by_name.get(name),
                    source_file_id=self.file_id,
                    target_file_id=self.file_id if name in self._symbol_ids_by_name else None,
                    relation_type="calls_best_effort",
                    start_line=node.lineno,
                    end_line=getattr(node, "end_lineno", node.lineno),
                    confidence=0.7 if name in self._symbol_ids_by_name else 0.35,
                    evidence={"call": name},
                )
            )
        self.generic_visit(node)

    def _add_symbol(
        self,
        node: ast.ClassDef | ast.FunctionDef | ast.AsyncFunctionDef,
        qualified_name: str,
        name: str,
        kind: str,
        signature: str,
        exported: bool,
    ) -> str:
        symbol_id = _id("symbol", qualified_name)
        self.symbols.append(
            GraphSymbolRecord(
                id=symbol_id,
                file_id=self.file_id,
                qualified_name=qualified_name,
                name=name,
                kind=kind,
                language="python",
                start_line=node.lineno,
                end_line=getattr(node, "end_lineno", node.lineno),
                signature=signature,
                doc_summary=ast.get_docstring(node),
                exported=exported,
                confidence=1.0,
            )
        )
        self._symbol_ids_by_name[name] = symbol_id
        self._symbol_ids_by_name[qualified_name] = symbol_id
        return symbol_id

    def _qualified_name(self, name: str) -> str:
        parts = [self.module_name, *self._scope, name]
        return ".".join(part for part in parts if part)


def _module_name(relative_path: str) -> str:
    without_suffix = relative_path[:-3] if relative_path.endswith(".py") else relative_path
    parts = [part for part in Path(without_suffix).parts if part != "__init__"]
    return ".".join(parts)


def _function_signature(node: ast.FunctionDef | ast.AsyncFunctionDef) -> str:
    prefix = "async def" if isinstance(node, ast.AsyncFunctionDef) else "def"
    args = [arg.arg for arg in node.args.args]
    return f"{prefix} {node.name}({', '.join(args)})"


def _class_signature(node: ast.ClassDef) -> str:
    bases = [_name_for_expr(base) for base in node.bases]
    rendered = ", ".join(base for base in bases if base is not None)
    return f"class {node.name}({rendered})" if rendered else f"class {node.name}"


def _route_for_decorator(node: ast.expr) -> str | None:
    if not isinstance(node, ast.Call):
        return None
    func = _name_for_expr(node.func)
    if func is None:
        return None
    method = func.rsplit(".", maxsplit=1)[-1]
    if method not in {"get", "post", "put", "patch", "delete", "options", "head"}:
        return None
    if not node.args or not isinstance(node.args[0], ast.Constant) or not isinstance(node.args[0].value, str):
        return method.upper()
    return f"{method.upper()} {node.args[0].value}"


def _name_for_expr(node: ast.expr) -> str | None:
    if isinstance(node, ast.Name):
        return node.id
    if isinstance(node, ast.Attribute):
        parent = _name_for_expr(node.value)
        return f"{parent}.{node.attr}" if parent else node.attr
    if isinstance(node, ast.Call):
        return _name_for_expr(node.func)
    return None


def _id(*parts: str) -> str:
    return hashlib.sha1("|".join(parts).encode("utf-8")).hexdigest()
