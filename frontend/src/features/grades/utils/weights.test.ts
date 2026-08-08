import { describe, expect, it } from 'vitest'
import {
  computeCategoryBreakdown,
  computeWeightedPercent,
  countsTowardCategory,
} from './weights'
import type { GradeCategory, GradebookEntry } from '../types'

const CATEGORIES: GradeCategory[] = [
  { id: 'cat-debriefs', name: 'Event debriefs', weightPercent: 40 },
  { id: 'cat-reflections', name: 'Reflections', weightPercent: 25 },
  { id: 'cat-deliverables', name: 'Deliverables', weightPercent: 20 },
  { id: 'cat-participation', name: 'Participation', weightPercent: 15 },
]

function entry(
  partial: Pick<GradebookEntry, 'id' | 'status' | 'score' | 'pointsPossible'> &
    Partial<GradebookEntry>,
): GradebookEntry {
  return {
    assignmentId: partial.id,
    assignmentTitle: partial.assignmentTitle ?? partial.id,
    assignmentType: 'task',
    ...partial,
  }
}

describe('countsTowardCategory', () => {
  it('ignores excused and upcoming work', () => {
    expect(
      countsTowardCategory(
        entry({ id: '1', status: 'excused', score: null, pointsPossible: 5 }),
      ),
    ).toBe(false)
    expect(
      countsTowardCategory(
        entry({
          id: '2',
          status: 'not_started',
          score: null,
          pointsPossible: 10,
        }),
      ),
    ).toBe(false)
  })

  it('counts graded and missing work', () => {
    expect(
      countsTowardCategory(
        entry({ id: '1', status: 'graded', score: 8, pointsPossible: 10 }),
      ),
    ).toBe(true)
    expect(
      countsTowardCategory(
        entry({ id: '2', status: 'missing', score: 0, pointsPossible: 10 }),
      ),
    ).toBe(true)
  })
})

describe('Canvas-style weighted categories', () => {
  const entries = [
    entry({
      id: 'd1',
      status: 'graded',
      score: 10,
      pointsPossible: 10,
      categoryId: 'cat-debriefs',
    }),
    entry({
      id: 'r1',
      status: 'late',
      score: 7,
      pointsPossible: 10,
      categoryId: 'cat-reflections',
    }),
    entry({
      id: 'p1',
      status: 'missing',
      score: 0,
      pointsPossible: 10,
      categoryId: 'cat-participation',
    }),
    entry({
      id: 'del1',
      status: 'not_started',
      score: null,
      pointsPossible: 10,
      categoryId: 'cat-deliverables',
    }),
  ]

  it('scores each category out of its own point total', () => {
    const breakdown = computeCategoryBreakdown(CATEGORIES, entries)
    const debriefs = breakdown.find((row) => row.categoryId === 'cat-debriefs')
    const reflections = breakdown.find(
      (row) => row.categoryId === 'cat-reflections',
    )
    const deliverables = breakdown.find(
      (row) => row.categoryId === 'cat-deliverables',
    )

    expect(debriefs).toMatchObject({
      earnedPoints: 10,
      possiblePoints: 10,
      percent: 100,
    })
    expect(reflections).toMatchObject({
      earnedPoints: 7,
      possiblePoints: 10,
      percent: 70,
    })
    // No countable work yet — dropped from the weighted final.
    expect(deliverables?.percent).toBeNull()
    expect(deliverables?.weightedContribution).toBeNull()
  })

  it('renormalizes weights across categories that have scores', () => {
    const breakdown = computeCategoryBreakdown(CATEGORIES, entries)
    // Active weights: 40 + 25 + 15 = 80 (deliverables dropped)
    // (100*40 + 70*25 + 0*15) / 80 = 71.875 → 71.9
    expect(computeWeightedPercent(breakdown)).toBe(71.9)
  })
})
