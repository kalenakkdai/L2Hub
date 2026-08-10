import { useQuery } from '@tanstack/react-query'
import { fetchCommitteeMembers } from './api'

/**
 * The roster behind an assignee picker.
 *
 * Keyed under ['committees', id, ...] rather than ['board'] on purpose: the
 * board is invalidated on every status-cycle click, and nesting the roster
 * under it would refetch every committee's members each time someone moved a
 * task from To do to In progress.
 */
export function useCommitteeMembers(committeeId: string, enabled = true) {
  return useQuery({
    queryKey: ['committees', committeeId, 'members'],
    queryFn: () => fetchCommitteeMembers(committeeId),
    enabled,
    staleTime: 300_000,
    // A 403 will still be a 403 on the fourth attempt. The app-level
    // QueryClient has no retry override, so without this a member who cannot
    // read the roster waits through three backoffs before the picker settles.
    // Note renderWithProviders sets retry: false, so no test can catch this
    // going missing.
    retry: false,
  })
}
