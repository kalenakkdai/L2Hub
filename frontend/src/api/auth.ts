import { apiFetch } from './client'

/** Mirrors backend system role slugs (with legacy aliases accepted by API). */
export type UserRole =
  | 'member'
  | 'committee_head'
  | 'asbo'
  | 'ac'
  | 'president'

export type RoleAssignment = {
  slug: string
  name: string
  rank: number
  scope: string
  committee_id: string | null
  event_id: string | null
  committee_name?: string | null
}

export type CurrentUser = {
  id: string
  email: string
  full_name: string | null
  role: UserRole | string
  status?: string
  created_at: string
  roles?: RoleAssignment[]
  permissions?: string[]
}

export type DashboardModule = {
  key: string
  title: string
}

export type DashboardPayload = {
  roles: RoleAssignment[]
  permissions: string[]
  modules: DashboardModule[]
}

export function fetchCurrentUser(): Promise<CurrentUser> {
  return apiFetch<CurrentUser>('/auth/me')
}

export function fetchDashboard(): Promise<DashboardPayload> {
  return apiFetch<DashboardPayload>('/auth/dashboard')
}

const ROLE_LABELS: Record<string, string> = {
  member: 'Member',
  committee_head: 'Committee Head',
  asbo: 'ASBO',
  ac: 'AC',
  president: 'President',
}

/** Human-readable role name, falling back to the raw value if unknown. */
export function roleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role
}

export function hasPermission(
  user: CurrentUser | null | undefined,
  permission: string,
): boolean {
  return Boolean(user?.permissions?.includes(permission))
}
