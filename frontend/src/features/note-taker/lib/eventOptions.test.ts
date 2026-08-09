import { describe, expect, it } from 'vitest'
import type { EventListItem } from '../../event-summary/api'
import {
  eventOptionGroups,
  eventOptionLabel,
  eventTimelinePath,
  findEventLabel,
} from './eventOptions'

const NOW = new Date('2026-08-08T12:00:00Z')

function event(overrides: Partial<EventListItem> & { id: string }): EventListItem {
  return {
    name: overrides.id,
    slug: overrides.id,
    year: 2026,
    eventStatus: 'scheduled',
    startsAt: null,
    endsAt: null,
    summaryStatus: 'not_requested',
    managingCommitteeId: null,
    wrappedPresentedAt: null,
    ...overrides,
  }
}

describe('eventOptionLabel', () => {
  it('reads the same as the campfire rows', () => {
    expect(
      eventOptionLabel(event({ id: 'a', name: 'Maze Day', year: 2026 })),
    ).toBe('Maze Day 2026')
  })
})

describe('eventTimelinePath', () => {
  it('points at the planning board with that campfire open', () => {
    expect(eventTimelinePath('event-maze')).toBe(
      '/event-planning?campfire=event-maze',
    )
  })

  it('escapes ids so they survive as a query value', () => {
    expect(eventTimelinePath('a b&c')).toBe('/event-planning?campfire=a%20b%26c')
  })
})

describe('eventOptionGroups', () => {
  it('puts running events first and labels each group', () => {
    const groups = eventOptionGroups(
      [
        event({
          id: 'later',
          name: 'Rally',
          startsAt: '2026-09-01T00:00:00Z',
        }),
        event({
          id: 'live',
          name: 'Maze Day',
          startsAt: '2026-08-07T00:00:00Z',
          endsAt: '2026-08-09T00:00:00Z',
        }),
      ],
      NOW,
    )

    expect(groups.map((group) => group.label)).toEqual([
      'Happening now',
      'Upcoming',
    ])
    expect(groups[0].options).toEqual([{ id: 'live', label: 'Maze Day 2026' }])
    expect(groups[1].options).toEqual([{ id: 'later', label: 'Rally 2026' }])
  })

  it('drops empty groups so the menu has no dead headings', () => {
    const groups = eventOptionGroups(
      [event({ id: 'old', name: 'Fall Fest', year: 2024, endsAt: '2024-10-01T00:00:00Z' })],
      NOW,
    )
    expect(groups).toHaveLength(1)
    expect(groups[0].label).toBe('Previous years')
  })

  it('returns nothing when there are no events', () => {
    expect(eventOptionGroups([], NOW)).toEqual([])
  })
})

describe('findEventLabel', () => {
  const groups = [
    { label: 'Happening now', options: [{ id: 'live', label: 'Maze Day 2026' }] },
  ]

  it('finds the label for a selected event', () => {
    expect(findEventLabel(groups, 'live')).toBe('Maze Day 2026')
  })

  it('returns null when nothing is selected', () => {
    expect(findEventLabel(groups, null)).toBeNull()
  })

  it('falls back to the name from the link for an unlistable event', () => {
    expect(findEventLabel(groups, 'hidden', 'Secret Rally 2026')).toBe(
      'Secret Rally 2026',
    )
  })

  it('returns null rather than a bare id when there is no fallback name', () => {
    expect(findEventLabel(groups, 'hidden', '  ')).toBeNull()
  })
})
