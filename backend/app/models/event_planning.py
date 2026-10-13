"""Event planning records.

Anonymous reports keep the author on the row for accountability, but no API
payload includes that column. Callers who can review reports still receive a
redacted shape.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, String, Text, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class EventPlan(Base):
    __tablename__ = "event_plans"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String, nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False, default="")
    event_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String, nullable=False, default="draft")
    created_by_user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False
    )
    enabled_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("profiles.id", ondelete="SET NULL"), nullable=True
    )
    enabled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    agenda_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    created_by = relationship("Profile", foreign_keys=[created_by_user_id])
    enabled_by = relationship("Profile", foreign_keys=[enabled_by_user_id])
    assignments: Mapped[list[EventPlanAssignment]] = relationship(
        back_populates="plan", cascade="all, delete-orphan"
    )


class EventPlanAssignment(Base):
    __tablename__ = "event_plan_assignments"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    plan_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("event_plans.id", ondelete="CASCADE"), nullable=False
    )
    target_type: Mapped[str] = mapped_column(String, nullable=False)
    committee_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("committees.id", ondelete="SET NULL"), nullable=True
    )
    member_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("profiles.id", ondelete="SET NULL"), nullable=True
    )
    role_label: Mapped[str] = mapped_column(String, nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False, default="invited")

    plan: Mapped[EventPlan] = relationship(back_populates="assignments")
    committee = relationship("Committee")
    member = relationship("Profile", foreign_keys=[member_user_id])


class EventPlanReport(Base):
    """One anonymous concern about a plan. `author_user_id` is not an API field."""

    __tablename__ = "event_plan_reports"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    plan_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("event_plans.id", ondelete="CASCADE"), nullable=False
    )
    author_user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False
    )
    subject_user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False
    )
    category: Mapped[str] = mapped_column(String, nullable=False)
    details: Mapped[str] = mapped_column(Text, nullable=False)
    attachments_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    subject = relationship("Profile", foreign_keys=[subject_user_id])
