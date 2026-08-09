export type AttendanceStatus =
  | 'present'
  | 'late'
  | 'absent'
  | 'excused'
  | 'under_80'

export type AttendanceRecord = {
  id: string
  profileId: string
  displayName: string
  checkedInAt: string | null
  checkInSource: 'barcode' | 'keypad' | 'passkey' | 'manual' | null
  late: boolean
  scorePercent: number
  presentPercent: number
  status: AttendanceStatus
  manualNote: string | null
  editedAt: string | null
  parentAlertSentAt: string | null
  needsAttention: boolean
}

export type AttendanceDay = {
  id: string
  schoolDate: string
  startsAt: string
  endsAt: string
  status: 'open' | 'closed'
  closedAt: string | null
  recordCount: number
  records: AttendanceRecord[]
}

export type AttendanceDaySummary = Omit<AttendanceDay, 'records'>

export type AttendanceStudent = {
  profileId: string
  displayName: string
  studentIdLast4: string | null
  parentEmail: string | null
  parentPhone: string | null
  passkeyOptIn: boolean
}

export type WhereaboutsKind = 'bathroom' | 'errand'

export type WhereaboutsEntry = {
  id: string
  profileId: string | null
  displayName: string
  kind: WhereaboutsKind
  destinationKey: string
  customDestination: string | null
  taskName: string | null
  leftAt: string
  returnedAt: string | null
  canSms: boolean
}

export type PingResult = {
  id: string
  deliveryStatus: string
  smsPhone: string | null
  smsUrl: string | null
}
