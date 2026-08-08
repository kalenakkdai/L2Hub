import { useState } from 'react'
import { Download, KeyRound, LogOut } from 'lucide-react'
import { Button } from '../ui/Button'
import { Field, FIELD_CLASS, SettingsCard } from './primitives'
import { supabase } from '../../lib/supabase'
import type { SettingsProfile } from '../../hooks/useProfile'

type AccountSectionProps = {
  profile: SettingsProfile
}

const MIN_PASSWORD_LENGTH = 8

/**
 * Password, sessions, and a data export.
 *
 * Note there is no list of active sessions: supabase-js exposes no API to
 * enumerate them. Signing out everywhere is offered instead, which is the
 * part that actually protects someone who has lost a device.
 */
export function AccountSection({ profile }: AccountSectionProps) {
  const [password, setPassword] = useState('')
  const [passwordState, setPasswordState] = useState<
    { kind: 'idle' } | { kind: 'saving' } | { kind: 'done' } | { kind: 'error'; message: string }
  >({ kind: 'idle' })
  const [signingOut, setSigningOut] = useState(false)

  const changePassword = async () => {
    if (password.length < MIN_PASSWORD_LENGTH) {
      setPasswordState({
        kind: 'error',
        message: `Use at least ${MIN_PASSWORD_LENGTH} characters.`,
      })
      return
    }

    setPasswordState({ kind: 'saving' })
    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setPasswordState({ kind: 'error', message: error.message })
      return
    }

    setPassword('')
    setPasswordState({ kind: 'done' })
  }

  const signOutEverywhere = async () => {
    setSigningOut(true)
    // Global scope revokes every refresh token, this device included.
    await supabase.auth.signOut({ scope: 'global' })
    setSigningOut(false)
  }

  const downloadData = () => {
    const payload = {
      exported_at: new Date().toISOString(),
      profile,
      note: 'Profile and preferences only. Submissions, grades, and debriefs are not included in this export yet.',
    }

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'l2-campsite-data.json'
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <SettingsCard id="account" title="Account" description="Password, sessions, and your data.">
      <div className="flex flex-col gap-5">
        <div>
          <Field
            label="New password"
            htmlFor="new-password"
            hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
            className="max-w-xs"
          >
            <input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value)
                setPasswordState({ kind: 'idle' })
              }}
              className={FIELD_CLASS}
            />
          </Field>

          <div className="mt-2 flex items-center gap-3">
            <Button
              variant="secondary"
              size="sm"
              disabled={!password || passwordState.kind === 'saving'}
              onClick={() => void changePassword()}
            >
              <KeyRound aria-hidden="true" className="h-3.5 w-3.5" />
              {passwordState.kind === 'saving' ? 'Changing…' : 'Change password'}
            </Button>

            {passwordState.kind === 'done' && (
              <span role="status" className="text-[12.5px] text-accent-ink">
                Password changed
              </span>
            )}
            {passwordState.kind === 'error' && (
              <span role="alert" className="text-[12.5px] text-status-danger">
                {passwordState.message}
              </span>
            )}
          </div>
        </div>

        <div className="border-t border-border-divider pt-5">
          <p className="text-[13px] font-medium text-ink">Active sessions</p>
          <p className="mt-1 text-[12.5px] text-ink-subtle">
            Supabase does not expose a list of signed-in devices, so there is nothing to
            show here. Signing out everywhere ends every session, including this one.
          </p>
          <Button
            variant="secondary"
            size="sm"
            className="mt-3"
            disabled={signingOut}
            onClick={() => void signOutEverywhere()}
          >
            <LogOut aria-hidden="true" className="h-3.5 w-3.5" />
            {signingOut ? 'Signing out…' : 'Sign out everywhere'}
          </Button>
        </div>

        <div className="border-t border-border-divider pt-5">
          <p className="text-[13px] font-medium text-ink">Download my data</p>
          <p className="mt-1 text-[12.5px] text-ink-subtle">
            Your profile and preferences as JSON. Submissions, grades, and debriefs are not
            included yet.
          </p>
          <Button variant="secondary" size="sm" className="mt-3" onClick={downloadData}>
            <Download aria-hidden="true" className="h-3.5 w-3.5" />
            Download JSON
          </Button>
        </div>
      </div>
    </SettingsCard>
  )
}
