"""Deterministic Event Summary synthesis (no paid AI for MVP)."""

from __future__ import annotations

from typing import Any

# Contributors are synthesised locally because the MVP must not depend on a paid
# model. The roster is longer than the largest mention count so a single theme
# never quotes the same person twice, and every value is derived from the index
# rather than randomness so repeated generations produce identical payloads.
_ROSTER: tuple[tuple[str, str], ...] = (
    ("Avery Chen", "Community"),
    ("Sam Ortiz", "Publicity"),
    ("Jordan Lee", "Community"),
    ("Riley Park", "Activities"),
    ("Taylor Kim", "Activities"),
    ("Maya Patel", "Fundraising"),
    ("Diego Ramirez", "Sports"),
    ("Hana Suzuki", "Tech"),
    ("Noah Whitfield", "Publicity"),
    ("Leah Goldberg", "Elections"),
    ("Omar Haddad", "GTAC"),
    ("Priya Nair", "HCMC"),
    ("Ethan Brooks", "Student Store"),
    ("Sofia Marino", "STAR"),
    ("Kai Nakamura", "Videography / Photography"),
    ("Grace Liu", "Community"),
    ("Marcus Bell", "Sports"),
    ("Ines Duarte", "Fundraising"),
    ("Tomas Novak", "Tech"),
    ("Aaliyah Reed", "Publicity"),
    ("Ben Carter", "Activities"),
    ("Yuki Tanaka", "STAR"),
    ("Nadia Rahman", "HCMC"),
    ("Caleb Foster", "Student Store"),
    ("Elena Petrova", "Elections"),
    ("Andre Silva", "GTAC"),
    ("Mei Wong", "Community"),
    ("Jonah Klein", "Tech"),
    ("Farah Aziz", "Publicity"),
    ("Luis Herrera", "Sports"),
    ("Sana Iqbal", "Fundraising"),
    ("Derek Osei", "Activities"),
    ("Clara Weiss", "STAR"),
    ("Ravi Menon", "HCMC"),
    ("Tessa Nguyen", "Student Store"),
    ("Milo Ferrari", "Videography / Photography"),
    ("Zoe Alvarez", "Elections"),
    ("Hugo Berg", "GTAC"),
    ("Iris Chandra", "Community"),
    ("Owen Blake", "Tech"),
)

# Every fifth contributor submitted anonymously.
_ANONYMOUS_EVERY = 5

# Closing clauses are shared per theme kind. Their count is coprime with the
# eight openers each theme supplies, so the pairing walks 56 combinations before
# repeating — more than the largest mention count.
_CLOSERS: dict[str, tuple[str, ...]] = {
    "strength": (
        "and stations never stalled",
        "so nobody waited on an officer",
        "which kept the crowd moving",
        "and volunteers stayed confident",
        "so leads could focus on guests",
        "which made every handoff easy",
        "and the energy held all morning",
    ),
    "improvement": (
        "and we lost time we could not make up",
        "so the opening felt rushed",
        "which pushed the whole schedule back",
        "and volunteers had to improvise",
        "so guests asked us where to go",
        "which cost us a calm start",
        "and it showed at the busiest moment",
    ),
    "mixed": (
        "once the first rush cleared",
        "though the opening minutes were tight",
        "and it evened out by mid-morning",
        "so the fix is a small one",
        "which only mattered early on",
        "though another table would help",
        "and most guests never noticed",
    ),
}


def _contributors(
    count: int, *, openers: tuple[str, ...], closers: tuple[str, ...]
) -> list[dict[str, Any]]:
    """Build exactly `count` quotes so mentions and quotes always agree."""
    people: list[dict[str, Any]] = []
    for i in range(count):
        quote = f"{openers[i % len(openers)]}, {closers[(i * 3) % len(closers)]}."

        if i % _ANONYMOUS_EVERY == _ANONYMOUS_EVERY - 1:
            # An anonymous submission carries no identifying field at all — not
            # a name, not a committee, not an index that maps back to one.
            people.append(
                {"name": None, "committee": None, "quote": quote, "anonymous": True}
            )
            continue

        name, committee = _ROSTER[i % len(_ROSTER)]
        people.append(
            {"name": name, "committee": committee, "quote": quote, "anonymous": False}
        )
    return people


