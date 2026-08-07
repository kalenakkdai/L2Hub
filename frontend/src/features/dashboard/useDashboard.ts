import { useQuery } from '@tanstack/react-query'
import { SAMPLE_DASHBOARD } from './fixtures/sampleDashboard'
import type { DashboardData } from './types'

/**
 * Dashboard contents.
 *
 * TEMPORARY: resolves the sample fixture instead of calling the API. This is
 * the single seam that becomes the real request:
 *
 *   queryFn: () => apiFetch<DashboardData>('/dashboard/modules')
 *
 * Nothing else in the dashboard needs to change when that happens, because
 * every component is typed against DashboardData rather than the fixture.
 */
export function useDashboard() {
  return useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: async () => SAMPLE_DASHBOARD,
    staleTime: 30_000,
  })
}
