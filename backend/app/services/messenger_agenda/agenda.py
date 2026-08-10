"""Deterministic meeting-agenda generation from a Messenger capture window."""

from __future__ import annotations

import re
from dataclasses import dataclass

_SENTENCE_SPLIT = re.compile(r"(?<=[.!?])\s+")
_DECISION = re.compile(
    r"\b(decid(?:e|ed|ing)|agreed|agreement|we will|we'll|resolved|approve[ds]?)\b",
    re.IGNORECASE,
)
_ACTION = re.compile(
    r"\b(action item|todo|to-do|follow[- ]?up|will (?:do|handle|send|update|create)|"
    r"assigned to|please|need to|should|@)\b",
    re.IGNORECASE,
)
_ATTENDEE = re.compile(
    r"\b(present|attending|here:|who'?s here|attendees?)\b",
    re.IGNORECASE,
)


@dataclass(frozen=True, slots=True)
class AgendaSection:
    title: str
    bullets: tuple[str, ...]


@dataclass(frozen=True, slots=True)
class GeneratedAgenda:
    title: str
    summary: str
    goals: tuple[str, ...]
    sections: tuple[AgendaSection, ...]


def _sentences(text: str) -> list[str]:
    cleaned = " ".join(text.split())
    if not cleaned:
        return []
    return [part.strip() for part in _SENTENCE_SPLIT.split(cleaned) if part.strip()]


def _lines(text: str) -> list[str]:
    return [line.strip() for line in text.splitlines() if line.strip()]


def generate_agenda(*, session_title: str, captured_text: str) -> GeneratedAgenda:
    """Build a Winter Ball–style agenda outline without a paid LLM."""
    lines = _lines(captured_text)
    sentences = _sentences(captured_text)
    title = session_title.strip() or (
        lines[0][:80] if lines else "Leadership meeting agenda"
    )

    if not lines and not sentences:
        return GeneratedAgenda(
            title=title,
            summary="No chat content was captured between the start and end keywords.",
            goals=(),
            sections=(
                AgendaSection("Attendees", ()),
                AgendaSection("To-do before meeting", ()),
                AgendaSection("Agenda / Meeting Notes", ()),
                AgendaSection("Key decisions", ()),
                AgendaSection("Action items", ()),
            ),
        )

    summary = " ".join(sentences[:3]) if sentences else " ".join(lines[:2])
    goals = tuple(s for s in sentences if re.search(r"\bgoal|objective|aim\b", s, re.IGNORECASE))[
        :5
    ]
    if not goals:
        goals = tuple(lines[:3])

    attendee_lines = tuple(line for line in lines if _ATTENDEE.search(line))[:8]
    decisions = tuple(s for s in sentences if _DECISION.search(s))[:8]
    actions = tuple(s for s in sentences if _ACTION.search(s))[:10]
    notes = tuple(lines[:12])

    return GeneratedAgenda(
        title=title,
        summary=summary,
        goals=goals,
        sections=(
            AgendaSection("Attendees", attendee_lines),
            AgendaSection(
                "To-do before meeting",
                actions[:4] if actions else ("Confirm owners before adjourning",),
            ),
            AgendaSection("Agenda / Meeting Notes", notes),
            AgendaSection("Key decisions", decisions),
            AgendaSection("Action items", actions),
        ),
    )


def agenda_to_dict(agenda: GeneratedAgenda) -> dict:
    return {
        "title": agenda.title,
        "summary": agenda.summary,
        "goals": list(agenda.goals),
        "sections": [
            {"title": section.title, "bullets": list(section.bullets)}
            for section in agenda.sections
        ],
    }