def _theme(
    *,
    id: str,
    label: str,
    mentions: int,
    summary: str,
    kind: str,
    openers: tuple[str, ...],
    recommended_action: str | None = None,
    positive: str | None = None,
    improvement: str | None = None,
    related: list[str] | None = None,
) -> dict[str, Any]:
    # mentions is reported as the length of the quote list rather than the
    # requested count, so the two can never drift apart in the payload.
    contributors = _contributors(
        mentions, openers=openers, closers=_CLOSERS[kind]
    )
    return {
        "id": id,
        "label": label,
        "mentions": len(contributors),
        "kind": kind,
        "summary": summary,
        "recommendedAction": recommended_action,
        "positivePatterns": positive,
        "improvementPatterns": improvement,
        "relatedThemeIds": related or [],
        "contributors": contributors,
    }


class DeterministicEventSummaryProvider:
    """Produces a Maze Day–quality Wrapped payload without an LLM."""

    def build_payload(self, *, event_name: str, event_year: int) -> dict[str, Any]:
        themes = [
            _theme(
                id="communication",
                label="Communication",
                mentions=28,
                kind="strength",
                summary="Leaders praised clear radio checks and committee updates.",
                positive="Check-ins and walkie channels kept stations aligned.",
                openers=(
                    "Radio checks kept every station aligned",
                    "The morning briefing told me exactly where to stand",
                    "Committee updates reached us before the doors opened",
                    "Walkie channels stayed clear the whole shift",
                    "Officers answered questions in under a minute",
                    "The group chat caught the schedule change fast",
                    "Station leads repeated the plan so nobody guessed",
                    "I always knew who to ask for a decision",
                ),
                related=["volunteer_coordination", "committee_cooperation"],
            ),
            _theme(
                id="volunteer_help",
                label="Volunteer Help",
                mentions=22,
                kind="strength",
                summary="Volunteers knew stations and rotated without confusion.",
                positive="Role cards reduced onboarding time.",
                openers=(
                    "Volunteers arrived already knowing their station",
                    "Role cards made the handoff obvious",
                    "Rotations happened without anyone being told twice",
                    "Extra volunteers filled the gap at the busiest table",
                    "New members were paired with someone experienced",
                    "Nobody stood around waiting for an assignment",
                    "The volunteer list matched who actually showed up",
                    "Break coverage was arranged before we needed it",
                ),
                related=["communication", "organization"],
            ),
            _theme(
                id="organization",
                label="Organization",
                mentions=19,
                kind="strength",
                summary="Stations opened on a shared schedule with clear owners.",
                openers=(
                    "Stations opened on the shared schedule",
                    "Every table had a named owner",
                    "Supplies were sorted by station before load-in",
                    "The run-of-show matched what actually happened",
                    "Cleanup assignments were posted in advance",
                    "The site map made setup positions unambiguous",
                    "Equipment came back to the right bin",
                    "Timing cues kept the program on track",
                ),
                related=["volunteer_help"],
            ),
            _theme(
                id="earlier_setup",
                label="Earlier Setup",
                mentions=31,
                kind="improvement",
                summary="Setup started late because tables arrived after 7:45.",
                recommended_action="Move load-in 45 minutes earlier and assign a dock lead.",
                improvement="Late physical setup delayed check-in opening.",
                openers=(
                    "Setup started late because tables arrived at 7:45",
                    "We were still moving chairs when guests walked in",
                    "Load-in needed at least another forty-five minutes",
                    "The dock had nobody assigned to receive deliveries",
                    "Decorations went up while check-in was already open",
                    "Half the crew waited on equipment that had not arrived",
                    "We could not test anything before the first guests",
                    "The first station was not ready when the bell rang",
                ),
                related=["parking", "signage"],
            ),
            _theme(
                id="signage",
                label="Signage",
                mentions=18,
                kind="improvement",
                summary="Directional signs were hard to spot near the parent entrance.",
                recommended_action="Print A-frame signs for parent and student entries.",
                openers=(
                    "Directional signs were hard to spot near the parent entrance",
                    "Parents kept asking where to check in",
                    "The signs we had were too small to read from the lot",
                    "Nothing marked the student entry separately",
                    "Arrows pointed at a door that stayed locked",
                    "Guests walked past our table twice before seeing it",
                    "We ended up pointing people by hand all morning",
                    "The entrance signage went up too late to help",
                ),
                related=["parking", "check_in"],
            ),
            _theme(
                id="parking",
                label="Parking",
                mentions=14,
                kind="improvement",
                summary="Parking congestion fell vs last year but still peaked at open.",
                recommended_action="Add two parking guides from 7:00–8:00.",
                openers=(
                    "Parking backed up right at opening",
                    "Cars circled the lot looking for the entrance",
                    "Nobody was directing traffic during the first rush",
                    "The overflow lot was not marked",
                    "Drop-off blocked the main lane for a while",
                    "Guests were late because parking took so long",
                    "We needed guides posted before seven",
                    "The lot cleared fine later but opening was rough",
                ),
                related=["earlier_setup", "signage"],
            ),
            _theme(
                id="check_in",
                label="Check-In",
                mentions=16,
                kind="mixed",
                summary="Lines moved quickly after the first ten minutes.",
                openers=(
                    "Lines moved quickly after the first ten minutes",
                    "Check-in was smooth once the second table opened",
                    "The roster lookup was faster than last year",
                    "We had a short backup at the very start",
                    "Wristbands ran out briefly at one table",
                    "Volunteers found names quickly once they learned the list",
                    "The queue rope kept the line orderly",
                    "One scanner lagged but the backup worked",
                ),
                related=["signage", "communication"],
            ),
            _theme(
                id="volunteer_coordination",
                label="Volunteer Coordination",
                mentions=12,
                kind="strength",
                summary="Volunteers covered gaps without waiting for officers.",
                openers=(
                    "Volunteers covered gaps without waiting for officers",
                    "Someone stepped in the moment a table got busy",
                    "Shift swaps were handled between volunteers directly",
                    "The floating volunteer idea worked well",
                    "Leads knew who was on break at any time",
                    "Coverage held even during the lunch rotation",
                    "Volunteers flagged problems before they grew",
                    "The check-in and games teams traded help easily",
                ),
                related=["communication", "committee_cooperation"],
            ),
            _theme(
                id="committee_cooperation",
                label="Committee Cooperation",
                mentions=11,
                kind="strength",
                summary="Committees shared runners and supplies across stations.",
                openers=(
                    "Committees shared runners across stations",
                    "Supplies moved between committees without a fight",
                    "Another committee lent us people when we were short",
                    "The handoff between committees was planned ahead",
                    "We solved the extension cord shortage together",
                    "Committee leads met once and it settled everything",
                    "Nobody guarded their own supplies",
                    "Cross-committee cleanup finished faster",
                ),
                related=["communication", "volunteer_coordination"],
            ),
        ]

        graph = {
            "nodes": [
                {
                    "id": t["id"],
                    "label": t["label"],
                    "mentions": t["mentions"],
                    "kind": t["kind"],
                }
                for t in themes
            ],
            "edges": [
                {"source": "communication", "target": "volunteer_coordination"},
                {"source": "volunteer_coordination", "target": "committee_cooperation"},
                {"source": "earlier_setup", "target": "parking"},
                {"source": "earlier_setup", "target": "signage"},
                {"source": "signage", "target": "check_in"},
                {"source": "parking", "target": "signage"},
                {"source": "communication", "target": "organization"},
            ],
            "themes": themes,
        }

        wrapped = {
            "hero": {
                "title": f"{event_name} {event_year}",
                "contributors": 48,
                "submissionRate": 96,
                "tagline": "Let's look back.",
            },
            "overallRating": {"score": 4.82, "max": 5.0, "stars": 5},
            "committeeRankings": [
                {"name": "Community", "rating": 4.91},
                {"name": "Spirit", "rating": 4.80},
                {"name": "Publicity", "rating": 4.62},
                {"name": "Technology", "rating": 4.44},
            ],
            "participation": {
                "invited": 50,
                "submitted": 48,
                "absent": 2,
                "completionPercent": 96,
            },
            "timeline": {
                "windowMinutes": 5,
                "firstMinutePercent": 50,
                "medianSeconds": 78,
                "bubbles": [
                    {"t": 12, "status": "submitted"},
                    {"t": 28, "status": "submitted"},
                    {"t": 45, "status": "writing"},
                    {"t": 61, "status": "submitted"},
                    {"t": 90, "status": "submitted"},
                    {"t": 120, "status": "submitted"},
                    {"t": 150, "status": "absent"},
                    {"t": 180, "status": "submitted"},
                ],
            },
            "topStrengths": [t for t in themes if t["kind"] == "strength"][:3],
            "topImprovements": [t for t in themes if t["kind"] == "improvement"],
            "materialRequests": [
                {
                    "name": "Extension Cords",
                    "requests": 17,
                    "quantity": 8,
                    "estimatedCost": 96,
                    "purchasingUrl": "https://example.com/extension-cords",
                },
                {
                    "name": "A-Frame Signs",
                    "requests": 9,
                    "quantity": 4,
                    "estimatedCost": 120,
                    "purchasingUrl": "https://example.com/a-frame-signs",
                },
            ],
            "committeeBreakdown": [
                {
                    "name": "Community",
                    "rating": 4.91,
                    "strengths": ["Check-in flow", "Volunteer coverage"],
                    "improvements": ["Earlier table load-in"],
                    "materials": ["Extension cords"],
                    "participation": 100,
                },
                {
                    "name": "Spirit",
                    "rating": 4.80,
                    "strengths": ["Energy at stations"],
                    "improvements": ["Clearer parent signage"],
                    "materials": ["Megaphone batteries"],
                    "participation": 94,
                },
                {
                    "name": "Publicity",
                    "rating": 4.62,
                    "strengths": ["Photo coverage"],
                    "improvements": ["Earlier poster drop"],
                    "materials": [],
                    "participation": 92,
                },
                {
                    "name": "Technology",
                    "rating": 4.44,
                    "strengths": ["Live status board"],
                    "improvements": ["Spare hotspot"],
                    "materials": ["Extension cords"],
                    "participation": 96,
                },
            ],
            "historicalComparison": {
                "previousEvent": f"{event_name} {event_year - 1}",
                "ratingDeltaPercent": 12,
                "parkingComplaintDeltaPercent": -40,
                "repeatedIssues": ["Late setup"],
                "resolvedIssues": ["Volunteer confusion"],
            },
            "executiveSummary": {
                "summary": (
                    f"{event_name} {event_year} ran with a 96% debrief completion rate "
                    "and a 4.82 overall rating. Setup timing remains the top operational gap."
                ),
                "successes": [
                    "Clear radio communication across stations",
                    "Strong volunteer coverage after role cards",
                    "Parking complaints down 40% vs last year",
                ],
                "improvementAreas": [
                    "Start physical setup earlier",
                    "Improve parent-entry signage",
                    "Assign dedicated parking guides at open",
                ],
                "recommendedActions": [
                    "Lock a T-45 load-in checklist owned by Community",
                    "Print A-frame signs before the next Maze Day",
                    "Budget eight extension cords for outdoor stations",
                ],
                "budgetSuggestions": [
                    {"item": "Extension cords", "estimate": 96},
                    {"item": "A-frame signs", "estimate": 120},
                ],
                "committeeRecommendations": [
                    {
                        "committee": "Community",
                        "action": "Own dock lead and table arrival SLA",
                    },
                    {
                        "committee": "Publicity",
                        "action": "Deliver parent/student entry signage kit",
                    },
                ],
            },
        }

        agenda = {
            "title": f"{event_name} {event_year} Leadership Debrief Agenda",
            "sections": [
                {
                    "heading": "Celebrate successes",
                    "items": wrapped["executiveSummary"]["successes"],
                },
                {
                    "heading": "Review improvements",
                    "items": wrapped["executiveSummary"]["improvementAreas"],
                },
                {
                    "heading": "Budget requests",
                    "items": [
                        f"{b['item']} — ${b['estimate']}"
                        for b in wrapped["executiveSummary"]["budgetSuggestions"]
                    ],
                },
                {
                    "heading": "Assignments",
                    "items": [
                        f"{c['committee']}: {c['action']}"
                        for c in wrapped["executiveSummary"]["committeeRecommendations"]
                    ],
                },
                {
                    "heading": "Next steps",
                    "items": wrapped["executiveSummary"]["recommendedActions"],
                },
                {
                    "heading": "Action owners",
                    "items": [
                        "Community Head — load-in checklist",
                        "Publicity Head — signage kit",
                        "ASBO — budget approval",
                    ],
                },
                {
                    "heading": "Due dates",
                    "items": [
                        "Load-in checklist draft — next cabinet meeting",
                        "Signage proofs — within 7 days",
                        "Budget vote — following ASBO review",
                    ],
                },
            ],
        }

        return {
            "wrapped": wrapped,
            "graph": graph,
            "executiveSummary": wrapped["executiveSummary"],
            "agenda": agenda,
        }
