import re
from dataclasses import dataclass
from enum import StrEnum

_OPEN_QUESTION_RE = re.compile(r"^OQ-\d{3}$")


class Severity(StrEnum):
    HARD = "hard"
    SOFT = "soft"
    NEEDS_INPUT = "needs_input"


@dataclass(frozen=True)
class Violation:
    rule_id: str
    severity: Severity
    message: str
    source_section: str
    subject_ids: tuple[str, ...]
    measured: float | None = None
    required: float | None = None
    open_question_id: str | None = None

    def __post_init__(self) -> None:
        if not self.source_section.strip():
            raise ValueError("source_section is required")
        if self.severity is Severity.NEEDS_INPUT:
            if self.open_question_id is None:
                raise ValueError("needs_input violations require open_question_id")
            if _OPEN_QUESTION_RE.fullmatch(self.open_question_id) is None:
                raise ValueError("open_question_id must match OQ-xxx")


@dataclass(frozen=True)
class RuleResult:
    violations: tuple[Violation, ...]
    rules_version: str

    @property
    def passes_hard(self) -> bool:
        return not any(
            violation.severity in {Severity.HARD, Severity.NEEDS_INPUT}
            for violation in self.violations
        )
