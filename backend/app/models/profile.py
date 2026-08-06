import uuid
from datetime import datetime

from sqlalchemy import DateTime, String, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class Profile(Base):
    """Mirror of public.profiles, created by supabase/migrations.

    The backend never creates these rows — the auth.users trigger does. This
    model is read-oriented. `role` is a Postgres enum in the database; it is
    mapped as a plain string here so the same model works against SQLite in
    tests, with the database remaining the source of truth for valid values.
    """

    __tablename__ = "profiles"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True)
    email: Mapped[str] = mapped_column(String, nullable=False)
    full_name: Mapped[str | None] = mapped_column(String, nullable=True)
    role: Mapped[str] = mapped_column(String, nullable=False, default="student")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return f"<Profile id={self.id} role={self.role}>"
