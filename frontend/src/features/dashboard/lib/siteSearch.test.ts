import { describe, expect, it } from 'vitest'
import { searchSiteDestinations } from './siteSearch'

describe('searchSiteDestinations', () => {
  const member = [
    'note_taker.view',
    'notifications.view_own',
  ]

  it('returns starter destinations when the query is empty', () => {
    const hits = searchSiteDestinations('', member)
    expect(hits.length).toBeGreaterThan(0)
    expect(hits.some((hit) => hit.to === '/dashboard')).toBe(true)
  })

  it('matches labels and aliases', () => {
    expect(
      searchSiteDestinations('gradebook', member).map((hit) => hit.to),
    ).toContain('/grades')
    expect(
      searchSiteDestinations('transcript', member).map((hit) => hit.to),
    ).toContain('/note-taker')
  })

  it('hides destinations the caller cannot open', () => {
    const hits = searchSiteDestinations('attendance', member)
    expect(hits.map((hit) => hit.to)).not.toContain('/attendance')

    const asbo = searchSiteDestinations('attendance', [
      ...member,
      'attendance.manage_all',
    ])
    expect(asbo.map((hit) => hit.to)).toContain('/attendance')
  })

  it('respects disabled campsite modules', () => {
    const hits = searchSiteDestinations('grades', member, { grades: false })
    expect(hits.map((hit) => hit.to)).not.toContain('/grades')
  })

  it('marks My tasks as implemented once the campfire page ships', () => {
    const hits = searchSiteDestinations('tasks', [
      ...member,
      'tasks.view_own',
    ])
    const tasks = hits.find((hit) => hit.to === '/tasks')
    expect(tasks).toEqual(
      expect.objectContaining({
        label: 'My tasks',
        implemented: true,
      }),
    )
  })
})
