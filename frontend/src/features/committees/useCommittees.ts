import { useQuery } from '@tanstack/react-query'
import { SAMPLE_COMMITTEES, sampleCommitteeDetail } from './fixtures/sampleCommittees'
import type { CommitteeDetail, CommitteeSummary } from './types'

/**
 * TEMPORARY: both hooks resolve fixtures. These are the seams that become
 * real requests once the endpoints exist:
 *
 *   apiFetch<CommitteeSummary[]>('/committees')
 *   apiFetch<CommitteeDetail>(`/committees/${id}`)
 */

export function useCommittees() {
  return useQuery<CommitteeSummary[]>({
    queryKey: ['committees'],
    queryFn: async () => SAMPLE_COMMITTEES,
    staleTime: 60_000,
  })
}

export function useCommittee(id: string | undefined) {
  return useQuery<CommitteeDetail | null>({
    queryKey: ['committees', id],
    queryFn: async () => (id ? sampleCommitteeDetail(id) : null),
    enabled: Boolean(id),
    staleTime: 60_000,
  })
}
