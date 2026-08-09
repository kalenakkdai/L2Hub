import { describe, expect, it } from 'vitest'
import {
  HEIGHT,
  layoutConstellation,
  weightForStatus,
} from './constellation'

const docs = (count: number) =>
  Array.from({ length: count }, (_, index) => ({ id: `doc-${index}` }))

describe('layoutConstellation', () => {
  it('places docs left to right in the order given', () => {
    const layout = layoutConstellation(docs(4))
    const xs = layout.stars.map((star) => star.x)
    expect(xs).toEqual([...xs].sort((a, b) => a - b))
    expect(new Set(xs).size).toBe(4)
    expect(layout.stars.map((star) => star.id)).toEqual([
      'doc-0',
      'doc-1',
      'doc-2',
      'doc-3',
    ])
  })

  it('keeps every star inside the drawing box', () => {
    const layout = layoutConstellation(docs(24))
    for (const star of layout.stars) {
      expect(star.y - star.radius).toBeGreaterThan(0)
      expect(star.y + star.radius).toBeLessThan(HEIGHT)
      expect(star.x).toBeGreaterThan(0)
      expect(star.x).toBeLessThan(layout.width)
    }
  })

  it('links only consecutive stars, so the line reads as a timeline', () => {
    const layout = layoutConstellation(docs(3))
    expect(layout.links.map((link) => [link.fromId, link.toId])).toEqual([
      ['doc-0', 'doc-1'],
      ['doc-1', 'doc-2'],
    ])
  })

  it('handles the empty and single-doc cases without collapsing the box', () => {
    expect(layoutConstellation([]).stars).toEqual([])
    expect(layoutConstellation([]).width).toBeGreaterThan(0)

    const single = layoutConstellation(docs(1))
    expect(single.stars).toHaveLength(1)
    expect(single.links).toEqual([])
  })

  it('is stable across calls so the chart does not jump between renders', () => {
    expect(layoutConstellation(docs(6))).toEqual(layoutConstellation(docs(6)))
  })

  it('draws finished docs larger than failed ones', () => {
    const layout = layoutConstellation([
      { id: 'ready', weight: weightForStatus('ready') },
      { id: 'failed', weight: weightForStatus('failed') },
    ])
    const [ready, failed] = layout.stars
    expect(ready.radius).toBeGreaterThan(failed.radius)
  })
})

describe('weightForStatus', () => {
  it('ranks ready above in-flight above failed', () => {
    expect(weightForStatus('ready')).toBeGreaterThan(weightForStatus('processing'))
    expect(weightForStatus('processing')).toBeGreaterThan(weightForStatus('failed'))
  })
})
