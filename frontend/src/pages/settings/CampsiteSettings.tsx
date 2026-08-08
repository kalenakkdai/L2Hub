import { Link } from 'react-router-dom'
import { AppShell } from '../../components/layout/AppShell'
import { ErrorState } from '../../components/ui/ErrorState'
import { Skeleton } from '../../components/ui/Skeleton'
import { SettingsLayout, type SettingsSection } from '../../components/settings/SettingsLayout'
import { DangerZone } from '../../components/settings/DangerZone'
import {
  Field,
  FIELD_CLASS,
  SettingsCard,
  Toggle,
} from '../../components/settings/primitives'
import { useCurrentUser } from '../../auth/useCurrentUser'
import { useCampsiteSettings, type PointsConfig } from '../../hooks/useCampsiteSettings'

const SECTIONS: SettingsSection[] = [
  { id: 'identity', label: 'Identity' },
  { id: 'modules', label: 'Modules' },
  { id: 'joining', label: 'Joining' },
  { id: 'points', label: 'Points' },
  { id: 'danger', label: 'Danger zone' },
]

const MODULE_LABELS: Record<string, string> = {
  grades: 'Grades',
  events: 'Events',
  debriefs: 'Debriefs',
  committees: 'Committees',
  wrapped: 'Wrapped',
}

const POINTS_LABELS: Record<keyof PointsConfig, string> = {
  debrief_submitted: 'Debrief submitted',
  event_attended: 'Event attended',
  task_completed: 'Task completed',
  points_per_level: 'Points per level',
}

