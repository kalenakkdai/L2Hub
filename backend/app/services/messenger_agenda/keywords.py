"""Start/end keyword detection for Messenger agenda capture windows."""

from __future__ import annotations

import re

DEFAULT_START_KEYWORD = "agenda start"
DEFAULT_END_KEYWORD = "agenda end"


def _normalize(text: str) -> str:
    return " ".join(text.lower().split())


def keyword_index(text: str, keyword: str) -> int | None:
    """Return character index of the first keyword match, or None."""
    haystack = _normalize(text)
    needle = _normalize(keyword)
    if not needle:
        return None
    idx = haystack.find(needle)
    return idx if idx >= 0 else None


def extract_capture_window(
    text: str,
    *,
    start_keyword: str = DEFAULT_START_KEYWORD,
    end_keyword: str = DEFAULT_END_KEYWORD,
    capturing: bool = False,
) -> tuple[str, bool, bool]:
    """Slice chat text between start and end keywords.

    Returns (captured_text, saw_start, saw_end).

    When `capturing` is True (button already pressed), text before the start
    keyword is still included once capture has begun — the start keyword only
    trims if it appears. End keyword always closes the window.
    """
    if not text.strip():
        return "", False, False

    lines = text.splitlines()
    start_re = re.compile(re.escape(_normalize(start_keyword)), re.IGNORECASE)
    end_re = re.compile(re.escape(_normalize(end_keyword)), re.IGNORECASE)

    collecting = capturing
    saw_start = capturing
    saw_end = False
    captured: list[str] = []

    for line in lines:
        normalized = _normalize(line)
        if not collecting and start_re.search(normalized):
            collecting = True
            saw_start = True
            # Drop the keyword line itself from the agenda body.
            remainder = start_re.sub("", normalized, count=1).strip()
            if remainder:
                captured.append(line)
            continue
        if collecting and end_re.search(normalized):
            saw_end = True
            break
        if collecting:
            captured.append(line)

    return "\n".join(captured).strip(), saw_start, saw_end


def contains_end_keyword(text: str, end_keyword: str = DEFAULT_END_KEYWORD) -> bool:
    return keyword_index(text, end_keyword) is not None
