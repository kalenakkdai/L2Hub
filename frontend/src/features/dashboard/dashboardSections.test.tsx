import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { ActivityFeed } from './ActivityFeed'
import { AttentionList } from './AttentionList'
import { CalendarRail } from './CalendarRail'
import { GradesPanel } from './GradesPanel'
import { NextEventCard } from './NextEventCard'
import { ProgressPanel } from './ProgressPanel'
import { SAMPLE_DASHBOARD } from './fixtures/sampleDashboard'
import { blockFor, greetingFor } from './greeting'
import { countdown, dayLabel, relativeTime } from './formatDate'

const renderInRouter = (ui: React.ReactElement) =>
  render(<MemoryRouter>{ui}</MemoryRouter>)

describe('NextEventCard', () => {
  const event = SAMPLE_DASHBOARD.nextEvent!

  it('shows the event, the camper’s role, and the way in', () => {
    renderInRouter(<NextEventCard event={event} />)

    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent(event.title)
    expect(screen.getByText(event.assignment.title)).toBeInTheDocument()
    expect(screen.getByText(event.location)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Event brief/ })).toHaveAttribute(
      'href',
      event.to,
    )
  })

  it('counts the prep items that are done', () => {
    renderInRouter(<NextEventCard event={event} />)

    const done = event.prep.filter((item) => item.done).length
    expect(screen.getByText(`${done} of ${event.prep.length}`)).toBeInTheDocument()
  })

  it('toggles a prep item and updates the count', async () => {
    const user = userEvent.setup()
    renderInRouter(<NextEventCard event={event} />)

    const done = event.prep.filter((item) => item.done).length
    const target = event.prep.find((item) => !item.done)!

    await user.click(screen.getByRole('button', { name: target.label }))

    expect(screen.getByText(`${done + 1} of ${event.prep.length}`)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: target.label })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('reports prep progress to assistive tech', () => {
    renderInRouter(<NextEventCard event={event} />)

    const bar = screen.getByRole('progressbar', { name: /Event preparation/ })
    expect(bar).toHaveAttribute('aria-valuemax', String(event.prep.length))
  })

  it('omits the countdown once the event has started', () => {
    const past = { ...event, startsAt: new Date(Date.now() - 3_600_000).toISOString() }
    renderInRouter(<NextEventCard event={past} />)

    // A negative countdown is worse than none at all.
    expect(screen.queryByText(/to start/)).not.toBeInTheDocument()
  })
})

describe('AttentionList', () => {
  it('renders each item with its status and action', () => {
    renderInRouter(<AttentionList items={SAMPLE_DASHBOARD.attention} />)

    expect(screen.getAllByRole('listitem')).toHaveLength(
      SAMPLE_DASHBOARD.attention.length,
    )

    const first = SAMPLE_DASHBOARD.attention[0]
    expect(screen.getByText(first.title)).toBeInTheDocument()
    expect(screen.getByText(first.status.label)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: first.action.label })).toHaveAttribute(
      'href',
      first.action.to,
    )
  })

  it('exposes partial progress where an item has some', () => {
    renderInRouter(<AttentionList items={SAMPLE_DASHBOARD.attention} />)

    const withProgress = SAMPLE_DASHBOARD.attention.find((item) => item.progress)!
    const bar = screen.getByRole('progressbar', {
      name: new RegExp(withProgress.title),
    })
    expect(bar).toHaveAttribute('aria-valuenow', String(withProgress.progress!.value))
  })
})

describe('CalendarRail', () => {
  it('renders a tile per day', () => {
    renderInRouter(<CalendarRail days={SAMPLE_DASHBOARD.calendar} />)

    expect(screen.getAllByRole('listitem')).toHaveLength(SAMPLE_DASHBOARD.calendar.length)
  })

  it('marks today and labels quiet days', () => {
    renderInRouter(<CalendarRail days={SAMPLE_DASHBOARD.calendar} />)

    expect(screen.getByText('Today')).toBeInTheDocument()
    expect(screen.getAllByText('Nothing yet').length).toBeGreaterThan(0)
  })

  it('offers scroll controls with accessible names', () => {
    renderInRouter(<CalendarRail days={SAMPLE_DASHBOARD.calendar} />)

    expect(screen.getByRole('button', { name: 'Scroll calendar back' })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Scroll calendar forward' }),
    ).toBeInTheDocument()
  })
})

