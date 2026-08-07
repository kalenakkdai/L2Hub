import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Inbox } from 'lucide-react'
import { EmptyState } from './EmptyState'
import { ErrorState } from './ErrorState'
import { ProgressBar } from './ProgressBar'
import { SkeletonCard } from './Skeleton'
import { StatusBadge } from './StatusBadge'

describe('EmptyState', () => {
  it('explains the emptiness without sounding like a failure', () => {
    render(
      <EmptyState icon={Inbox} title="Nothing scheduled" description="It will appear here." />,
    )

    expect(screen.getByText('Nothing scheduled')).toBeInTheDocument()
    expect(screen.getByText('It will appear here.')).toBeInTheDocument()
    // An empty section is not an error and must not be announced as one.
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('ErrorState', () => {
  it('announces both the title and the reason', () => {
    render(<ErrorState title="Could not load" description="The server said no." />)

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Could not load')
    expect(alert).toHaveTextContent('The server said no.')
  })

  it('offers a retry when one is possible', async () => {
    const user = userEvent.setup()
    const onRetry = vi.fn()
    render(<ErrorState title="Could not load" description="Try again." onRetry={onRetry} />)

    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('omits retry for an unauthorized state, which retrying cannot fix', () => {
    render(
      <ErrorState
        variant="unauthorized"
        title="You do not have access"
        description="Ask an adviser for access."
      />,
    )

    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('You do not have access')
  })
})

describe('ProgressBar', () => {
  it('exposes its value to assistive tech', () => {
    render(<ProgressBar value={1240} max={1500} label="Points toward level 5" />)

    const bar = screen.getByRole('progressbar', { name: 'Points toward level 5' })
    expect(bar).toHaveAttribute('aria-valuenow', '1240')
    expect(bar).toHaveAttribute('aria-valuemax', '1500')
  })

  it('clamps overflow instead of drawing past the end', () => {
    render(<ProgressBar value={2000} max={1500} label="Points" />)

    expect(screen.getByRole('progressbar').firstElementChild).toHaveStyle({ width: '100%' })
  })

  it('survives a zero maximum', () => {
    expect(() => render(<ProgressBar value={0} max={0} label="Points" />)).not.toThrow()
  })
})

describe('StatusBadge', () => {
  it('renders its label', () => {
    render(<StatusBadge tone="warning">Response needed</StatusBadge>)

    expect(screen.getByText('Response needed')).toBeInTheDocument()
  })
})

describe('SkeletonCard', () => {
  it('renders placeholder blocks rather than text', () => {
    const { container } = render(<SkeletonCard />)

    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
    expect(container).not.toHaveTextContent(/\w/)
  })
})
