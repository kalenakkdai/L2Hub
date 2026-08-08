import { describe, expect, it } from 'vitest'
import { eventPhase, groupEvents } from './groupEvents'
import type { EventListItem } from '../api'

const NOW = new Date('2026-08-07T12:00:00Z')

function event(overrides: Partial<EventListItem> = {}): EventListItem {
  return {
    id: overrides.slug ?? 'id',
    name: 'Maze Day',
    slug: 'maze-day-2026',
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

describe('eventPhase', () => {
  it('treats an event whose window has not opened as upcoming', () => {
    const phase = eventPhase(
      event({ startsAt: '2026-09-01T15:00:00Z', endsAt: '2026-09-01T20:00:00Z' }),
      NOW,
    )
    expect(phase).toBe('upcoming')
  })

  it('treats an event inside its window as current', () => {
    const phase = eventPhase(
      event({ startsAt: '2026-08-07T09:00:00Z', endsAt: '2026-08-07T17:00:00Z' }),
      NOW,
    )
    expect(phase).toBe('current')
  })

  it('treats an event past its window as finished', () => {
    const phase = eventPhase(
      event({ startsAt: '2026-08-01T09:00:00Z', endsAt: '2026-08-01T17:00:00Z' }),
      NOW,
    )
    expect(phase).toBe('finished')
  })

  it('counts the exact boundary instants as current', () => {
    const opening = event({
      startsAt: '2026-08-07T12:00:00Z',
      endsAt: '2026-08-07T17:00:00Z',
    })
    const closing = event({
      startsAt: '2026-08-07T09:00:00Z',
      endsAt: '2026-08-07T12:00:00Z',
    })
    expect(eventPhase(opening, NOW)).toBe('current')
    expect(eventPhase(closing, NOW)).toBe('current')
  })

  it('lets an explicit complete status override a future window', () => {
    const phase = eventPhase(
      event({ eventStatus: 'complete', startsAt: '2026-09-01T15:00:00Z' }),
      NOW,
    )
    expect(phase).toBe('finished')
  })

  it('assumes an undated event is still ahead of us', () => {
    expect(eventPhase(event(), NOW)).toBe('upcoming')
  })

  it('treats a started event with no recorded end as underway', () => {
    expect(eventPhase(event({ startsAt: '2026-08-07T09:00:00Z' }), NOW)).toBe('current')
  })

  it('ignores unparseable timestamps rather than throwing', () => {
    expect(eventPhase(event({ startsAt: 'not-a-date' }), NOW)).toBe('upcoming')
  })
})

describe('groupEvents', () => {
  it('splits events into current, upcoming, and previous-this-year', () => {
    const current = event({ slug: 'now', startsAt: '2026-08-07T09:00:00Z', endsAt: '2026-08-07T17:00:00Z' })
    const upcoming = event({ slug: 'soon', startsAt: '2026-09-01T15:00:00Z' })
    const previous = event({ slug: 'done', eventStatus: 'complete', year: 2026 })

    const grouped = groupEvents([previous, upcoming, current], NOW)

    expect(grouped.current.map((e) => e.slug)).toEqual(['now'])
    expect(grouped.upcoming.map((e) => e.slug)).toEqual(['soon'])
    expect(grouped.previous.map((e) => e.slug)).toEqual(['done'])
    expect(grouped.earlier).toEqual([])
  })

  it('keeps finished events from prior years out of the this-year block', () => {
    const thisYear = event({ slug: 'this-year', eventStatus: 'complete', year: 2026 })
    const lastYear = event({ slug: 'last-year', eventStatus: 'complete', year: 2025 })

    const grouped = groupEvents([lastYear, thisYear], NOW)

    expect(grouped.previous.map((e) => e.slug)).toEqual(['this-year'])
    expect(grouped.earlier.map((e) => e.slug)).toEqual(['last-year'])
  })

  it('never drops an event on the floor', () => {
    const events = [
      event({ slug: 'a', eventStatus: 'complete', year: 2024 }),
      event({ slug: 'b', eventStatus: 'complete', year: 2026 }),
      event({ slug: 'c', startsAt: '2026-12-01T15:00:00Z' }),
      event({ slug: 'd', startsAt: '2026-08-07T09:00:00Z', endsAt: '2026-08-07T18:00:00Z' }),
      event({ slug: 'e' }),
    ]

    const grouped = groupEvents(events, NOW)
    const seen = [
      ...grouped.current,
      ...grouped.upcoming,
      ...grouped.previous,
      ...grouped.earlier,
    ]

    expect(seen).toHaveLength(events.length)
    expect(new Set(seen.map((e) => e.slug))).toEqual(new Set(['a', 'b', 'c', 'd', 'e']))
  })

  it('orders upcoming soonest first and pushes undated events last', () => {
    const events = [
      event({ slug: 'undated' }),
      event({ slug: 'october', startsAt: '2026-10-01T15:00:00Z' }),
      event({ slug: 'september', startsAt: '2026-09-01T15:00:00Z' }),
    ]

    const grouped = groupEvents(events, NOW)

    expect(grouped.upcoming.map((e) => e.slug)).toEqual(['september', 'october', 'undated'])
  })

  it('orders finished events most recent first', () => {
    const events = [
      event({ slug: 'january', eventStatus: 'complete', endsAt: '2026-01-15T20:00:00Z' }),
      event({ slug: 'june', eventStatus: 'complete', endsAt: '2026-06-15T20:00:00Z' }),
    ]

    const grouped = groupEvents(events, NOW)

    expect(grouped.previous.map((e) => e.slug)).toEqual(['june', 'january'])
  })

  it('returns empty blocks for an empty list', () => {
    expect(groupEvents([], NOW)).toEqual({
      current: [],
      upcoming: [],
      previous: [],
      earlier: [],
    })
  })
})
