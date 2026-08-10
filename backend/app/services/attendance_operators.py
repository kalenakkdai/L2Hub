"""Who may open and operate the Leadership attendance kiosk.

Only Mr. Jan (AC) and Jadon Li (ASB President) may see `/attendance` and call
`attendance.manage_all` APIs. Role bundles alone are not enough — other AC/ASBO
accounts stay locked out.
"""

from __future__ import annotations

import re

from app.models.profile import Profile

# Login emails (lowercase).
ATTENDANCE_OPERATOR_EMAILS: frozenset[str] = frozenset(
    {
        "ac@l2hub.local",  # seed / local Mr. Jan
        "jadonli2020@gmail.com",  # Jadon Li
    }
)

# Normalized full names (parentheticals stripped, lowercased).
ATTENDANCE_OPERATOR_NAMES: frozenset[str] = frozenset(
    {
        "mr jan",
        "jadon li",
    }
)


def _normalize_name(name: str) -> str:
    cleaned = re.sub(r"\([^)]*\)", "", name or "")
    return " ".join(cleaned.lower().split())


def is_attendance_operator(profile: Profile) -> bool:
    email = (getattr(profile, "email", None) or "").strip().lower()
    if email in ATTENDANCE_OPERATOR_EMAILS:
        return True
    return _normalize_name(getattr(profile, "full_name", None) or "") in ATTENDANCE_OPERATOR_NAMES
