import { apiFetch } from '../../api/client'

export type ShadowRequest = {
  id: string
  requester_id: string
  requester_name: string | null
  committee_id: string
  committee_name: string | null
  duration_minutes: number
  status: string
  message: string | null
  reviewed_by_id: string | null
  reviewed_at: string | null
  starts_at: string | null
  ends_at: string | null
  created_at: string | null
}

export function fetchShadowRequests(): Promise<{ requests: ShadowRequest[] }> {
  return apiFetch('/shadow')
}

export function createShadowRequest(input: {
  committeeId: string
  durationMinutes: number
  message?: string
}): Promise<ShadowRequest> {
  return apiFetch('/shadow', {
    method: 'POST',
    body: JSON.stringify({
      committee_id: input.committeeId,
      duration_minutes: input.durationMinutes,
      message: input.message,
    }),
  })
}

export function respondToShadowRequest(
  requestId: string,
  decision: 'approved' | 'denied',
): Promise<ShadowRequest> {
  return apiFetch(`/shadow/${requestId}/respond`, {
    method: 'POST',
    body: JSON.stringify({ decision }),
  })
}
