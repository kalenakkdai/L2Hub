import { describe, expect, it } from 'vitest'
import {
  DEFAULT_LATE_PENALTY_PERCENT_PER_DAY,
  createDefaultOnTimeCriterion,
  ensureDefaultRubric,
  evaluateRubric,
  lateDaysBetween,
  latePenaltyPoints,
} from './rubric'

describe('createDefaultOnTimeCriterion', () => {
  it('uses the 10% per day default policy', () => {
    const criterion = createDefaultOnTimeCriterion()
    expect(criterion.kind).toBe('on_time')
    expect(criterion.isDefault).toBe(true)
    expect(criterion.latePenaltyPercentPerDay).toBe(
      DEFAULT_LATE_PENALTY_PERCENT_PER_DAY,
    )
    expect(criterion.label).toBe('On time')
  })
})

describe('ensureDefaultRubric', () => {
  it('prepends On time when the provider omitted it', () => {
    const rubric = ensureDefaultRubric([
      {
        id: 'c1',
        label: 'Content',
        pointsPossible: 10,
        kind: 'manual',
      },
    ])
    expect(rubric.criteria[0].kind).toBe('on_time')
    expect(rubric.criteria).toHaveLength(2)
  })

  it('does not duplicate an existing On time criterion', () => {
    const rubric = ensureDefaultRubric([
      createDefaultOnTimeCriterion(),
      {
        id: 'c1',
        label: 'Content',
        pointsPossible: 10,
        kind: 'manual',
      },
    ])
    expect(rubric.criteria.filter((c) => c.kind === 'on_time')).toHaveLength(1)
  })
})

describe('lateDaysBetween', () => {
  it('is zero when submission is missing or on time', () => {
    expect(lateDaysBetween('2026-08-12T22:45:00.000Z', null)).toBe(0)
    expect(
      lateDaysBetween(
        '2026-08-12T22:45:00.000Z',
        '2026-08-12T22:43:00.000Z',
      ),
    ).toBe(0)
  })

  it('counts whole calendar days late from provider timestamps', () => {
    expect(
      lateDaysBetween(
        '2026-08-12T22:45:00.000Z',
        '2026-08-13T00:00:00.000Z',
      ),
    ).toBe(1)
    expect(
      lateDaysBetween(
        '2026-08-12T22:45:00.000Z',
        '2026-08-14T22:45:00.000Z',
      ),
    ).toBe(2)
  })
})

describe('latePenaltyPoints', () => {
  it('deducts 10% of the total per day and caps at the total', () => {
    expect(latePenaltyPoints(10, 1)).toBe(1)
    expect(latePenaltyPoints(10, 2)).toBe(2)
    expect(latePenaltyPoints(10, 15)).toBe(10)
    expect(latePenaltyPoints(10, 0)).toBe(0)
  })
})

describe('evaluateRubric', () => {
  const rubric = ensureDefaultRubric([
    {
      id: 'completeness',
      label: 'Completeness',
      pointsPossible: 4,
      kind: 'manual',
    },
    {
      id: 'quality',
      label: 'Quality',
      pointsPossible: 6,
      kind: 'manual',
    },
  ])

  it('sums manual scores and applies the on-time penalty', () => {
    const evaluation = evaluateRubric({
      rubric,
      scores: [
        { criterionId: 'completeness', pointsEarned: 4 },
        { criterionId: 'quality', pointsEarned: 6 },
      ],
      dueAt: '2026-08-12T22:45:00.000Z',
      submittedAt: '2026-08-14T22:45:00.000Z',
    })

    expect(evaluation.contentEarned).toBe(10)
    expect(evaluation.lateDays).toBe(2)
    expect(evaluation.latePenaltyPoints).toBe(2)
    expect(evaluation.earnedPoints).toBe(8)
    expect(evaluation.scores[0].autoApplied).toBe(true)
    expect(evaluation.scores[0].pointsEarned).toBe(-2)
  })

  it('leaves earnedPoints null until every manual part is scored', () => {
    const evaluation = evaluateRubric({
      rubric,
      scores: [{ criterionId: 'completeness', pointsEarned: 4 }],
      dueAt: '2026-08-12T22:45:00.000Z',
      submittedAt: '2026-08-12T22:40:00.000Z',
    })
    expect(evaluation.earnedPoints).toBeNull()
    expect(evaluation.latePenaltyPoints).toBe(0)
  })

  it('shows full on-time credit when submitted before the due time', () => {
    const evaluation = evaluateRubric({
      rubric,
      scores: [
        { criterionId: 'completeness', pointsEarned: 4 },
        { criterionId: 'quality', pointsEarned: 6 },
      ],
      dueAt: '2026-08-12T22:45:00.000Z',
      submittedAt: '2026-08-12T22:43:00.000Z',
    })
    expect(evaluation.lateDays).toBe(0)
    expect(evaluation.earnedPoints).toBe(10)
    expect(evaluation.scores[0].note).toMatch(/on time/i)
  })
})
