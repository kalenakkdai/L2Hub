import type {
  GradeCategory,
  GradebookEntry,
  GradebookSummary,
  TheoreticalGradeScenario,
} from '../types'
import {
  computeCategoryBreakdown,
  computeWeightedPercent,
  withWeightedSummary,
} from './weights'

/**
 * Overlay hypothetical scores onto real gradebook entries.
 * Assignments with a theoretical score count even if they were still upcoming.
 */
export function applyTheoreticalScores(
  entries: GradebookEntry[],
  scores: Record<string, number>,
): GradebookEntry[] {
  return entries.map((entry) => {
    if (!(entry.id in scores)) return entry
    const pointsPossible = entry.pointsPossible ?? 0
    const raw = scores[entry.id]
    const clamped = Math.min(
      pointsPossible,
      Math.max(0, Number.isFinite(raw) ? raw : 0),
    )
    return {
      ...entry,
      score: clamped,
      // So Canvas-style category math includes this what-if row.
      status: entry.status === 'excused' ? entry.status : 'graded',
    }
  })
}

export function summarizeWithTheoreticals(
  entries: GradebookEntry[],
  categories: GradeCategory[],
  scores: Record<string, number>,
): GradebookSummary {
  const merged = applyTheoreticalScores(entries, scores)
  const earnedPoints = merged.reduce(
    (sum, entry) => sum + (typeof entry.score === 'number' ? entry.score : 0),
    0,
  )
  const possiblePoints = merged.reduce(
    (sum, entry) =>
      sum + (typeof entry.pointsPossible === 'number' ? entry.pointsPossible : 0),
    0,
  )
  const base: GradebookSummary = {
    earnedPoints,
    possiblePoints,
    completionPercent:
      possiblePoints > 0
        ? Math.round((earnedPoints / possiblePoints) * 1000) / 10
        : undefined,
  }
  return withWeightedSummary(base, categories, merged)
}

export function theoreticalWeightedPercent(
  entries: GradebookEntry[],
  categories: GradeCategory[],
  scores: Record<string, number>,
): number | null {
  const summary = summarizeWithTheoreticals(entries, categories, scores)
  if (typeof summary.weightedPercent === 'number') return summary.weightedPercent
  const breakdown = computeCategoryBreakdown(
    categories,
    applyTheoreticalScores(entries, scores),
  )
  return computeWeightedPercent(breakdown)
}

const STORAGE_KEY = 'l2hub.gradebook.theoreticals'

export function loadTheoreticalScenarios(): TheoreticalGradeScenario[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as TheoreticalGradeScenario[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveTheoreticalScenarios(
  scenarios: TheoreticalGradeScenario[],
): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(scenarios))
}

export function createTheoreticalScenario(input: {
  name: string
  scores: Record<string, number>
  weightedPercent: number | null
}): TheoreticalGradeScenario {
  return {
    id: `th-${Date.now().toString(36)}`,
    name: input.name.trim() || 'Untitled theoretical',
    scores: { ...input.scores },
    weightedPercent: input.weightedPercent,
    savedAt: new Date().toISOString(),
  }
}
