"""Auto-generated names for meeting documents.

Names are suggestions only — the owner can rename a meeting afterwards, so the
generator optimises for being recognisable in a timeline rather than clever.
"""

from __future__ import annotations

from datetime import datetime

MAX_TITLE_LENGTH = 200


def _short_date(when: datetime) -> str:
    """M.D.YYYY, matching the Winter Ball agenda convention used elsewhere."""
    return f"{when.month}.{when.day}.{when.year}"


def suggest_meeting_title(
    *,
    event_name: str | None,
    sequence: int,
    when: datetime,
) -> str:
    """Build a default document name.

    `sequence` is 1-based: the nth meeting recorded against this event.
    """
    ordinal = max(1, int(sequence))
    stem = (event_name or "").strip()
    if stem:
        title = f"{stem} · Meeting {ordinal} · {_short_date(when)}"
    else:
        title = f"Leadership meeting {ordinal} · {_short_date(when)}"
    return title[:MAX_TITLE_LENGTH]
