"""Owl rewards — A+-gated campsite owl customization."""

from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.api.deps import CurrentProfile, DbSession
from app.core import permission_keys as pk
from app.services import authorization as authz
from app.services import owl as owl_service
from app.services.letter_grade import is_a_plus

router = APIRouter(prefix="/owl", tags=["owl"])


class SyncEligibilityBody(BaseModel):
    """Weighted percent from the authoritative grade standing.

    Until the gradebook persists totals, operators and tests pass the percent
    explicitly. The client must never be the only gate — this endpoint still
    enforces A+ on the server before cosmetics can change.
    """

    weighted_percent: float | None = Field(default=None, alias="weightedPercent")

    model_config = {"populate_by_name": True}


class CosmeticsBody(BaseModel):
    belly_color: str | None = Field(default=None, alias="bellyColor")
    wing_color: str | None = Field(default=None, alias="wingColor")
    accessory: str | None = None
    trail: str | None = None

    model_config = {"populate_by_name": True}


@router.get("/me")
def read_owl_profile(profile: CurrentProfile, db: DbSession) -> dict:
    authz.require_permission(db, profile, pk.GRADES_VIEW_OWN, resource_owner_id=profile.id)
    row = owl_service.ensure_owl_profile(db, profile.id)
    db.commit()
    eligible = is_a_plus(row.weighted_percent)
    return owl_service.profile_payload(row, eligible=eligible)


@router.post("/eligibility/sync")
def sync_owl_eligibility(
    body: SyncEligibilityBody, profile: CurrentProfile, db: DbSession
) -> dict:
    """Update owl access from a weighted percent and notify on revoke."""
    authz.require_permission(db, profile, pk.GRADES_VIEW_OWN, resource_owner_id=profile.id)
    row, change = owl_service.sync_access(
        db, profile, weighted_percent=body.weighted_percent, notify=True
    )
    return {
        **owl_service.profile_payload(row, eligible=is_a_plus(row.weighted_percent)),
        "change": {
            "unlocked": change.unlocked,
            "revoked": change.revoked,
            "letter": change.letter,
            "percent": change.percent,
        },
    }


@router.patch("/cosmetics")
def update_owl_cosmetics(
    body: CosmeticsBody, profile: CurrentProfile, db: DbSession
) -> dict:
    authz.require_permission(db, profile, pk.GRADES_VIEW_OWN, resource_owner_id=profile.id)
    row = owl_service.apply_cosmetics(
        db,
        profile,
        belly_color=body.belly_color,
        wing_color=body.wing_color,
        accessory=body.accessory,
        trail=body.trail,
    )
    return owl_service.profile_payload(row, eligible=True)
