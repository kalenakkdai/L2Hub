import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Camera, LockKeyhole, MapPinned } from 'lucide-react'
import { Link } from 'react-router-dom'
import { fetchCurrentUser, hasPermission } from '../../../api/auth'
import { AppShell } from '../../../components/layout/AppShell'
import { FullPageMessage } from '../../../components/FullPageMessage'
import { ErrorState } from '../../../components/ui/ErrorState'
import { ApiError } from '../../../api/client'
import {
  beginPasskeyCheckIn,
  finishPasskeyCheckIn,
} from '../api'
import { AttendanceRoster } from '../components/AttendanceRoster'
import { BarcodeScanner } from '../components/BarcodeScanner'
import { IdentitySetup } from '../components/IdentitySetup'
import { StudentIdKeypad } from '../components/StudentIdKeypad'
import { WhereaboutsCheckout } from '../components/WhereaboutsCheckout'
import {
  useAttendanceCommands,
  useAttendanceDay,
  useAttendanceStudents,
  useWhereabouts,
} from '../hooks'
import { getPasskeyAssertion, passkeysSupported } from '../passkeys'

function errorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : 'The attendance request failed.'
}

export function AttendancePage() {
  const meQuery = useQuery({ queryKey: ['auth', 'me'], queryFn: fetchCurrentUser })
  const me = meQuery.data
  const canManage = Boolean(me && hasPermission(me, 'attendance.manage_all'))
  const commands = useAttendanceCommands()
  const students = useAttendanceStudents(canManage)
  const whereabouts = useWhereabouts(canManage)
  const [dayId, setDayId] = useState<string | null>(null)
  const day = useAttendanceDay(dayId)
  const startedRef = useRef(false)
  const [studentId, setStudentId] = useState('')
  const [cameraOn, setCameraOn] = useState(true)
  const [scanUse, setScanUse] = useState<'attendance' | 'bathroom'>(
    'attendance',
  )
  const [passkeyBusy, setPasskeyBusy] = useState(false)
  const [notice, setNotice] = useState<{
    tone: 'success' | 'error'
    text: string
  } | null>(null)

  // Opening the console creates (or returns) today's server-dated log. The
  // endpoint is idempotent, including under React StrictMode's double effect.
  useEffect(() => {
    if (!canManage || startedRef.current) return
    startedRef.current = true
    void commands.createDay
      .mutateAsync({})
      .then((created) => setDayId(created.id))
      .catch((error) =>
        setNotice({ tone: 'error', text: errorMessage(error) }),
      )
  }, [canManage, commands.createDay])

  if (meQuery.isPending) return <FullPageMessage>Loading…</FullPageMessage>
  if (meQuery.isError || !me) {
    return (
      <FullPageMessage>
        <ErrorState title="Could not load profile" description="Sign in again." />
      </FullPageMessage>
    )
  }
  if (!canManage) {
    return (
      <AppShell
        name={me.full_name ?? me.email}
        role={me.role}
        permissions={me.permissions}
      >
        <ErrorState
          variant="unauthorized"
          title="Attendance console restricted"
          description="Only ASBO and AC accounts can scan IDs or edit attendance."
        />
      </AppShell>
    )
  }

  const submitScan = (value: string, source: 'barcode' | 'keypad') => {
    if (!dayId || !value.trim() || day.data?.status !== 'open') return
    setNotice(null)
    void commands.scan
      .mutateAsync({ dayId, studentId: value, source })
      .then((record) => {
        setStudentId('')
        setNotice({
          tone: 'success',
          text: `${record.displayName} checked in${
            record.late ? ' late — attendance score 90%' : ''
          }.`,
        })
      })
      .catch((error) =>
        setNotice({ tone: 'error', text: errorMessage(error) }),
      )
  }

  const checkInWithPasskey = async () => {
    if (!dayId || day.data?.status !== 'open') return
    setPasskeyBusy(true)
    setNotice(null)
    try {
      const started = await beginPasskeyCheckIn(dayId)
      const credential = await getPasskeyAssertion(started.options)
      const record = await finishPasskeyCheckIn(dayId, {
        challengeId: started.challengeId,
        credential,
      })
      setNotice({
        tone: 'success',
        text: `${record.displayName} verified by passkey and checked in${
          record.late ? ' late — attendance score 90%' : ''
        }.`,
      })
      await day.refetch()
    } catch (error) {
      setNotice({ tone: 'error', text: errorMessage(error) })
    } finally {
      setPasskeyBusy(false)
    }
  }

  const handleBarcode = (value: string) => {
    if (scanUse === 'attendance') {
      submitScan(value, 'barcode')
      return
    }
    setNotice(null)
    void commands.checkout
      .mutateAsync({
        kind: 'bathroom',
        destinationKey: 'bathroom',
        studentId: value,
      })
      .then((entry) =>
        setNotice({
          tone: 'success',
          text: `${entry.displayName} checked out to the bathroom.`,
        }),
      )
      .catch((error) =>
        setNotice({ tone: 'error', text: errorMessage(error) }),
      )
  }

  return (
    <AppShell
      name={me.full_name ?? me.email}
      role={me.role}
      permissions={me.permissions}
    >
      <header className="mb-5 flex flex-wrap items-start justify-between gap-3 border-b border-border-subtle pb-4">
        <div>
          <h1 className="text-display font-semibold text-ink">Attendance</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Daily Leadership check-in, bathroom/errand whereabouts, and manual
            corrections.
          </p>
        </div>
        <Link
          to="/whereabouts"
          className="inline-flex items-center gap-2 rounded-control border border-border-strong px-3 py-2 text-sm font-semibold text-ink"
        >
          <MapPinned size={16} aria-hidden="true" />
          Campus map
        </Link>
      </header>

      <div className="mb-4 rounded-control border border-status-info/25 bg-status-info-bg px-3 py-2 text-xs text-status-info">
        Server timing: check-ins more than 60 seconds after class starts receive
        90%. When the day closes, students present for under 80% get a red halo
        and a parent-email alert enters the delivery outbox.
      </div>

      {notice ? (
        <p
          role="status"
          className={`mb-4 rounded-control px-3 py-2 text-sm ${
            notice.tone === 'success'
              ? 'bg-status-success-bg text-status-success'
              : 'bg-status-danger-bg text-status-danger'
          }`}
        >
          {notice.text}
        </p>
      ) : null}

      {day.isPending || commands.createDay.isPending ? (
        <p className="text-sm text-ink-muted">Opening today’s attendance log…</p>
      ) : null}
      {day.isError ? (
        <ErrorState
          title="Could not load today’s attendance"
          description={errorMessage(day.error)}
          onRetry={() => void day.refetch()}
        />
      ) : null}

      {day.data ? (
        <div className="space-y-4">
          <section className="rounded-card border border-border-subtle bg-surface p-4 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-ink">
                  {new Date(`${day.data.schoolDate}T12:00:00`).toLocaleDateString(
                    undefined,
                    { weekday: 'long', month: 'long', day: 'numeric' },
                  )}
                </h2>
                <p className="text-xs text-ink-muted">
                  {new Date(day.data.startsAt).toLocaleTimeString([], {
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                  {'–'}
                  {new Date(day.data.endsAt).toLocaleTimeString([], {
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                  {' · '}
                  {day.data.status}
                </p>
              </div>
              {day.data.status === 'open' ? (
                <button
                  type="button"
                  disabled={commands.closeDay.isPending}
                  onClick={() => {
                    if (
                      window.confirm(
                        'Close today’s attendance and calculate final presence percentages?',
                      )
                    ) {
                      void commands.closeDay.mutateAsync(day.data.id)
                    }
                  }}
                  className="rounded-control border border-status-danger px-3 py-2 text-xs font-semibold text-status-danger"
                >
                  Close day & calculate
                </button>
              ) : null}
            </div>
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-card border border-border-subtle bg-surface p-4 shadow-xs">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold text-ink">
                    Scan student ID
                  </h2>
                  <p className="text-xs text-ink-muted">
                    Camera processing stays on this iPad or MacBook.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setCameraOn((value) => !value)}
                  className="inline-flex items-center gap-1.5 rounded-control border border-border-strong px-2.5 py-1.5 text-xs font-semibold"
                >
                  <Camera size={14} aria-hidden="true" />
                  {cameraOn ? 'Turn off' : 'Turn on'}
                </button>
              </div>
              <div className="mb-3 grid grid-cols-2 rounded-control bg-surface-sunken p-1">
                {(
                  [
                    ['attendance', 'Class check-in'],
                    ['bathroom', 'Bathroom checkout'],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={scanUse === value}
                    onClick={() => setScanUse(value)}
                    className={`rounded-control px-2 py-1.5 text-xs font-semibold ${
                      scanUse === value
                        ? 'bg-surface text-ink shadow-xs'
                        : 'text-ink-muted'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <BarcodeScanner
                active={cameraOn}
                disabled={
                  commands.scan.isPending ||
                  commands.checkout.isPending ||
                  day.data.status !== 'open'
                }
                onScan={handleBarcode}
              />
            </section>

            <section className="rounded-card border border-border-subtle bg-surface p-4 shadow-xs">
              <h2 className="text-sm font-semibold text-ink">Type student ID</h2>
              <p className="mt-1 text-xs text-ink-muted">
                The large keypad appears on iPhone and other narrow screens.
              </p>
              <div className="mt-3">
                <StudentIdKeypad
                  value={studentId}
                  disabled={commands.scan.isPending || day.data.status !== 'open'}
                  onChange={setStudentId}
                  onSubmit={() => submitScan(studentId, 'keypad')}
                />
              </div>
              <div className="mt-4 flex items-start gap-2 rounded-control bg-surface-sunken p-3 text-xs text-ink-muted">
                <LockKeyhole size={16} className="shrink-0" aria-hidden="true" />
                Touch ID/Face ID can only be offered as a WebAuthn passkey on a
                student’s own device. The browser never exposes or stores a
                fingerprint, and a shared kiosk cannot safely identify 50
                students by fingerprint.
              </div>
              <button
                type="button"
                disabled={
                  !passkeysSupported() ||
                  passkeyBusy ||
                  day.data.status !== 'open'
                }
                onClick={() => void checkInWithPasskey()}
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-control border border-accent-600 px-4 py-3 text-sm font-semibold text-accent-700 disabled:opacity-50"
              >
                <LockKeyhole size={16} aria-hidden="true" />
                {passkeyBusy
                  ? 'Waiting for Touch ID / Face ID…'
                  : 'Check in with personal-device passkey'}
              </button>
            </section>
          </div>

          <AttendanceRoster
            records={day.data.records}
            saving={commands.editRecord.isPending}
            onSave={(recordId, input) =>
              commands.editRecord.mutate({ recordId, ...input })
            }
          />

          <div className="grid gap-4 lg:grid-cols-2">
            <WhereaboutsCheckout
              entries={whereabouts.data ?? []}
              busy={
                commands.checkout.isPending || commands.returnEntry.isPending
              }
              onCheckout={(input) => commands.checkout.mutate(input)}
              onReturn={(entryId) => commands.returnEntry.mutate(entryId)}
            />
            <IdentitySetup
              students={students.data ?? []}
              saving={commands.saveIdentity.isPending}
              onSave={(profileId, input) =>
                commands.saveIdentity.mutate({ profileId, ...input })
              }
            />
          </div>
        </div>
      ) : null}
    </AppShell>
  )
}
