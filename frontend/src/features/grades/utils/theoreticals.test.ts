import { beforeEach, describe, expect, it } from 'vitest'
import {
  applyTheoreticalScores,
  createTheoreticalScenario,
  loadTheoreticalScenarios,
  saveTheoreticalScenarios,
  summarizeWithTheoreticals,
} from './theoreticals'
import type { GradeCategory, GradebookEntry } from '../types'

const CATEGORIES: GradeCategory[] = [
  { id: 'cat-a', name: 'Group A', weightPercent: 50 },
  { id: 'cat-b', name: 'Group B', weightPercent: 50 },
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

describe('applyTheoreticalScores', () => {
  it('overlays hypothetical scores and clamps to points possible', () => {
    const merged = applyTheoreticalScores(
      [
        entry({
          id: 'open',
          status: 'not_started',
          score: null,
          pointsPossible: 10,
          categoryId: 'cat-b',
        }),
      ],
      { open: 15 },
    )
    expect(merged[0].score).toBe(10)
    expect(merged[0].status).toBe('graded')
  })
})

describe('summarizeWithTheoreticals', () => {
  it('recalculates the weighted total from what-if scores', () => {
    const entries = [
      entry({
        id: 'done',
        status: 'graded',
        score: 10,
        pointsPossible: 10,
        categoryId: 'cat-a',
      }),
      entry({
        id: 'open',
        status: 'not_started',
        score: null,
        pointsPossible: 10,
        categoryId: 'cat-b',
      }),
    ]
    // Without theoreticals, only cat-a counts → 100%
    const actual = summarizeWithTheoreticals(entries, CATEGORIES, {})
    expect(actual.weightedPercent).toBe(100)

    // With a 5/10 what-if on cat-b: (100*50 + 50*50) / 100 = 75
    const whatIf = summarizeWithTheoreticals(entries, CATEGORIES, { open: 5 })
    expect(whatIf.weightedPercent).toBe(75)
  })
})

describe('createTheoreticalScenario', () => {
  it('stores a named snapshot of what-if scores', () => {
    const scenario = createTheoreticalScenario({
      name: 'If I get full credit on Spring',
      scores: { open: 10 },
      weightedPercent: 100,
    })
    expect(scenario.name).toBe('If I get full credit on Spring')
    expect(scenario.scores.open).toBe(10)
    expect(scenario.weightedPercent).toBe(100)
    expect(scenario.id).toMatch(/^th-/)
  })
})

describe('theoretical scenario storage', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('round-trips saved theoreticals through localStorage', () => {
    const scenario = createTheoreticalScenario({
      name: 'Full credit path',
      scores: { open: 10 },
      weightedPercent: 100,
    })
    saveTheoreticalScenarios([scenario])
    expect(loadTheoreticalScenarios()).toEqual([scenario])
  })

  it('returns an empty list for corrupt storage', () => {
    window.localStorage.setItem('l2hub.gradebook.theoreticals', '{not-json')
    expect(loadTheoreticalScenarios()).toEqual([])
  })
})
