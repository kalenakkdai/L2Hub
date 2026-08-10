"""Speaker attribution for Messenger captures.

Each person who contributed to the chat gets a stable color, the way Google
Docs colors edit history, so the generated agenda can highlight who said what.
"""

from __future__ import annotations

import re
from collections.abc import Iterable
from dataclasses import dataclass

# Accent (text / border) paired with a light highlight fill. Chosen for
# contrast on the light surface the agenda renders on.
PALETTE: tuple[tuple[str, str], ...] = (
    ("#1d4ed8", "#dbeafe"),  # blue
    ("#b45309", "#fef3c7"),  # amber
    ("#047857", "#d1fae5"),  # emerald
    ("#be123c", "#ffe4e6"),  # rose
    ("#6d28d9", "#ede9fe"),  # violet
    ("#0e7490", "#cffafe"),  # cyan
    ("#a16207", "#fef9c3"),  # yellow
    ("#4d7c0f", "#ecfccb"),  # lime
)

# Strips "[10:04 AM]" / "10:04" / "(10:04 PM)" before a speaker name.
_TIMESTAMP_PREFIX = re.compile(
    r"^\s*(?:\[[^\]]{1,32}\]|\(?\d{1,2}:\d{2}(?::\d{2})?\s*(?:[AaPp]\.?[Mm]\.?)?\)?)\s*[-–—]?\s*"
)
_SPEAKER_LINE = re.compile(r"^(?P<name>[^:\n]{1,40}?)\s*:\s*(?P<text>.*)$")
# A speaker label is a short name, not a sentence and not a URL scheme.
_NOT_A_NAME = re.compile(r"[.!?,;]|https?$|\bwww$", re.IGNORECASE)


@dataclass(frozen=True, slots=True)
class Utterance:
    """One chat line, with its speaker when the line was attributed."""

    speaker: str | None
    text: str


@dataclass(frozen=True, slots=True)
class Contributor:
    name: str
    color: str
    highlight: str
    initials: str
    line_count: int


def _looks_like_name(candidate: str) -> bool:
    name = candidate.strip()
    if not name or len(name) > 40:
        return False
    if _NOT_A_NAME.search(name):
        return False
    # "Kalena", "Mr. Jan" (dot already rejected), "Jadon Li", "Sam O" — at most
    # three words keeps prose like "one more thing" from becoming a speaker.
    return len(name.split()) <= 3


def parse_utterances(text: str) -> list[Utterance]:
    """Split captured chat text into speaker-attributed lines.

    Unattributed lines inherit the previous speaker, which is how multi-line
    Messenger messages paste.
    """
    utterances: list[Utterance] = []
    last_speaker: str | None = None
    for raw_line in text.splitlines():
        line = _TIMESTAMP_PREFIX.sub("", raw_line).strip()
        if not line:
            continue
        match = _SPEAKER_LINE.match(line)
        if match and _looks_like_name(match.group("name")):
            speaker = " ".join(match.group("name").split())
            body = match.group("text").strip()
            last_speaker = speaker
            if body:
                utterances.append(Utterance(speaker=speaker, text=body))
            continue
        utterances.append(Utterance(speaker=last_speaker, text=line))
    return utterances


def _initials(name: str) -> str:
    parts = [part for part in re.split(r"\s+", name.strip()) if part]
    if not parts:
        return "?"
    if len(parts) == 1:
        return parts[0][:2].upper()
    return (parts[0][0] + parts[-1][0]).upper()


def collect_contributors(utterances: Iterable[Utterance]) -> list[Contributor]:
    """Named contributors in first-appearance order, each with its own color."""
    counts: dict[str, int] = {}
    for utterance in utterances:
        if utterance.speaker:
            counts[utterance.speaker] = counts.get(utterance.speaker, 0) + 1

    contributors: list[Contributor] = []
    for index, (name, count) in enumerate(counts.items()):
        color, highlight = PALETTE[index % len(PALETTE)]
        contributors.append(
            Contributor(
                name=name,
                color=color,
                highlight=highlight,
                initials=_initials(name),
                line_count=count,
            )
        )
    return contributors


def contributors_to_dicts(contributors: Iterable[Contributor]) -> list[dict]:
    return [
        {
            "name": c.name,
            "color": c.color,
            "highlight": c.highlight,
            "initials": c.initials,
            "lineCount": c.line_count,
        }
        for c in contributors
    ]
