import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { DashboardModuleCard } from './DashboardModuleCard'
import { ModuleGroup } from './ModuleGroup'
import { GROUP_LABELS, GROUP_ORDER } from './moduleGroups'
import type { DashboardModule } from './types'

function module(overrides: Partial<DashboardModule> = {}): DashboardModule {
  return {
    id: 'tasks',
    group: 'my_work',
    title: 'My tasks',
    description: 'Assignments across every committee.',
    icon: 'ClipboardList',
    to: '/tasks',
    ...overrides,
  }
}

function renderInRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

describe('DashboardModuleCard', () => {
  it('renders the title, description, and link target', () => {
    renderInRouter(
      <ul>
        <DashboardModuleCard module={module()} />
      </ul>,
    )

    expect(screen.getByText('My tasks')).toBeInTheDocument()
    expect(screen.getByText('Assignments across every committee.')).toBeInTheDocument()
    expect(screen.getByRole('link')).toHaveAttribute('href', '/tasks')
  })

  it('shows a count when one is supplied', () => {
    renderInRouter(
      <ul>
        <DashboardModuleCard module={module({ count: 3 })} />
      </ul>,
    )

    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('omits the count when there is none', () => {
    renderInRouter(
      <ul>
        <DashboardModuleCard module={module()} />
      </ul>,
    )

    expect(screen.queryByText('3')).not.toBeInTheDocument()
  })

  it('renders a badge when one is supplied', () => {
    renderInRouter(
      <ul>
        <DashboardModuleCard
          module={module({ badge: { label: '1 overdue', tone: 'danger' } })}
        />
      </ul>,
    )

    expect(screen.getByText('1 overdue')).toBeInTheDocument()
  })

  it('falls back to a default icon for an unknown icon name', () => {
    // A future server-side icon name must not break the card.
    expect(() =>
      renderInRouter(
        <ul>
          <DashboardModuleCard module={module({ icon: 'NotARealIcon' })} />
        </ul>,
      ),
    ).not.toThrow()
    expect(screen.getByText('My tasks')).toBeInTheDocument()
  })
})

describe('ModuleGroup', () => {
  it('labels the group and lists its modules', () => {
    renderInRouter(
      <ModuleGroup
        group="my_work"
        modules={[module(), module({ id: 'other', title: 'Submissions' })]}
      />,
    )

    const section = screen.getByRole('region', { name: 'My work' })
    expect(within(section).getAllByRole('listitem')).toHaveLength(2)
  })

  it('renders nothing when the group is empty', () => {
    const { container } = renderInRouter(<ModuleGroup group="leadership" modules={[]} />)

    expect(container).toBeEmptyDOMElement()
  })

  it('has a label for every group in the display order', () => {
    // Guards against adding a group key without a heading for it.
    for (const group of GROUP_ORDER) {
      expect(GROUP_LABELS[group]).toBeTruthy()
    }
    expect(GROUP_ORDER).toEqual(['my_work', 'committee', 'events', 'leadership'])
  })
})
