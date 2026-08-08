import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
  FeedbackConstellation,
  HEIGHT,
  WIDTH,
  boxFor,
} from './FeedbackConstellation'

const NODES = [
  { id: 'communication', label: 'Communication', mentions: 28, kind: 'strength' },
  { id: 'volunteer_help', label: 'Volunteer Help', mentions: 22, kind: 'strength' },
  { id: 'organization', label: 'Organization', mentions: 19, kind: 'strength' },
  { id: 'earlier_setup', label: 'Earlier Setup', mentions: 31, kind: 'improvement' },
  { id: 'signage', label: 'Signage', mentions: 18, kind: 'improvement' },
  { id: 'parking', label: 'Parking', mentions: 14, kind: 'improvement' },
  { id: 'check_in', label: 'Check-In', mentions: 16, kind: 'mixed' },
  {
    id: 'volunteer_coordination',
    label: 'Volunteer Coordination',
    mentions: 12,
    kind: 'strength',
  },
  {
    id: 'committee_cooperation',
    label: 'Committee Cooperation',
    mentions: 11,
    kind: 'strength',
  },
]

const EDGES = [
  { source: 'communication', target: 'volunteer_coordination' },
  { source: 'volunteer_coordination', target: 'committee_cooperation' },
  { source: 'earlier_setup', target: 'parking' },
  { source: 'earlier_setup', target: 'signage' },
  { source: 'signage', target: 'check_in' },
  { source: 'parking', target: 'signage' },
  { source: 'communication', target: 'organization' },
]

function theme(id: string, label: string, mentions: number, kind: string) {
  return {
    id,
    label,
    mentions,
    kind,
    summary: `${label} summary`,
    contributors: Array.from({ length: mentions }, (_, index) => ({
      name: index % 5 === 4 ? null : `Person ${index}`,
      committee: index % 5 === 4 ? null : 'Community',
      quote: `Quote ${index} about ${label}`,
      anonymous: index % 5 === 4,
    })),
  }
}

const THEMES = NODES.map((n) => theme(n.id, n.label, n.mentions, n.kind))

function renderedPositions(container: HTMLElement) {
  const groups = Array.from(container.querySelectorAll('g[transform]'))
  return groups.map((group) => {
    const transform = group.getAttribute('transform') ?? ''
    const [x, y] = transform
      .replace('translate(', '')
      .replace(')', '')
      .split(',')
      .map((part) => Number(part.trim()))
    const label = group.querySelector('text')?.textContent ?? ''
    return { label, x, y }
  })
}

describe('FeedbackConstellation layout', () => {
  it('places every theme node without overlapping another', () => {
    const { container } = render(
      <FeedbackConstellation
        nodes={NODES}
        edges={EDGES}
        themes={THEMES}
        reducedMotion
      />,
    )

    const placed = renderedPositions(container)
    expect(placed).toHaveLength(NODES.length)

    const byLabel = new Map(NODES.map((n) => [n.label, n]))

    for (let i = 0; i < placed.length; i += 1) {
      for (let j = i + 1; j < placed.length; j += 1) {
        const a = placed[i]
        const b = placed[j]
        const nodeA = byLabel.get(a.label)
        const nodeB = byLabel.get(b.label)
        expect(nodeA).toBeDefined()
        expect(nodeB).toBeDefined()

        const boxA = boxFor(nodeA!)
        const boxB = boxFor(nodeB!)
        const overlapsHorizontally =
          Math.abs(b.x - a.x) < boxA.halfWidth + boxB.halfWidth
        const overlapsVertically =
          Math.abs(b.y - a.y) < boxA.halfHeight + boxB.halfHeight

        expect(
          overlapsHorizontally && overlapsVertically,
          `${a.label} overlaps ${b.label}`,
        ).toBe(false)
      }
    }
  })

  it('keeps every node and its label inside the viewport', () => {
    const { container } = render(
      <FeedbackConstellation
        nodes={NODES}
        edges={EDGES}
        themes={THEMES}
        reducedMotion
      />,
    )

    const byLabel = new Map(NODES.map((n) => [n.label, n]))

    for (const placed of renderedPositions(container)) {
      const node = byLabel.get(placed.label)
      expect(node).toBeDefined()
      const box = boxFor(node!)

      expect(placed.x - box.halfWidth).toBeGreaterThanOrEqual(0)
      expect(placed.x + box.halfWidth).toBeLessThanOrEqual(WIDTH)
      expect(placed.y - box.halfHeight).toBeGreaterThanOrEqual(0)
      expect(placed.y + box.halfHeight).toBeLessThanOrEqual(HEIGHT)
    }
  })

  it('shows one quote per mention for the selected theme', async () => {
    render(
      <FeedbackConstellation
        nodes={NODES}
        edges={EDGES}
        themes={THEMES}
        reducedMotion
      />,
    )

    // Communication is selected by default and reports 28 mentions.
    expect(await screen.findByText('28 mentions · strength')).toBeInTheDocument()
    expect(screen.getByText('28 quotes')).toBeInTheDocument()

    const quotes = screen.getAllByText(/Quote \d+ about Communication/)
    expect(quotes).toHaveLength(28)
  })
})
