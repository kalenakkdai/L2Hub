"""Letter-grade bands shared by the gradebook and A+-gated features."""

from __future__ import annotations

from typing import Final

# Matches frontend/src/features/grades/utils/letterGrade.ts
A_PLUS_MIN: Final[float] = 97.0


def letter_grade(percent: float | None) -> str | None:
    """Map a 0–100 weighted percent onto a letter band."""
    if percent is None:
        return None
    p = max(0.0, min(100.0, float(percent)))
    if p >= 97:
        return "A+"
    if p >= 93:
        return "A"
    if p >= 90:
        return "A−"
    if p >= 80:
        return "B"
    if p >= 70:
        return "C"
    if p >= 60:
        return "D"
    return "F"


def is_a_plus(percent: float | None) -> bool:
    if percent is None:
        return False
    return float(percent) >= A_PLUS_MIN
