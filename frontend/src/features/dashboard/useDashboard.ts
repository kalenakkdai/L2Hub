import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '../../api/client'
import type { DashboardData } from './types'

const EMPTY_GRADES = {
  completed: 0,
  missing: 0,
  open: 0,
  pointsEarned: 0,
  pointsPossible: 0,
  rows: [],
}

const EMPTY_PROGRESS = {
  gradeLetter: null,
  gradePercent: null,
  nextBand: null,
  nextBandMin: null,
  streakWeeks: 0,
  tasksDone: 0,
  participationRate: 0,
  note: null,
}

function normalizeDashboard(raw: Partial<DashboardData> | null | undefined): DashboardData {
  const data = raw ?? {}
  return {
    committee: data.committee ?? null,
    campsiteCount: data.campsiteCount ?? 0,
    stats: data.stats ?? {
      gradeLetter: null,
      gradePercent: null,
      openCount: 0,
    },
    nextEvent: data.nextEvent ?? null,
    calendar: data.calendar ?? [],
    attention: data.attention ?? [],
    grades: data.grades ?? EMPTY_GRADES,
    progress: data.progress ?? EMPTY_PROGRESS,
    activity: data.activity ?? [],
    committeeSnapshot: data.committeeSnapshot ?? null,
    liveDebrief: data.liveDebrief ?? null,
    upcoming: data.upcoming ?? [],
  }
}

/**
 * Dashboard contents from `GET /dashboard` — live grade standing;
 * other sections are empty shells until those backends exist.
 */
export function useDashboard() {
  return useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: async () =>
      normalizeDashboard(await apiFetch<Partial<DashboardData>>('/dashboard')),
    staleTime: 30_000,
  })
}
