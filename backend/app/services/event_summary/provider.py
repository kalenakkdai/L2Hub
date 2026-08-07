"""Event Summary provider contracts and payload shapes."""

from __future__ import annotations

from typing import Any, Protocol

GENERATION_STAGES: tuple[str, ...] = (
    "collecting_submissions",
    "analyzing_responses",
    "generating_insights",
    "comparing_previous_years",
    "building_wrapped",
    "creating_agenda",
    "done",
)

STAGE_LABELS: dict[str, str] = {
    "collecting_submissions": "Collecting submissions…",
    "analyzing_responses": "Analyzing responses…",
    "generating_insights": "Generating insights…",
    "comparing_previous_years": "Comparing previous years…",
    "building_wrapped": "Building Wrapped…",
    "creating_agenda": "Creating agenda…",
    "done": "Done.",
}


class EventSummaryProvider(Protocol):
    def build_payload(self, *, event_name: str, event_year: int) -> dict[str, Any]:
        """Return wrapped + graph + executive_summary + agenda draft."""
        ...
