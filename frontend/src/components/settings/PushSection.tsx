import { useCallback, useEffect, useState } from 'react'
import { Bell, Loader2, Share, TriangleAlert } from 'lucide-react'
import { Button } from '../ui/Button'
import { SettingsCard } from './primitives'
import {
  availability,
  currentSubscription,
  getPushConfig,
  sendTestPush,
  subscribe,
  unsubscribe,
  PushPermissionDeniedError,
  type PushAvailability,
  type PushConfig,
} from '../../lib/push'

/**
 * Push notifications.
 *
 * The permission prompt is behind a button and nowhere else. Asking on page
 * load is the single fastest way to lose the permission permanently — Chrome
 * blocks sites that do it, and a camper who dismisses a prompt they did not
 * ask for can never be asked again from this origin.
 */

/** The iOS instructions, which are the reason this card is not four lines. */
function AddToHomeScreen() {
  return (
    <div className="rounded-control border border-status-warning-border bg-status-warning-bg p-4">
      <h3 className="flex items-center gap-2 text-[13px] font-semibold text-status-warning">
        <Share aria-hidden="true" className="h-3.5 w-3.5" />
        Add The Quad to your Home Screen first
      </h3>
      <p className="mt-2 text-[12.5px] text-ink-subtle">
        On iPhone and iPad, Safari only sends notifications to apps you have
        added to your Home Screen. This takes about ten seconds and you only do
        it once.
      </p>
      <ol className="mt-2 list-decimal pl-5 text-[12.5px] text-ink-subtle">
        <li className="mt-0.5">
          Tap the Share button at the bottom of Safari — the square with an
          arrow pointing up.
        </li>
        <li className="mt-0.5">Scroll down and tap “Add to Home Screen”.</li>
        <li className="mt-0.5">Tap “Add” in the top right.</li>
        <li className="mt-0.5">
          Open The Quad from your Home Screen, come back to Settings, and the
          switch below will work.
        </li>
      </ol>
      <p className="mt-2 text-[12.5px] text-ink-subtle">
        This has to be done in Safari. Chrome and Firefox on iPhone cannot add
        a Home Screen app that receives notifications.
      </p>
    </div>
  )
}

const UNAVAILABLE_COPY: Record<
  Exclude<PushAvailability, 'available' | 'ios-needs-home-screen'>,
  string
> = {
  unsupported:
    'This browser cannot receive push notifications. Try Chrome, Edge, or Safari on a recent device.',
  denied:
    'Notifications are blocked for this site. Turn them back on in your browser’s site settings for The Quad, then reload this page.',
  'not-configured':
    'Push notifications are not set up for this Campsite yet, so there is nothing to switch on.',
}

export function PushSection() {
  const [config, setConfig] = useState<PushConfig | null>(null)
  const [state, setState] = useState<PushAvailability | null>(null)
  const [subscribed, setSubscribed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const value = await getPushConfig()
        if (cancelled) return
        setConfig(value)
        setState(availability(value))

        // Reading the existing subscription is NOT a permission request —
        // getSubscription never prompts — so it is safe to do on mount.
        const existing = await currentSubscription()
        if (!cancelled) setSubscribed(existing !== null)
      } catch {
        if (!cancelled) {
          setState(availability(null))
          setError('We could not check whether notifications are available.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const turnOn = useCallback(async () => {
    if (!config?.vapidPublicKey) return
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      await subscribe(config.vapidPublicKey)
      setSubscribed(true)
      setNotice('Notifications are on for this device.')
    } catch (caught) {
      if (caught instanceof PushPermissionDeniedError) {
        setState('denied')
        setError(UNAVAILABLE_COPY.denied)
      } else {
        setError('We could not turn on notifications. Try again in a moment.')
      }
    } finally {
      setBusy(false)
    }
  }, [config])

  const turnOff = useCallback(async () => {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      await unsubscribe()
      setSubscribed(false)
      setNotice('Notifications are off for this device.')
    } catch {
      setError('We could not turn off notifications. Try again in a moment.')
    } finally {
      setBusy(false)
    }
  }, [])

  const test = useCallback(async () => {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const { sent } = await sendTestPush()
      setNotice(
        sent > 0
          ? 'Sent. It should appear in a few seconds.'
          : 'Nothing was sent — this device may have been unsubscribed.',
      )
    } catch {
      setError('We could not send a test notification.')
    } finally {
      setBusy(false)
    }
  }, [])

  return (
    <SettingsCard
      id="push"
      title="Push notifications"
      description="Get told about new events on this device, even when The Quad is closed."
    >
      {loading && (
        <p role="status" className="flex items-center gap-2.5 py-4 text-sm text-ink-subtle">
          <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
          Checking this device…
        </p>
      )}

      {!loading && state === 'ios-needs-home-screen' && <AddToHomeScreen />}

      {!loading && state !== null && state !== 'available' && state !== 'ios-needs-home-screen' && (
        <p className="rounded-control border border-border-subtle bg-surface-muted px-3 py-2 text-[12.5px] text-ink-subtle">
          {UNAVAILABLE_COPY[state]}
        </p>
      )}

      {!loading && state === 'available' && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            {subscribed ? (
              <Button
                variant="secondary"
                size="sm"
                disabled={busy}
                onClick={() => void turnOff()}
              >
                Turn off on this device
              </Button>
            ) : (
              <Button size="sm" disabled={busy} onClick={() => void turnOn()}>
                <Bell aria-hidden="true" className="h-3.5 w-3.5" />
                Turn on notifications
              </Button>
            )}

            {subscribed && (
              <Button
                variant="secondary"
                size="sm"
                disabled={busy}
                onClick={() => void test()}
              >
                Send a test
              </Button>
            )}
          </div>

          <p className="text-[12.5px] text-ink-subtle">
            This setting is per device — turning it on here does not turn it on
            for your phone. Which notifications you get is controlled by the
            grid above, and quiet hours are always respected.
          </p>
        </div>
      )}

      {notice && (
        <p role="status" className="mt-3 text-sm text-ink-subtle">
          {notice}
        </p>
      )}

      {error && (
        <p role="alert" className="mt-3 flex items-start gap-2 text-sm text-status-danger">
          <TriangleAlert aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      )}
    </SettingsCard>
  )
}
