import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SummaryTrail, litStageCount } from './SummaryTrail'

describe('litStageCount', () => {
  it('lights stages in workflow order', () => {
    expect(litStageCount('not_requested')).toBe(0)
    expect(litStageCount('pending_approval')).toBe(1)
    expect(litStageCount('generating')).toBe(2)
    expect(litStageCount('generated')).toBe(3)
    expect(litStageCount('published')).toBe(4)
  })

  it('treats archived as fully complete', () => {
    expect(litStageCount('archived')).toBe(4)
  })

  it('lights nothing for an unknown status', () => {
    expect(litStageCount('something_new')).toBe(0)
  })
})

describe('SummaryTrail', () => {
  it('names every workflow stage', () => {
    render(<SummaryTrail status="generated" />)

    for (const stage of ['Requested', 'Approved', 'Generated', 'Published']) {
      expect(screen.getByText(stage)).toBeInTheDocument()
    }
  })

  it('marks the stage still in progress as the current step', () => {
    const { container } = render(<SummaryTrail status="generated" />)

    const current = container.querySelectorAll('[aria-current="step"]')
    expect(current).toHaveLength(1)
    expect(current[0]).toHaveTextContent('Published')
  })

  it('marks no current step once everything is published', () => {
    const { container } = render(<SummaryTrail status="published" />)

    expect(container.querySelectorAll('[aria-current="step"]')).toHaveLength(0)
  })
})
