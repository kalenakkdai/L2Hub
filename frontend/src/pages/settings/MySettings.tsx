import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppShell } from '../../components/layout/AppShell'
import { ErrorState } from '../../components/ui/ErrorState'
import { Skeleton } from '../../components/ui/Skeleton'
import { SettingsLayout, type SettingsSection } from '../../components/settings/SettingsLayout'
import { AccountSection } from '../../components/settings/AccountSection'
import { AppearanceSection } from '../../components/settings/AppearanceSection'
import { AvatarField } from '../../components/settings/AvatarField'
import { ContactSection } from '../../components/settings/ContactSection'
import { DangerZone } from '../../components/settings/DangerZone'
import { NotificationsGrid } from '../../components/settings/NotificationsGrid'
import { ProfileSection } from '../../components/settings/ProfileSection'
import { useCurrentUser } from '../../auth/useCurrentUser'
import { useProfile } from '../../hooks/useProfile'
import { leaveCampsite } from '../../api/campsite'
import { useAuth } from '../../auth/useAuth'

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
  const navigate = useNavigate()
  const { signOut } = useAuth()
  const [leaveError, setLeaveError] = useState<string | null>(null)
  const { profile, isPending, isError, refetch, save, saveNow, status } = useProfile()

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
        aside={
          profile && (
            <AvatarField
              avatarUrl={profile.avatar_url}
              fallback={profile.full_name ?? profile.email}
              onChange={(url) => {
                save({ avatar_url: url })
                saveNow()
              }}
            />
          )
        }
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
                    'Removes you from every crew and revokes your roles. An officer has to add you back.',
                  buttonLabel: 'Leave Campsite',
                  confirmTitle: 'Leave the L2 Campsite?',
                  confirmDescription:
                    'You will lose access to grades, debriefs, and crew work. Your submissions and grades stay on record.',
                  onConfirm: async () => {
                    setLeaveError(null)
                    try {
                      await leaveCampsite()
                      // Nothing is left to authorise, so end the session.
                      await signOut('manual')
                      navigate('/login', { replace: true })
                    } catch (error) {
                      setLeaveError(
                        error instanceof Error
                          ? error.message
                          : 'Could not leave the Campsite.',
                      )
                    }
                  },
                },
              ]}
            >
              {leaveError && (
                <p role="alert" className="mt-3 text-sm text-status-danger">
                  {leaveError}
                </p>
              )}
            </DangerZone>
          </>
        )}
      </SettingsLayout>
    </AppShell>
  )
}