describe('GradesPanel', () => {
  it('summarises the tallies and lists the rows', () => {
    renderInRouter(<GradesPanel grades={SAMPLE_DASHBOARD.grades} />)

    expect(screen.getByText('Completed')).toBeInTheDocument()
    expect(screen.getByText('268/310')).toBeInTheDocument()
    expect(screen.getByText('Points earned · 86%')).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(
      SAMPLE_DASHBOARD.grades.rows.length,
    )
  })

  it('shows a dash rather than a zero for ungraded work', () => {
    renderInRouter(<GradesPanel grades={SAMPLE_DASHBOARD.grades} />)

    // Ungraded is not the same as scoring nothing.
    expect(screen.getByText('— / 20')).toBeInTheDocument()
    expect(screen.getByText('0 / 15')).toBeInTheDocument()
  })

  it('survives a zero-point gradebook without dividing by zero', () => {
    renderInRouter(
      <GradesPanel
        grades={{ ...SAMPLE_DASHBOARD.grades, pointsEarned: 0, pointsPossible: 0, rows: [] }}
      />,
    )

    expect(screen.getByText('Points earned · 0%')).toBeInTheDocument()
  })
})

describe('ProgressPanel', () => {
  it('shows level, remaining points, and the three figures', () => {
    render(<ProgressPanel progress={SAMPLE_DASHBOARD.progress} />)

    expect(screen.getByText('Level 8 · Section Lead')).toBeInTheDocument()
    expect(screen.getByText('160 pts to Level 9')).toBeInTheDocument()
    expect(screen.getByText('Week streak')).toBeInTheDocument()
  })

  it('does not report negative points past a level boundary', () => {
    render(
      <ProgressPanel
        progress={{ ...SAMPLE_DASHBOARD.progress, points: 1600, pointsToNextLevel: 1400 }}
      />,
    )

    expect(screen.getByText('Ready for Level 9')).toBeInTheDocument()
  })
})

describe('ActivityFeed', () => {
  it('lists entries with relative timestamps and point awards', () => {
    render(<ActivityFeed items={SAMPLE_DASHBOARD.activity} />)

    const list = screen.getByRole('list')
    expect(within(list).getAllByRole('listitem')).toHaveLength(
      SAMPLE_DASHBOARD.activity.length,
    )
    expect(screen.getByText('+20')).toBeInTheDocument()
  })
})

describe('greeting', () => {
  beforeEach(() => sessionStorage.clear())

  it.each([
    [8, 'morning'],
    [13, 'afternoon'],
    [19, 'evening'],
    [2, 'late'],
  ])('maps hour %i to the %s block', (hour, expected) => {
    expect(blockFor(hour)).toBe(expected)
  })

  it('includes the name', () => {
    expect(greetingFor('Ada', new Date('2026-08-06T08:00:00'))).toContain('Ada')
  })

  it('holds the same greeting for the whole session', () => {
    const now = new Date('2026-08-06T08:00:00')
    expect(greetingFor('Ada', now)).toBe(greetingFor('Ada', now))
  })

  it('still greets when sessionStorage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })

    expect(greetingFor('Ada', new Date('2026-08-06T08:00:00'))).toContain('Ada')
  })
})

describe('date helpers', () => {
  const now = new Date('2026-08-06T12:00:00Z')

  it.each([
    ['2026-08-06T09:00:00Z', '3 hours ago'],
    ['2026-08-06T14:00:00Z', 'in 2 hours'],
  ])('formats %s as "%s"', (iso, expected) => {
    expect(relativeTime(iso, now)).toBe(expected)
  })

  it('counts down in hours and minutes', () => {
    expect(countdown('2026-08-06T18:42:00Z', now)).toBe('6h 42m')
  })

  it('counts down in days once far enough out', () => {
    expect(countdown('2026-08-09T12:00:00Z', now)).toBe('3d 0h')
  })

  it('returns null for a time that has passed', () => {
    expect(countdown('2026-08-06T11:00:00Z', now)).toBeNull()
  })

  it('names today and tomorrow rather than dating them', () => {
    expect(dayLabel('2026-08-06T20:00:00Z', now)).toBe('Today')
    expect(dayLabel('2026-08-07T08:00:00Z', now)).toBe('Tomorrow')
  })
})
