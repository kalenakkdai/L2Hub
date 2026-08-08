"""Campsite lifecycle operations: transfer admin, leave, and Break Camp.

Every function here mutates role assignments, which the database guards with
a trigger that refuses to let the last administrator disappear. Two rules
follow from that, and both are load-bearing:

1. Each operation runs in one transaction. Transfer assigns the incoming
   administrator *before* removing the outgoing one, so the trigger sees the
   replacement already present and the Campsite is never momentarily
   unadministered — not even inside the transaction.

2. Each takes an advisory lock first. The trigger counts remaining
   administrators, which is a read-then-write: without serialisation two
   concurrent removals can each see two admins, each remove one, and leave
   zero. Row locks do not help, because the rows being counted are not the
   rows being deleted.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy import delete, select, text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import Session

from app.models import Profile
from app.models.rbac import CommitteeMembership, Role, UserRoleAssignment

SUPERADMIN_SLUGS = ("ac", "president")

#: Raised by the last-admin triggers in 20260809000000_settings.sql.
_LAST_ADMIN_MARKER = "last administrator"


def _lock_admin_changes(db: Session) -> None:
    """Serialises this transaction against other administrator changes."""
    db.execute(text("select public.lock_admin_changes()"))


def _superadmin_role_ids(db: Session) -> list[uuid.UUID]:
    return list(
        db.scalars(select(Role.id).where(Role.slug.in_(SUPERADMIN_SLUGS))).all()
    )


def _active_admin_ids(db: Session) -> set[uuid.UUID]:
    """User ids holding an unexpired superadmin role."""
    now = datetime.now(UTC)
    rows = db.execute(
        select(UserRoleAssignment.user_id)
        .join(Role, Role.id == UserRoleAssignment.role_id)
        .where(
            Role.slug.in_(SUPERADMIN_SLUGS),
            (UserRoleAssignment.ends_at.is_(None)) | (UserRoleAssignment.ends_at > now),
        )
    ).all()
    return {row[0] for row in rows}


def _translate_last_admin_error(error: DBAPIError) -> HTTPException:
    """Turns the trigger's exception into an answer a caller can act on."""
    if _LAST_ADMIN_MARKER in str(error.orig).lower():
        return HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "This would leave the Campsite with no administrator. "
                "Assign another AC or President first."
            ),
        )
    raise error


def transfer_admin(
    db: Session, actor: Profile, *, to_user_id: uuid.UUID, keep_own_role: bool = False
) -> dict:
    """Hands administration to another camper.

    The incoming administrator is assigned first. If anything below fails the
    whole transaction rolls back, so there is no window in which both the old
    and new assignment are absent.
    """
    _lock_admin_changes(db)

    if to_user_id == actor.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You already administer this Campsite.",
        )

    recipient = db.get(Profile, to_user_id)
    if recipient is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="No such camper."
        )
    if recipient.status != "active":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="That camper's account is not active.",
        )

    admin_ids = _active_admin_ids(db)
    if actor.id not in admin_ids:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only an administrator can transfer administration.",
        )

    ac_role_id = db.scalar(select(Role.id).where(Role.slug == "ac"))
    if ac_role_id is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="The AC role is missing from this Campsite.",
        )

    # Assign first — this is what lets the removal below pass the trigger.
    if to_user_id not in admin_ids:
        db.add(UserRoleAssignment(user_id=to_user_id, role_id=ac_role_id))
        db.flush()

    removed = 0
    if not keep_own_role:
        try:
            result = db.execute(
                delete(UserRoleAssignment).where(
                    UserRoleAssignment.user_id == actor.id,
                    UserRoleAssignment.role_id.in_(_superadmin_role_ids(db)),
                )
            )
            removed = result.rowcount or 0
        except DBAPIError as error:
            db.rollback()
            raise _translate_last_admin_error(error) from error

    db.commit()

    return {
        "transferredTo": str(to_user_id),
        "recipientName": recipient.full_name or recipient.email,
        "keptOwnRole": keep_own_role,
        "rolesRemoved": removed,
    }


def leave_campsite(db: Session, actor: Profile) -> dict:
    """Removes the caller's roles and committee memberships.

    Refused outright for the last administrator: leaving would strand the
    Campsite, and the caller can fix it by transferring first.
    """
    _lock_admin_changes(db)

    admin_ids = _active_admin_ids(db)
    if actor.id in admin_ids and len(admin_ids) == 1:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "You are the only administrator. Transfer administration to "
                "someone else before leaving."
            ),
        )

    try:
        memberships = db.execute(
            delete(CommitteeMembership).where(CommitteeMembership.user_id == actor.id)
        ).rowcount
        roles = db.execute(
            delete(UserRoleAssignment).where(UserRoleAssignment.user_id == actor.id)
        ).rowcount

        # The account stays, deactivated. Deleting the profile would cascade
        # into submissions and grades that the Campsite still needs.
        actor.status = "left"
        db.commit()
    except DBAPIError as error:
        db.rollback()
        raise _translate_last_admin_error(error) from error

    return {
        "left": True,
        "rolesRemoved": roles or 0,
        "committeesLeft": memberships or 0,
    }


def break_camp(db: Session, actor: Profile, *, confirm_name: str, reason: str | None) -> dict:
    """Archives the Campsite.

    Archives rather than deletes: reversible by someone with database access,
    where deletion is not, and a mistyped confirmation should not cost a year
    of debriefs.
    """
    settings_row = db.execute(
        text(
            "select id, name, archived_at from public.campsite_settings "
            "order by created_at limit 1 for update"
        )
    ).first()

    if settings_row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="This Campsite has no settings row.",
        )

    settings_id, name, archived_at = settings_row

    if archived_at is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This Campsite is already archived.",
        )

    # The name is checked server-side too. The typed confirmation in the UI is
    # a speed bump; this is the actual gate.
    if confirm_name.strip() != name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The Campsite name does not match.",
        )

    db.execute(
        text(
            "update public.campsite_settings "
            "set archived_at = now(), archived_by = :actor, archived_reason = :reason "
            "where id = :id"
        ),
        {"actor": actor.id, "reason": reason, "id": settings_id},
    )
    db.commit()

    return {"archived": True, "name": name}
