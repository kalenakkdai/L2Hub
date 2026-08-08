import type { GradebookEntry, GradebookTab } from '../types'

export const GRADEBOOK_TABS: GradebookTab[] = [
  'upcoming',
  'missing',
  'completed',
]

export function parseGradebookTab(value: string | null): GradebookTab {
  if (value === 'missing' || value === 'completed' || value === 'upcoming') {
    return value
  }
  return 'upcoming'
}

export function gradebookTabLabel(tab: GradebookTab): string {
  switch (tab) {
    case 'missing':
      return 'Missing'
    case 'completed':
      return 'Completed'
    case 'upcoming':
      return 'Upcoming'
  }
}

/**
 * Buckets an entry into the Grades page tabs.
 * Every status maps to exactly one tab so nothing disappears from the list.
 */
export function gradebookTabFor(entry: GradebookEntry): GradebookTab {
  switch (entry.status) {
    case 'missing':
      return 'missing'
    case 'graded':
    case 'submitted':
    case 'late':
    case 'excused':
    case 'closed':
      return 'completed'
    case 'not_started':
    case 'draft':
    default:
      return 'upcoming'
  }
}

export function filterEntriesByTab(
  entries: GradebookEntry[],
  tab: GradebookTab,
): GradebookEntry[] {
  return entries.filter((entry) => gradebookTabFor(entry) === tab)
}

export function countEntriesByTab(
  entries: GradebookEntry[],
): Record<GradebookTab, number> {
  return {
    missing: filterEntriesByTab(entries, 'missing').length,
    completed: filterEntriesByTab(entries, 'completed').length,
    upcoming: filterEntriesByTab(entries, 'upcoming').length,
  }
}
