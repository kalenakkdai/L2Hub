import { useEffect, useState } from 'react'
import { Button } from '../ui/Button'
import { FIELD_CLASS, SettingsCard, VerificationChip } from './primitives'
import { VerifyCodeModal } from './VerifyCodeModal'
import {
  sendEmailCode,
  sendPhoneCode,
  smsConfigured,
  verifyEmailCode,
  verifyPhoneCode,
  type VerificationChannel,
} from '../../lib/verification'
import type { ProfilePatch, SaveStatus, SettingsProfile } from '../../hooks/useProfile'

type ContactSectionProps = {
  profile: SettingsProfile
  status: SaveStatus
  save: (patch: ProfilePatch) => void
  saveNow: () => void
  onVerified: () => void
}

/**
 * Email and phone, each with a verification chip.
 *
 * Changing a verified value clears its verified flag — enforced by a database
 * trigger, mirrored here so the chip updates without waiting for a refetch.
 */
export function ContactSection({
  profile,
  status,
  save,
  saveNow,
  onVerified,
}: ContactSectionProps) {
  const [email, setEmail] = useState(profile.email)
  const [phone, setPhone] = useState(profile.phone ?? '')
  const [verifying, setVerifying] = useState<VerificationChannel | null>(null)

  useEffect(() => {
    setEmail(profile.email)
    setPhone(profile.phone ?? '')
  }, [profile.email, profile.phone])

  const emailChanged = email.trim() !== profile.email
  const phoneChanged = phone.trim() !== (profile.phone ?? '')

  return (
    <SettingsCard
      id="contact"
      title="Contact"
      description="Where the Campsite can reach you."
      status={status}
    >
      <div className="flex flex-col gap-5">
        <div>
          <div className="mb-1.5 flex items-center gap-2.5">
            <label htmlFor="contact-email" className="text-[13px] font-medium text-ink">
              Email
            </label>
            <VerificationChip verified={profile.email_verified} />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              id="contact-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={`${FIELD_CLASS} sm:max-w-xs`}
            />
            <Button
              variant="secondary"
              size="sm"
              disabled={!email.trim() || (profile.email_verified && !emailChanged)}
              onClick={() => setVerifying('email')}
            >
              {emailChanged ? 'Verify new address' : 'Verify'}
            </Button>
          </div>

          {/* Say why the button is off. A disabled control with no reason
              reads as broken, and this one is disabled precisely because
              everything is fine. The reason cannot go in a `title`: Button
              sets `disabled:pointer-events-none`, so a disabled button never
              receives the hover that would show it. */}
          <p className="mt-1.5 text-[12.5px] text-ink-subtle">
            {profile.email_verified && !emailChanged
              ? 'This address is already verified. To verify a different one, type it above.'
              : 'We send a six-digit code to this address. It stays unverified until you enter the code.'}
          </p>
        </div>

        <div>
          <div className="mb-1.5 flex items-center gap-2.5">
            <label htmlFor="contact-phone" className="text-[13px] font-medium text-ink">
              Phone
            </label>
            {phone.trim() ? (
              <VerificationChip verified={profile.phone_verified} />
            ) : (
              <span className="text-[12.5px] text-ink-subtle">Optional</span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              id="contact-phone"
              type="tel"
              inputMode="tel"
              placeholder="+1 555 123 4567"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              onBlur={() => {
                if (!phoneChanged) return
                save({ phone: phone.trim() || null })
                saveNow()
              }}
              className={`${FIELD_CLASS} sm:max-w-xs`}
            />
            <Button
              variant="secondary"
              size="sm"
              disabled={
                !phone.trim() ||
                !smsConfigured() ||
                (profile.phone_verified && !phoneChanged)
              }
              onClick={() => setVerifying('phone')}
            >
              Verify
            </Button>
          </div>

          {/* Whatever switched the button off has to be legible here. The
              `title` this used to carry was never readable: Button sets
              `disabled:pointer-events-none`, so the one state that needed
              explaining was the one state that could not be hovered. */}
          <p className="mt-1.5 text-[12.5px] text-ink-subtle">
            {!smsConfigured()
              ? 'Text messaging is not set up for this Campsite yet, so phone verification is unavailable.'
              : !phone.trim()
                ? 'Enter a number above to verify it.'
                : profile.phone_verified && !phoneChanged
                  ? 'This number is already verified. To verify a different one, type it above.'
                  : 'A verified phone is required before SMS notifications can be switched on.'}
          </p>
        </div>
      </div>

      <VerifyCodeModal
        open={verifying !== null}
        channel={verifying ?? 'email'}
        destination={verifying === 'phone' ? phone.trim() : email.trim()}
        onClose={() => setVerifying(null)}
        onVerified={() => {
          setVerifying(null)
          onVerified()
        }}
        send={verifying === 'phone' ? sendPhoneCode : sendEmailCode}
        verify={verifying === 'phone' ? verifyPhoneCode : verifyEmailCode}
      />
    </SettingsCard>
  )
}
