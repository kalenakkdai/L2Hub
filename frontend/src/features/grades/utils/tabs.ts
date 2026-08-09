import type { AssignmentGradebookTab, GradebookEntry, GradebookTab } from '../types'

export const ASSIGNMENT_TABS: AssignmentGradebookTab[] = [
  'upcoming',
  'missing',
  'completed',
]

export const GRADEBOOK_TABS: GradebookTab[] = [...ASSIGNMENT_TABS, 'syllabus']

export function isAssignmentGradebookTab(
  tab: GradebookTab,
): tab is AssignmentGradebookTab {
  return tab === 'upcoming' || tab === 'missing' || tab === 'completed'
}

export function parseGradebookTab(value: string | null): GradebookTab {
  if (
    value === 'missing' ||
    value === 'completed' ||
    value === 'upcoming' ||
    value === 'syllabus'
  ) {
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
    case 'syllabus':
      return 'Syllabus'
  }
}

/**
 * Buckets an entry into the Grades page assignment tabs.
 * Every status maps to exactly one tab so nothing disappears from the list.
 */
export function gradebookTabFor(entry: GradebookEntry): AssignmentGradebookTab {
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
  tab: AssignmentGradebookTab,
): GradebookEntry[] {
  return entries.filter((entry) => gradebookTabFor(entry) === tab)
}

export function countEntriesByTab(
  entries: GradebookEntry[],
): Record<AssignmentGradebookTab, number> {
  return {
    missing: filterEntriesByTab(entries, 'missing').length,
    completed: filterEntriesByTab(entries, 'completed').length,
    upcoming: filterEntriesByTab(entries, 'upcoming').length,
  }
}
