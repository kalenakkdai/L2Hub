import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.core.permissions import UserRole


class CurrentUser(BaseModel):
    """The authenticated caller, as returned by GET /auth/me."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    full_name: str | None = None
    role: UserRole
    created_at: datetime
