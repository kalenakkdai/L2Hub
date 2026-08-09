"""Committee work: the tasks on the L2 Board and the requests between crews.

Two tables, one workflow. A committee lists a task; if that task needs another
committee's help — Publicity making a post, Videography filming it — the task
fans out into `committee_requests`, one row per committee asked. The link back
to the originating task is what makes the paper trail readable months later.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, String, Text, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base

#: Task lifecycle. Deliberately three states — a board nobody updates is worse
#: than a coarse one, and "doing" is the only distinction crews asked for.
TASK_STATUSES = ("todo", "doing", "done")

#: Request lifecycle. `declined` exists because a committee that cannot take
#: the work needs to say so on the record, rather than leaving it open forever.
REQUEST_STATUSES = ("open", "accepted", "done", "declined")

#: Requests that still need something from the target committee.
REQUEST_OPEN_STATUSES = ("open", "accepted")


class Task(Base):
    """One piece of work owned by one committee."""

    __tablename__ = "tasks"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    committee_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("committees.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(String, nullable=False)
    details: Mapped[str] = mapped_column(Text, nullable=False, default="")
    status: Mapped[str] = mapped_column(String, nullable=False, default="todo")
    # Unassigned is a real state: a committee lists the work before deciding
    # who picks it up.
    assignee_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("profiles.id", ondelete="SET NULL"), nullable=True
    )
    due_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("profiles.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    committee: Mapped[Committee] = relationship("Committee")  # noqa: F821
    assignee = relationship("Profile", foreign_keys=[assignee_user_id])
    requests: Mapped[list[CommitteeRequest]] = relationship(
        back_populates="source_task",
        foreign_keys="CommitteeRequest.source_task_id",
    )


class CommitteeRequest(Base):
    """One committee asking another for something, and the answer."""

    __tablename__ = "committee_requests"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    requesting_committee_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("committees.id", ondelete="CASCADE"), nullable=False
    )
    target_committee_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("committees.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(String, nullable=False)
    details: Mapped[str] = mapped_column(Text, nullable=False, default="")
    status: Mapped[str] = mapped_column(String, nullable=False, default="open")
    due_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    # Set when the request was fanned out from a board task rather than filed
    # by hand. Kept on delete so the trail survives the task being removed.
    source_task_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("tasks.id", ondelete="SET NULL"), nullable=True
    )
    created_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("profiles.id", ondelete="SET NULL"), nullable=True
    )
    responded_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("profiles.id", ondelete="SET NULL"), nullable=True
    )
    responded_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    requesting_committee: Mapped[Committee] = relationship(  # noqa: F821
        "Committee", foreign_keys=[requesting_committee_id]
    )
    target_committee: Mapped[Committee] = relationship(  # noqa: F821
        "Committee", foreign_keys=[target_committee_id]
    )
    source_task: Mapped[Task | None] = relationship(
        back_populates="requests", foreign_keys=[source_task_id]
    )
    created_by = relationship("Profile", foreign_keys=[created_by_user_id])
    responded_by = relationship("Profile", foreign_keys=[responded_by_user_id])
