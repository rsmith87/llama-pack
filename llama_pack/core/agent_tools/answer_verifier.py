from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path

from llama_pack.core.code_graph.tools import ProjectGraphToolContext


_PATH_RE = re.compile(r"`?((?:[A-Za-z0-9_.-]+/)+[A-Za-z0-9_.-]+(?:\.[A-Za-z0-9_]+)?)`?")
_QUALIFIED_SYMBOL_RE = re.compile(r"\b([A-Z][A-Za-z0-9_]+(?:\.[A-Za-z_][A-Za-z0-9_]+)+)\b")
_CLASS_SYMBOL_RE = re.compile(r"\b([A-Z][A-Za-z0-9_]*[a-z][A-Z][A-Za-z0-9_]*)\b")
_TRACE_HINT_RE = re.compile(r"(ordered call path|runtime path|handoff|from_symbol=|to_symbol=)", re.IGNORECASE)
_TEST_COVERAGE_HINT_RE = re.compile(r"(covering tests|tests cover|which tests cover|covered by|coverage)", re.IGNORECASE)
_TRACE_EDGE_RE = re.compile(
    r"from_symbol=(?P<from_symbol>\S+)\s+"
    r"to_symbol=(?P<to_symbol>\S+)\s+"
    r"file=(?P<file>\S+)\s+"
    r"(?P<line_label>line|lines)=(?P<line_value>\d+(?:-\d+)?)\s+"
    r"statement=(?P<quote>['\"])(?P<statement>.*?)(?P=quote)"
)


@dataclass(frozen=True)
class AnswerClaims:
    paths: list[str]
    symbols: list[str]


@dataclass(frozen=True)
class AnswerClaim:
    kind: str
    value: str
    start: int
    end: int
    excerpt: str


@dataclass(frozen=True)
class AnswerVerificationReport:
    ok: bool
    verified_paths: list[str]
    missing_paths: list[str]
    verified_symbols: list[str]
    missing_symbols: list[str]
    missing_source_evidence: bool
    missing_test_source_evidence: bool
    issues: list[dict[str, str | int]]

    def feedback(self) -> str:
        parts: list[str] = []
        if self.missing_source_evidence:
            parts.append("No project/source tool evidence was captured for these codebase claims.")
        if self.missing_test_source_evidence:
            parts.append("No test source tool evidence was captured for these test coverage claims.")
        if self.missing_paths:
            parts.append("Missing file paths: " + ", ".join(self.missing_paths))
        if self.missing_symbols:
            parts.append("Missing symbols: " + ", ".join(self.missing_symbols))
        unsupported_evidence = [str(issue["value"]) for issue in self.issues if issue["kind"] == "missing_source_evidence"]
        if unsupported_evidence:
            parts.append("Unsupported source evidence: " + ", ".join(unsupported_evidence))
        return "\n".join(parts)


