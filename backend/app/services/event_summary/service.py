"""Event Summary workflow: request, approve, generate, publish."""

from __future__ import annotations

import json
import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import permission_keys as pk
from app.models import (
    Event,
    EventAgenda,
    EventSummary,
    EventSummaryRequest,
    Profile,
    UserRoleAssignment,
)
from app.services import authorization as authz
from app.services import notifications
from app.services.audit import write_audit_log
from app.services.event_summary.deterministic import DeterministicEventSummaryProvider
from app.services.event_summary.provider import GENERATION_STAGES, STAGE_LABELS

provider = DeterministicEventSummaryProvider()


def _utcnow() -> datetime:
    return datetime.now(UTC)


def get_or_create_summary(db: Session, event: Event) -> EventSummary:
    if event.summary is not None:
        return event.summary
    summary = EventSummary(event_id=event.id, status="not_requested")
    db.add(summary)
    db.flush()
    event.summary = summary
    return summary


def load_event(db: Session, event_ref: str) -> Event | None:
    try:
        event_id = uuid.UUID(event_ref)
        event = db.get(Event, event_id)
    except ValueError:
        event = db.scalar(select(Event).where(Event.slug == event_ref))
    if event is None:
        return None
    # Ensure relationships for status payload.
    db.refresh(event)
    _ = event.summary
    return event


def _notify(
    db: Session,
    *,
    recipient_ids: list[uuid.UUID],
    type: str,
    title: str,
    body: str,
    payload: dict | None = None,
) -> None:
    """Delivers to whoever wants it.

    Previously wrote a row per recipient unconditionally, which made the
    settings grid, quiet hours, and the pause switch decorative. Gating lives
    in one place so every future notification source inherits it.
    """
    notifications.deliver(
        db,
        recipient_ids=recipient_ids,
        type=type,
        title=title,
        body=body,
        payload=payload,
    )


def _superadmin_ids(db: Session) -> list[uuid.UUID]:
    from app.models import Role

    rows = db.scalars(
        select(Profile)
        .join(UserRoleAssignment, UserRoleAssignment.user_id == Profile.id)
        .join(Role, Role.id == UserRoleAssignment.role_id)
        .where(Role.slug.in_(("ac", "president")))
    ).unique().all()
    return [p.id for p in rows]


def can_manage_event_request(db: Session, user: Profile, event: Event) -> bool:
    if authz.has_permission(db, user, pk.WRAPPED_APPROVE):
        return True
    if not authz.has_permission(db, user, pk.WRAPPED_REQUEST):
        return False
    # ASBO may request any complete event.
    if any(r["slug"] == "asbo" for r in authz.build_auth_context(db, user).roles):
        return True
    # Committee head: must manage the event's committee.
    if event.managing_committee_id is None:
        return False
    return authz.has_permission(
        db,
        user,
        pk.WRAPPED_REQUEST,
        committee_id=event.managing_committee_id,
    ) and event.managing_committee_id in authz.build_auth_context(
        db, user
    ).headed_committee_ids


def request_summary(
    db: Session, user: Profile, event: Event, *, note: str | None = None
) -> EventSummaryRequest:
    if event.status != "complete":
        raise authz.permission_denied(
            code="event_not_complete",
            message="Event Summary can only be requested after the event is complete.",
        )
    if not can_manage_event_request(db, user, event):
        raise authz.permission_denied(
            code="committee_scope_denied",
            message="You do not have access to request a summary for this event.",
        )

    summary = get_or_create_summary(db, event)
    if summary.status in {"generating", "generated", "published"}:
        raise authz.permission_denied(
            code="summary_already_active",
            message="This event already has an active or published summary.",
        )

    request = EventSummaryRequest(
        event_id=event.id,
        requested_by=user.id,
        status="pending",
        note=note,
    )
    db.add(request)
    summary.status = "pending_approval"
    summary.generation_stage = None

    _notify(
        db,
        recipient_ids=_superadmin_ids(db),
        type="wrapped.request",
        title=f"{event.name} Event Summary requested",
        body=(
            f"{user.full_name or user.email} requested generation of "
            f"{event.name} Event Wrapped."
        ),
        payload={"eventId": str(event.id), "eventSlug": event.slug},
    )
    write_audit_log(
        db,
        actor_user_id=user.id,
        action="wrapped.request",
        target_type="event",
        target_id=event.id,
    )
    db.commit()
    db.refresh(request)
    return request


