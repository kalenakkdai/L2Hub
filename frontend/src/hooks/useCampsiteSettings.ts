import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { SAVE_DEBOUNCE_MS, type SaveStatus } from './useProfile'

export type ModulesEnabled = Record<string, boolean>

export type PointsConfig = {
  debrief_submitted: number
  event_attended: number
  task_completed: number
  points_per_level: number
}

export type CampsiteSettings = {
  id: string
  name: string
  tagline: string | null
  category: string | null
  icon: string | null
  accent_color: string
  modules_enabled: ModulesEnabled
  join_code: string | null
  requires_approval: boolean
  is_public: boolean
  points_config: PointsConfig
}

export type CampsitePatch = Partial<Omit<CampsiteSettings, 'id'>>

const COLUMNS =
  'id, name, tagline, category, icon, accent_color, modules_enabled, join_code, requires_approval, is_public, points_config'

async function fetchSettings(): Promise<CampsiteSettings> {
  const { data, error } = await supabase.from('campsite_settings').select(COLUMNS).single()
  if (error) throw error
  return data as unknown as CampsiteSettings
}

/**
 * The singleton Campsite configuration.
 *
 * Writes are debounced and optimistic like the profile hook. RLS is what
 * actually decides whether a write lands — `canEdit` only decides whether the
 * controls are interactive.
 */
export function useCampsiteSettings(canEdit: boolean) {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<SaveStatus>('idle')

  const query = useQuery({
    queryKey: ['campsite-settings'],
    queryFn: fetchSettings,
    staleTime: 60_000,
  })

  const pending = useRef<CampsitePatch>({})
  const rollback = useRef<CampsiteSettings | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const savedTimer = useRef<number | undefined>(undefined)

  const mutation = useMutation({
    mutationFn: async (patch: CampsitePatch) => {
      const id = queryClient.getQueryData<CampsiteSettings>(['campsite-settings'])?.id
      if (!id) throw new Error('Campsite settings have not loaded.')

      const { error } = await supabase
        .from('campsite_settings')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      rollback.current = null
      setStatus('saved')
      window.clearTimeout(savedTimer.current)
      savedTimer.current = window.setTimeout(() => setStatus('idle'), 2000)
      void queryClient.invalidateQueries({ queryKey: ['campsite-settings'] })
    },
    onError: () => {
      if (rollback.current) {
        queryClient.setQueryData(['campsite-settings'], rollback.current)
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
    (patch: CampsitePatch) => {
      if (!canEdit) return
      const current = queryClient.getQueryData<CampsiteSettings>(['campsite-settings'])
      if (!current) return

      if (!rollback.current) rollback.current = current
      queryClient.setQueryData<CampsiteSettings>(['campsite-settings'], {
        ...current,
        ...patch,
      })
      pending.current = { ...pending.current, ...patch }

      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(flush, SAVE_DEBOUNCE_MS)
    },
    [canEdit, flush, queryClient],
  )

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
      settings: query.data ?? null,
      isPending: query.isPending,
      isError: query.isError,
      refetch: query.refetch,
      save,
      saveNow,
      status,
    }),
    [query.data, query.isPending, query.isError, query.refetch, save, saveNow, status],
  )
}
