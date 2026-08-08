import type { GradeDistribution, GradeDistributionBucket } from '../types'

/**
 * Default percentage bands for the distribution bar.
 * Providers may supply their own buckets; otherwise these are derived from
 * anonymized score percentages.
 */
export const DEFAULT_DISTRIBUTION_BANDS = [
  { label: '0–59', min: 0, max: 60 },
  { label: '60–69', min: 60, max: 70 },
  { label: '70–79', min: 70, max: 80 },
  { label: '80–89', min: 80, max: 90 },
  { label: '90–100', min: 90, max: 101 },
] as const

export function meanOf(values: number[]): number | null {
  if (values.length === 0) return null
  const sum = values.reduce((total, value) => total + value, 0)
  return Math.round((sum / values.length) * 10) / 10
}

export function medianOf(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) return sorted[mid]
  return Math.round(((sorted[mid - 1] + sorted[mid]) / 2) * 10) / 10
}

export function bucketScorePercents(
  scorePercents: number[],
  bands: ReadonlyArray<{ label: string; min: number; max: number }> = DEFAULT_DISTRIBUTION_BANDS,
): GradeDistributionBucket[] {
  return bands.map((band) => ({
    label: band.label,
    minPercent: band.min,
    maxPercent: band.max,
    count: scorePercents.filter(
      (score) => score >= band.min && score < band.max,
    ).length,
  }))
}

/**
 * Builds display stats from a provider distribution.
 * Prefer explicit mean/median from the provider when present; otherwise derive
 * them from anonymized score percentages so the UI never invents peer scores.
 */
export function summarizeGradeDistribution(distribution: GradeDistribution): {
  mean: number | null
  median: number | null
  scoredCount: number
  buckets: GradeDistributionBucket[]
  yourPercent: number | null
} {
  const scores = distribution.scorePercents ?? []
  const buckets =
    distribution.buckets && distribution.buckets.length > 0
      ? distribution.buckets
      : bucketScorePercents(scores)

  const scoredCount =
    typeof distribution.scoredCount === 'number'
      ? distribution.scoredCount
      : buckets.reduce((sum, bucket) => sum + bucket.count, 0) || scores.length

  return {
    mean:
      typeof distribution.mean === 'number'
        ? distribution.mean
        : meanOf(scores),
    median:
      typeof distribution.median === 'number'
        ? distribution.median
        : medianOf(scores),
    scoredCount,
    buckets,
    yourPercent:
      typeof distribution.yourPercent === 'number'
        ? distribution.yourPercent
        : null,
  }
}
