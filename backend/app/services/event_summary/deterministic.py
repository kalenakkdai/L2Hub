"""Deterministic Event Summary synthesis (no paid AI for MVP)."""

from __future__ import annotations

from typing import Any


def _theme(
    *,
    id: str,
    label: str,
    mentions: int,
    summary: str,
    kind: str,
    recommended_action: str | None = None,
    positive: str | None = None,
    improvement: str | None = None,
    quotes: list[dict] | None = None,
    related: list[str] | None = None,
) -> dict[str, Any]:
    return {
        "id": id,
        "label": label,
        "mentions": mentions,
        "kind": kind,
        "summary": summary,
        "recommendedAction": recommended_action,
        "positivePatterns": positive,
        "improvementPatterns": improvement,
        "relatedThemeIds": related or [],
        "contributors": quotes or [],
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
                quotes=[
                    {
                        "name": "Avery Chen",
                        "committee": "Community",
                        "quote": "Radio checks kept every station aligned.",
                        "anonymous": False,
                    }
                ],
                related=["volunteer_coordination", "committee_cooperation"],
            ),
            _theme(
                id="volunteer_help",
                label="Volunteer Help",
                mentions=22,
                kind="strength",
                summary="Volunteers knew stations and rotated without confusion.",
                positive="Role cards reduced onboarding time.",
                related=["communication", "organization"],
            ),
            _theme(
                id="organization",
                label="Organization",
                mentions=19,
                kind="strength",
                summary="Stations opened on a shared schedule with clear owners.",
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
                quotes=[
                    {
                        "name": "Avery Chen",
                        "committee": "Community",
                        "quote": "Setup started too late because tables arrived at 7:45.",
                        "anonymous": False,
                    },
                    {
                        "name": None,
                        "committee": None,
                        "quote": "We needed more time before doors opened.",
                        "anonymous": True,
                    },
                ],
                related=["parking", "signage"],
            ),
            _theme(
                id="signage",
                label="Signage",
                mentions=18,
                kind="improvement",
                summary="Directional signs were hard to spot near the parent entrance.",
                recommended_action="Print A-frame signs for parent and student entries.",
                related=["parking", "check_in"],
            ),
            _theme(
                id="parking",
                label="Parking",
                mentions=14,
                kind="improvement",
                summary="Parking congestion fell vs last year but still peaked at open.",
                recommended_action="Add two parking guides from 7:00–8:00.",
                related=["earlier_setup", "signage"],
            ),
            _theme(
                id="check_in",
                label="Check-In",
                mentions=16,
                kind="mixed",
                summary="Lines moved quickly after the first ten minutes.",
                related=["signage", "communication"],
            ),
            _theme(
                id="volunteer_coordination",
                label="Volunteer Coordination",
                mentions=12,
                kind="strength",
                summary="Volunteers covered gaps without waiting for officers.",
                related=["communication", "committee_cooperation"],
            ),
            _theme(
                id="committee_cooperation",
                label="Committee Cooperation",
                mentions=11,
                kind="strength",
                summary="Committees shared runners and supplies across stations.",
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
