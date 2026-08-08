import { useEffect, useRef } from 'react'
import { prefersReducedMotion } from '../../lib/appearance'

const STORAGE_KEY = 'quad.level'
const COLORS = ['#12372A', '#9BE3BE', '#D99B12', '#A7F3D0']

function alreadyCelebrated(level: number): boolean {
  try {
    const seen = Number.parseInt(localStorage.getItem(STORAGE_KEY) ?? '', 10)
    return Number.isInteger(seen) && seen >= level
  } catch {
    // Storage unavailable — treat as celebrated so we do not fire on every
    // single render in a private window.
    return true
  }
}

function remember(level: number): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(level))
  } catch {
    // Nothing to do; the burst simply may repeat next session.
  }
}

/**
 * Throws one confetti burst the first time a level is reached, ever.
 *
 * Returns a ref for the element the burst originates from. Deliberately
 * once-only and persisted: a celebration that fires on every page load stops
 * being a celebration.
 */
export function useLevelConfetti<T extends HTMLElement>(level: number) {
  const ref = useRef<T>(null)

  useEffect(() => {
    if (!Number.isFinite(level) || alreadyCelebrated(level)) return

    remember(level)
    if (prefersReducedMotion()) return

    const timer = window.setTimeout(() => {
      const host = ref.current
      if (!host || host.querySelector('.confetti-burst')) return

      const burst = document.createElement('span')
      burst.className = 'confetti-burst'
      burst.setAttribute('aria-hidden', 'true')

      for (let i = 0; i < 16; i++) {
        const piece = document.createElement('span')
        const angle = (Math.PI * 2 * i) / 16 + Math.random() * 0.3
        const distance = 34 + Math.random() * 26
        piece.style.setProperty('--dx', `${Math.cos(angle) * distance}px`)
        piece.style.setProperty('--dy', `${Math.sin(angle) * distance - 12}px`)
        piece.style.setProperty('--rot', `${Math.round(Math.random() * 360 - 180)}deg`)
        piece.style.background = COLORS[i % COLORS.length]
        piece.style.animationDelay = `${Math.round(Math.random() * 60)}ms`
        burst.appendChild(piece)
      }

      host.appendChild(burst)
      window.setTimeout(() => burst.remove(), 1200)
    }, 500)

    return () => window.clearTimeout(timer)
  }, [level])

  return ref
}