def reject_summary(
    db: Session, user: Profile, event: Event, *, note: str | None = None
) -> EventSummary:
    authz.require_permission(db, user, pk.WRAPPED_APPROVE)
    summary = get_or_create_summary(db, event)
    pending = db.scalars(
        select(EventSummaryRequest).where(
            EventSummaryRequest.event_id == event.id,
            EventSummaryRequest.status == "pending",
        )
    ).all()
    for req in pending:
        req.status = "rejected"
        req.reviewed_by = user.id
        req.reviewed_at = _utcnow()
        req.note = note or req.note
    summary.status = "not_requested"
    summary.generation_stage = None
    write_audit_log(
        db,
        actor_user_id=user.id,
        action="wrapped.reject",
        target_type="event",
        target_id=event.id,
    )
    db.commit()
    db.refresh(summary)
    return summary


def run_generation(db: Session, user: Profile, event: Event) -> EventSummary:
    """Approve (if needed) and run deterministic generation synchronously with stages."""
    authz.require_permission(db, user, pk.WRAPPED_GENERATE)
    summary = get_or_create_summary(db, event)

    pending = db.scalars(
        select(EventSummaryRequest).where(
            EventSummaryRequest.event_id == event.id,
            EventSummaryRequest.status == "pending",
        )
    ).all()
    for req in pending:
        req.status = "approved"
        req.reviewed_by = user.id
        req.reviewed_at = _utcnow()

    summary.status = "generating"
    db.commit()

    for stage in GENERATION_STAGES:
        summary.generation_stage = stage
        db.commit()
        if stage == "done":
            break

    payload = provider.build_payload(event_name=event.name, event_year=event.year)
    summary.payload_json = json.dumps(payload)
    summary.status = "generated"
    summary.generation_stage = "done"
    summary.updated_at = _utcnow()

    agenda = EventAgenda(
        event_id=event.id,
        summary_id=summary.id,
        content_json=json.dumps(payload["agenda"]),
        status="draft",
    )
    db.add(agenda)

    _notify(
        db,
        recipient_ids=_superadmin_ids(db),
        type="wrapped.generated",
        title=f"{event.name} Wrapped ready",
        body=f"Event Summary generation finished for {event.name}.",
        payload={"eventId": str(event.id), "eventSlug": event.slug},
    )
    write_audit_log(
        db,
        actor_user_id=user.id,
        action="wrapped.generate",
        target_type="event",
        target_id=event.id,
    )
    db.commit()
    db.refresh(summary)
    return summary


def approve_and_generate(db: Session, user: Profile, event: Event) -> EventSummary:
    authz.require_permission(db, user, pk.WRAPPED_APPROVE)
    return run_generation(db, user, event)


def publish_summary(db: Session, user: Profile, event: Event) -> EventSummary:
    authz.require_permission(db, user, pk.WRAPPED_PUBLISH)
    summary = get_or_create_summary(db, event)
    if summary.status not in {"generated", "published"}:
        raise authz.permission_denied(
            code="summary_not_ready",
            message="Generate the Event Summary before publishing.",
        )
    summary.status = "published"
    summary.published_at = _utcnow()
    summary.published_by = user.id
    _notify(
        db,
        recipient_ids=_superadmin_ids(db),
        type="wrapped.published",
        title=f"{event.name} Wrapped published",
        body=f"{event.name} Event Wrapped is now visible to members.",
        payload={"eventId": str(event.id), "eventSlug": event.slug},
    )
    write_audit_log(
        db,
        actor_user_id=user.id,
        action="wrapped.publish",
        target_type="event",
        target_id=event.id,
    )
    db.commit()
    db.refresh(summary)
    return summary