export function CampsiteSettings() {
  const me = useCurrentUser()
  const permissions = me.profile?.permissions ?? []
  const canEdit = permissions.includes('settings.edit')
  const canView = canEdit || permissions.includes('settings.view')

  const { settings, isPending, isError, refetch, save, saveNow, status } =
    useCampsiteSettings(canEdit)

  if (me.shell) return me.shell
  const { profile: account, name, committee } = me

  const shellProps = {
    name,
    role: account.role,
    committee,
    permissions: account.permissions,
  }

  // The route is reachable by URL, so permission is checked here rather than
  // relying on the sidebar hiding the link. RLS is the real boundary.
  if (!canView) {
    return (
      <AppShell {...shellProps}>
        <ErrorState
          variant="unauthorized"
          title="You do not have access"
          description="Campsite settings are limited to officers and advisers."
        />
      </AppShell>
    )
  }

  return (
    <AppShell {...shellProps}>
      <SettingsLayout
        title="Campsite settings"
        description={
          canEdit ? 'Changes save as you make them.' : 'You can view these but not change them.'
        }
        sections={SECTIONS}
        footerLinks={[{ to: '/settings', label: 'My settings' }]}
      >
        {!canEdit && (
          <p
            role="status"
            className="rounded-control border border-status-info-border bg-status-info-bg px-4 py-3 text-[13px] text-status-info"
          >
            Read-only. Advisers can review the configuration; only an AC or President can
            change it.
          </p>
        )}

        {isPending && (
          <div role="status" aria-busy="true" className="flex flex-col gap-4">
            <span className="sr-only">Loading Campsite settings…</span>
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} className="h-40 w-full rounded-card" />
            ))}
          </div>
        )}

        {isError && (
          <ErrorState
            title="Could not load Campsite settings"
            description="The configuration did not come back. Try again in a moment."
            onRetry={() => void refetch()}
          />
        )}

        {settings && (
          <>
            <SettingsCard
              id="identity"
              title="Identity"
              description="What this Campsite is called and how it is presented."
              status={status}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Name" htmlFor="campsite-name">
                  <input
                    id="campsite-name"
                    defaultValue={settings.name}
                    disabled={!canEdit}
                    onBlur={(event) => {
                      const value = event.target.value.trim()
                      if (value && value !== settings.name) {
                        save({ name: value })
                        saveNow()
                      }
                    }}
                    className={FIELD_CLASS}
                  />
                </Field>

                <Field label="Category" htmlFor="campsite-category">
                  <input
                    id="campsite-category"
                    defaultValue={settings.category ?? ''}
                    disabled={!canEdit}
                    onBlur={(event) => {
                      save({ category: event.target.value.trim() || null })
                      saveNow()
                    }}
                    className={FIELD_CLASS}
                  />
                </Field>

                <Field label="Tagline" htmlFor="campsite-tagline" className="sm:col-span-2">
                  <input
                    id="campsite-tagline"
                    defaultValue={settings.tagline ?? ''}
                    disabled={!canEdit}
                    onBlur={(event) => {
                      save({ tagline: event.target.value.trim() || null })
                      saveNow()
                    }}
                    className={FIELD_CLASS}
                  />
                </Field>

                <Field
                  label="Accent colour"
                  htmlFor="campsite-accent"
                  hint="Applied across the Campsite."
                >
                  <input
                    id="campsite-accent"
                    type="color"
                    value={settings.accent_color}
                    disabled={!canEdit}
                    onChange={(event) => {
                      save({ accent_color: event.target.value })
                      saveNow()
                    }}
                    className="h-10 w-20 cursor-pointer rounded-control border border-border-subtle bg-surface p-1 disabled:cursor-not-allowed"
                  />
                </Field>
              </div>
            </SettingsCard>

            <SettingsCard
              id="modules"
              title="Modules"
              description="Switch parts of the Campsite on and off."
              status={status}
            >
              <ul className="flex flex-col gap-3">
                {Object.entries(settings.modules_enabled).map(([module, enabled]) => (
                  <li key={module} className="flex items-center justify-between gap-4">
                    <span className="text-sm text-ink">{MODULE_LABELS[module] ?? module}</span>
                    <Toggle
                      checked={enabled}
                      disabled={!canEdit}
                      label={`${MODULE_LABELS[module] ?? module} module`}
                      onChange={(next) => {
                        save({
                          modules_enabled: { ...settings.modules_enabled, [module]: next },
                        })
                        saveNow()
                      }}
                    />
                  </li>
                ))}
              </ul>

              <p className="mt-4 border-t border-border-divider pt-4 text-[12.5px] text-ink-subtle">
                Committee management and role assignment live on the{' '}
                <Link to="/committees" className="text-accent-600 underline-offset-2 hover:underline">
                  Committees
                </Link>{' '}
                page, where the roster and its permissions are already handled.
              </p>
            </SettingsCard>

            <SettingsCard
              id="joining"
              title="Joining"
              description="How new campers get in."
              status={status}
            >
              <div className="flex flex-col gap-4">
                <Field
                  label="Join code"
                  htmlFor="join-code"
                  hint="Campers enter this to request access. Leave blank to disable code joining."
                  className="max-w-xs"
                >
                  <input
                    id="join-code"
                    defaultValue={settings.join_code ?? ''}
                    disabled={!canEdit}
                    onBlur={(event) => {
                      save({ join_code: event.target.value.trim() || null })
                      saveNow()
                    }}
                    className={`${FIELD_CLASS} font-mono`}
                  />
                </Field>

                <div className="flex items-center justify-between gap-4 border-t border-border-divider pt-4">
                  <div>
                    <p className="text-[13px] font-medium text-ink">Require approval</p>
                    <p className="mt-1 text-[12.5px] text-ink-subtle">
                      An officer approves each request before access is granted.
                    </p>
                  </div>
                  <Toggle
                    checked={settings.requires_approval}
                    disabled={!canEdit}
                    label="Require approval to join"
                    onChange={(next) => {
                      save({ requires_approval: next })
                      saveNow()
                    }}
                  />
                </div>

                <div className="flex items-center justify-between gap-4 border-t border-border-divider pt-4">
                  <div>
                    <p className="text-[13px] font-medium text-ink">Listed publicly</p>
                    <p className="mt-1 text-[12.5px] text-ink-subtle">
                      Shown on the Quad to people outside this Campsite.
                    </p>
                  </div>
                  <Toggle
                    checked={settings.is_public}
                    disabled={!canEdit}
                    label="Listed publicly on the Quad"
                    onChange={(next) => {
                      save({ is_public: next })
                      saveNow()
                    }}
                  />
                </div>
              </div>
            </SettingsCard>

            <SettingsCard
              id="points"
              title="Points"
              description="What each action is worth."
              status={status}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                {(Object.keys(POINTS_LABELS) as (keyof PointsConfig)[]).map((key) => (
                  <Field key={key} label={POINTS_LABELS[key]} htmlFor={`points-${key}`}>
                    <input
                      id={`points-${key}`}
                      type="number"
                      min={0}
                      defaultValue={settings.points_config[key]}
                      disabled={!canEdit}
                      onBlur={(event) => {
                        const value = Number(event.target.value)
                        if (!Number.isFinite(value) || value < 0) return
                        save({
                          points_config: { ...settings.points_config, [key]: value },
                        })
                        saveNow()
                      }}
                      className={FIELD_CLASS}
                    />
                  </Field>
                ))}
              </div>
            </SettingsCard>

            <DangerZone
              actions={[
                {
                  id: 'transfer-admin',
                  label: 'Transfer administration',
                  description:
                    'Hand the AC role to another camper. You keep your other roles.',
                  buttonLabel: 'Transfer',
                  confirmTitle: 'Transfer administration?',
                  confirmDescription:
                    'Not wired up yet — it needs an endpoint that assigns the new administrator before removing you, so the Campsite is never left without one.',
                  disabled: true,
                  disabledReason: 'Needs a server endpoint that reassigns roles atomically.',
                  onConfirm: () => {},
                },
                {
                  id: 'break-camp',
                  label: 'Break Camp',
                  description:
                    'Archives the Campsite. Nobody can sign in and all work becomes read-only.',
                  buttonLabel: 'Break Camp',
                  confirmText: settings.name,
                  confirmTitle: `Break Camp for ${settings.name}?`,
                  confirmDescription:
                    'Every camper loses access immediately. Not wired up yet — archiving needs a server endpoint so it can be audited and reversed.',
                  disabled: !canEdit,
                  disabledReason: 'Only an AC or President can break camp.',
                  onConfirm: () => {},
                },
              ]}
            />
          </>
        )}
      </SettingsLayout>
    </AppShell>
  )
}
