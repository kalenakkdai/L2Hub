import { describe, expect, it } from 'vitest'
import { WAYPOINTS, owlPosition, scrollProgress } from './Owl'

describe('scrollProgress', () => {
  it('stays at the start when the page cannot scroll', () => {
    expect(scrollProgress(0, 0)).toBe(0)
    expect(scrollProgress(400, 0)).toBe(0)
  })

  it('reaches the end at the bottom of the page', () => {
    expect(scrollProgress(2000, 2000)).toBe(1)
  })

  it('clamps overscroll at either end', () => {
    expect(scrollProgress(-300, 2000)).toBe(0)
    expect(scrollProgress(9000, 2000)).toBe(1)
  })
})

describe('owlPosition', () => {
  it('starts and ends on the outer waypoints', () => {
    expect(owlPosition(0)).toEqual(WAYPOINTS[0])
    expect(owlPosition(1)).toEqual(WAYPOINTS.at(-1))
  })

  it('passes through every waypoint on the way down', () => {
    WAYPOINTS.forEach((waypoint, index) => {
      const at = owlPosition(index / (WAYPOINTS.length - 1))
      expect(at.x).toBeCloseTo(waypoint.x, 5)
      expect(at.y).toBeCloseTo(waypoint.y, 5)
    })
  })

  it('descends steadily as the page scrolls', () => {
    let previous = -Infinity
    for (let step = 0; step <= 100; step += 1) {
      const { y } = owlPosition(step / 100)
      expect(y).toBeGreaterThanOrEqual(previous)
      previous = y
    }
  })

  it('moves continuously rather than jumping between perches', () => {
    let previous = owlPosition(0)
    for (let step = 1; step <= 200; step += 1) {
      const next = owlPosition(step / 200)
      // Half a percent of travel per half-percent of scroll: no teleporting.
      expect(Math.abs(next.x - previous.x)).toBeLessThan(2)
      expect(Math.abs(next.y - previous.y)).toBeLessThan(2)
      previous = next
    }
  })

  it('clamps progress outside the path', () => {
    expect(owlPosition(-5)).toEqual(WAYPOINTS[0])
    expect(owlPosition(5)).toEqual(WAYPOINTS.at(-1))
  })

  it('keeps the whole path inside the visible area', () => {
    for (let step = 0; step <= 100; step += 1) {
      const { x, y } = owlPosition(step / 100)
      expect(x).toBeGreaterThanOrEqual(10)
      expect(x).toBeLessThanOrEqual(90)
      expect(y).toBeGreaterThanOrEqual(5)
      expect(y).toBeLessThanOrEqual(90)
    }
  })
})
