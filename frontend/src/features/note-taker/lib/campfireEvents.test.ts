import { describe, expect, it } from 'vitest'
import { campfireHeading, selectCampfireEvents } from './campfireEvents'
import type { EventListItem } from '../../event-summary/api'
import type { GroupedEvents } from '../../event-summary/lib/groupEvents'

function event(id: string): EventListItem {
  return {
    id,
    name: id,
    slug: id,
    year: 2026,
    eventStatus: 'scheduled',
    startsAt: null,
    endsAt: null,
    summaryStatus: 'not_requested',
    managingCommitteeId: null,
    wrappedPresentedAt: null,
  }
}

function grouped(partial: Partial<GroupedEvents>): GroupedEvents {
  return { current: [], upcoming: [], previous: [], earlier: [], ...partial }
}

describe('selectCampfireEvents', () => {
  it('prefers running events and lights their fires', () => {
    const selection = selectCampfireEvents(
      grouped({ current: [event('maze')], upcoming: [event('rally')] }),
    )
    expect(selection.tone).toBe('now')
    expect(selection.events.map((item) => item.id)).toEqual(['maze'])
  })

  it('falls back to what is scheduled next when nothing is running', () => {
    const selection = selectCampfireEvents(
      grouped({ upcoming: [event('rally')], previous: [event('old')] }),
    )
    expect(selection.tone).toBe('next')
    expect(selection.events.map((item) => item.id)).toEqual(['rally'])
  })

  it('falls back to finished events so a debrief still has a campfire', () => {
    const selection = selectCampfireEvents(
      grouped({ previous: [event('maze-2026')], earlier: [event('maze-2025')] }),
    )
    expect(selection.tone).toBe('recent')
    expect(selection.events.map((item) => item.id)).toEqual([
      'maze-2026',
      'maze-2025',
    ])
  })

  it('caps the fallback lists so the section stays a short row', () => {
    const many = Array.from({ length: 9 }, (_, index) => event(`e${index}`))
    expect(selectCampfireEvents(grouped({ upcoming: many })).events).toHaveLength(5)
    expect(selectCampfireEvents(grouped({ previous: many })).events).toHaveLength(5)
  })

  it('reports an empty selection when there are no events at all', () => {
    const selection = selectCampfireEvents(grouped({}))
    expect(selection.events).toEqual([])
    expect(selection.tone).toBe('recent')
  })
})

describe('campfireHeading', () => {
  it('names each tone distinctly', () => {
    const headings = ['now', 'next', 'recent'].map((tone) =>
      campfireHeading(tone as 'now'),
    )
    expect(new Set(headings).size).toBe(3)
  })
})
