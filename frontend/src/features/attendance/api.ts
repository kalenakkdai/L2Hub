import { apiFetch } from '../../api/client'
import type {
  AttendanceDay,
  AttendanceDaySummary,
  AttendanceRecord,
  AttendanceStudent,
  PingResult,
  WhereaboutsEntry,
} from './types'

export function listAttendanceDays(): Promise<{ days: AttendanceDaySummary[] }> {
  return apiFetch('/attendance/days')
}

export function createAttendanceDay(input: {
  schoolDate?: string
  startsAt?: string
  endsAt?: string
} = {}): Promise<AttendanceDay> {
  return apiFetch('/attendance/days', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function getAttendanceDay(dayId: string): Promise<AttendanceDay> {
  return apiFetch(`/attendance/days/${dayId}`)
}

export function scanAttendance(
  dayId: string,
  studentId: string,
  source: 'barcode' | 'keypad' | 'passkey',
): Promise<AttendanceRecord> {
  return apiFetch(`/attendance/days/${dayId}/scan`, {
    method: 'POST',
    body: JSON.stringify({ studentId, source }),
  })
}

export function closeAttendanceDay(dayId: string): Promise<AttendanceDay> {
  return apiFetch(`/attendance/days/${dayId}/close`, { method: 'POST' })
}

export function editAttendanceRecord(
  recordId: string,
  input: {
    status: string
    scorePercent: number
    presentPercent: number
    note?: string
  },
): Promise<AttendanceRecord> {
  return apiFetch(`/attendance/records/${recordId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export function listAttendanceStudents(): Promise<{
  students: AttendanceStudent[]
}> {
  return apiFetch('/attendance/identities')
}

export function saveAttendanceIdentity(
  profileId: string,
  input: {
    studentId: string
    parentEmail?: string
    parentPhone?: string
  },
): Promise<AttendanceStudent> {
  return apiFetch(`/attendance/identities/${profileId}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

export function listWhereabouts(): Promise<{ entries: WhereaboutsEntry[] }> {
  return apiFetch('/attendance/whereabouts')
}

export function startWhereabouts(input: {
  kind: 'bathroom' | 'errand'
  destinationKey: string
  studentId?: string
  customName?: string
  customDestination?: string
  taskName?: string
}): Promise<WhereaboutsEntry> {
  return apiFetch('/attendance/whereabouts', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function returnWhereabouts(entryId: string): Promise<WhereaboutsEntry> {
  return apiFetch(`/attendance/whereabouts/${entryId}/return`, { method: 'POST' })
}

export function pingWhereabouts(
  entryId: string,
  message: string,
): Promise<PingResult> {
  return apiFetch(`/attendance/whereabouts/${entryId}/ping`, {
    method: 'POST',
    body: JSON.stringify({ message }),
  })
}

export function beginPasskeyRegistration(): Promise<{
  challengeId: string
  options: Record<string, unknown>
}> {
  return apiFetch('/attendance/passkeys/register/options', { method: 'POST' })
}

export function finishPasskeyRegistration(input: {
  challengeId: string
  credential: Record<string, unknown>
  deviceName: string
}): Promise<{ id: string; deviceName: string; createdAt: string }> {
  return apiFetch('/attendance/passkeys/register/verify', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function beginPasskeyCheckIn(dayId: string): Promise<{
  challengeId: string
  options: Record<string, unknown>
}> {
  return apiFetch(`/attendance/days/${dayId}/passkey/options`, {
    method: 'POST',
  })
}

export function finishPasskeyCheckIn(
  dayId: string,
  input: {
    challengeId: string
    credential: Record<string, unknown>
  },
): Promise<AttendanceRecord> {
  return apiFetch(`/attendance/days/${dayId}/passkey/verify`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}
