import type { ModuleGroupKey } from './types'

/** Display labels for each group. */
export const GROUP_LABELS: Record<ModuleGroupKey, string> = {
  my_work: 'My work',
  committee: 'Committee',
  events: 'Events',
  leadership: 'Leadership tools',
}

/** Render order. Groups with no modules are skipped entirely. */
export const GROUP_ORDER: ModuleGroupKey[] = [
  'my_work',
  'committee',
  'events',
  'leadership',
]
