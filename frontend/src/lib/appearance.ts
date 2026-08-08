/**
 * Applies appearance preferences to the document root.
 *
 * These are written as attributes on <html> rather than held in React state,
 * because the CSS that reacts to them lives outside the React tree — hover
 * transitions, the confetti burst, the scroll reveal.
 *
 * Reduce motion here is an override, not a duplicate of the OS setting: the
 * media query already handles someone who asked their system for less motion,
 * and this handles someone who wants it only in this app.
 */

export type Theme = 'system' | 'light' | 'dark'

export type Appearance = {
  theme: Theme
  reduceMotion: boolean
  compactDensity: boolean
}

export function applyAppearance(appearance: Appearance, root: HTMLElement): void {
  root.setAttribute('data-theme', appearance.theme)

  if (appearance.reduceMotion) {
    root.setAttribute('data-reduce-motion', 'true')
  } else {
    root.removeAttribute('data-reduce-motion')
  }

  if (appearance.compactDensity) {
    root.setAttribute('data-density', 'compact')
  } else {
    root.removeAttribute('data-density')
  }
}

/**
 * True when animation should be suppressed, from either source.
 *
 * Imperative animation — the confetti burst, the points count-up — cannot be
 * stopped by CSS, so it asks this instead.
 */
export function prefersReducedMotion(root: HTMLElement = document.documentElement): boolean {
  if (root.getAttribute('data-reduce-motion') === 'true') return true

  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}
