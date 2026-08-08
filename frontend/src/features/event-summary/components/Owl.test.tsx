import { describe, expect, it } from 'vitest'
import { PERCHES, perchIndexFor } from './Owl'

describe('perchIndexFor', () => {
  it('stays on the first perch when the page cannot scroll', () => {
    expect(perchIndexFor(0, 0)).toBe(0)
    expect(perchIndexFor(400, 0)).toBe(0)
  })

  it('moves to the last perch at the bottom of the page', () => {
    expect(perchIndexFor(2000, 2000)).toBe(PERCHES.length - 1)
  })

  it('walks the perches in order as the page scrolls', () => {
    const seen = Array.from({ length: 21 }, (_, step) =>
      perchIndexFor(step * 100, 2000),
    )

    expect(seen[0]).toBe(0)
    expect(seen.at(-1)).toBe(PERCHES.length - 1)
    // Scrolling never skips a perch, so the owl always flies to a neighbour.
    seen.forEach((index, position) => {
      if (position === 0) return
      expect(index - seen[position - 1]).toBeLessThanOrEqual(1)
      expect(index).toBeGreaterThanOrEqual(seen[position - 1])
    })
    expect(new Set(seen).size).toBe(PERCHES.length)
  })

  it('clamps overscroll at either end', () => {
    expect(perchIndexFor(-300, 2000)).toBe(0)
    expect(perchIndexFor(9000, 2000)).toBe(PERCHES.length - 1)
  })

  it('keeps every perch inside the visible area', () => {
    PERCHES.forEach((perch) => {
      expect(perch.x).toBeGreaterThanOrEqual(10)
      expect(perch.x).toBeLessThanOrEqual(90)
      expect(perch.y).toBeGreaterThanOrEqual(5)
      expect(perch.y).toBeLessThanOrEqual(90)
    })
  })
})
