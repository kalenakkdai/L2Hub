import { useEffect, useState } from 'react'
import { Field, FIELD_CLASS, SettingsCard } from './primitives'
import { roleLabel } from '../../api/auth'
import type { CurrentUser } from '../../api/auth'
import type { SaveStatus } from '../../hooks/useProfile'
import type { ProfilePatch, SettingsProfile } from '../../hooks/useProfile'

type ProfileSectionProps = {
  profile: SettingsProfile
  account: CurrentUser
  status: SaveStatus
  save: (patch: ProfilePatch) => void
  saveNow: () => void
}

const GRADE_YEARS = [9, 10, 11, 12]

/**
 * Offered pronouns.
 *
 * A closed list keeps the roster tidy and spares people typing this out, but
 * a fixed list that omits someone is worse than no list, so "Prefer not to
 * say" and a free-text "Other" are both here. A stored value that is not in
 * the list still shows, rather than silently resetting to blank.
 */
const PRONOUN_OPTIONS = [
  'she/her',
  'he/him',
  'they/them',
  'she/they',
  'he/they',
  'any pronouns',
  'Prefer not to say',
] as const

const OTHER = '__other__'

/**
 * Name, pronouns, grade. The avatar lives in the settings sidebar, where it
 * can be shown at a size worth looking at.
 *
 * Roles and committees are shown but not editable — changing them is an
 * officer action, and saying so here saves someone hunting for a control that
 * was never going to be there.
 */
export function ProfileSection({
  profile,
  account,
  status,
  save,
  saveNow,
}: ProfileSectionProps) {
  // Text inputs stay local while typing and commit on blur; the debounce in
  // useProfile handles the write. Everything else commits immediately.
  const [displayName, setDisplayName] = useState(profile.display_name ?? '')

  // A value already stored that is not one of the offered options keeps the
  // free-text field open rather than being dropped on the floor.
  const stored = profile.pronouns ?? ''
  const isPreset = stored === '' || PRONOUN_OPTIONS.includes(stored as never)
  const [customOpen, setCustomOpen] = useState(!isPreset)
  const [customPronouns, setCustomPronouns] = useState(isPreset ? '' : stored)

  useEffect(() => {
    setDisplayName(profile.display_name ?? '')
  }, [profile.display_name])

  // Membership, not committee-scoped roles: a camper can sit on a committee
  // without holding a role there, and both belong in this list.
  const committees = (account.committees ?? []).map((membership) =>
    membership.is_head ? `${membership.name} (head)` : membership.name,
  )

  return (
    <SettingsCard
      id="profile"
      title="Profile"
      description="How you appear to the rest of the Campsite."
      status={status}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Display name"
          htmlFor="display-name"
          hint={`Leave blank to use ${profile.full_name ?? profile.email}.`}
        >
          <input
            id="display-name"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            onBlur={() => {
              save({ display_name: displayName.trim() || null })
              saveNow()
            }}
            className={FIELD_CLASS}
          />
        </Field>

        <Field label="Pronouns" htmlFor="pronouns" hint="Optional. Shown next to your name.">
          <select
            id="pronouns"
            value={customOpen ? OTHER : stored}
            onChange={(event) => {
              const value = event.target.value
              if (value === OTHER) {
                setCustomOpen(true)
                return
              }
              setCustomOpen(false)
              setCustomPronouns('')
              save({ pronouns: value || null })
              saveNow()
            }}
            className={FIELD_CLASS}
          >
            <option value="">Not set</option>
            {PRONOUN_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
            <option value={OTHER}>Something else…</option>
          </select>

          {customOpen && (
            <input
              aria-label="Your pronouns"
              placeholder="Type your pronouns"
              value={customPronouns}
              onChange={(event) => setCustomPronouns(event.target.value)}
              onBlur={() => {
                save({ pronouns: customPronouns.trim() || null })
                saveNow()
              }}
              className={`${FIELD_CLASS} mt-2`}
            />
          )}
        </Field>

        <Field label="Grade" htmlFor="grade-year">
          <select
            id="grade-year"
            value={profile.grade_year ?? ''}
            onChange={(event) => {
              const value = event.target.value
              save({ grade_year: value ? Number(value) : null })
              saveNow()
            }}
            className={FIELD_CLASS}
          >
            <option value="">Not set</option>
            {GRADE_YEARS.map((year) => (
              <option key={year} value={year}>
                Grade {year}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="mt-5 border-t border-border-divider pt-4">
        <p className="text-[13px] font-medium text-ink">Roles and committees</p>
        <p className="mt-1 text-[12.5px] text-ink-subtle">
          Only officers can change these. Ask an ASBO officer or your adviser if something
          is wrong.
        </p>

        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-[12.5px] text-ink-subtle">Role</dt>
            <dd className="mt-0.5 text-sm text-ink">{roleLabel(account.role)}</dd>
          </div>
          <div>
            <dt className="text-[12.5px] text-ink-subtle">Committees</dt>
            <dd className="mt-0.5 text-sm text-ink">
              {committees.length > 0 ? committees.join(', ') : 'None yet'}
            </dd>
          </div>
        </dl>
      </div>
    </SettingsCard>
  )
}
