import type { AssignmentGradebookTab, GradebookTab } from '../types'
import {
  GRADEBOOK_TABS,
  gradebookTabLabel,
  isAssignmentGradebookTab,
} from '../utils/tabs'

export interface GradesTabsProps {
  active: GradebookTab
  counts: Record<AssignmentGradebookTab, number>
  onChange: (tab: GradebookTab) => void
}

export function GradesTabs({ active, counts, onChange }: GradesTabsProps) {
  return (
    <div
      className="flex flex-wrap gap-1 border-b border-border-subtle"
      role="tablist"
      aria-label="Gradebook sections"
    >
      {GRADEBOOK_TABS.map((tab) => {
        const selected = active === tab
        return (
          <button
            key={tab}
            type="button"
            role="tab"
            id={`grades-tab-${tab}`}
            aria-selected={selected}
            aria-controls={`grades-panel-${tab}`}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition ${
              selected
                ? 'border-accent-600 text-ink'
                : 'border-transparent text-ink-muted hover:text-ink'
            }`}
            onClick={() => onChange(tab)}
          >
            {gradebookTabLabel(tab)}
            {isAssignmentGradebookTab(tab) ? (
              <span className="ml-1.5 tabular-nums text-ink-subtle">
                {counts[tab]}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
