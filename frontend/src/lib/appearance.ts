/**
 * Applies appearance preferences to the document root.
 *
 * These are written as attributes on <html> rather than held in React state,
 * because the CSS that reacts to them lives outside the React tree — hover
 * transitions, the confetti burst, the scroll reveal.
 *
 * "System" is resolved here rather than in CSS. Doing it in JS means the
 * stylesheet needs one dark block keyed on data-theme="dark", instead of
 * duplicating every token inside a prefers-color-scheme media query.
 */

export type Theme = 'system' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'

export type Appearance = {
  theme: Theme
  reduceMotion: boolean
  compactDensity: boolean
}

export const DEFAULT_APPEARANCE: Appearance = {
  theme: 'system',
  reduceMotion: false,
  compactDensity: false,
}

const DARK_QUERY = '(prefers-color-scheme: dark)'

function systemPrefersDark(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia(DARK_QUERY).matches
  )
}

/** Turns a preference into the theme actually being shown. */
export function resolveTheme(theme: Theme): ResolvedTheme {
  if (theme === 'light' || theme === 'dark') return theme
  return systemPrefersDark() ? 'dark' : 'light'
}

export function applyAppearance(
  appearance: Appearance,
  root: HTMLElement = document.documentElement,
): void {
  // The resolved theme drives the stylesheet; the preference is kept
  // alongside it so the settings UI and the OS watcher can read it back.
  root.setAttribute('data-theme', resolveTheme(appearance.theme))
  root.setAttribute('data-theme-preference', appearance.theme)

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
 * Keeps a "system" preference in step with the operating system.
 *
 * Returns an unsubscribe function. Does nothing useful when the preference is
 * an explicit light or dark, but is safe to call either way.
 */
export function watchSystemTheme(onChange: (resolved: ResolvedTheme) => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return () => {}
  }

  const query = window.matchMedia(DARK_QUERY)
  const listener = (event: MediaQueryListEvent) => onChange(event.matches ? 'dark' : 'light')

  query.addEventListener('change', listener)
  return () => query.removeEventListener('change', listener)
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
