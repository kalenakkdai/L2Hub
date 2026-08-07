"""Feedback endpoints — AC-only. Bodies never include author metadata."""

from fastapi import APIRouter

from app.api.deps import CurrentProfile, DbSession
from app.core import permission_keys as pk
from app.services import authorization as authz
from app.services.audit import write_audit_log

router = APIRouter(prefix="/feedback", tags=["feedback"])


@router.get("/private")
def read_private_feedback(profile: CurrentProfile, db: DbSession) -> dict:
    authz.require_permission(db, profile, pk.FEEDBACK_VIEW_PRIVATE)
    write_audit_log(
        db,
        actor_user_id=profile.id,
        action="feedback.view_private",
        target_type="feedback",
        target_id="private",
    )
    db.commit()
    # Intentionally empty / redacted — no author fields.
    return {"items": []}


@router.get("/anonymous")
def read_anonymous_feedback(profile: CurrentProfile, db: DbSession) -> dict:
    authz.require_permission(db, profile, pk.FEEDBACK_VIEW_ANONYMOUS)
    write_audit_log(
        db,
        actor_user_id=profile.id,
        action="feedback.view_anonymous",
        target_type="feedback",
        target_id="anonymous",
    )
    db.commit()
    return {"items": []}
