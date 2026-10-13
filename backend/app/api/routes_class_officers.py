"""Class Officers fundraiser and homecoming, scoped to senior or junior."""

from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel, ConfigDict, Field

from app.api.deps import CurrentProfile, DbSession
from app.services import class_officers

router = APIRouter(prefix="/class-officers", tags=["class-officers"])


class FundraiserPatch(BaseModel):
    label: str | None = None
    notes: str | None = None
    target_cents: int | None = Field(default=None, alias="targetCents")
    raised_cents: int | None = Field(default=None, alias="raisedCents")

    model_config = ConfigDict(populate_by_name=True)


class HomecomingPatch(BaseModel):
    skit_theme: str | None = Field(default=None, alias="skitTheme")
    skit_script: str | None = Field(default=None, alias="skitScript")
    skit_script_url: str | None = Field(default=None, alias="skitScriptUrl")
    skit_actors: list[dict] | None = Field(default=None, alias="skitActors")
    airbands: list[dict] | None = None
    actors: list[dict] | None = None
    stage_crew: list[dict] | None = Field(default=None, alias="stageCrew")
    cleanup_crew: list[dict] | None = Field(default=None, alias="cleanupCrew")
    checkpoints: list[dict] | None = None

    model_config = ConfigDict(populate_by_name=True)


@router.get("/{cohort}")
def read_workspace(cohort: str, profile: CurrentProfile, db: DbSession) -> dict:
    parsed = class_officers.parse_cohort(cohort)
    return class_officers.snapshot(db, profile, parsed)


@router.patch("/{cohort}/fundraiser")
def patch_fundraiser(
    cohort: str, body: FundraiserPatch, profile: CurrentProfile, db: DbSession
) -> dict:
    parsed = class_officers.parse_cohort(cohort)
    patch = body.model_dump(exclude_unset=True, by_alias=True)
    return class_officers.update_fundraiser(db, profile, parsed, patch)


@router.patch("/{cohort}/homecoming")
def patch_homecoming(
    cohort: str, body: HomecomingPatch, profile: CurrentProfile, db: DbSession
) -> dict:
    parsed = class_officers.parse_cohort(cohort)
    patch = body.model_dump(exclude_unset=True, by_alias=True)
    return class_officers.update_homecoming(db, profile, parsed, patch)
