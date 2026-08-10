"""Shadow duration requests: baby campers temporarily see head tools."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

from fastapi import HTTPException
from fastapi import status as http_status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models import Committee, CommitteeMembership, Profile
from app.models.shadow import ShadowRequest
from app.services import notifications

ALLOWED_DURATIONS = frozenset({15, 30, 60, 120, 240, 480})


def _now() -> datetime:
    return datetime.now(UTC)


def _invalid(detail: str) -> HTTPException:
    return HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail=detail)


def _forbidden(detail: str) -> HTTPException:
    return HTTPException(status_code=http_status.HTTP_403_FORBIDDEN, detail=detail)


def membership_for(
    db: Session, user_id: uuid.UUID, committee_id: uuid.UUID
) -> CommitteeMembership | None:
    return db.scalars(
        select(CommitteeMembership).where(
            CommitteeMembership.user_id == user_id,
            CommitteeMembership.committee_id == committee_id,
        )
    ).first()


def is_baby_on_committee(
    db: Session, user_id: uuid.UUID, committee_id: uuid.UUID
) -> bool:
    row = membership_for(db, user_id, committee_id)
    return row is not None and row.membership_type == "baby"


def is_head_of_committee(
    db: Session, user_id: uuid.UUID, committee_id: uuid.UUID
) -> bool:
    row = membership_for(db, user_id, committee_id)
    return row is not None and row.is_head


def active_shadow_committee_ids(db: Session, user_id: uuid.UUID) -> set[uuid.UUID]:
    """Committees where this camper currently has an approved shadow grant."""
    now = _now()
    rows = db.scalars(
        select(ShadowRequest).where(
            ShadowRequest.requester_id == user_id,
            ShadowRequest.status == "approved",
            ShadowRequest.ends_at.is_not(None),
            ShadowRequest.ends_at > now,
        )
    ).all()
    return {row.committee_id for row in rows}


def expire_stale_grants(db: Session) -> int:
    now = _now()
    rows = list(
        db.scalars(
            select(ShadowRequest).where(
                ShadowRequest.status == "approved",
                ShadowRequest.ends_at.is_not(None),
                ShadowRequest.ends_at <= now,
            )
        ).all()
    )
    for row in rows:
        row.status = "expired"
    if rows:
        db.flush()
    return len(rows)


def committee_head_ids(db: Session, committee_id: uuid.UUID) -> list[uuid.UUID]:
    return list(
        db.scalars(
            select(CommitteeMembership.user_id).where(
                CommitteeMembership.committee_id == committee_id,
                CommitteeMembership.is_head.is_(True),
            )
        ).all()
    )


def serialize(row: ShadowRequest) -> dict:
    return {
        "id": str(row.id),
        "requester_id": str(row.requester_id),
        "requester_name": row.requester.full_name if row.requester else None,
        "committee_id": str(row.committee_id),
        "committee_name": row.committee.name if row.committee else None,
        "duration_minutes": row.duration_minutes,
        "status": row.status,
        "message": row.message,
        "reviewed_by_id": str(row.reviewed_by_id) if row.reviewed_by_id else None,
        "reviewed_at": row.reviewed_at.isoformat() if row.reviewed_at else None,
        "starts_at": row.starts_at.isoformat() if row.starts_at else None,
        "ends_at": row.ends_at.isoformat() if row.ends_at else None,
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }


def list_for_user(db: Session, profile: Profile) -> list[dict]:
    expire_stale_grants(db)
    headed = {
        m.committee_id for m in profile.committee_memberships if m.is_head
    }
    clauses = [ShadowRequest.requester_id == profile.id]
    if headed:
        clauses.append(ShadowRequest.committee_id.in_(headed))
    from sqlalchemy import or_

    rows = (
        db.scalars(
            select(ShadowRequest)
            .options(
                selectinload(ShadowRequest.requester),
                selectinload(ShadowRequest.committee),
            )
            .where(or_(*clauses))
            .order_by(ShadowRequest.created_at.desc())
        )
        .unique()
        .all()
    )
    return [serialize(row) for row in rows]


def create_request(
    db: Session,
    profile: Profile,
    *,
    committee_id: uuid.UUID,
    duration_minutes: int,
    message: str | None = None,
) -> dict:
    if duration_minutes not in ALLOWED_DURATIONS:
        raise _invalid(
            f"Duration must be one of: {', '.join(str(d) for d in sorted(ALLOWED_DURATIONS))} minutes."
        )
    if not is_baby_on_committee(db, profile.id, committee_id):
        raise _forbidden("Only baby campers on this committee can request shadow access.")

    committee = db.get(Committee, committee_id)
    if committee is None:
        raise _invalid("Committee not found.")

    open_existing = db.scalars(
        select(ShadowRequest).where(
            ShadowRequest.requester_id == profile.id,
            ShadowRequest.committee_id == committee_id,
            ShadowRequest.status == "pending",
        )
    ).first()
    if open_existing is not None:
        raise _invalid("You already have a pending shadow request for this committee.")

    active = db.scalars(
        select(ShadowRequest).where(
            ShadowRequest.requester_id == profile.id,
            ShadowRequest.committee_id == committee_id,
            ShadowRequest.status == "approved",
            ShadowRequest.ends_at.is_not(None),
            ShadowRequest.ends_at > _now(),
        )
    ).first()
    if active is not None:
        raise _invalid("You already have an active shadow grant for this committee.")

    row = ShadowRequest(
        requester_id=profile.id,
        committee_id=committee_id,
        duration_minutes=duration_minutes,
        status="pending",
        message=(message or "").strip() or None,
    )
    db.add(row)
    db.flush()

    heads = committee_head_ids(db, committee_id)
    if heads:
        name = profile.full_name or profile.email
        notifications.deliver(
            db,
            recipient_ids=heads,
            type="shadow.requested",
            title="Shadow request",
            body=f"{name} asked to shadow {committee.name} for {duration_minutes} minutes.",
            payload={
                "shadowRequestId": str(row.id),
                "committeeId": str(committee_id),
                "href": "/dashboard",
            },
            dedupe_key=f"shadow.requested:{row.id}",
        )
    db.commit()
    db.refresh(row)
    row = db.scalars(
        select(ShadowRequest)
        .where(ShadowRequest.id == row.id)
        .options(
            selectinload(ShadowRequest.requester),
            selectinload(ShadowRequest.committee),
        )
    ).one()
    return serialize(row)


def respond(
    db: Session,
    profile: Profile,
    request_id: uuid.UUID,
    *,
    decision: str,
) -> dict:
    if decision not in {"approved", "denied"}:
        raise _invalid("Decision must be approved or denied.")

    row = db.scalars(
        select(ShadowRequest)
        .where(ShadowRequest.id == request_id)
        .options(
            selectinload(ShadowRequest.requester),
            selectinload(ShadowRequest.committee),
        )
    ).first()
    if row is None:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail="Not found.")
    if row.status != "pending":
        raise _invalid("This shadow request is no longer pending.")
    if not is_head_of_committee(db, profile.id, row.committee_id):
        raise _forbidden("Only committee heads can review shadow requests.")

    now = _now()
    row.status = decision
    row.reviewed_by_id = profile.id
    row.reviewed_at = now
    if decision == "approved":
        row.starts_at = now
        row.ends_at = now + timedelta(minutes=row.duration_minutes)

    committee_name = row.committee.name if row.committee else "your committee"
    notifications.deliver(
        db,
        recipient_ids=[row.requester_id],
        type="shadow.approved" if decision == "approved" else "shadow.denied",
        title="Shadow request approved" if decision == "approved" else "Shadow request denied",
        body=(
            f"You can shadow {committee_name} until the grant ends."
            if decision == "approved"
            else f"Your request to shadow {committee_name} was denied."
        ),
        payload={
            "shadowRequestId": str(row.id),
            "committeeId": str(row.committee_id),
            "href": "/dashboard",
        },
        dedupe_key=f"shadow.{decision}:{row.id}",
    )
    db.commit()
    db.refresh(row)
    return serialize(row)
