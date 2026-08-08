import { useEffect, useMemo, useState } from 'react'
import type {
  AssignmentRubric,
  RubricCriterionScore,
  RubricEvaluation,
} from '../types'
import { formatScore } from '../utils/format'
import {
  ensureDefaultRubric,
  evaluateRubric,
} from '../utils/rubric'

export interface AssignmentRubricPanelProps {
  rubric: AssignmentRubric
  evaluation: RubricEvaluation | null
  dueAt?: string | null
  submittedAt?: string | null
  /** When true, assigners can edit manual criterion scores. */
  editable?: boolean
  busy?: boolean
  onSave?: (scores: RubricCriterionScore[]) => void
}

function scoreMap(
  evaluation: RubricEvaluation | null,
): Map<string, RubricCriterionScore> {
  return new Map((evaluation?.scores ?? []).map((score) => [score.criterionId, score]))
}

/**
 * Rubric breakdown shared by students (read-only while working) and assigners
 * (editable manual parts). On time is always automatic.
 */
export function AssignmentRubricPanel({
  rubric,
  evaluation,
  dueAt,
  submittedAt,
  editable = false,
  busy = false,
  onSave,
}: AssignmentRubricPanelProps) {
  const ensured = useMemo(() => ensureDefaultRubric(rubric.criteria), [rubric])
  const [draft, setDraft] = useState<Record<string, string>>({})

  useEffect(() => {
    const next: Record<string, string> = {}
    const map = scoreMap(evaluation)
    for (const criterion of ensured.criteria) {
      if (criterion.kind !== 'manual') continue
      const points = map.get(criterion.id)?.pointsEarned
      next[criterion.id] =
        typeof points === 'number' ? String(points) : ''
    }
    setDraft(next)
  }, [ensured, evaluation])

  const existing = scoreMap(evaluation)
  const previewScores: RubricCriterionScore[] = ensured.criteria
    .filter((criterion) => criterion.kind === 'manual')
    .map((criterion) => {
      const raw = draft[criterion.id]
      const parsed =
        raw === undefined || raw.trim() === '' ? null : Number(raw)
      return {
        criterionId: criterion.id,
        pointsEarned:
          parsed === null || Number.isNaN(parsed) ? null : parsed,
        note: existing.get(criterion.id)?.note ?? null,
      }
    })

  const live = evaluateRubric({
    rubric: ensured,
    scores: previewScores,
    dueAt,
    submittedAt,
  })

  const onTime = ensured.criteria.find((criterion) => criterion.kind === 'on_time')
  const onTimeScore = live.scores.find((score) => score.criterionId === onTime?.id)

  return (
    <section
      aria-labelledby="assignment-rubric-heading"
      data-testid="assignment-rubric"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2
          id="assignment-rubric-heading"
          className="text-[13px] font-semibold text-ink"
        >
          Rubric
        </h2>
        <p className="text-xs tabular-nums text-ink-muted">
          {formatScore(live.earnedPoints, live.possiblePoints)}
        </p>
      </div>
      <p className="mt-1 text-xs text-ink-muted">
        Grade breakdown by part. On time is scored automatically
        {onTime?.latePenaltyPercentPerDay
          ? ` (−${onTime.latePenaltyPercentPerDay}% of the total per day late)`
          : ''}
        .
      </p>

      <ul className="mt-3 divide-y divide-border-subtle rounded-control border border-border-subtle">
        {ensured.criteria.map((criterion) => {
          const scored = live.scores.find(
            (score) => score.criterionId === criterion.id,
          )
          const isOnTime = criterion.kind === 'on_time'

          return (
            <li key={criterion.id} className="px-3 py-2.5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink">
                    {criterion.label}
                    {criterion.isDefault ? (
                      <span className="ml-1.5 text-[11px] font-normal text-ink-subtle">
                        Default
                      </span>
                    ) : null}
                  </p>
                  {criterion.description ? (
                    <p className="mt-0.5 text-xs text-ink-muted">
                      {criterion.description}
                    </p>
                  ) : null}
                  {scored?.note ? (
                    <p className="mt-1 text-xs text-ink-subtle">{scored.note}</p>
                  ) : null}
                </div>

                <div className="shrink-0 text-right">
                  {isOnTime ? (
                    <p
                      className={`text-sm font-semibold tabular-nums ${
                        (scored?.pointsEarned ?? 0) < 0
                          ? 'text-status-warning'
                          : 'text-ink'
                      }`}
                      data-testid="rubric-on-time-score"
                    >
                      {scored?.pointsEarned === 0 || scored?.pointsEarned == null
                        ? 'No deduction'
                        : `${scored.pointsEarned} pts`}
                    </p>
                  ) : editable ? (
                    <label className="inline-flex items-center gap-1 text-xs text-ink-muted">
                      <span className="sr-only">
                        Points for {criterion.label}
                      </span>
                      <input
                        type="number"
                        min={0}
                        max={criterion.pointsPossible}
                        step={0.5}
                        value={draft[criterion.id] ?? ''}
                        disabled={busy}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            [criterion.id]: event.target.value,
                          }))
                        }
                        className="w-16 rounded-control border border-border-strong bg-surface px-2 py-1 text-right text-sm tabular-nums text-ink"
                        data-testid={`rubric-score-${criterion.id}`}
                      />
                      <span>/ {criterion.pointsPossible}</span>
                    </label>
                  ) : (
                    <p className="text-sm font-semibold tabular-nums text-ink">
                      {formatScore(
                        scored?.pointsEarned ?? null,
                        criterion.pointsPossible,
                      )}
                    </p>
                  )}
                </div>
              </div>
            </li>
          )
        })}
      </ul>

      {editable && onSave ? (
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            data-testid="save-rubric-grades"
            disabled={busy}
            className="rounded-control bg-accent-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-700 disabled:opacity-50"
            onClick={() => onSave(previewScores)}
          >
            Save rubric grades
          </button>
        </div>
      ) : null}

      {!submittedAt && onTimeScore ? (
        <p className="mt-2 text-[11px] text-ink-subtle">
          On-time credit is applied from the submission timestamp after you
          submit — the browser clock is not used.
        </p>
      ) : null}
    </section>
  )
}
