"""Page-level dashboard payload (grades standing + empty shells for the rest)."""

from __future__ import annotations

from fastapi import APIRouter

from app.api.deps import CurrentProfile, DbSession
from app.services import gradebook

router = APIRouter(tags=["dashboard"])


@router.get("/dashboard")
def read_dashboard_page(profile: CurrentProfile, db: DbSession) -> dict:
    """Live grade standing for the header/panel; other sections empty until wired."""
    return gradebook.dashboard_payload(db, profile)
