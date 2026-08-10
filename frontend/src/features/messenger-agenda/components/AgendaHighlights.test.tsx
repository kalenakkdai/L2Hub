import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  AttributedTranscript,
  ContributorLegend,
} from '../components/AgendaHighlights'
import type { Contributor } from '../types'

const CONTRIBUTORS: Contributor[] = [
  {
    name: 'Avery',
    color: '#1d4ed8',
    highlight: '#dbeafe',
    initials: 'AV',
    lineCount: 2,
  },
  {
    name: 'Jordan Lee',
    color: '#b45309',
    highlight: '#fef3c7',
    initials: 'JL',
    lineCount: 1,
  },
]

describe('ContributorLegend', () => {
  it('lists every contributor with their own color', () => {
    render(<ContributorLegend contributors={CONTRIBUTORS} />)
    const avery = screen.getByText('Avery')
    const jordan = screen.getByText('Jordan Lee')
    expect(avery).toHaveStyle({ color: 'rgb(29, 78, 216)' })
    expect(jordan).toHaveStyle({ color: 'rgb(180, 83, 9)' })
  })

  it('renders nothing when nobody was attributed', () => {
    const { container } = render(<ContributorLegend contributors={[]} />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('AttributedTranscript', () => {
  it('highlights each line in the speaker color and leaves others plain', () => {
    render(
      <AttributedTranscript
        contributors={CONTRIBUTORS}
        lines={[
          { text: 'Publicity posts the flyer', speaker: 'Avery' },
          { text: 'Unattributed note' },
        ]}
      />,
    )

    const highlighted = screen.getByText(/Publicity posts the flyer/)
    expect(highlighted).toHaveStyle({ backgroundColor: 'rgb(219, 234, 254)' })
    expect(screen.getByText('Avery:')).toBeInTheDocument()

    const plain = screen.getByText(/Unattributed note/)
    expect(plain.style.backgroundColor).toBe('')
  })
})
