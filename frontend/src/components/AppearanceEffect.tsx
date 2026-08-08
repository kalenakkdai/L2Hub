import { useEffect, useMemo } from 'react'
import { useAuth } from '../auth/useAuth'
import { useProfile } from '../hooks/useProfile'
import {
  applyAppearance,
  DEFAULT_APPEARANCE,
  watchSystemTheme,
  type Appearance,
} from '../lib/appearance'

/**
 * Applies the signed-in camper's appearance preferences to the whole app.
 *
 * Mounted once at the root rather than on the settings page, because a theme
 * that only holds while you are looking at the theme control is not a theme.
 * Renders nothing.
 *
 * The profile query is shared with the settings page through react-query, so
 * mounting this costs no extra request.
 */
export function AppearanceEffect() {
  const { status } = useAuth()
  const { profile } = useProfile()

  const appearance: Appearance = useMemo(
    () =>
      status === 'authenticated' && profile
        ? {
            theme: profile.theme,
            reduceMotion: profile.reduce_motion,
            compactDensity: profile.compact_density,
          }
        : DEFAULT_APPEARANCE,
    [status, profile],
  )

  useEffect(() => {
    applyAppearance(appearance)
  }, [appearance])

  // Only "system" needs to follow the OS; an explicit choice should not move
  // when someone's machine switches at sunset.
  useEffect(() => {
    if (appearance.theme !== 'system') return
    return watchSystemTheme(() => applyAppearance(appearance))
  }, [appearance])

  return null
}
