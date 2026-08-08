import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export type CampsiteChrome = {
  modulesEnabled: Record<string, boolean>
  accentColor: string | null
  archivedAt: string | null
}

/**
 * The Campsite-wide configuration every screen needs, not just the settings
 * page: which modules are switched on, the accent colour, and whether the
 * Campsite has been archived.
 *
 * Readable by anyone signed in — RLS allows select to all authenticated
 * users, because these values drive the chrome rather than exposing anything.
 * Shares nothing with useCampsiteSettings beyond the table; that hook is for
 * editing, this one is for reading cheaply from anywhere.
 */
export function useCampsiteChrome() {
  return useQuery<CampsiteChrome>({
    queryKey: ['campsite-chrome'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('campsite_settings')
        .select('modules_enabled, accent_color, archived_at')
        .single()

      if (error) throw error

      const row = data as unknown as {
        modules_enabled: Record<string, boolean> | null
        accent_color: string | null
        archived_at: string | null
      }

      return {
        modulesEnabled: row.modules_enabled ?? {},
        accentColor: row.accent_color,
        archivedAt: row.archived_at,
      }
    },
    staleTime: 60_000,
  })
}

/**
 * True when a module is available.
 *
 * Absent means on: a module the Campsite has never configured should work,
 * not silently disappear.
 */
export function moduleEnabled(
  modules: Record<string, boolean> | undefined,
  key: string | undefined,
): boolean {
  if (!key) return true
  return modules?.[key] ?? true
}
