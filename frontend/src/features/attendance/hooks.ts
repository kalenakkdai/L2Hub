import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  closeAttendanceDay,
  createAttendanceDay,
  editAttendanceRecord,
  getAttendanceDay,
  listAttendanceDays,
  listAttendanceStudents,
  listWhereabouts,
  pingWhereabouts,
  returnWhereabouts,
  saveAttendanceIdentity,
  scanAttendance,
  startWhereabouts,
} from './api'

const daysKey = ['attendance', 'days'] as const
const whereaboutsKey = ['attendance', 'whereabouts'] as const

export function useAttendanceDays(enabled = true) {
  return useQuery({
    queryKey: daysKey,
    queryFn: async () => (await listAttendanceDays()).days,
    enabled,
  })
}

export function useAttendanceDay(dayId: string | null) {
  return useQuery({
    queryKey: ['attendance', 'day', dayId],
    queryFn: () => getAttendanceDay(dayId!),
    enabled: Boolean(dayId),
    refetchInterval: 15_000,
  })
}

export function useAttendanceStudents(enabled = true) {
  return useQuery({
    queryKey: ['attendance', 'students'],
    queryFn: async () => (await listAttendanceStudents()).students,
    enabled,
  })
}

export function useWhereabouts(enabled = true) {
  return useQuery({
    queryKey: whereaboutsKey,
    queryFn: async () => (await listWhereabouts()).entries,
    enabled,
    refetchInterval: 10_000,
  })
}

export function useAttendanceCommands() {
  const client = useQueryClient()
  const invalidateDays = () => {
    void client.invalidateQueries({ queryKey: daysKey })
    void client.invalidateQueries({ queryKey: ['attendance', 'day'] })
  }
  const invalidateWhereabouts = () =>
    void client.invalidateQueries({ queryKey: whereaboutsKey })

  const createDay = useMutation({
    mutationFn: createAttendanceDay,
    onSuccess: invalidateDays,
  })
  const scan = useMutation({
    mutationFn: (input: {
      dayId: string
      studentId: string
      source: 'barcode' | 'keypad' | 'passkey'
    }) => scanAttendance(input.dayId, input.studentId, input.source),
    onSuccess: invalidateDays,
  })
  const closeDay = useMutation({
    mutationFn: closeAttendanceDay,
    onSuccess: invalidateDays,
  })
  const editRecord = useMutation({
    mutationFn: (input: {
      recordId: string
      status: string
      scorePercent: number
      presentPercent: number
      note?: string
    }) =>
      editAttendanceRecord(input.recordId, {
        status: input.status,
        scorePercent: input.scorePercent,
        presentPercent: input.presentPercent,
        note: input.note,
      }),
    onSuccess: invalidateDays,
  })
  const saveIdentity = useMutation({
    mutationFn: (input: {
      profileId: string
      studentId: string
      parentEmail?: string
      parentPhone?: string
    }) => saveAttendanceIdentity(input.profileId, input),
    onSuccess: () =>
      void client.invalidateQueries({ queryKey: ['attendance', 'students'] }),
  })
  const checkout = useMutation({
    mutationFn: startWhereabouts,
    onSuccess: invalidateWhereabouts,
  })
  const returnEntry = useMutation({
    mutationFn: returnWhereabouts,
    onSuccess: invalidateWhereabouts,
  })
  const ping = useMutation({
    mutationFn: (input: { entryId: string; message: string }) =>
      pingWhereabouts(input.entryId, input.message),
  })

  return {
    createDay,
    scan,
    closeDay,
    editRecord,
    saveIdentity,
    checkout,
    returnEntry,
    ping,
  }
}
