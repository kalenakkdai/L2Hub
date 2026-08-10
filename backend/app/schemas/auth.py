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


class CommitteeMembershipOut(BaseModel):
    """A committee the caller belongs to, regardless of any scoped role."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    is_head: bool = False
    membership_type: str = "member"


class ShadowGrantOut(BaseModel):
    committee_id: uuid.UUID
    committee_name: str
    ends_at: datetime


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
    # Membership is not the same as a committee-scoped role: a camper can sit
    # on a committee without holding a role there, and the settings page has
    # to show those too.
    committees: list[CommitteeMembershipOut] = Field(default_factory=list)
    # Baby campers may request temporary head-level visibility.
    is_baby: bool = False
    active_shadows: list[ShadowGrantOut] = Field(default_factory=list)
    # SCO → senior, JCO → junior. Null for platform ops who may switch.
    class_cohort: str | None = None
    can_switch_class_cohort: bool = False


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
    # False for spreadsheet campers who have not signed up yet (Campers tab).
    account_linked: bool = True


class UserDetail(UserListItem):
    effective_permissions: list[str]
    global_roles: list[RoleAssignmentOut]
    scoped_roles: list[RoleAssignmentOut]


class UserListResponse(BaseModel):
    users: list[UserListItem]
