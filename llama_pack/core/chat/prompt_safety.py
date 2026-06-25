from __future__ import annotations

from dataclasses import dataclass
import re


@dataclass(frozen=True)
class PromptSafetyViolation:
    kind: str
    path: str


class PromptSafetyViolationError(ValueError):
    def __init__(self, violations: list[PromptSafetyViolation]) -> None:
        kinds = ", ".join(sorted({violation.kind for violation in violations}))
        super().__init__(f"Prompt contains sensitive data: {kinds}")
        self.violations = violations


def prompt_safety_http_detail(exc: PromptSafetyViolationError) -> dict[str, object]:
    return {
        "error_type": "prompt_safety_violation",
        "message": "Prompt contains sensitive data and was not sent to the model.",
        "violations": [
            {"kind": violation.kind, "path": violation.path}
            for violation in exc.violations
        ],
    }


class PromptSafetyScanner:
    _credit_card_candidate = re.compile(r"(?<!\d)(?:\d[ -]?){13,19}(?!\d)")
    _ssn_candidate = re.compile(r"(?<!\d)(\d{3})-(\d{2})-(\d{4})(?!\d)")
    _api_key_candidates = [
        re.compile(r"(?i)\b(?:api[_-]?key|access[_-]?token|secret[_-]?key|authorization)\s*[:=]\s*Bearer\s+[A-Za-z0-9._~+/=-]{16,}"),
        re.compile(r"(?i)\b(?:api[_-]?key|access[_-]?token|secret[_-]?key)\s*[:=]\s*[A-Za-z0-9._~+/=-]{24,}"),
        re.compile(r"\bsk-[A-Za-z0-9_-]{24,}"),
        re.compile(r"\bghp_[A-Za-z0-9_]{24,}"),
        re.compile(r"\bhf_[A-Za-z0-9]{24,}"),
    ]

    def require_safe_messages(self, messages: list[dict[str, object]]) -> None:
        violations = self.scan_messages(messages)
        if violations:
            raise PromptSafetyViolationError(violations)

    def scan_messages(self, messages: list[dict[str, object]]) -> list[PromptSafetyViolation]:
        violations: list[PromptSafetyViolation] = []
        for message_index, message in enumerate(messages):
            content = message.get("content")
            violations.extend(self._scan_content(content, f"messages[{message_index}].content"))
        return violations

    def _scan_content(self, content: object, path: str) -> list[PromptSafetyViolation]:
        if isinstance(content, str):
            return self._scan_text(content, path)
        if isinstance(content, list):
            violations: list[PromptSafetyViolation] = []
            for part_index, part in enumerate(content):
                if isinstance(part, dict):
                    text = part.get("text")
                    if isinstance(text, str):
                        violations.extend(self._scan_text(text, f"{path}[{part_index}].text"))
            return violations
        return []

    def _scan_text(self, text: str, path: str) -> list[PromptSafetyViolation]:
        violations: list[PromptSafetyViolation] = []
        if self._contains_credit_card(text):
            violations.append(PromptSafetyViolation(kind="credit_card", path=path))
        if self._contains_ssn(text):
            violations.append(PromptSafetyViolation(kind="ssn", path=path))
        if self._contains_api_key(text):
            violations.append(PromptSafetyViolation(kind="api_key", path=path))
        return violations

    def _contains_credit_card(self, text: str) -> bool:
        for match in self._credit_card_candidate.finditer(text):
            digits = re.sub(r"\D", "", match.group(0))
            if 13 <= len(digits) <= 19 and self._luhn_valid(digits):
                return True
        return False

    def _contains_ssn(self, text: str) -> bool:
        for match in self._ssn_candidate.finditer(text):
            area = match.group(1)
            group = match.group(2)
            serial = match.group(3)
            if area == "000" or area == "666" or area.startswith("9"):
                continue
            if group == "00" or serial == "0000":
                continue
            return True
        return False

    def _contains_api_key(self, text: str) -> bool:
        return any(candidate.search(text) is not None for candidate in self._api_key_candidates)

    def _luhn_valid(self, digits: str) -> bool:
        total = 0
        reversed_digits = list(reversed(digits))
        for index, character in enumerate(reversed_digits):
            value = int(character)
            if index % 2 == 1:
                value *= 2
                if value > 9:
                    value -= 9
            total += value
        return total % 10 == 0
