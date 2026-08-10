"""Shadow request API for baby campers and committee heads."""

from __future__ import annotations

import uuid

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.api.deps import CurrentProfile, DbSession
from app.services import shadow as shadow_service

router = APIRouter(prefix="/shadow", tags=["shadow"])


class ShadowCreateIn(BaseModel):
    committee_id: uuid.UUID
    duration_minutes: int = Field(..., ge=15, le=480)
    message: str | None = None


class ShadowRespondIn(BaseModel):
    decision: str  # approved | denied


@router.get("")
def list_shadow_requests(profile: CurrentProfile, db: DbSession) -> dict:
    return {"requests": shadow_service.list_for_user(db, profile)}


@router.post("")
def create_shadow_request(
    body: ShadowCreateIn, profile: CurrentProfile, db: DbSession
) -> dict:
    return shadow_service.create_request(
        db,
        profile,
        committee_id=body.committee_id,
        duration_minutes=body.duration_minutes,
        message=body.message,
    )


@router.post("/{request_id}/respond")
def respond_shadow_request(
    request_id: uuid.UUID,
    body: ShadowRespondIn,
    profile: CurrentProfile,
    db: DbSession,
) -> dict:
    return shadow_service.respond(
        db, profile, request_id, decision=body.decision
    )
