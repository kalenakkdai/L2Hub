import type {
  CategoryGradeSummary,
  GradeCategory,
  GradebookEntry,
  GradebookSummary,
} from '../types'

/**
 * Canvas-style rule: only scored / past-due work counts inside a category.
 * Upcoming drafts and excused work are left out of the category total.
 */
export function countsTowardCategory(entry: GradebookEntry): boolean {
  if (entry.status === 'excused') return false
  if (entry.status === 'not_started' || entry.status === 'draft') return false
  return (
    typeof entry.pointsPossible === 'number' &&
    entry.pointsPossible > 0 &&
    (typeof entry.score === 'number' || entry.status === 'missing')
  )
}

export function categoryPercent(
  earnedPoints: number,
  possiblePoints: number,
): number | null {
  if (possiblePoints <= 0) return null
  return Math.round((earnedPoints / possiblePoints) * 1000) / 10
}

/**
 * Weighted final grade the way Canvas Assignment Groups work:
 * each category is points-earned / points-possible, then those percents are
 * combined by weight. Categories with no countable work are dropped and the
 * remaining weights are renormalized.
 */
export function computeCategoryBreakdown(
  categories: GradeCategory[],
  entries: GradebookEntry[],
): CategoryGradeSummary[] {
  const activeWeightTotal = categories.reduce((sum, category) => {
    const hasWork = entries.some(
      (entry) =>
        entry.categoryId === category.id && countsTowardCategory(entry),
    )
    return hasWork ? sum + category.weightPercent : sum
  }, 0)

  return categories.map((category) => {
    const inCategory = entries.filter(
      (entry) =>
        entry.categoryId === category.id && countsTowardCategory(entry),
    )
    const earnedPoints = inCategory.reduce(
      (sum, entry) => sum + (typeof entry.score === 'number' ? entry.score : 0),
      0,
    )
    const possiblePoints = inCategory.reduce(
      (sum, entry) => sum + (entry.pointsPossible ?? 0),
      0,
    )
    const percent = categoryPercent(earnedPoints, possiblePoints)
    const weightedContribution =
      percent === null || activeWeightTotal <= 0
        ? null
        : Math.round(
            ((percent * category.weightPercent) / activeWeightTotal) * 10,
          ) / 10

    return {
      categoryId: category.id,
      name: category.name,
      weightPercent: category.weightPercent,
      earnedPoints,
      possiblePoints,
      percent,
      weightedContribution,
      assignmentCount: entries.filter((entry) => entry.categoryId === category.id)
        .length,
      scoredCount: inCategory.length,
    }
  })
}

export function computeWeightedPercent(
  breakdown: CategoryGradeSummary[],
): number | null {
  const parts = breakdown.filter(
    (row) => typeof row.weightedContribution === 'number',
  )
  if (parts.length === 0) return null
  const total = parts.reduce(
    (sum, row) => sum + (row.weightedContribution ?? 0),
    0,
  )
  return Math.round(total * 10) / 10
}

export function withWeightedSummary(
  base: GradebookSummary,
  categories: GradeCategory[],
  entries: GradebookEntry[],
): GradebookSummary {
  if (categories.length === 0) return base
  const categoryBreakdown = computeCategoryBreakdown(categories, entries)
  return {
    ...base,
    categoryBreakdown,
    weightedPercent: computeWeightedPercent(categoryBreakdown) ?? undefined,
  }
}
