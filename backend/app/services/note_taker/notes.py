"""Deterministic meeting-note generation from a raw transcript."""

from __future__ import annotations

import re
from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class NoteSection:
    title: str
    bullets: tuple[str, ...]


@dataclass(frozen=True, slots=True)
class GeneratedMeetingNote:
    title: str
    summary: str
    sections: tuple[NoteSection, ...]


_SENTENCE_SPLIT = re.compile(r"(?<=[.!?])\s+")
_DECISION = re.compile(
    r"\b(decid(?:e|ed|ing)|agreed|agreement|we will|we'll|resolved|approve[ds]?)\b",
    re.IGNORECASE,
)
_ACTION = re.compile(
    r"\b(action item|todo|to-do|follow[- ]?up|will (?:do|handle|send|update|create)|"
    r"assigned to|please|need to|should)\b",
    re.IGNORECASE,
)


def _sentences(text: str) -> list[str]:
    cleaned = " ".join(text.split())
    if not cleaned:
        return []
    parts = _SENTENCE_SPLIT.split(cleaned)
    return [part.strip() for part in parts if part.strip()]


def generate_meeting_note(*, session_title: str, transcript: str) -> GeneratedMeetingNote:
    """Build an Otter-style structured note without a paid LLM."""
    sentences = _sentences(transcript)
    title = session_title.strip() or (sentences[0][:80] if sentences else "Meeting notes")

    if not sentences:
        return GeneratedMeetingNote(
            title=title,
            summary="No speech was detected in this recording.",
            sections=(
                NoteSection("Key points", ()),
                NoteSection("Key decisions", ()),
                NoteSection("Action items", ()),
                NoteSection("Open questions", ()),
            ),
        )

    summary = " ".join(sentences[:3])
    key_points = tuple(sentences[:8])
    decisions = tuple(s for s in sentences if _DECISION.search(s))[:8]
    actions = tuple(s for s in sentences if _ACTION.search(s))[:8]
    questions = tuple(s for s in sentences if "?" in s)[:8]

    # Fallbacks so the note is never an empty shell when speech exists.
    if not decisions:
        decisions = ()
    if not actions:
        actions = ()
    if not questions:
        questions = ()

    return GeneratedMeetingNote(
        title=title,
        summary=summary,
        sections=(
            NoteSection("Key points", key_points),
            NoteSection("Key decisions", decisions),
            NoteSection("Action items", actions),
            NoteSection("Open questions", questions),
        ),
    )
