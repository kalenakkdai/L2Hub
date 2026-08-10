import { describe, expect, it } from 'vitest'
import { ringPositions } from './CampfireRing'

describe('ringPositions', () => {
  it('returns nothing for an empty circle', () => {
    expect(ringPositions(0)).toEqual([])
  })

  it('places a single fire at the top of the circle', () => {
    expect(ringPositions(1)).toEqual([{ x: 50, y: 8 }])
  })

  it('spaces four fires evenly around the ring', () => {
    const spots = ringPositions(4)
    expect(spots).toHaveLength(4)
    // Top, right, bottom, left — within a pixel of the expected seats.
    expect(spots[0]?.x).toBeCloseTo(50, 5)
    expect(spots[0]?.y).toBeCloseTo(8, 5)
    expect(spots[1]?.x).toBeCloseTo(92, 5)
    expect(spots[1]?.y).toBeCloseTo(50, 5)
    expect(spots[2]?.x).toBeCloseTo(50, 5)
    expect(spots[2]?.y).toBeCloseTo(92, 5)
    expect(spots[3]?.x).toBeCloseTo(8, 5)
    expect(spots[3]?.y).toBeCloseTo(50, 5)
  })
})
