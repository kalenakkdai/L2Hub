import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { Moon } from './Moon'
import { NightSky } from './NightSky'

function renderMoon() {
  const { container } = render(<Moon />)
  return container
}

describe('Moon', () => {
  it('draws the disc as a true circle', () => {
    const disc = renderMoon().querySelector('[data-moon="disc"]')

    expect(disc).not.toBeNull()
    expect(disc?.tagName.toLowerCase()).toBe('circle')
    expect(disc?.getAttribute('r')).toBe('34')
  })

  it('keeps its own aspect ratio so the disc cannot be squashed into an ellipse', () => {
    const container = renderMoon()
    const svg = container.querySelector('svg')

    // NightSky stretches its star field with preserveAspectRatio="none". The
    // moon must never inherit that, or it stops being round.
    expect(svg?.getAttribute('preserveAspectRatio')).toBe('xMidYMid meet')
    expect(container.firstElementChild?.className).toContain('aspect-square')
  })

  it('gives the face bumps to catch the light', () => {
    const craters = renderMoon().querySelectorAll('[data-crater]')

    expect(craters.length).toBeGreaterThanOrEqual(6)
  })

  it('keeps every bump inside the disc', () => {
    const container = renderMoon()
    const disc = container.querySelector('[data-moon="disc"]')
    const cx = Number(disc?.getAttribute('cx'))
    const cy = Number(disc?.getAttribute('cy'))
    const radius = Number(disc?.getAttribute('r'))

    for (const crater of container.querySelectorAll('[data-crater] circle')) {
      const x = Number(crater.getAttribute('cx'))
      const y = Number(crater.getAttribute('cy'))
      const r = Number(crater.getAttribute('r'))
      const distance = Math.hypot(x - cx, y - cy)

      expect(distance + r).toBeLessThanOrEqual(radius)
    }
  })

  it('fills the face with a warm yellow rather than a pale white', () => {
    const container = renderMoon()
    const disc = container.querySelector('[data-moon="disc"]')
    expect(disc?.getAttribute('fill')).toBe('url(#moon-face)')

    const stops = [...container.querySelectorAll('#moon-face stop')].map((stop) =>
      stop.getAttribute('stop-color'),
    )
    expect(stops).toEqual(['#fffbe0', '#ffe98a', '#f0bd42'])
  })

  it('glows with a halo behind the disc', () => {
    const container = renderMoon()
    const halo = container.querySelector('.moon-halo')

    expect(halo?.getAttribute('fill')).toBe('url(#moon-halo)')
    // Painted first, so the disc sits on top of its own glow.
    expect(halo?.compareDocumentPosition(container.querySelector('.moon-disc')!)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    )
  })

  it('stays decorative', () => {
    expect(renderMoon().firstElementChild?.getAttribute('aria-hidden')).toBe('true')
  })
})

describe('NightSky', () => {
  it('hangs the moon in the sky', () => {
    const { container } = render(<NightSky />)

    expect(container.querySelector('[data-moon="disc"]')).not.toBeNull()
  })

  it('no longer draws a moon inside the stretched star field', () => {
    const { container } = render(<NightSky />)
    const stretched = [...container.querySelectorAll('svg')].find(
      (svg) => svg.getAttribute('preserveAspectRatio') === 'none',
    )

    expect(stretched).toBeDefined()
    expect(stretched?.querySelector('[data-moon="disc"]')).toBeNull()
    expect(stretched?.querySelector('#moon-glow')).toBeNull()
  })
})
