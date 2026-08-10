"""Map agenda action lines onto committee assignment drafts."""

from __future__ import annotations

import re
from dataclasses import dataclass

# Keyword → committee slug used by the L2 Board / planning mock.
_COMMITTEE_HINTS: tuple[tuple[re.Pattern[str], str, str], ...] = (
    (re.compile(r"\b(publicit|flyer|poster|instagram|reel|graphics?)\b", re.IGNORECASE), "publicity", "Publicity"),
    (re.compile(r"\b(spirit|cheer|rally|chant)\b", re.IGNORECASE), "spirit", "Spirit"),
    (re.compile(r"\b(communit|service|volunteer)\b", re.IGNORECASE), "community", "Community"),
    (re.compile(r"\b(event|venue|setup|station|check[- ]?in)\b", re.IGNORECASE), "events", "Events"),
    (re.compile(r"\b(tech|sound|av|mic|speaker)\b", re.IGNORECASE), "tech", "Tech"),
    (re.compile(r"\b(budget|money|purchas|finance|treasur)\b", re.IGNORECASE), "finance", "Finance"),
    (re.compile(r"\b(sports?|athlet)\b", re.IGNORECASE), "sports", "Sports"),
    (re.compile(r"\b(decor|theme|balloon)\b", re.IGNORECASE), "decor", "Decor"),
)


@dataclass(frozen=True, slots=True)
class AssignmentDraft:
    role_label: str
    committee_slug: str
    committee_name: str
    source_line: str


def generate_assignment_drafts(
    action_lines: list[str] | tuple[str, ...],
) -> list[AssignmentDraft]:
    """Turn action-item text into committee assignment suggestions."""
    drafts: list[AssignmentDraft] = []
    seen: set[str] = set()
    for line in action_lines:
        text = line.strip()
        if not text:
            continue
        matched = False
        for pattern, slug, name in _COMMITTEE_HINTS:
            if pattern.search(text):
                key = f"{slug}:{text.lower()}"
                if key in seen:
                    break
                seen.add(key)
                drafts.append(
                    AssignmentDraft(
                        role_label=_role_label(text, name),
                        committee_slug=slug,
                        committee_name=name,
                        source_line=text,
                    )
                )
                matched = True
                break
        if not matched:
            key = f"events:{text.lower()}"
            if key in seen:
                continue
            seen.add(key)
            drafts.append(
                AssignmentDraft(
                    role_label=_role_label(text, "Events"),
                    committee_slug="events",
                    committee_name="Events",
                    source_line=text,
                )
            )
    return drafts[:12]


def _role_label(line: str, committee_name: str) -> str:
    cleaned = re.sub(r"^[-*•\d.\s]+", "", line).strip()
    if len(cleaned) > 72:
        cleaned = cleaned[:69] + "…"
    return cleaned or f"{committee_name} follow-up"


def drafts_to_dicts(drafts: list[AssignmentDraft]) -> list[dict]:
    return [
        {
            "roleLabel": d.role_label,
            "committeeSlug": d.committee_slug,
            "committeeName": d.committee_name,
            "sourceLine": d.source_line,
            "targetType": "committee",
        }
        for d in drafts
    ]
