import { useState } from 'react'
import type { AssignmentRubric, RubricCriterion } from '../types'
import { ensureDefaultRubric } from '../utils/rubric'

const field =
  'mt-1 w-full rounded-control border border-border-subtle bg-surface px-2 py-1.5 text-sm text-ink'
const barButton =
  'rounded-control border border-border-strong bg-surface px-3 py-1.5 text-xs font-medium text-ink hover:bg-surface-sunken disabled:opacity-50'

type Props = {
  rubric: AssignmentRubric
  onSave: (rubric: AssignmentRubric) => void
  saving?: boolean
}

/**
 * Jan/Jadon-only editor for rubric structure (not scoring).
 * Default On time criterion cannot be removed.
 */
export function RubricEditorPanel({ rubric, onSave, saving }: Props) {
  const [criteria, setCriteria] = useState<RubricCriterion[]>(() =>
    rubric.criteria.filter((c) => c.kind === 'manual'),
  )

  const update = (id: string, patch: Partial<RubricCriterion>) => {
    setCriteria((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    )
  }

  const remove = (id: string) => {
    setCriteria((prev) => prev.filter((c) => c.id !== id))
  }

  const add = () => {
    const id = `crit-${Date.now()}`
    setCriteria((prev) => [
      ...prev,
      {
        id,
        label: 'New criterion',
        pointsPossible: 2,
        kind: 'manual',
      },
    ])
  }

  return (
    <section className="space-y-3 rounded-card border border-border-subtle bg-surface p-4 shadow-xs">
      <header>
        <h2 className="text-sm font-semibold text-ink">Edit rubric</h2>
        <p className="mt-0.5 text-xs text-ink-subtle">
          Jan and Jadon only. On time stays automatic and cannot be removed.
        </p>
      </header>
      <ul className="space-y-3">
        {criteria.map((criterion) => (
          <li key={criterion.id} className="grid gap-2 sm:grid-cols-[1fr_5rem_auto]">
            <label className="text-xs text-ink-muted">
              Label
              <input
                className={field}
                value={criterion.label}
                onChange={(e) => update(criterion.id, { label: e.target.value })}
              />
            </label>
            <label className="text-xs text-ink-muted">
              Points
              <input
                className={field}
                type="number"
                min={0}
                value={criterion.pointsPossible}
                onChange={(e) =>
                  update(criterion.id, {
                    pointsPossible: Number(e.target.value) || 0,
                  })
                }
              />
            </label>
            <div className="flex items-end">
              <button
                type="button"
                className={barButton}
                onClick={() => remove(criterion.id)}
                disabled={criteria.length <= 1}
              >
                Remove
              </button>
            </div>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={barButton} onClick={add}>
          Add criterion
        </button>
        <button
          type="button"
          className={barButton}
          disabled={saving}
          onClick={() => onSave(ensureDefaultRubric(criteria))}
        >
          {saving ? 'Saving…' : 'Save rubric'}
        </button>
      </div>
    </section>
  )
}
