"""Pydantic schemas for auth, dashboard, and users administration."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class RoleAssignmentOut(BaseModel):
    slug: str
    name: str
    rank: int
    scope: str
    committee_id: str | None = None
    event_id: str | None = None
    committee_name: str | None = None


class CurrentUser(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    full_name: str | None = None
    role: str
    status: str = "active"
    created_at: datetime
    roles: list[RoleAssignmentOut] = Field(default_factory=list)
    permissions: list[str] = Field(default_factory=list)


class DashboardModuleOut(BaseModel):
    key: str
    title: str


class DashboardOut(BaseModel):
    roles: list[RoleAssignmentOut]
    permissions: list[str]
    modules: list[DashboardModuleOut]


class CommitteeSummary(BaseModel):
    id: uuid.UUID
    slug: str
    name: str
    is_head: bool = False
    membership_type: str = "member"


class UserListItem(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str | None
    status: str
    primary_role: str
    roles: list[RoleAssignmentOut]
    committees: list[CommitteeSummary]
    last_active_at: datetime | None
    created_at: datetime


class UserDetail(UserListItem):
    effective_permissions: list[str]
    global_roles: list[RoleAssignmentOut]
    scoped_roles: list[RoleAssignmentOut]


class UserListResponse(BaseModel):
    users: list[UserListItem]
