import { describe, expect, it } from 'vitest'
import {
  bucketScorePercents,
  meanOf,
  medianOf,
  summarizeGradeDistribution,
} from './distribution'

describe('meanOf / medianOf', () => {
  it('returns null for an empty set', () => {
    expect(meanOf([])).toBeNull()
    expect(medianOf([])).toBeNull()
  })

  it('computes mean to one decimal', () => {
    expect(meanOf([100, 80, 60])).toBe(80)
    expect(meanOf([100, 90])).toBe(95)
  })

  it('computes median for odd and even lengths', () => {
    expect(medianOf([10, 30, 20])).toBe(20)
    expect(medianOf([10, 40, 20, 30])).toBe(25)
  })
})

describe('bucketScorePercents', () => {
  it('places boundary scores in the higher band', () => {
    const buckets = bucketScorePercents([59, 60, 89, 90, 100])
    expect(buckets.find((b) => b.label === '0–59')?.count).toBe(1)
    expect(buckets.find((b) => b.label === '60–69')?.count).toBe(1)
    expect(buckets.find((b) => b.label === '80–89')?.count).toBe(1)
    expect(buckets.find((b) => b.label === '90–100')?.count).toBe(2)
  })
})

describe('summarizeGradeDistribution', () => {
  it('derives mean, median, and buckets from score percents', () => {
    const summary = summarizeGradeDistribution({
      scorePercents: [100, 80, 60, 40],
      yourPercent: 80,
    })
    expect(summary.mean).toBe(70)
    expect(summary.median).toBe(70)
    expect(summary.yourPercent).toBe(80)
    expect(summary.scoredCount).toBe(4)
    expect(summary.buckets.reduce((sum, b) => sum + b.count, 0)).toBe(4)
  })

  it('prefers provider-authored mean and median', () => {
    const summary = summarizeGradeDistribution({
      mean: 88,
      median: 90,
      scoredCount: 12,
      buckets: [
        { label: 'Low', count: 2, minPercent: 0, maxPercent: 70 },
        { label: 'High', count: 10, minPercent: 70, maxPercent: 101 },
      ],
    })
    expect(summary.mean).toBe(88)
    expect(summary.median).toBe(90)
    expect(summary.scoredCount).toBe(12)
  })
})
