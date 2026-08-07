import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ActivityFeed } from './ActivityFeed'
import { FeaturedEventCard } from './FeaturedEventCard'
import { PageHeader } from './PageHeader'
import { ProgressCard } from './ProgressCard'
import { SAMPLE_DASHBOARD } from './fixtures/sampleDashboard'
import { relativeTime } from './formatDate'

const renderInRouter = (ui: React.ReactElement) =>
  render(<MemoryRouter>{ui}</MemoryRouter>)

describe('PageHeader', () => {
  it('greets by first name and shows role and committee', () => {
    render(<PageHeader name="Ada Lovelace" role="officer" committee="Events Committee" />)

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Ada')
    expect(screen.getByText('Officer')).toBeInTheDocument()
    expect(screen.getByText('Events Committee')).toBeInTheDocument()
  })

  it('omits the committee when the member has none', () => {
    render(<PageHeader name="Ada Lovelace" role="student" committee={null} />)

    expect(screen.getByText('Student')).toBeInTheDocument()
    expect(screen.queryByText('Events Committee')).not.toBeInTheDocument()
  })
})

describe('FeaturedEventCard', () => {
  it('renders the event with its status and action', () => {
    const featured = SAMPLE_DASHBOARD.featured!
    renderInRouter(<FeaturedEventCard item={featured} />)

    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(featured.title)
    expect(screen.getByText(featured.status.label)).toBeInTheDocument()
    expect(screen.getByText(featured.location)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: featured.actionLabel })).toHaveAttribute(
      'href',
      featured.to,
    )
  })

  it('labels a debrief differently from an event', () => {
    const featured = SAMPLE_DASHBOARD.featured!
    renderInRouter(<FeaturedEventCard item={{ ...featured, kind: 'debrief' }} />)

    expect(screen.getByText('Active debrief')).toBeInTheDocument()
    expect(screen.queryByText('Next event')).not.toBeInTheDocument()
  })

  it('gives the start time a machine-readable timestamp', () => {
    const featured = SAMPLE_DASHBOARD.featured!
    const { container } = renderInRouter(<FeaturedEventCard item={featured} />)

    expect(container.querySelector('time')).toHaveAttribute('datetime', featured.startsAt)
  })
})

describe('ProgressCard', () => {
  it('shows level, points, and attendance', () => {
    render(<ProgressCard progress={SAMPLE_DASHBOARD.progress} />)

    expect(screen.getByText('Level 4')).toBeInTheDocument()
    expect(screen.getByText('Contributor')).toBeInTheDocument()
    expect(screen.getByText('1,240')).toBeInTheDocument()
    expect(screen.getByText('260 points to level 5')).toBeInTheDocument()
  })

  it('does not report negative points remaining past a level boundary', () => {
    render(
      <ProgressCard
        progress={{ ...SAMPLE_DASHBOARD.progress, points: 1600, pointsToNextLevel: 1500 }}
      />,
    )

    expect(screen.getByText('Ready for level 5')).toBeInTheDocument()
  })
})

describe('ActivityFeed', () => {
  it('lists each entry with a relative timestamp', () => {
    render(<ActivityFeed items={SAMPLE_DASHBOARD.activity} />)

    expect(screen.getAllByRole('listitem')).toHaveLength(SAMPLE_DASHBOARD.activity.length)
    expect(screen.getByText(SAMPLE_DASHBOARD.activity[0].description)).toBeInTheDocument()
  })
})

describe('relativeTime', () => {
  const now = new Date('2026-08-06T12:00:00Z')

  it.each([
    ['2026-08-06T09:00:00Z', '3 hours ago'],
    ['2026-08-06T14:00:00Z', 'in 2 hours'],
    ['2026-08-05T12:00:00Z', 'yesterday'],
    ['2026-08-07T12:00:00Z', 'tomorrow'],
  ])('formats %s as "%s"', (iso, expected) => {
    expect(relativeTime(iso, now)).toBe(expected)
  })
})
