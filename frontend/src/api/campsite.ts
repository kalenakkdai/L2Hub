import { apiFetch } from './client'

/**
 * Campsite lifecycle operations.
 *
 * All three are server-side because they mutate role assignments, which the
 * database guards against leaving the Campsite unadministered. Doing them
 * from the client would race that guard.
 */

export type TransferAdminResult = {
  transferredTo: string
  recipientName: string
  keptOwnRole: boolean
  rolesRemoved: number
}

export type LeaveResult = {
  left: boolean
  rolesRemoved: number
  committeesLeft: number
}

export type BreakCampResult = {
  archived: boolean
  name: string
}

export function transferAdmin(
  toUserId: string,
  keepOwnRole = false,
): Promise<TransferAdminResult> {
  return apiFetch<TransferAdminResult>('/campsite/transfer-admin', {
    method: 'POST',
    body: JSON.stringify({ to_user_id: toUserId, keep_own_role: keepOwnRole }),
  })
}

export function leaveCampsite(): Promise<LeaveResult> {
  return apiFetch<LeaveResult>('/campsite/leave', { method: 'POST' })
}

export function breakCamp(confirmName: string, reason?: string): Promise<BreakCampResult> {
  return apiFetch<BreakCampResult>('/campsite/break-camp', {
    method: 'POST',
    body: JSON.stringify({ confirm_name: confirmName, reason: reason ?? null }),
  })
}
