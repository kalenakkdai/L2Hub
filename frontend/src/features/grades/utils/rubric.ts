import type {
  AssignmentRubric,
  RubricCriterion,
  RubricCriterionScore,
  RubricEvaluation,
} from '../types'

/** Default L2 Hub lateness policy: 10% of the assignment total per day late. */
export const DEFAULT_LATE_PENALTY_PERCENT_PER_DAY = 10

export const ON_TIME_CRITERION_ID = 'criterion-on-time'

export function createDefaultOnTimeCriterion(
  latePenaltyPercentPerDay: number = DEFAULT_LATE_PENALTY_PERCENT_PER_DAY,
): RubricCriterion {
  return {
    id: ON_TIME_CRITERION_ID,
    label: 'On time',
    description: `${latePenaltyPercentPerDay}% of the assignment total is deducted automatically for each calendar day late.`,
    pointsPossible: 0,
    kind: 'on_time',
    latePenaltyPercentPerDay,
    isDefault: true,
  }
}

/**
 * Every assignment rubric includes the On time criterion. If a provider omits
 * it, we prepend the default rather than inventing other grading policy.
 */
export function ensureDefaultRubric(
  criteria: RubricCriterion[],
  latePenaltyPercentPerDay: number = DEFAULT_LATE_PENALTY_PERCENT_PER_DAY,
): AssignmentRubric {
  const withoutOnTime = criteria.filter((criterion) => criterion.kind !== 'on_time')
  const existingOnTime = criteria.find((criterion) => criterion.kind === 'on_time')
  const onTime =
    existingOnTime ?? createDefaultOnTimeCriterion(latePenaltyPercentPerDay)

  return {
    criteria: [
      {
        ...onTime,
        kind: 'on_time',
        isDefault: true,
        latePenaltyPercentPerDay:
          onTime.latePenaltyPercentPerDay ?? latePenaltyPercentPerDay,
        pointsPossible: 0,
      },
      ...withoutOnTime.map((criterion) => ({
        ...criterion,
        kind: 'manual' as const,
      })),
    ],
  }
}

/**
 * Whole calendar days late using provider timestamps only.
 * Does not use the browser clock — both ends must come from the server.
 */
export function lateDaysBetween(
  dueAt: string | null | undefined,
  submittedAt: string | null | undefined,
): number {
  if (!dueAt || !submittedAt) return 0
  const due = Date.parse(dueAt)
  const submitted = Date.parse(submittedAt)
  if (Number.isNaN(due) || Number.isNaN(submitted)) return 0
  if (submitted <= due) return 0

  const msPerDay = 24 * 60 * 60 * 1000
  return Math.ceil((submitted - due) / msPerDay)
}

export function latePenaltyPoints(
  possiblePoints: number,
  lateDays: number,
  percentPerDay: number = DEFAULT_LATE_PENALTY_PERCENT_PER_DAY,
): number {
  if (possiblePoints <= 0 || lateDays <= 0 || percentPerDay <= 0) return 0
  const raw = possiblePoints * (percentPerDay / 100) * lateDays
  return Math.min(possiblePoints, Math.round(raw * 100) / 100)
}

function scoreFor(
  scores: RubricCriterionScore[],
  criterionId: string,
): RubricCriterionScore | undefined {
  return scores.find((score) => score.criterionId === criterionId)
}

export interface EvaluateRubricInput {
  rubric: AssignmentRubric
  scores?: RubricCriterionScore[]
  dueAt?: string | null
  submittedAt?: string | null
}

/**
 * Builds the authoritative breakdown for display and final scoring.
 * Manual parts come from assigner scores; on-time is always recomputed.
 */
export function evaluateRubric({
  rubric,
  scores = [],
  dueAt,
  submittedAt,
}: EvaluateRubricInput): RubricEvaluation {
  const ensured = ensureDefaultRubric(rubric.criteria)
  const manual = ensured.criteria.filter((criterion) => criterion.kind === 'manual')
  const onTime = ensured.criteria.find((criterion) => criterion.kind === 'on_time')!

  const contentPossible = manual.reduce(
    (sum, criterion) => sum + criterion.pointsPossible,
    0,
  )

  let contentEarned: number | null = 0
  const manualScores: RubricCriterionScore[] = []

  for (const criterion of manual) {
    const existing = scoreFor(scores, criterion.id)
    const points =
      typeof existing?.pointsEarned === 'number' ? existing.pointsEarned : null
    if (points === null) contentEarned = null
    else if (contentEarned !== null) contentEarned += points

    manualScores.push({
      criterionId: criterion.id,
      pointsEarned: points,
      note: existing?.note ?? null,
      autoApplied: false,
    })
  }

  const lateDays = lateDaysBetween(dueAt, submittedAt)
  const percent =
    onTime.latePenaltyPercentPerDay ?? DEFAULT_LATE_PENALTY_PERCENT_PER_DAY
  const penalty = latePenaltyPoints(contentPossible, lateDays, percent)

  const onTimeScore: RubricCriterionScore = {
    criterionId: onTime.id,
    pointsEarned: -penalty,
    lateDays,
    autoApplied: true,
    note:
      lateDays === 0
        ? 'Submitted on time — no deduction.'
        : `${lateDays} day${lateDays === 1 ? '' : 's'} late × ${percent}% = −${penalty} pts.`,
  }

  const earnedPoints =
    contentEarned === null ? null : Math.max(0, contentEarned - penalty)

  return {
    scores: [onTimeScore, ...manualScores],
    contentEarned,
    contentPossible,
    lateDays,
    latePenaltyPoints: penalty,
    earnedPoints,
    possiblePoints: contentPossible,
  }
}
