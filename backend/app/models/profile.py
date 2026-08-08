import uuid
from datetime import datetime, time

from sqlalchemy import Boolean, DateTime, Integer, String, Time, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class Profile(Base):
    """Mirror of public.profiles.

    The backend never creates these rows in production — the auth.users trigger
    does. Tests and the local seed helper insert rows directly. Authorization
    comes exclusively from normalized role assignments.
    """

    __tablename__ = "profiles"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True)
    email: Mapped[str] = mapped_column(String, nullable=False)
    full_name: Mapped[str | None] = mapped_column(String, nullable=True)
    status: Mapped[str] = mapped_column(String, nullable=False, default="active")
    last_active_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Settings columns, added in 20260809000000_settings.sql. They were absent
    # from this model for a while, which made server-side reads of them
    # silently fall back to defaults — quiet hours and the notification pause
    # would never have gated anything.
    display_name: Mapped[str | None] = mapped_column(String, nullable=True)
    pronouns: Mapped[str | None] = mapped_column(String, nullable=True)
    grade_year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(String, nullable=True)
    phone: Mapped[str | None] = mapped_column(String, nullable=True)
    phone_verified: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    email_verified: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    theme: Mapped[str] = mapped_column(String, nullable=False, default="system")
    reduce_motion: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    compact_density: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    quiet_hours_start: Mapped[time | None] = mapped_column(Time, nullable=True)
    quiet_hours_end: Mapped[time | None] = mapped_column(Time, nullable=True)
    notifications_paused: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    role_assignments = relationship(
        "UserRoleAssignment",
        back_populates="user",
        cascade="all, delete-orphan",
        foreign_keys="UserRoleAssignment.user_id",
    )
    committee_memberships = relationship(
        "CommitteeMembership",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    permission_overrides = relationship(
        "PermissionOverride",
        back_populates="user",
        cascade="all, delete-orphan",
        foreign_keys="PermissionOverride.user_id",
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Profile id={self.id} email={self.email!r}>"