class AnswerVerifier:
    def __init__(self, context: ProjectGraphToolContext) -> None:
        self.context = context

    def verify(
        self,
        answer: str,
        source_evidence_available: bool,
        test_source_evidence_available: bool,
    ) -> AnswerVerificationReport:
        claims = extract_answer_claims(answer)
        claim_spans = extract_answer_claim_spans(answer)
        verified_paths: list[str] = []
        missing_paths: list[str] = []
        verified_symbols: list[str] = []
        missing_symbols: list[str] = []
        issues: list[dict[str, str | int]] = []
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
        missing_source_evidence = bool(claims.paths or claims.symbols) and not source_evidence_available
        for claim in claim_spans:
            if claim.kind == "path" and claim.value in missing_paths:
                issues.append(_issue_from_claim("missing_path", claim))
            if claim.kind == "symbol" and claim.value in missing_symbols:
                issues.append(_issue_from_claim("missing_symbol", claim))
        trace_issues = self._trace_evidence_issues(answer)
        issues.extend(trace_issues)
        test_source_issues = self._test_source_evidence_issues(answer, claims.paths, test_source_evidence_available)
        issues.extend(test_source_issues)
        empty_answer_issues = _empty_answer_issues(answer)
        issues.extend(empty_answer_issues)
        return AnswerVerificationReport(
            ok=not missing_paths
            and not missing_symbols
            and not missing_source_evidence
            and not trace_issues
            and not test_source_issues
            and not empty_answer_issues,
            verified_paths=verified_paths,
            missing_paths=missing_paths,
            verified_symbols=verified_symbols,
            missing_symbols=missing_symbols,
            missing_source_evidence=missing_source_evidence,
            missing_test_source_evidence=bool(test_source_issues),
            issues=issues,
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

    def _trace_evidence_issues(self, answer: str) -> list[dict[str, str | int]]:
        hint = _TRACE_HINT_RE.search(answer)
        if hint is None:
            return []
        edges = list(_TRACE_EDGE_RE.finditer(answer))
        if not edges:
            return [
                {
                    "kind": "missing_source_evidence",
                    "value": "runtime trace edges",
                    "start": hint.start(1),
                    "end": hint.end(1),
                    "excerpt": hint.group(1),
                    "severity": "failed",
                }
            ]
        issues: list[dict[str, str | int]] = []
        for edge in edges:
            file_path = edge.group("file")
            statement = edge.group("statement")
            line_spec = f"{edge.group('line_label')}={edge.group('line_value')}"
            source_status = self._source_statement_status(file_path, edge.group("line_value"), statement)
            if source_status == "ok":
                continue
            if source_status == "wrong_line":
                issues.append(
                    {
                        "kind": "missing_source_evidence",
                        "value": line_spec,
                        "start": edge.start("line_label"),
                        "end": edge.end("line_value"),
                        "excerpt": line_spec,
                        "severity": "failed",
                    }
                )
                continue
            issues.append(
                {
                    "kind": "missing_source_evidence",
                    "value": statement,
                    "start": edge.start("statement"),
                    "end": edge.end("statement"),
                    "excerpt": statement,
                    "severity": "failed",
                }
            )
        return issues

    def _test_source_evidence_issues(
        self,
        answer: str,
        paths: list[str],
        test_source_evidence_available: bool,
    ) -> list[dict[str, str | int]]:
        if test_source_evidence_available:
            return []
        hint = _TEST_COVERAGE_HINT_RE.search(answer)
        if hint is None or not any(_is_test_path(path) for path in paths):
            return []
        return [
            {
                "kind": "missing_source_evidence",
                "value": "test coverage claims",
                "start": hint.start(1),
                "end": hint.end(1),
                "excerpt": hint.group(1),
                "severity": "failed",
            }
        ]

    def _source_statement_status(self, file_path: str, line_value: str, statement: str) -> str:
        active = self.context.store.get_active_snapshot(self.context.project_id)
        if active is None:
            return "missing_statement"
        root_path = active.get("root_path")
        if not isinstance(root_path, str) or not root_path.strip():
            return "missing_statement"
        source_path = (Path(root_path) / file_path).resolve()
        root = Path(root_path).resolve()
        if root not in source_path.parents and source_path != root:
            return "missing_statement"
        if not source_path.exists() or not source_path.is_file():
            return "missing_statement"
        content = source_path.read_text(encoding="utf-8")
        if statement not in content:
            return "missing_statement"
        line_span = _parse_line_span(line_value)
        if line_span is None:
            return "wrong_line"
        lines = content.splitlines()
        start_line, end_line = line_span
        if start_line > len(lines) or end_line > len(lines):
            return "wrong_line"
        selected = "\n".join(lines[start_line - 1:end_line])
        return "ok" if statement in selected else "wrong_line"


def extract_answer_claims(answer: str) -> AnswerClaims:
    paths = _unique(_PATH_RE.findall(answer))
    symbols = _unique([*_QUALIFIED_SYMBOL_RE.findall(answer), *_CLASS_SYMBOL_RE.findall(answer)])
    return AnswerClaims(paths=paths, symbols=symbols)


def extract_answer_claim_spans(answer: str) -> list[AnswerClaim]:
    claims: list[AnswerClaim] = []
    for match in _PATH_RE.finditer(answer):
        value = match.group(1)
        start = match.start(1)
        end = match.end(1)
        claims.append(AnswerClaim(kind="path", value=value, start=start, end=end, excerpt=match.group(0)))
    qualified_symbol_spans: list[tuple[int, int]] = []
    for match in _QUALIFIED_SYMBOL_RE.finditer(answer):
        value = match.group(1)
        start = match.start(1)
        end = match.end(1)
        qualified_symbol_spans.append((start, end))
        claims.append(AnswerClaim(kind="symbol", value=value, start=start, end=end, excerpt=match.group(0)))
    for match in _CLASS_SYMBOL_RE.finditer(answer):
        value = match.group(1)
        start = match.start(1)
        end = match.end(1)
        if _is_inside_span(start, end, qualified_symbol_spans):
            continue
        claims.append(AnswerClaim(kind="symbol", value=value, start=start, end=end, excerpt=match.group(0)))
    return _unique_claim_spans(claims)


def _issue_from_claim(kind: str, claim: AnswerClaim) -> dict[str, str | int]:
    return {
        "kind": kind,
        "value": claim.value,
        "start": claim.start,
        "end": claim.end,
        "excerpt": claim.excerpt,
        "severity": "failed",
    }


def _unique(values: list[str]) -> list[str]:
    seen: set[str] = set()
    unique_values: list[str] = []
    for value in values:
        if value in seen:
            continue
        seen.add(value)
        unique_values.append(value)
    return unique_values


def _is_test_path(path: str) -> bool:
    return path == "tests" or path.startswith("tests/") or "/tests/" in path


def _empty_answer_issues(answer: str) -> list[dict[str, str | int]]:
    if answer.strip():
        return []
    return [
        {
            "kind": "missing_source_evidence",
            "value": "assistant answer",
            "start": 0,
            "end": 0,
            "excerpt": "",
            "severity": "failed",
        }
    ]


def _unique_claim_spans(claims: list[AnswerClaim]) -> list[AnswerClaim]:
    seen: set[tuple[str, str, int, int]] = set()
    unique_claims: list[AnswerClaim] = []
    for claim in claims:
        key = (claim.kind, claim.value, claim.start, claim.end)
        if key in seen:
            continue
        seen.add(key)
        unique_claims.append(claim)
    return unique_claims


def _is_inside_span(start: int, end: int, spans: list[tuple[int, int]]) -> bool:
    return any(span_start <= start and end <= span_end for span_start, span_end in spans)


def _parse_line_span(value: str) -> tuple[int, int] | None:
    if "-" not in value:
        line = int(value)
        return (line, line) if line >= 1 else None
    raw_start, raw_end = value.split("-", 1)
    start = int(raw_start)
    end = int(raw_end)
    if start < 1 or end < start:
        return None
    return start, end