def mark_presented(db: Session, user: Profile, event: Event) -> EventSummary:
    """Record that the Wrapped was walked through with the class.

    The first walkthrough wins: calling this again keeps the original
    timestamp, so a later viewer cannot rewrite when the class reviewed it.
    """
    authz.require_permission(db, user, pk.WRAPPED_PRESENT)
    summary = get_or_create_summary(db, event)
    if summary.status not in {"generated", "published"} or not summary.payload_json:
        raise authz.permission_denied(
            code="summary_not_ready",
            message="Generate the Event Wrapped before presenting it to the class.",
        )
    if summary.presented_at is not None:
        return summary

    summary.presented_at = _utcnow()
    summary.presented_by = user.id
    write_audit_log(
        db,
        actor_user_id=user.id,
        action="wrapped.present",
        target_type="event",
        target_id=event.id,
    )
    db.commit()
    db.refresh(summary)
    return summary


def _theme_headline(theme: dict) -> dict:
    """A theme stripped down to its headline.

    Contributor quotes stay out of the recap entirely: they carry names and
    committees, and some of them are anonymous.
    """
    return {
        "id": theme.get("id"),
        "label": theme.get("label"),
        "mentions": theme.get("mentions"),
        "summary": theme.get("summary"),
    }


def build_recap(event: Event, summary: EventSummary) -> dict:
    """The condensed Wrapped shown when an event row is expanded."""
    payload = json.loads(summary.payload_json or "{}")
    wrapped = payload.get("wrapped", {})
    executive = payload.get("executiveSummary", {})

    return {
        "event": event_list_item(event),
        "presentedAt": summary.presented_at,
        "hero": wrapped.get("hero"),
        "overallRating": wrapped.get("overallRating"),
        "participation": wrapped.get("participation"),
        "committeeRankings": wrapped.get("committeeRankings", []),
        "topStrengths": [_theme_headline(t) for t in wrapped.get("topStrengths", [])],
        "topImprovements": [
            _theme_headline(t) for t in wrapped.get("topImprovements", [])
        ],
        "materialRequests": wrapped.get("materialRequests", []),
        "summary": executive.get("summary"),
        "recommendedActions": executive.get("recommendedActions", []),
    }


def ensure_can_view_recap(db: Session, user: Profile, event: Event) -> EventSummary:
    """The recap unlocks only once the class has been through the Wrapped."""
    summary = ensure_can_view_wrapped(db, user, event)
    if summary.presented_at is None:
        raise authz.permission_denied(
            code="wrapped_not_presented",
            message="This recap unlocks after the Wrapped is reviewed with the class.",
        )
    return summary


def ensure_can_view_wrapped(db: Session, user: Profile, event: Event) -> EventSummary:
    summary = get_or_create_summary(db, event)
    if summary.status == "published" and (
        authz.has_permission(db, user, pk.WRAPPED_VIEW_PUBLISHED)
        or authz.has_permission(db, user, pk.WRAPPED_VIEW_ALL)
        or authz.has_permission(db, user, pk.WRAPPED_VIEW_COMMITTEE)
    ):
        return summary
    if authz.has_permission(db, user, pk.WRAPPED_VIEW_ALL):
        return summary
    if authz.has_permission(db, user, pk.WRAPPED_GENERATE):
        return summary
    raise authz.permission_denied(
        code="permission_denied",
        message="You do not have permission to view this Event Wrapped.",
    )


def generation_status_payload(summary: EventSummary) -> dict:
    stage = summary.generation_stage
    return {
        "status": summary.status,
        "stage": stage,
        "label": STAGE_LABELS.get(stage or "", None),
        "stages": [
            {"key": key, "label": STAGE_LABELS[key], "done": _stage_done(summary, key)}
            for key in GENERATION_STAGES
        ],
    }


def _stage_done(summary: EventSummary, key: str) -> bool:
    if summary.status in {"generated", "published", "archived"}:
        return True
    if summary.generation_stage is None:
        return False
    try:
        return GENERATION_STAGES.index(key) <= GENERATION_STAGES.index(
            summary.generation_stage
        )
    except ValueError:
        return False


def event_list_item(event: Event) -> dict:
    summary = event.summary
    status = summary.status if summary else "not_requested"
    return {
        "id": str(event.id),
        "name": event.name,
        "slug": event.slug,
        "year": event.year,
        "eventStatus": event.status,
        "summaryStatus": status,
        "wrappedPresentedAt": (
            summary.presented_at.isoformat()
            if summary and summary.presented_at
            else None
        ),
        "managingCommitteeId": (
            str(event.managing_committee_id) if event.managing_committee_id else None
        ),
    }
