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

// ---------------------------------------------------------------------------
// Campsite accent colour
// ---------------------------------------------------------------------------

function channel(value: number): number {
  const v = value / 255
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
}

/** WCAG relative luminance, 0 (black) to 1 (white). */
export function luminance(hex: string): number | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!match) return null

  const int = Number.parseInt(match[1], 16)
  const r = channel((int >> 16) & 255)
  const g = channel((int >> 8) & 255)
  const b = channel(int & 255)

  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrastRatio(a: string, b: string): number | null {
  const la = luminance(a)
  const lb = luminance(b)
  if (la === null || lb === null) return null

  const [light, dark] = la > lb ? [la, lb] : [lb, la]
  return (light + 0.05) / (dark + 0.05)
}

/** Shifts a colour toward black by `amount` (0-1), for a hover state. */
function darken(hex: string, amount: number): string {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!match) return hex

  const int = Number.parseInt(match[1], 16)
  const shift = (v: number) => Math.max(0, Math.round(v * (1 - amount)))
  const r = shift((int >> 16) & 255)
  const g = shift((int >> 8) & 255)
  const b = shift(int & 255)

  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

/** Minimum contrast for a fill that carries white text. */
const MIN_FILL_CONTRAST = 4.5

/**
 * Applies a Campsite's chosen accent colour.
 *
 * Only the *fill* steps move. accent-ink is left alone, because a custom
 * colour readable as a button background is often unreadable as body text,
 * and silently making links illegible is worse than an accent that only
 * partly applies.
 *
 * A colour that cannot carry white text is refused outright and the default
 * palette stays — a Campsite should not be able to configure itself into
 * unreadable buttons.
 */
export function applyAccentColor(
  color: string | null | undefined,
  root: HTMLElement = document.documentElement,
): boolean {
  root.style.removeProperty('--color-accent-600')
  root.style.removeProperty('--color-accent-700')

  if (!color) return false

  const ratio = contrastRatio(color, '#ffffff')
  if (ratio === null || ratio < MIN_FILL_CONTRAST) return false

  root.style.setProperty('--color-accent-600', color)
  root.style.setProperty('--color-accent-700', darken(color, 0.18))
  return true
}
