import { useCallback, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { SaveStatus } from './useProfile'

export const EVENT_TYPES = [
  'task_assigned',
  'task_due_soon',
  'task_overdue',
  'event_created',
  'event_starting',
  'crew_announcement',
  'points_awarded',
  'level_up',
] as const

export const CHANNELS = ['email', 'sms', 'in_app'] as const

export type NotificationEventType = (typeof EVENT_TYPES)[number]
export type NotificationChannel = (typeof CHANNELS)[number]

export type NotificationPreference = {
  event_type: NotificationEventType
  channel: NotificationChannel
  enabled: boolean
}

export const EVENT_TYPE_LABELS: Record<NotificationEventType, string> = {
  task_assigned: 'Task assigned to me',
  task_due_soon: 'Task due soon',
  task_overdue: 'Task overdue',
  event_created: 'New event created',
  event_starting: 'Event starting',
  // The column value keeps the spec's name; the label uses this project's word.
  crew_announcement: 'Committee announcement',
  points_awarded: 'Points awarded',
  level_up: 'Level up',
}

export const CHANNEL_LABELS: Record<NotificationChannel, string> = {
  email: 'Email',
  sms: 'SMS',
  in_app: 'In-app',
}

/** Overdue alerts ignore quiet hours, so the grid can say so. */
export const ALWAYS_DELIVERS: NotificationEventType[] = ['task_overdue']

function key(eventType: NotificationEventType, channel: NotificationChannel): string {
  return `${eventType}:${channel}`
}

async function fetchPrefs(): Promise<Map<string, boolean>> {
  const { data: auth } = await supabase.auth.getUser()
  const userId = auth.user?.id
  if (!userId) throw new Error('Not signed in.')

  const { data, error } = await supabase
    .from('notification_preferences')
    .select('event_type, channel, enabled')
    .eq('profile_id', userId)

  if (error) throw error

  const map = new Map<string, boolean>()
  for (const row of (data ?? []) as NotificationPreference[]) {
    map.set(key(row.event_type, row.channel), row.enabled)
  }
  return map
}

/**
 * The 8×3 notification grid.
 *
 * Rows are not seeded up front. A missing row means "on", which is the
 * default in the schema, so a camper who never opens this page costs no
 * storage and a toggle writes exactly one row.
 */
export function useNotificationPrefs() {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<SaveStatus>('idle')

  const query = useQuery({
    queryKey: ['notification-preferences'],
    queryFn: fetchPrefs,
    staleTime: 30_000,
  })

  const mutation = useMutation({
    mutationFn: async (pref: NotificationPreference) => {
      const { data: auth } = await supabase.auth.getUser()
      const userId = auth.user?.id
      if (!userId) throw new Error('Not signed in.')

      const { error } = await supabase.from('notification_preferences').upsert(
        {
          profile_id: userId,
          event_type: pref.event_type,
          channel: pref.channel,
          enabled: pref.enabled,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'profile_id,event_type,channel' },
      )
      if (error) throw error
    },
    onMutate: async (pref) => {
      await queryClient.cancelQueries({ queryKey: ['notification-preferences'] })
      const previous = queryClient.getQueryData<Map<string, boolean>>([
        'notification-preferences',
      ])

      const next = new Map(previous ?? [])
      next.set(key(pref.event_type, pref.channel), pref.enabled)
      queryClient.setQueryData(['notification-preferences'], next)
      setStatus('saving')

      return { previous }
    },
    onError: (_error, _pref, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['notification-preferences'], context.previous)
      }
      setStatus('error')
    },
    onSuccess: () => {
      setStatus('saved')
      window.setTimeout(() => setStatus('idle'), 2000)
    },
  })

  const isEnabled = useCallback(
    (eventType: NotificationEventType, channel: NotificationChannel): boolean =>
      query.data?.get(key(eventType, channel)) ?? true,
    [query.data],
  )

  const toggle = useCallback(
    (eventType: NotificationEventType, channel: NotificationChannel, enabled: boolean) => {
      mutation.mutate({ event_type: eventType, channel, enabled })
    },
    [mutation],
  )

  return useMemo(
    () => ({
      isPending: query.isPending,
      isError: query.isError,
      refetch: query.refetch,
      isEnabled,
      toggle,
      status,
    }),
    [query.isPending, query.isError, query.refetch, isEnabled, toggle, status],
  )
}
