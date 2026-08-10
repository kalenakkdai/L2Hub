"""Deterministic meeting-agenda generation from a Messenger capture window.

Every bullet keeps the name of the person whose message it came from so the
agenda can highlight contributions per person.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

from app.services.messenger_agenda.contributors import (
    Contributor,
    Utterance,
    collect_contributors,
    parse_utterances,
)
from app.services.messenger_agenda.keywords import (
    DEFAULT_END_KEYWORD,
    DEFAULT_START_KEYWORD,
)

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
_GOAL = re.compile(r"\b(goal|objective|aim)\b", re.IGNORECASE)


@dataclass(frozen=True, slots=True)
class AgendaBullet:
    text: str
    speaker: str | None = None


@dataclass(frozen=True, slots=True)
class AgendaSection:
    title: str
    bullets: tuple[AgendaBullet, ...]


@dataclass(frozen=True, slots=True)
class GeneratedAgenda:
    title: str
    summary: str
    goals: tuple[AgendaBullet, ...]
    sections: tuple[AgendaSection, ...]
    contributors: tuple[Contributor, ...]


def _sentence_bullets(utterances: list[Utterance]) -> list[AgendaBullet]:
    """Sentences with the speaker of the message they came from."""
    bullets: list[AgendaBullet] = []
    for utterance in utterances:
        cleaned = " ".join(utterance.text.split())
        if not cleaned:
            continue
        for part in _SENTENCE_SPLIT.split(cleaned):
            sentence = part.strip()
            if sentence:
                bullets.append(AgendaBullet(text=sentence, speaker=utterance.speaker))
    return bullets


def _empty_agenda(title: str) -> GeneratedAgenda:
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
        contributors=(),
    )


def _is_keyword_only(text: str, keywords: tuple[str, ...]) -> bool:
    normalized = " ".join(text.lower().split())
    return any(normalized == " ".join(k.lower().split()) for k in keywords if k)


def generate_agenda(
    *,
    session_title: str,
    captured_text: str,
    start_keyword: str = DEFAULT_START_KEYWORD,
    end_keyword: str = DEFAULT_END_KEYWORD,
) -> GeneratedAgenda:
    """Build a Winter Ball–style agenda outline without a paid LLM."""
    keywords = (start_keyword, end_keyword)
    utterances = [
        u
        for u in parse_utterances(captured_text)
        if not _is_keyword_only(u.text, keywords)
    ]
    line_bullets = [
        AgendaBullet(text=u.text, speaker=u.speaker) for u in utterances if u.text
    ]
    sentence_bullets = _sentence_bullets(utterances)
    title = session_title.strip() or (
        line_bullets[0].text[:80] if line_bullets else "Leadership meeting agenda"
    )

    if not line_bullets:
        return _empty_agenda(title)

    contributors = tuple(collect_contributors(utterances))
    summary = " ".join(b.text for b in sentence_bullets[:3])
    goals = tuple(b for b in sentence_bullets if _GOAL.search(b.text))[:5]
    if not goals:
        goals = tuple(line_bullets[:3])

    attendees = tuple(b for b in line_bullets if _ATTENDEE.search(b.text))[:8]
    decisions = tuple(b for b in sentence_bullets if _DECISION.search(b.text))[:8]
    actions = tuple(b for b in sentence_bullets if _ACTION.search(b.text))[:10]
    notes = tuple(line_bullets[:12])

    # When nobody typed an explicit roll call, the contributor list is the
    # attendance record — everyone who spoke in the window.
    if not attendees and contributors:
        attendees = tuple(
            AgendaBullet(text=c.name, speaker=c.name) for c in contributors
        )

    return GeneratedAgenda(
        title=title,
        summary=summary,
        goals=goals,
        sections=(
            AgendaSection("Attendees", attendees),
            AgendaSection(
                "To-do before meeting",
                actions[:4]
                if actions
                else (AgendaBullet(text="Confirm owners before adjourning"),),
            ),
            AgendaSection("Agenda / Meeting Notes", notes),
            AgendaSection("Key decisions", decisions),
            AgendaSection("Action items", actions),
        ),
        contributors=contributors,
    )


def bullets_to_dicts(bullets: tuple[AgendaBullet, ...]) -> list[dict]:
    return [{"text": b.text, "speaker": b.speaker} for b in bullets]


def agenda_to_dict(agenda: GeneratedAgenda) -> dict:
    return {
        "title": agenda.title,
        "summary": agenda.summary,
        "goals": bullets_to_dicts(agenda.goals),
        "sections": [
            {"title": section.title, "bullets": bullets_to_dicts(section.bullets)}
            for section in agenda.sections
        ],
    }


def bullets_from_payload(raw: object) -> list[AgendaBullet]:
    """Read bullets back out of stored JSON, tolerating pre-attribution rows."""
    if not isinstance(raw, list):
        return []
    bullets: list[AgendaBullet] = []
    for item in raw:
        if isinstance(item, str) and item.strip():
            bullets.append(AgendaBullet(text=item.strip()))
        elif isinstance(item, dict):
            text = str(item.get("text") or "").strip()
            if not text:
                continue
            speaker = item.get("speaker")
            bullets.append(
                AgendaBullet(
                    text=text,
                    speaker=str(speaker) if isinstance(speaker, str) else None,
                )
            )
    return bullets
