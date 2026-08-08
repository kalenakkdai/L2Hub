import { describe, expect, it } from 'vitest'
import {
  centsToDollars,
  checkpointTone,
  fundraiserPercent,
  homecomingCompletion,
} from './progress'
import type { HomecomingCheckpoint } from '../types'

describe('fundraiserPercent', () => {
  it('rounds the ratio to a whole percent', () => {
    expect(fundraiserPercent({ raisedCents: 320_000, targetCents: 800_000 })).toBe(40)
  })

  it('clamps to 100 when raised exceeds target', () => {
    expect(fundraiserPercent({ raisedCents: 900_000, targetCents: 800_000 })).toBe(100)
  })

  it('never returns a negative percent', () => {
    expect(fundraiserPercent({ raisedCents: -500, targetCents: 800_000 })).toBe(0)
  })

  it('returns 0 for a non-positive target instead of dividing by zero', () => {
    expect(fundraiserPercent({ raisedCents: 5000, targetCents: 0 })).toBe(0)
    expect(fundraiserPercent({ raisedCents: 5000, targetCents: -100 })).toBe(0)
  })
})

describe('centsToDollars', () => {
  it('formats whole dollars with no cents', () => {
    expect(centsToDollars(320_000)).toBe('$3,200')
  })
})

function checkpoint(status: HomecomingCheckpoint['status']): HomecomingCheckpoint {
  return { id: `cp-${status}`, date: '2026-09-08', title: 't', detail: 'd', status }
}

describe('homecomingCompletion', () => {
  it('counts only done checkpoints', () => {
    const result = homecomingCompletion({
      checkpoints: [checkpoint('done'), checkpoint('done'), checkpoint('upcoming'), checkpoint('missed')],
    })
    expect(result).toEqual({ done: 2, total: 4, percent: 50 })
  })

  it('reports zero percent for an empty plan rather than NaN', () => {
    expect(homecomingCompletion({ checkpoints: [] })).toEqual({ done: 0, total: 0, percent: 0 })
  })
})

describe('checkpointTone', () => {
  it('maps status to a tone class', () => {
    expect(checkpointTone('done')).toContain('success')
    expect(checkpointTone('missed')).toContain('danger')
    expect(checkpointTone('upcoming')).toContain('muted')
  })
})
