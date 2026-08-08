import { describe, expect, it } from 'vitest'
import {
  placeBubble,
  seedFrom,
  statusCounts,
  submittedPercent,
} from './bubbleTank'
import type { LiveParticipant } from '../api'

function participant(
  id: string,
  status: LiveParticipant['status'],
): LiveParticipant {
  return { id, displayName: id, status, submittedAt: null }
}

describe('seedFrom', () => {
  it('is stable for the same id', () => {
    expect(seedFrom('abc')).toBe(seedFrom('abc'))
  })

  it('separates different ids', () => {
    expect(seedFrom('abc')).not.toBe(seedFrom('abd'))
  })
})

describe('placeBubble', () => {
  it('keeps every bubble inside the tank', () => {
    for (let index = 0; index < 60; index += 1) {
      const placement = placeBubble(`member-${index}`, index, 60)
      expect(placement.leftPercent).toBeGreaterThanOrEqual(9)
      expect(placement.leftPercent).toBeLessThanOrEqual(91)
      expect(placement.topPercent).toBeGreaterThanOrEqual(10)
      expect(placement.topPercent).toBeLessThanOrEqual(90)
    }
  })

  it('gives the same participant the same spot across refetches', () => {
    const first = placeBubble('member-7', 7, 50)
    const second = placeBubble('member-7', 7, 50)
    expect(second).toEqual(first)
  })

  it('spreads a full class out instead of stacking them', () => {
    const spots = new Set(
      Array.from({ length: 50 }, (_, index) => {
        const placement = placeBubble(`member-${index}`, index, 50)
        return `${placement.leftPercent.toFixed(1)}:${placement.topPercent.toFixed(1)}`
      }),
    )
    expect(spots.size).toBe(50)
  })

  it('places a single bubble near the middle', () => {
    const placement = placeBubble('solo', 0, 1)
    expect(placement.leftPercent).toBeGreaterThan(20)
    expect(placement.leftPercent).toBeLessThan(80)
  })

  it('survives an empty roster without dividing by zero', () => {
    const placement = placeBubble('ghost', 0, 0)
    expect(Number.isFinite(placement.leftPercent)).toBe(true)
    expect(Number.isFinite(placement.topPercent)).toBe(true)
  })

  it('scales size with depth so the tank reads three-dimensional', () => {
    const placements = Array.from({ length: 40 }, (_, index) =>
      placeBubble(`member-${index}`, index, 40),
    )
    const sizes = placements.map((placement) => placement.size)
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(66)
    expect(Math.max(...sizes)).toBeLessThanOrEqual(104)
    expect(new Set(sizes).size).toBeGreaterThan(1)
  })
})

describe('statusCounts', () => {
  it('tallies each status', () => {
    const counts = statusCounts([
      participant('a', 'submitted'),
      participant('b', 'submitted'),
      participant('c', 'writing'),
      participant('d', 'absent'),
      participant('e', 'not_started'),
    ])
    expect(counts).toEqual({
      submitted: 2,
      writing: 1,
      not_started: 1,
      absent: 1,
    })
  })

  it('treats an unknown status as not started', () => {
    expect(statusCounts([participant('a', 'weird')]).not_started).toBe(1)
  })

  it('returns zeroes for an empty roster', () => {
    expect(statusCounts([])).toEqual({
      submitted: 0,
      writing: 0,
      not_started: 0,
      absent: 0,
    })
  })
})

describe('submittedPercent', () => {
  it('rounds to a whole percent', () => {
    const roster = [
      participant('a', 'submitted'),
      participant('b', 'submitted'),
      participant('c', 'writing'),
    ]
    expect(submittedPercent(roster)).toBe(67)
  })

  it('is zero rather than NaN for an empty roster', () => {
    expect(submittedPercent([])).toBe(0)
  })
})
