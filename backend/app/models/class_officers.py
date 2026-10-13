"""Senior and junior Class Officers workspaces.

One row per cohort. Fundraiser totals and the homecoming plan are JSON so a
checklist edit does not need a new table for every list on the page. The
browser never reads this table; the API does, after a cohort check.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class ClassOfficerWorkspace(Base):
    __tablename__ = "class_officer_workspaces"

    cohort: Mapped[str] = mapped_column(String, primary_key=True)
    fundraiser_json: Mapped[str] = mapped_column(Text, nullable=False)
    homecoming_json: Mapped[str] = mapped_column(Text, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
