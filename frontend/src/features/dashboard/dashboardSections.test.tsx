import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { ActivityFeed } from './ActivityFeed'
import { AttentionList } from './AttentionList'
import { CalendarRail } from './CalendarRail'
import { DashboardHeader } from './DashboardHeader'
import { GradesPanel } from './GradesPanel'
import { NextEventCard } from './NextEventCard'
import { ProgressPanel } from './ProgressPanel'
import { SAMPLE_DASHBOARD } from './fixtures/sampleDashboard'
import { blockFor, greetingFor } from './greeting'
import { countdown, dayLabel, relativeTime } from './formatDate'

vi.mock('../../hooks/useCampsiteModules', () => ({
  useCampsiteChrome: () => ({ data: { modulesEnabled: {} } }),
}))

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
    expect(screen.getByText('B')).toBeInTheDocument()
    expect(screen.getByText('Grade · 86% · 268/310')).toBeInTheDocument()
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

    expect(screen.getByText('Grade · 0%')).toBeInTheDocument()
  })
})

describe('ProgressPanel', () => {
  it('shows grade, climb toward the next band, and the three figures', () => {
    render(<ProgressPanel progress={SAMPLE_DASHBOARD.progress} />)

    expect(screen.getByText('Grade B · 86%')).toBeInTheDocument()
    expect(screen.getByText('4% to A−')).toBeInTheDocument()
    expect(screen.getByText('Week streak')).toBeInTheDocument()
  })

  it('does not report a negative climb past the next band', () => {
    render(
      <ProgressPanel
        progress={{
          ...SAMPLE_DASHBOARD.progress,
          gradePercent: 92,
          gradeLetter: 'A−',
          nextBand: 'A',
          nextBandMin: 93,
        }}
      />,
    )

    expect(screen.getByText('1% to A')).toBeInTheDocument()
  })

  it('marks the top of the scale when there is no next band', () => {
    render(
      <ProgressPanel
        progress={{
          ...SAMPLE_DASHBOARD.progress,
          gradePercent: 98,
          gradeLetter: 'A+',
          nextBand: null,
          nextBandMin: null,
        }}
      />,
    )

    expect(screen.getByText('Top of the scale')).toBeInTheDocument()
  })
})

describe('ActivityFeed', () => {
  it('lists entries with relative timestamps and grade scores', () => {
    render(<ActivityFeed items={SAMPLE_DASHBOARD.activity} />)

    const list = screen.getByRole('list')
    expect(within(list).getAllByRole('listitem')).toHaveLength(
      SAMPLE_DASHBOARD.activity.length,
    )
    expect(screen.getByText('20')).toBeInTheDocument()
  })
})

describe('DashboardHeader', () => {
  beforeEach(() => sessionStorage.clear())

  const stats = { gradeLetter: 'B', gradePercent: 86, openCount: 3 }

  it('leads with the greeting and no date or clock above it', () => {
    renderInRouter(<DashboardHeader firstName="Brittany" stats={stats} />)

    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading).toHaveTextContent(/Brittany[.?]$/)

    // The date line is gone: every device already shows the time, and it only
    // pushed the greeting down. Match a weekday or a clock, in any locale
    // spelling this test can reasonably anticipate.
    expect(screen.queryByText(/\d{1,2}:\d{2}/)).not.toBeInTheDocument()
    expect(
      screen.queryByText(/Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday/),
    ).not.toBeInTheDocument()
  })

  it('still shows the three standing numbers', () => {
    renderInRouter(<DashboardHeader firstName="Brittany" stats={stats} />)

    expect(screen.getByText('Grade')).toBeInTheDocument()
    expect(screen.getByText('Overall')).toBeInTheDocument()
    expect(screen.getByText('Open')).toBeInTheDocument()
    expect(screen.getByText('B')).toBeInTheDocument()
  })

  it('offers a page search field under the greeting', () => {
    renderInRouter(
      <DashboardHeader
        firstName="Brittany"
        stats={stats}
        permissions={['note_taker.view']}
      />,
    )

    expect(screen.getByRole('search')).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Search pages' })).toBeInTheDocument()
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

  it('is a short phrase, the first name, and its own punctuation', () => {
    const greeting = greetingFor('Brittany', new Date('2026-08-06T13:00:00'))

    // e.g. "Afternoon, Brittany." or "Almost caught up, Brittany?"
    expect(greeting).toMatch(/^[A-Z][A-Za-z ]*, Brittany[.?]$/)
  })

  it('ends a question with a question mark, not a full stop', () => {
    // 02:00 is the late block, where the phrases ask rather than state.
    // "Still up, Brittany." reads as an observation about the camper.
    const seen = new Set<string>()
    for (let attempt = 0; attempt < 60; attempt += 1) {
      sessionStorage.clear()
      seen.add(greetingFor('Brittany', new Date('2026-08-06T02:00:00')))
    }

    const questions = [...seen].filter((line) => line.endsWith('?'))
    expect(questions.length).toBeGreaterThan(0)
    for (const line of questions) {
      expect(line).not.toContain('.')
    }
    expect(seen).toContain('Still up, Brittany?')
  })

  it('greets in a complete, capitalised sentence in every block', () => {
    // Guards the whole table at once: a phrase added without a mark, or in
    // lower case, fails here rather than shipping onto the dashboard.
    for (const hour of [8, 13, 19, 2]) {
      for (let attempt = 0; attempt < 40; attempt += 1) {
        sessionStorage.clear()
        const greeting = greetingFor('Brittany', new Date(2026, 7, 6, hour))

        expect(greeting).toMatch(/^[A-Z]/)
        expect(greeting).toMatch(/[.?]$/)
        expect(greeting).toContain(', Brittany')
        // One terminal mark, and nothing doubled up.
        expect(greeting.match(/[.?]/g)).toHaveLength(1)
      }
    }
  })

  it('holds the same greeting for the whole session', () => {
    const now = new Date('2026-08-06T08:00:00')
    expect(greetingFor('Ada', now)).toBe(greetingFor('Ada', now))
  })

  it('drops the name rather than falling back to an email', () => {
    const greeting = greetingFor(null, new Date('2026-08-06T13:00:00'))

    expect(greeting).toMatch(/^[A-Z][A-Za-z ]*[.?]$/)
    expect(greeting).not.toContain('@')
    expect(greeting).not.toContain(',')
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
