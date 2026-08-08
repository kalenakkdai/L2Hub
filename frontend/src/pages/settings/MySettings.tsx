import { useEffect } from 'react'
import { AppShell } from '../../components/layout/AppShell'
import { ErrorState } from '../../components/ui/ErrorState'
import { Skeleton } from '../../components/ui/Skeleton'
import { SettingsLayout, type SettingsSection } from '../../components/settings/SettingsLayout'
import { AccountSection } from '../../components/settings/AccountSection'
import { AppearanceSection } from '../../components/settings/AppearanceSection'
import { ContactSection } from '../../components/settings/ContactSection'
import { DangerZone } from '../../components/settings/DangerZone'
import { NotificationsGrid } from '../../components/settings/NotificationsGrid'
import { ProfileSection } from '../../components/settings/ProfileSection'
import { useCurrentUser } from '../../auth/useCurrentUser'
import { useProfile } from '../../hooks/useProfile'
import { applyAppearance } from '../../lib/appearance'

const SECTIONS: SettingsSection[] = [
  { id: 'profile', label: 'Profile' },
  { id: 'contact', label: 'Contact' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'account', label: 'Account' },
  { id: 'danger', label: 'Danger zone' },
]

export function MySettings() {
  const me = useCurrentUser()
  const { profile, isPending, isError, refetch, save, saveNow, status } = useProfile()

  // Appearance is applied from the saved profile rather than from local state,
  // so an optimistic toggle takes effect immediately and a rollback undoes it.
  useEffect(() => {
    if (!profile) return
    applyAppearance(
      {
        theme: profile.theme,
        reduceMotion: profile.reduce_motion,
        compactDensity: profile.compact_density,
      },
      document.documentElement,
    )
  }, [profile])

  if (me.shell) return me.shell
  const { profile: account, name, committee } = me

  const shellProps = {
    name,
    role: account.role,
    committee,
    permissions: account.permissions,
  }

  return (
    <AppShell {...shellProps}>
      <SettingsLayout
        title="My settings"
        description="Changes save as you make them."
        sections={SECTIONS}
        footerLinks={
          account.permissions?.includes('settings.view')
            ? [{ to: '/settings/campsite', label: 'Campsite settings' }]
            : undefined
        }
      >
        {isPending && (
          <div role="status" aria-busy="true" className="flex flex-col gap-4">
            <span className="sr-only">Loading your settings…</span>
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} className="h-44 w-full rounded-card" />
            ))}
          </div>
        )}

        {isError && (
          <ErrorState
            title="Could not load your settings"
            description="Your account loaded, but your preferences did not."
            onRetry={() => void refetch()}
          />
        )}

        {profile && (
          <>
            <ProfileSection
              profile={profile}
              account={account}
              status={status}
              save={save}
              saveNow={saveNow}
            />

            <ContactSection
              profile={profile}
              status={status}
              save={save}
              saveNow={saveNow}
              onVerified={() => void refetch()}
            />

            <NotificationsGrid
              profile={profile}
              status={status}
              save={save}
              saveNow={saveNow}
            />

            <AppearanceSection
              profile={profile}
              status={status}
              save={save}
              saveNow={saveNow}
            />

            <AccountSection profile={profile} />

            <DangerZone
              actions={[
                {
                  id: 'leave-campsite',
                  label: 'Leave this Campsite',
                  description:
                    'Removes you from every committee and revokes your roles. An officer has to add you back.',
                  buttonLabel: 'Leave Campsite',
                  confirmTitle: 'Leave the L2 Campsite?',
                  confirmDescription:
                    'You will lose access to grades, debriefs, and committee work. This is not wired up yet — it needs an endpoint that can revoke roles safely.',
                  disabled: true,
                  disabledReason:
                    'Leaving needs a server endpoint that revokes roles; it is not built yet.',
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
