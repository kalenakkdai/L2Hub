import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, render } from '@testing-library/react'
import { Owl, WAYPOINTS, owlPosition, scrollProgress } from './Owl'

/** Absolute coordinate pairs in a path built only from M/C commands. */
function pathPoints(d: string): Array<{ x: number; y: number }> {
  const numbers = (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number)
  const points = []
  for (let i = 0; i + 1 < numbers.length; i += 2) {
    points.push({ x: numbers[i], y: numbers[i + 1] })
  }
  return points
}

function renderOwl() {
  const { container, unmount } = render(<Owl />)
  const svg = container.querySelector('svg')
  if (!svg) throw new Error('owl svg did not render')
  const styles = Array.from(container.querySelectorAll('style'))
    .map((node) => node.textContent ?? '')
    .join('\n')
  return { container, svg, styles, unmount }
}

/** The rotate() angles declared inside one @keyframes block. */
function flapAngles(styles: string, name: string): number[] {
  const block = styles.split(`@keyframes ${name}`)[1]
  if (!block) throw new Error(`missing keyframes ${name}`)
  const body = block.slice(0, block.indexOf('}\n\n') + 1)
  return (body.match(/rotate\((-?\d+(\.\d+)?)deg\)/g) ?? []).map((match) =>
    Number(match.replace(/rotate\(|deg\)/g, '')),
  )
}

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

describe('owl wings', () => {
  it('gives the owl one wing on each flank', () => {
    const { svg, unmount } = renderOwl()

    const far = svg.querySelector('.owl-wing-far path')
    const near = svg.querySelector('.owl-wing-near path')
    expect(far).not.toBeNull()
    expect(near).not.toBeNull()

    const farX = pathPoints(far?.getAttribute('d') ?? '').map((p) => p.x)
    const nearX = pathPoints(near?.getAttribute('d') ?? '').map((p) => p.x)

    // Centre line of the 64-unit viewBox: neither wing crosses to the far side.
    expect(Math.max(...farX)).toBeLessThanOrEqual(32)
    expect(Math.min(...nearX)).toBeGreaterThanOrEqual(32)
    unmount()
  })

  it('never draws a wing over the eyes', () => {
    const { svg, unmount } = renderOwl()

    const drawn = Array.from(svg.querySelectorAll('g, circle, ellipse, path'))
    const lastWing = Math.max(
      ...Array.from(svg.querySelectorAll('.owl-wing')).map((node) =>
        drawn.indexOf(node),
      ),
    )
    const eyes = Array.from(svg.querySelectorAll('.owl-eye'))
    expect(eyes).toHaveLength(2)

    // Later siblings paint on top, so the eyes must come after both wings.
    for (const eye of eyes) {
      expect(drawn.indexOf(eye)).toBeGreaterThan(lastWing)
    }
    unmount()
  })

  it('pivots each wing at its own shoulder rather than the body centre', () => {
    const { styles, unmount } = renderOwl()

    expect(styles).toContain('.owl-wing-far')
    expect(styles).toContain('transform-origin: 22px 28.5px')
    expect(styles).toContain('transform-origin: 42px 28.5px')
    unmount()
  })

  it('beats both wings symmetrically', () => {
    const { styles, unmount } = renderOwl()

    const near = flapAngles(styles, 'owlFlapNear')
    const far = flapAngles(styles, 'owlFlapFar')

    expect(near.length).toBeGreaterThan(0)
    expect(near).toHaveLength(far.length)
    // Mirrored angles: when one wing lifts, so does the other.
    near.forEach((angle, index) => {
      expect(far[index]).toBe(-angle)
    })
    // The upstroke actually moves the wing.
    expect(Math.max(...near.map(Math.abs))).toBeGreaterThan(10)
    unmount()
  })

  it('blinks each eye in place and stays decorative', () => {
    const { container, styles, unmount } = renderOwl()

    // Without fill-box the eyes squash toward the middle of the drawing.
    expect(styles).toMatch(/\.owl-eye\s*\{[^}]*transform-box:\s*fill-box/)
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull()
    unmount()
  })

  it('stops wing animation under reduced motion', () => {
    const { styles, unmount } = renderOwl()

    const reduced = styles.split('prefers-reduced-motion')[1] ?? ''
    expect(reduced).toContain('.owl-wing')
    expect(reduced).toContain('animation: none')
    unmount()
  })
})

describe('owl sweep reporting', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('reports its on-screen box to onSweep as it roams', () => {
    // jsdom cannot lay out an SVG, so hand back a stable box to measure.
    const fakeRect = {
      left: 120,
      top: 60,
      right: 236,
      bottom: 176,
      width: 116,
      height: 116,
      x: 120,
      y: 60,
      toJSON: () => ({}),
    } as DOMRect
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(fakeRect)
    vi.useFakeTimers()

    const onSweep = vi.fn()
    const { unmount } = render(<Owl onSweep={onSweep} />)

    // A page that cannot scroll puts the owl into roaming mode; the first hop
    // fires after one ROAM_MS interval.
    act(() => {
      vi.advanceTimersByTime(5000)
    })

    expect(onSweep).toHaveBeenCalled()
    expect(onSweep.mock.calls[0][0]).toBe(fakeRect)
    unmount()
  })

  it('lands on a returned tent perch, folds its wings, then takes off', () => {
    const fakeRect = {
      left: 0,
      top: 0,
      right: 116,
      bottom: 116,
      width: 116,
      height: 116,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(fakeRect)
    vi.useFakeTimers()

    const onSweep = vi.fn(() => ({ id: 'publicity', x: 240, y: 180 }))
    const { container, unmount } = render(<Owl onSweep={onSweep} />)

    act(() => {
      vi.advanceTimersByTime(5000)
    })

    const anchor = container.querySelector<HTMLElement>('.owl-anchor')
    expect(anchor?.className).toContain('owl-anchor-perching')
    expect(anchor?.style.left).toBe('240px')
    expect(anchor?.style.top).toBe('180px')
    expect(container.querySelector('.owl-body')?.className).toContain(
      'owl-body-perched',
    )

    act(() => {
      vi.advanceTimersByTime(720)
    })
    expect(container.querySelector('.owl-body')?.className).not.toContain(
      'owl-body-flying',
    )

    act(() => {
      vi.advanceTimersByTime(3200)
    })
    expect(container.querySelector('.owl-body')?.className).not.toContain(
      'owl-body-perched',
    )
    unmount()
  })
})
