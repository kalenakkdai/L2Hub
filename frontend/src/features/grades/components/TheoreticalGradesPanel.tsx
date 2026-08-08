import { useEffect, useMemo, useState } from 'react'
import type {
  GradeCategory,
  GradebookEntry,
  TheoreticalGradeScenario,
} from '../types'
import { formatScore } from '../utils/format'
import {
  createTheoreticalScenario,
  loadTheoreticalScenarios,
  saveTheoreticalScenarios,
  summarizeWithTheoreticals,
} from '../utils/theoreticals'

export interface TheoreticalGradesPanelProps {
  entries: GradebookEntry[]
  categories: GradeCategory[]
  actualWeightedPercent?: number | null
}

/**
 * Canvas-style what-if grades: enter hypothetical scores, see the weighted
 * total update, and save named theoreticals to the sidebar list.
 */
export function TheoreticalGradesPanel({
  entries,
  categories,
  actualWeightedPercent = null,
}: TheoreticalGradesPanelProps) {
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [scenarioName, setScenarioName] = useState('')
  const [saved, setSaved] = useState<TheoreticalGradeScenario[]>(() =>
    loadTheoreticalScenarios(),
  )
  const [activeId, setActiveId] = useState<string | null>(null)

  useEffect(() => {
    saveTheoreticalScenarios(saved)
  }, [saved])

  const editable = useMemo(
    () =>
      entries.filter(
        (entry) =>
          entry.status !== 'excused' &&
          typeof entry.pointsPossible === 'number' &&
          entry.pointsPossible > 0,
      ),
    [entries],
  )

  const numericScores = useMemo(() => {
    const scores: Record<string, number> = {}
    for (const [entryId, raw] of Object.entries(draft)) {
      if (raw.trim() === '') continue
      const value = Number(raw)
      if (!Number.isNaN(value)) scores[entryId] = value
    }
    return scores
  }, [draft])

  const theoreticalSummary = useMemo(
    () => summarizeWithTheoreticals(entries, categories, numericScores),
    [entries, categories, numericScores],
  )

  const hasDraft = Object.keys(numericScores).length > 0

  const loadScenario = (scenario: TheoreticalGradeScenario) => {
    const next: Record<string, string> = {}
    for (const [entryId, score] of Object.entries(scenario.scores)) {
      next[entryId] = String(score)
    }
    setDraft(next)
    setScenarioName(scenario.name)
    setActiveId(scenario.id)
  }

  const saveScenario = () => {
    if (!hasDraft) return
    const scenario = createTheoreticalScenario({
      name: scenarioName || `Theoretical ${saved.length + 1}`,
      scores: numericScores,
      weightedPercent: theoreticalSummary.weightedPercent ?? null,
    })
    setSaved((current) => [scenario, ...current])
    setActiveId(scenario.id)
    setScenarioName(scenario.name)
  }

  const removeScenario = (id: string) => {
    setSaved((current) => current.filter((scenario) => scenario.id !== id))
    if (activeId === id) setActiveId(null)
  }

  const clearDraft = () => {
    setDraft({})
    setScenarioName('')
    setActiveId(null)
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_280px]">
      <section
        aria-labelledby="theoretical-grades-heading"
        className="rounded-card border border-border-subtle bg-surface p-4 shadow-xs"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2
              id="theoretical-grades-heading"
              className="text-sm font-semibold text-ink"
            >
              Theoretical grades
            </h2>
            <p className="mt-1 text-xs text-ink-muted">
              Enter what-if scores to preview your weighted total. Saved
              theoreticals stay in the sidebar on this device.
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px] font-medium text-ink-subtle">What-if total</p>
            <p
              className="text-lg font-semibold tabular-nums text-ink"
              data-testid="theoretical-weighted-total"
            >
              {typeof theoreticalSummary.weightedPercent === 'number'
                ? `${theoreticalSummary.weightedPercent}%`
                : '—'}
            </p>
            {typeof actualWeightedPercent === 'number' ? (
              <p className="text-[11px] text-ink-subtle">
                Actual {actualWeightedPercent}%
              </p>
            ) : null}
          </div>
        </div>

        <ul className="mt-4 divide-y divide-border-subtle rounded-control border border-border-subtle">
          {editable.map((entry) => {
            const category = categories.find((item) => item.id === entry.categoryId)
            const actual =
              typeof entry.score === 'number'
                ? formatScore(entry.score, entry.pointsPossible)
                : `— / ${entry.pointsPossible}`
            return (
              <li
                key={entry.id}
                className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">
                    {entry.assignmentTitle}
                  </p>
                  <p className="text-[11px] text-ink-subtle">
                    {category?.name ?? 'Uncategorized'} · Actual {actual}
                  </p>
                </div>
                <label className="inline-flex items-center gap-1 text-xs text-ink-muted">
                  <span className="sr-only">
                    Theoretical score for {entry.assignmentTitle}
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={entry.pointsPossible ?? undefined}
                    step={0.5}
                    value={draft[entry.id] ?? ''}
                    placeholder="What-if"
                    data-testid={`theoretical-score-${entry.id}`}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        [entry.id]: event.target.value,
                      }))
                    }
                    className="w-20 rounded-control border border-border-strong bg-surface px-2 py-1 text-right text-sm tabular-nums text-ink"
                  />
                  <span>/ {entry.pointsPossible}</span>
                </label>
              </li>
            )
          })}
        </ul>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <label
              htmlFor="theoretical-name"
              className="text-xs font-medium text-ink-muted"
            >
              Save as
            </label>
            <input
              id="theoretical-name"
              value={scenarioName}
              onChange={(event) => setScenarioName(event.target.value)}
              placeholder="e.g. Full credit on Spring Formal"
              className="mt-1 w-full rounded-control border border-border-strong px-3 py-2 text-sm"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              data-testid="save-theoretical"
              disabled={!hasDraft}
              onClick={saveScenario}
              className="rounded-control bg-accent-600 px-3 py-2 text-sm font-medium text-white hover:bg-accent-700 disabled:opacity-50"
            >
              Save theoretical
            </button>
            <button
              type="button"
              onClick={clearDraft}
              className="rounded-control border border-border-strong px-3 py-2 text-sm font-medium text-ink-muted hover:bg-surface-sunken"
            >
              Clear
            </button>
          </div>
        </div>
      </section>

      <aside
        aria-label="Saved theoreticals"
        className="rounded-card border border-border-subtle bg-surface-sunken p-4 shadow-xs"
      >
        <h3 className="text-sm font-semibold text-ink">Saved theoreticals</h3>
        <p className="mt-1 text-xs text-ink-muted">
          Load a scenario back into the what-if inputs.
        </p>
        <ul className="mt-3 space-y-2">
          {saved.map((scenario) => (
            <li
              key={scenario.id}
              className={`rounded-control border px-3 py-2 ${
                activeId === scenario.id
                  ? 'border-accent-600 bg-accent-50'
                  : 'border-border-subtle bg-surface'
              }`}
            >
              <button
                type="button"
                className="w-full text-left"
                onClick={() => loadScenario(scenario)}
              >
                <p className="text-sm font-medium text-ink">{scenario.name}</p>
                <p className="mt-0.5 text-[11px] tabular-nums text-ink-subtle">
                  {scenario.weightedPercent !== null
                    ? `${scenario.weightedPercent}% weighted`
                    : 'No weighted total'}
                </p>
              </button>
              <button
                type="button"
                className="mt-1 text-[11px] font-medium text-status-danger hover:underline"
                onClick={() => removeScenario(scenario.id)}
              >
                Delete
              </button>
            </li>
          ))}
          {saved.length === 0 ? (
            <li className="text-xs text-ink-muted">
              No theoreticals saved yet.
            </li>
          ) : null}
        </ul>
      </aside>
    </div>
  )
}
