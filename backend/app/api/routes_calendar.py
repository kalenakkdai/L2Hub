"""iCal subscription feed endpoints.

Two of these are public in the sense that no bearer token reaches them —
Google Calendar refreshes a subscription with a bare GET. They are guarded by
the feed token in the query string instead, which is the only credential a
calendar client can carry. The two management endpoints are ordinary
authenticated routes and require SETTINGS_EDIT.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Response, status

from app.api.deps import CurrentProfile, DbSession, require_permission
from app.core import permission_keys as pk
from app.services import calendar_feed

router = APIRouter(tags=["calendar"])

#: RFC 5545 §3.1. `charset` is not optional in practice — Outlook has
#: historically decoded a feed without it as latin-1 and mangled any non-ASCII
#: event name.
ICS_MEDIA_TYPE = "text/calendar; charset=utf-8"


def _ics_response(body: bytes, *, filename: str) -> Response:
    return Response(
        content=body,
        media_type=ICS_MEDIA_TYPE,
        headers={
            # `inline` so a browser hitting the URL directly shows it rather
            # than downloading; calendar clients ignore this either way.
            "Content-Disposition": f'inline; filename="{filename}"',
            # The token is a credential. Nothing in front of this should keep
            # a copy — a shared cache serving one Campsite's calendar to
            # another request is the failure mode being closed off here.
            "Cache-Control": "private, no-store",
        },
    )


_UNAUTHORIZED = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="This calendar link is not valid. Ask an administrator for a new one.",
)


@router.get("/calendar.ics")
def campsite_calendar(db: DbSession, token: str | None = None) -> Response:
    """The whole-Campsite feed.

    Deliberately not under /campsites/{id}: campsite_settings is a singleton
    with no campsites table, so a path id would be decoration rather than a
    selector. See the header of 20260809000000_settings.sql.
    """
    try:
        campsite = calendar_feed.authenticate(db, token)
    except calendar_feed.FeedAuthError:
        raise _UNAUTHORIZED from None

    body, _included, _skipped = calendar_feed.build_calendar(
        db, calendar_name=campsite.name
    )
    return _ics_response(body, filename="l2hub.ics")


@router.get("/committees/{committee_id}/calendar.ics")
def committee_calendar(
    committee_id: uuid.UUID, db: DbSession, token: str | None = None
) -> Response:
    """One Crew's events, filtered from the same calendar.

    The token is the Campsite's, not the Committee's — a Crew feed is a view,
    not a separate grant. Anyone with the Campsite token can already read every
    event from the feed above, so scoping this one to a per-Crew secret would
    imply an isolation that does not exist.
    """
    try:
        campsite = calendar_feed.authenticate(db, token)
    except calendar_feed.FeedAuthError:
        raise _UNAUTHORIZED from None

    committee = calendar_feed.resolve_committee(db, committee_id)
    if committee is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="No such Crew."
        )

    body, _included, _skipped = calendar_feed.build_calendar(
        db,
        calendar_name=f"{campsite.name} — {committee.name}",
        committee_id=committee_id,
    )
    return _ics_response(body, filename=f"l2hub-{committee.slug}.ics")


@router.get(
    "/calendar/subscription",
    dependencies=[Depends(require_permission(pk.SETTINGS_EDIT))],
)
def subscription_details(profile: CurrentProfile, db: DbSession) -> dict:
    """The token, for the settings page to build a subscribe URL from.

    Behind SETTINGS_EDIT rather than SETTINGS_VIEW: this hands back a
    credential that outlives the caller's session, so seeing it is the same
    privilege as being able to rotate it.
    """
    campsite = _require_campsite(db)
    if not campsite.feed_token:
        campsite.feed_token = calendar_feed.generate_token()
        db.commit()

    committees = calendar_feed.list_committees(db)
    return {
        "token": campsite.feed_token,
        "campsiteName": campsite.name,
        "crews": [
            {"id": str(c.id), "slug": c.slug, "name": c.name} for c in committees
        ],
    }


@router.post(
    "/calendar/subscription/rotate",
    dependencies=[Depends(require_permission(pk.SETTINGS_EDIT))],
)
def rotate_subscription(profile: CurrentProfile, db: DbSession) -> dict:
    """Mints a new token and invalidates every URL already handed out.

    Not in the original request, but a bearer credential with no way to revoke
    it is a one-way door: the moment a subscribe URL is forwarded to someone
    who should not have it, the only remedy is a database edit. Rotation makes
    that a button.
    """
    campsite = _require_campsite(db)
    campsite.feed_token = calendar_feed.generate_token()
    db.commit()
    return {"token": campsite.feed_token}


def _require_campsite(db: DbSession):
    campsite = calendar_feed.get_campsite(db)
    if campsite is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="This Campsite has no settings row.",
        )
    return campsite
