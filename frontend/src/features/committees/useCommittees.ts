import { useQuery } from '@tanstack/react-query'
import { ApiError, apiFetch } from '../../api/client'
import type { CommitteeDetail, CommitteeDirectory } from './types'

export function useCommittees() {
  return useQuery<CommitteeDirectory>({
    queryKey: ['committees'],
    queryFn: () => apiFetch<CommitteeDirectory>('/committees'),
    staleTime: 60_000,
  })
}

export function useCommittee(id: string | undefined) {
  return useQuery<CommitteeDetail | null>({
    queryKey: ['committees', id],
    queryFn: async () => {
      try {
        return await apiFetch<CommitteeDetail>(`/committees/${id}`)
      } catch (error) {
        // A missing slug is an empty page with an explanation, not a crash.
        if (error instanceof ApiError && error.status === 404) return null
        throw error
      }
    },
    enabled: Boolean(id),
    staleTime: 60_000,
  })
}
