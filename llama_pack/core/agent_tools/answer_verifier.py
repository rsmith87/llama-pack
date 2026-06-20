from __future__ import annotations

import re
from dataclasses import dataclass

from llama_pack.core.code_graph.tools import ProjectGraphToolContext


_PATH_RE = re.compile(r"`?((?:[A-Za-z0-9_.-]+/)+[A-Za-z0-9_.-]+(?:\.[A-Za-z0-9_]+)?)`?")
_QUALIFIED_SYMBOL_RE = re.compile(r"\b([A-Z][A-Za-z0-9_]+(?:\.[A-Za-z_][A-Za-z0-9_]+)+)\b")
_CLASS_SYMBOL_RE = re.compile(r"\b([A-Z][A-Za-z0-9_]*[a-z][A-Z][A-Za-z0-9_]*)\b")


@dataclass(frozen=True)
class AnswerClaims:
    paths: list[str]
    symbols: list[str]


@dataclass(frozen=True)
class AnswerVerificationReport:
    ok: bool
    verified_paths: list[str]
    missing_paths: list[str]
    verified_symbols: list[str]
    missing_symbols: list[str]

    def feedback(self) -> str:
        parts: list[str] = []
        if self.missing_paths:
            parts.append("Missing file paths: " + ", ".join(self.missing_paths))
        if self.missing_symbols:
            parts.append("Missing symbols: " + ", ".join(self.missing_symbols))
        return "\n".join(parts)


class AnswerVerifier:
    def __init__(self, context: ProjectGraphToolContext) -> None:
        self.context = context

    def verify(self, answer: str) -> AnswerVerificationReport:
        claims = extract_answer_claims(answer)
        verified_paths: list[str] = []
        missing_paths: list[str] = []
        verified_symbols: list[str] = []
        missing_symbols: list[str] = []
        for path in claims.paths:
            if self._path_exists(path):
                verified_paths.append(path)
            else:
                missing_paths.append(path)
        for symbol in claims.symbols:
            if self._symbol_exists(symbol):
                verified_symbols.append(symbol)
            else:
                missing_symbols.append(symbol)
        return AnswerVerificationReport(
            ok=not missing_paths and not missing_symbols,
            verified_paths=verified_paths,
            missing_paths=missing_paths,
            verified_symbols=verified_symbols,
            missing_symbols=missing_symbols,
        )

    def _path_exists(self, path: str) -> bool:
        active = self.context.store.get_active_snapshot(self.context.project_id)
        if active is None:
            return False
        graph = self.context.store.export_snapshot_graph(str(active["id"]))
        files = graph.get("files") or []
        return any(isinstance(item, dict) and item.get("path") == path for item in files)

    def _symbol_exists(self, symbol: str) -> bool:
        if self.context.store.find_symbols(project_id=self.context.project_id, query=symbol, kind=None):
            return True
        leaf = symbol.rsplit(".", 1)[-1]
        return bool(self.context.store.find_symbols(project_id=self.context.project_id, query=leaf, kind=None))


def extract_answer_claims(answer: str) -> AnswerClaims:
    paths = _unique(_PATH_RE.findall(answer))
    symbols = _unique([*_QUALIFIED_SYMBOL_RE.findall(answer), *_CLASS_SYMBOL_RE.findall(answer)])
    return AnswerClaims(paths=paths, symbols=symbols)


def _unique(values: list[str]) -> list[str]:
    seen: set[str] = set()
    unique_values: list[str] = []
    for value in values:
        if value in seen:
            continue
        seen.add(value)
        unique_values.append(value)
    return unique_values
