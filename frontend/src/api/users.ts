import { apiFetch } from './client'
import type { RoleAssignment } from './auth'

export type CommitteeSummary = {
  id: string
  slug: string
  name: string
  is_head: boolean
  membership_type: string
}

export type UserListItem = {
  id: string
  email: string
  full_name: string | null
  status: string
  primary_role: string
  roles: RoleAssignment[]
  committees: CommitteeSummary[]
  last_active_at: string | null
  created_at: string
}

export type UserDetail = UserListItem & {
  effective_permissions: string[]
  global_roles: RoleAssignment[]
  scoped_roles: RoleAssignment[]
}

export type UserListResponse = {
  users: UserListItem[]
}

export function fetchUsers(params?: {
  q?: string
  status?: string
}): Promise<UserListResponse> {
  const search = new URLSearchParams()
  if (params?.q) search.set('q', params.q)
  if (params?.status) search.set('status', params.status)
  const suffix = search.toString() ? `?${search}` : ''
  return apiFetch<UserListResponse>(`/admin/users${suffix}`)
}

export function fetchUser(userId: string): Promise<UserDetail> {
  return apiFetch<UserDetail>(`/admin/users/${userId}`)
}
