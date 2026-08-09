import { useState } from 'react'
import { Fingerprint } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import { SettingsCard } from '../../../components/settings/primitives'
import {
  beginPasskeyRegistration,
  finishPasskeyRegistration,
} from '../api'
import { createPasskey, passkeysSupported } from '../passkeys'

export function AttendancePasskeySettings() {
  const [state, setState] = useState<
    | { kind: 'idle' }
    | { kind: 'saving' }
    | { kind: 'done'; device: string }
    | { kind: 'error'; message: string }
  >({ kind: 'idle' })

  const enroll = async () => {
    setState({ kind: 'saving' })
    try {
      const started = await beginPasskeyRegistration()
      const credential = await createPasskey(started.options)
      const deviceName = /iPhone|iPad/i.test(navigator.userAgent)
        ? 'iPhone or iPad'
        : 'Touch ID device'
      const saved = await finishPasskeyRegistration({
        challengeId: started.challengeId,
        credential,
        deviceName,
      })
      setState({ kind: 'done', device: saved.deviceName })
    } catch (error) {
      setState({
        kind: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Could not enroll this passkey.',
      })
    }
  }

  return (
    <SettingsCard
      id="attendance-passkey"
      title="Attendance passkey"
      description="Optional Touch ID / Face ID check-in without carrying your student ID."
    >
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-50 text-accent-700">
          <Fingerprint size={20} aria-hidden="true" />
        </span>
        <div>
          <p className="text-[13px] text-ink">
            Your device verifies you and sends L2 Hub a signed public-key
            response. Your fingerprint or face never leaves the device and is
            never stored by L2 Hub.
          </p>
          <p className="mt-1 text-[12.5px] text-ink-subtle">
            Jan or ASBO must enroll your student ID first. At the kiosk, choose
            passkey and follow the browser prompt; it may offer a QR code to use
            this phone.
          </p>
          <Button
            variant="secondary"
            size="sm"
            className="mt-3"
            disabled={!passkeysSupported() || state.kind === 'saving'}
            onClick={() => void enroll()}
          >
            <Fingerprint aria-hidden="true" className="h-3.5 w-3.5" />
            {state.kind === 'saving' ? 'Waiting for device…' : 'Add this device'}
          </Button>
          {!passkeysSupported() ? (
            <p className="mt-2 text-[12.5px] text-status-warning">
              Passkeys require a secure browser context and a compatible device.
            </p>
          ) : null}
          {state.kind === 'done' ? (
            <p role="status" className="mt-2 text-[12.5px] text-accent-ink">
              {state.device} added for attendance.
            </p>
          ) : null}
          {state.kind === 'error' ? (
            <p role="alert" className="mt-2 text-[12.5px] text-status-danger">
              {state.message}
            </p>
          ) : null}
        </div>
      </div>
    </SettingsCard>
  )
}
