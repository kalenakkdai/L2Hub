import { Field, FIELD_CLASS, SettingsCard, Toggle } from './primitives'
import {
  ALWAYS_DELIVERS,
  CHANNELS,
  CHANNEL_LABELS,
  EVENT_TYPES,
  EVENT_TYPE_LABELS,
  useNotificationPrefs,
} from '../../hooks/useNotificationPrefs'
import type { ProfilePatch, SaveStatus, SettingsProfile } from '../../hooks/useProfile'

type NotificationsGridProps = {
  profile: SettingsProfile
  status: SaveStatus
  save: (patch: ProfilePatch) => void
  saveNow: () => void
}

const SMS_DISABLED_REASON =
  'Verify your phone number before switching on SMS notifications.'

/**
 * Eight event types by three channels, plus quiet hours and a master pause.
 *
 * SMS toggles are disabled until the phone is verified. That is a
 * convenience, not a control: the sender is what must actually refuse to
 * text an unverified number.
 */
export function NotificationsGrid({
  profile,
  status,
  save,
  saveNow,
}: NotificationsGridProps) {
  const prefs = useNotificationPrefs()
  const smsAvailable = profile.phone_verified

  return (
    <SettingsCard
      id="notifications"
      title="Notifications"
      description="Choose what reaches you, and how."
      status={prefs.status === 'idle' ? status : prefs.status}
    >
      <div className="-mx-5 overflow-x-auto px-5 sm:mx-0 sm:px-0">
        <table className="w-full min-w-[26rem] border-collapse">
          <caption className="sr-only">
            Notification preferences by event type and channel
          </caption>
          <thead>
            <tr>
              <th scope="col" className="pb-2 text-left text-[12.5px] font-medium text-ink-subtle">
                Event
              </th>
              {CHANNELS.map((channel) => (
                <th
                  key={channel}
                  scope="col"
                  className="w-20 pb-2 text-center text-[12.5px] font-medium text-ink-subtle"
                >
                  {CHANNEL_LABELS[channel]}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {EVENT_TYPES.map((eventType) => (
              <tr key={eventType} className="border-t border-border-divider">
                <th
                  scope="row"
                  className="py-2.5 pr-4 text-left text-sm font-normal text-ink"
                >
                  {EVENT_TYPE_LABELS[eventType]}
                  {ALWAYS_DELIVERS.includes(eventType) && (
                    <span className="mt-0.5 block text-[12px] text-ink-subtle">
                      Always sends, even during quiet hours
                    </span>
                  )}
                </th>

                {CHANNELS.map((channel) => {
                  const smsBlocked = channel === 'sms' && !smsAvailable
                  return (
                    <td key={channel} className="py-2.5 text-center">
                      <Toggle
                        size="sm"
                        checked={!smsBlocked && prefs.isEnabled(eventType, channel)}
                        disabled={smsBlocked || prefs.isPending}
                        disabledReason={smsBlocked ? SMS_DISABLED_REASON : undefined}
                        label={`${EVENT_TYPE_LABELS[eventType]} by ${CHANNEL_LABELS[channel]}`}
                        onChange={(next) => prefs.toggle(eventType, channel, next)}
                      />
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 border-t border-border-divider pt-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[13px] font-medium text-ink">Pause all notifications</p>
            <p className="mt-1 text-[12.5px] text-ink-subtle">
              Nothing is sent while this is on, including overdue alerts.
            </p>
          </div>
          <Toggle
            checked={profile.notifications_paused}
            label="Pause all notifications"
            onChange={(next) => {
              save({ notifications_paused: next })
              saveNow()
            }}
          />
        </div>
      </div>

      <div className="mt-5 border-t border-border-divider pt-5">
        <p className="text-[13px] font-medium text-ink">Quiet hours</p>
        <p className="mt-1 text-[12.5px] text-ink-subtle">
          Notifications wait until quiet hours end. Overdue task alerts still send —
          missing a deadline is worse than a late-night buzz.
        </p>

        <div className="mt-3 grid max-w-xs gap-3 sm:grid-cols-2">
          <Field label="From" htmlFor="quiet-start">
            <input
              id="quiet-start"
              type="time"
              value={profile.quiet_hours_start ?? ''}
              onChange={(event) => {
                save({ quiet_hours_start: event.target.value || null })
                saveNow()
              }}
              className={FIELD_CLASS}
            />
          </Field>
          <Field label="Until" htmlFor="quiet-end">
            <input
              id="quiet-end"
              type="time"
              value={profile.quiet_hours_end ?? ''}
              onChange={(event) => {
                save({ quiet_hours_end: event.target.value || null })
                saveNow()
              }}
              className={FIELD_CLASS}
            />
          </Field>
        </div>
      </div>
    </SettingsCard>
  )
}
