"""Committee rosters — who is in a committee, for pickers and member lists."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models import Committee, CommitteeMembership, Profile


def _position(membership: CommitteeMembership) -> str | None:
    """The label under a camper's name, or nothing at all.

    Returning "Member" would hang a meaningless badge on most of the roster,
    so an ordinary membership has no position rather than a filler one.
    """
    if membership.is_head:
        return "Head"
    if membership.membership_type and membership.membership_type != "member":
        return membership.membership_type.replace("_", " ").title()
    return None


def member_payload(membership: CommitteeMembership) -> dict:
    profile = membership.user
    return {
        "id": str(profile.id),
        # A roster is exactly where a chosen display name should win; the
        # task serializer's `_person` only knows full_name because it labels
        # records rather than introducing people.
        "name": profile.display_name or profile.full_name or profile.email,
        "position": _position(membership),
        "isHead": membership.is_head,
        "avatarUrl": profile.avatar_url,
    }


def roster_payload(db: Session, committee: Committee) -> dict:
    """Everyone in `committee`, heads first then alphabetical.

    camelCase, matching board_payload and task_payload. The sibling
    /committees/{ref}/tasks endpoint returns snake_case keys; that is the
    outlier in this area and not worth propagating into a new response.
    """
    memberships = db.scalars(
        select(CommitteeMembership)
        .options(selectinload(CommitteeMembership.user))
        .join(Profile, Profile.id == CommitteeMembership.user_id)
        .where(CommitteeMembership.committee_id == committee.id)
        .order_by(CommitteeMembership.is_head.desc(), Profile.full_name)
    ).all()
    return {
        "committeeId": str(committee.id),
        "committeeSlug": committee.slug,
        "committeeName": committee.name,
        "members": [member_payload(m) for m in memberships if m.user is not None],
    }
