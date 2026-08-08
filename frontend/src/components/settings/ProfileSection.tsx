import { useEffect, useState } from 'react'
import { Upload } from 'lucide-react'
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
 * Name, pronouns, grade, avatar. Roles and committees are shown but not
 * editable — changing them is an officer action, and saying so here saves
 * someone hunting for a control that was never going to be there.
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
  const [pronouns, setPronouns] = useState(profile.pronouns ?? '')

  useEffect(() => {
    setDisplayName(profile.display_name ?? '')
    setPronouns(profile.pronouns ?? '')
  }, [profile.display_name, profile.pronouns])

  const committees = (account.roles ?? [])
    .map((role) => role.committee_name)
    .filter((name): name is string => Boolean(name))

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
          <input
            id="pronouns"
            value={pronouns}
            onChange={(event) => setPronouns(event.target.value)}
            onBlur={() => {
              save({ pronouns: pronouns.trim() || null })
              saveNow()
            }}
            className={FIELD_CLASS}
          />
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

        <Field label="Avatar" htmlFor="avatar" hint="Image uploads are not wired up yet.">
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent-100 text-[13px] font-semibold text-accent-600"
            >
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
              ) : (
                (profile.full_name ?? profile.email).slice(0, 1).toUpperCase()
              )}
            </span>
            <button
              id="avatar"
              type="button"
              disabled
              title="Avatar upload needs a storage bucket, which is not set up yet."
              className="inline-flex h-10 cursor-not-allowed items-center gap-2 rounded-control border border-border-subtle px-3 text-sm text-ink-subtle opacity-60"
            >
              <Upload aria-hidden="true" className="h-3.5 w-3.5" />
              Upload
            </button>
          </div>
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
