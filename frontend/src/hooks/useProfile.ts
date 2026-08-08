import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Theme } from '../lib/appearance'

/** The settings-relevant shape of public.profiles. */
export type SettingsProfile = {
  id: string
  email: string
  full_name: string | null
  display_name: string | null
  pronouns: string | null
  grade_year: number | null
  avatar_url: string | null
  phone: string | null
  phone_verified: boolean
  email_verified: boolean
  theme: Theme
  reduce_motion: boolean
  compact_density: boolean
  quiet_hours_start: string | null
  quiet_hours_end: string | null
  notifications_paused: boolean
}

/** Columns a camper is allowed to change. Verification flags are absent by design. */
export type ProfilePatch = Partial<
  Pick<
    SettingsProfile,
    | 'display_name'
    | 'pronouns'
    | 'grade_year'
    | 'avatar_url'
    | 'phone'
    | 'theme'
    | 'reduce_motion'
    | 'compact_density'
    | 'quiet_hours_start'
    | 'quiet_hours_end'
    | 'notifications_paused'
  >
>

const COLUMNS =
  'id, email, full_name, display_name, pronouns, grade_year, avatar_url, phone, phone_verified, email_verified, theme, reduce_motion, compact_density, quiet_hours_start, quiet_hours_end, notifications_paused'

export const SAVE_DEBOUNCE_MS = 500

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

async function fetchProfile(): Promise<SettingsProfile> {
  const { data: auth } = await supabase.auth.getUser()
  const userId = auth.user?.id
  if (!userId) throw new Error('Not signed in.')

  const { data, error } = await supabase
    .from('profiles')
    .select(COLUMNS)
    .eq('id', userId)
    .single()

  if (error) throw error
  return data as unknown as SettingsProfile
}

/**
 * The camper's own profile, with debounced optimistic autosave.
 *
 * `save` applies the change to the cache immediately and schedules the write.
 * Consecutive edits to different fields inside the debounce window are merged
 * into one request rather than racing each other. A failed write rolls the
 * cache back to what the server last confirmed.
 */
export function useProfile() {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<SaveStatus>('idle')

  const query = useQuery({
    queryKey: ['profile', 'settings'],
    queryFn: fetchProfile,
    staleTime: 30_000,
  })

  // Edits waiting out the debounce, and the snapshot to roll back to.
  const pending = useRef<ProfilePatch>({})
  const rollback = useRef<SettingsProfile | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const savedTimer = useRef<number | undefined>(undefined)

  const mutation = useMutation({
    mutationFn: async (patch: ProfilePatch) => {
      const { data: auth } = await supabase.auth.getUser()
      const userId = auth.user?.id
      if (!userId) throw new Error('Not signed in.')

      const { error } = await supabase.from('profiles').update(patch).eq('id', userId)
      if (error) throw error
    },
    onSuccess: () => {
      rollback.current = null
      setStatus('saved')
      // The indicator is an acknowledgement, not a permanent label.
      window.clearTimeout(savedTimer.current)
      savedTimer.current = window.setTimeout(() => setStatus('idle'), 2000)
      void queryClient.invalidateQueries({ queryKey: ['profile', 'settings'] })
    },
    onError: () => {
      if (rollback.current) {
        queryClient.setQueryData(['profile', 'settings'], rollback.current)
        rollback.current = null
      }
      setStatus('error')
    },
  })

  const flush = useCallback(() => {
    const patch = pending.current
    pending.current = {}
    if (Object.keys(patch).length === 0) return
    setStatus('saving')
    mutation.mutate(patch)
  }, [mutation])

  const save = useCallback(
    (patch: ProfilePatch) => {
      const current = queryClient.getQueryData<SettingsProfile>(['profile', 'settings'])
      if (!current) return

      // Snapshot once per burst, so a rollback returns to the last confirmed
      // server state rather than to a half-applied optimistic one.
      if (!rollback.current) rollback.current = current

      queryClient.setQueryData<SettingsProfile>(['profile', 'settings'], {
        ...current,
        ...patch,
      })
      pending.current = { ...pending.current, ...patch }

      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(flush, SAVE_DEBOUNCE_MS)
    },
    [flush, queryClient],
  )

  /** Writes any pending edit immediately — for blur and unmount. */
  const saveNow = useCallback(() => {
    window.clearTimeout(timer.current)
    flush()
  }, [flush])

  useEffect(
    () => () => {
      window.clearTimeout(timer.current)
      window.clearTimeout(savedTimer.current)
    },
    [],
  )

  return useMemo(
    () => ({
      profile: query.data ?? null,
      isPending: query.isPending,
      isError: query.isError,
      error: query.error,
      refetch: query.refetch,
      save,
      saveNow,
      status,
    }),
    [query.data, query.isPending, query.isError, query.error, query.refetch, save, saveNow, status],
  )
}
