"""Persisted gradebook assignments and per-student score entries."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import (
    DateTime,
    Float,
    ForeignKey,
    String,
    Text,
    UniqueConstraint,
    Uuid,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base

GRADE_STATUSES = (
    "not_started",
    "draft",
    "submitted",
    "late",
    "graded",
    "missing",
    "excused",
    "closed",
)

PUBLICATION_STATUSES = ("draft", "pending_publish", "published")

ASSIGNMENT_TYPES = (
    "event_debrief",
    "reflection",
    "attendance",
    "task",
    "committee_deliverable",
    "committee_grade",
    "meeting_response",
    "material_checklist",
    "custom",
)


class GradeAssignment(Base):
    """One graded piece of work configured by Jan/Jadon."""

    __tablename__ = "grade_assignments"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    category_id: Mapped[str] = mapped_column(String, nullable=False)
    assignment_type: Mapped[str] = mapped_column(
        String, nullable=False, default="custom"
    )
    points_possible: Mapped[float] = mapped_column(Float, nullable=False, default=10.0)
    event_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("events.id", ondelete="SET NULL"), nullable=True
    )
    committee_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("committees.id", ondelete="SET NULL"), nullable=True
    )
    available_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    due_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    late_due_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("profiles.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    entries: Mapped[list[GradeEntry]] = relationship(
        back_populates="assignment",
        cascade="all, delete-orphan",
    )
    event = relationship("Event")
    committee = relationship("Committee")
    created_by = relationship("Profile", foreign_keys=[created_by_user_id])


class GradeEntry(Base):
    """One student's row for a gradebook assignment."""

    __tablename__ = "grade_entries"
    __table_args__ = (
        UniqueConstraint(
            "assignment_id",
            "student_id",
            name="uq_grade_entries_assignment_student",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    assignment_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("grade_assignments.id", ondelete="CASCADE"), nullable=False
    )
    student_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False
    )
    status: Mapped[str] = mapped_column(String, nullable=False, default="not_started")
    score: Mapped[float | None] = mapped_column(Float, nullable=True)
    publication_status: Mapped[str] = mapped_column(
        String, nullable=False, default="draft"
    )
    submitted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    graded_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    published_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    graded_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("profiles.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    assignment: Mapped[GradeAssignment] = relationship(back_populates="entries")
    student = relationship("Profile", foreign_keys=[student_id])
    graded_by = relationship("Profile", foreign_keys=[graded_by_user_id])


class GradeAssignmentRequest(Base):
    """A member-authored proposal awaiting Jan/Jadon's decision."""

    __tablename__ = "grade_assignment_requests"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    proposed_category_id: Mapped[str] = mapped_column(String, nullable=False)
    proposed_points: Mapped[float] = mapped_column(Float, nullable=False, default=10.0)
    committee_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("committees.id", ondelete="SET NULL"), nullable=True
    )
    submitted_by_user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False
    )
    status: Mapped[str] = mapped_column(String, nullable=False, default="pending")
    reviewed_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("profiles.id", ondelete="SET NULL"), nullable=True
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    review_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_assignment_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("grade_assignments.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    committee = relationship("Committee")
    submitted_by = relationship("Profile", foreign_keys=[submitted_by_user_id])
    reviewed_by = relationship("Profile", foreign_keys=[reviewed_by_user_id])
    created_assignment = relationship("GradeAssignment")
