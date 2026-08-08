import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Campsite } from './Campsite'
import { L2_COMMITTEES } from '../lib/campsite'

describe('Campsite', () => {
  it('pitches a labelled tent for every crew', () => {
    const { container } = render(
      <Campsite committees={['Community', 'Publicity', 'Rally Committee']} />,
    )

    expect(container.querySelectorAll('[data-tent]')).toHaveLength(3)
    expect(screen.getByText('Community')).toBeInTheDocument()
    expect(screen.getByText('Publicity')).toBeInTheDocument()
    // The redundant suffix is trimmed so the name fits on the tent.
    expect(screen.getByText('Rally')).toBeInTheDocument()
  })

  it('falls back to the full Leadership roster', () => {
    const { container } = render(<Campsite />)
    expect(container.querySelectorAll('[data-tent]')).toHaveLength(
      L2_COMMITTEES.length,
    )
  })

  it('burns an L2 Hub campfire with animated flames', () => {
    const { container } = render(<Campsite committees={['Spirit']} />)

    expect(screen.getByText('L2 Hub')).toBeInTheDocument()
    expect(container.querySelectorAll('.campsite-flame').length).toBeGreaterThan(0)
    expect(container.querySelectorAll('.campsite-spark').length).toBeGreaterThan(0)
  })

  it('grows a forest of pines in layered depth bands', () => {
    const { container } = render(<Campsite committees={[]} />)

    // Far, mid, and the two near bands that frame the clearing.
    expect(container.querySelectorAll('path[d^="M"]').length).toBeGreaterThan(80)
    expect(container.querySelectorAll('[data-tent]')).toHaveLength(0)
  })

  it('hides the decorative scene from assistive tech', () => {
    const { container } = render(<Campsite />)
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true')
  })
})
