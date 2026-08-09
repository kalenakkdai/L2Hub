import { useState } from 'react'
import type { AttendanceStudent } from '../types'

type IdentitySetupProps = {
  students: AttendanceStudent[]
  saving: boolean
  onSave: (
    profileId: string,
    input: {
      studentId: string
      parentEmail?: string
      parentPhone?: string
    },
  ) => void
}

/** ASBO/AC-only enrollment; the raw student ID is never returned by the API. */
export function IdentitySetup({
  students,
  saving,
  onSave,
}: IdentitySetupProps) {
  const [profileId, setProfileId] = useState('')
  const selected = students.find((student) => student.profileId === profileId)
  const [studentId, setStudentId] = useState('')
  const [parentEmail, setParentEmail] = useState('')
  const [parentPhone, setParentPhone] = useState('')

  return (
    <details className="rounded-card border border-border-subtle bg-surface p-4 shadow-xs">
      <summary className="cursor-pointer text-sm font-semibold text-ink">
        Student ID & parent contact setup
      </summary>
      <p className="mt-2 text-xs text-ink-muted">
        Student IDs are stored as a one-way keyed digest; only the last four
        characters come back to this screen.
      </p>
      <form
        className="mt-3 grid gap-3 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault()
          if (!profileId || !studentId) return
          onSave(profileId, { studentId, parentEmail, parentPhone })
          setStudentId('')
        }}
      >
        <label className="text-xs font-medium text-ink-muted sm:col-span-2">
          Student
          <select
            required
            value={profileId}
            onChange={(event) => {
              const next = event.target.value
              setProfileId(next)
              const student = students.find((item) => item.profileId === next)
              setParentEmail(student?.parentEmail ?? '')
              setParentPhone(student?.parentPhone ?? '')
            }}
            className="mt-1 w-full rounded-control border border-border-strong bg-surface px-3 py-2 text-sm text-ink"
          >
            <option value="">Choose a student</option>
            {students.map((student) => (
              <option key={student.profileId} value={student.profileId}>
                {student.displayName}
                {student.studentIdLast4
                  ? ` · ID ending ${student.studentIdLast4}`
                  : ' · not enrolled'}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-ink-muted">
          {selected?.studentIdLast4 ? 'New student ID' : 'Student ID'}
          <input
            required
            value={studentId}
            onChange={(event) => setStudentId(event.target.value)}
            className="mt-1 w-full rounded-control border border-border-strong px-3 py-2 text-sm"
            autoComplete="off"
          />
        </label>
        <label className="text-xs font-medium text-ink-muted">
          Parent email
          <input
            type="email"
            value={parentEmail}
            onChange={(event) => setParentEmail(event.target.value)}
            className="mt-1 w-full rounded-control border border-border-strong px-3 py-2 text-sm"
          />
        </label>
        <label className="text-xs font-medium text-ink-muted">
          Parent phone
          <input
            type="tel"
            value={parentPhone}
            onChange={(event) => setParentPhone(event.target.value)}
            className="mt-1 w-full rounded-control border border-border-strong px-3 py-2 text-sm"
          />
        </label>
        <div className="flex items-end">
          <button
            type="submit"
            disabled={saving || !profileId || studentId.length < 4}
            className="rounded-control bg-navy-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Save protected identity
          </button>
        </div>
      </form>
    </details>
  )
}
