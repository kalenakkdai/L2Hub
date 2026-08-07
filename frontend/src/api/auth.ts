import { apiFetch } from './client'
import { getDevCurrentUser } from '../auth/devAuth'

/** Mirrors the backend's CurrentUser schema (backend/app/schemas/auth.py). */
export type UserRole = 'student' | 'committee_head' | 'officer' | 'adviser'

export type CurrentUser = {
  id: string
  email: string
  full_name: string | null
  role: UserRole
  created_at: string
}

export function fetchCurrentUser(): Promise<CurrentUser> {
  const devUser = getDevCurrentUser()
  if (devUser) return Promise.resolve(devUser)
  return apiFetch<CurrentUser>('/auth/me')
}

const ROLE_LABELS: Record<UserRole, string> = {
  student: 'Student',
  committee_head: 'Committee Head',
  officer: 'Officer',
  adviser: 'Adviser',
}

/** Human-readable role name, falling back to the raw value if unknown. */
export function roleLabel(role: string): string {
  return ROLE_LABELS[role as UserRole] ?? role
}
