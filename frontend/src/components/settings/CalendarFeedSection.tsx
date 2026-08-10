import { useCallback, useEffect, useState } from 'react'
import { Check, Copy, Loader2, TriangleAlert } from 'lucide-react'
import { Button } from '../ui/Button'
import { FIELD_CLASS, ConfirmDialog, SettingsCard } from './primitives'
import {
  getSubscription,
  rotateSubscription,
  subscribeUrl,
  webcalUrl,
  type Subscription,
} from '../../api/calendar'

/**
 * The subscribe URL, plus how to use it in the three calendar apps campers
 * actually have.
 *
 * The URL contains a bearer credential. That is not a design choice so much as
 * the only option: Google Calendar refreshes a subscription with a bare GET and
 * sends no Authorization header, so anything that authenticates the request has
 * to live in the URL. The card says so plainly rather than presenting the link
 * as harmless, and Reset is always one click away.
 */

const INSTRUCTIONS: { app: string; steps: string[] }[] = [
  {
    app: 'Google Calendar',
    steps: [
      'Open Google Calendar on a computer — the mobile apps cannot add a subscription.',
      'In the left sidebar, click + next to "Other calendars".',
      'Choose "From URL", paste the link, and click "Add calendar".',
    ],
  },
  {
    app: 'Apple Calendar',
    steps: [
      'On iPhone: Settings → Apps → Calendar → Calendar Accounts → Add Account → Other → Add Subscribed Calendar.',
      'On Mac: Calendar → File → New Calendar Subscription.',
      'Paste the link and confirm.',
    ],
  },
  {
    app: 'Outlook',
    steps: [
      'Open Outlook on the web and go to Calendar.',
      'Click "Add calendar" → "Subscribe from web".',
      'Paste the link, give it a name, and click Import.',
    ],
  },
]

export function CalendarFeedSection() {
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [crewId, setCrewId] = useState<string>('')
  const [copied, setCopied] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)
  const [resetting, setResetting] = useState(false)

  useEffect(() => {
    let cancelled = false
    getSubscription()
      .then((value) => {
        if (!cancelled) setSubscription(value)
      })
      .catch(() => {
        if (!cancelled) setError('We could not load the calendar link.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Clears itself, so the button does not sit on "Copied" forever.
  useEffect(() => {
    if (!copied) return
    const id = window.setTimeout(() => setCopied(false), 2000)
    return () => window.clearTimeout(id)
  }, [copied])

  const url = subscription ? subscribeUrl(subscription.token, crewId || null) : ''

  // Defaulted rather than trusted. This card is embedded in the Campsite
  // settings page, so a payload missing `crews` would throw during render and
  // take down every other section with it — identity, modules, danger zone.
  // One malformed response should cost this card, not the page.
  const crews = subscription?.crews ?? []

  const copy = useCallback(async () => {
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
    } catch {
      // Clipboard access is refused outside a secure context and in some
      // embedded browsers. Selecting the text is the fallback, so say that
      // rather than failing silently.
      setError('Copying was blocked. Select the link and copy it manually.')
    }
  }, [url])

  const reset = useCallback(async () => {
    setResetting(true)
    try {
      const { token } = await rotateSubscription()
      setSubscription((current) => (current ? { ...current, token } : current))
      setResetOpen(false)
      setError(null)
    } catch {
      setError('We could not reset the link. Try again in a moment.')
    } finally {
      setResetting(false)
    }
  }, [])

  return (
    <SettingsCard
      id="calendar"
      title="Calendar subscription"
      description="Add the Campsite calendar to Google, Apple, or Outlook."
    >
      {loading && (
        <p role="status" className="flex items-center gap-2.5 py-4 text-sm text-ink-subtle">
          <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
          Loading your calendar link…
        </p>
      )}

      {!loading && subscription && (
        <div className="flex flex-col gap-5">
          <div>
            <label
              htmlFor="calendar-crew"
              className="mb-1.5 block text-[13px] font-medium text-ink"
            >
              Which calendar?
            </label>
            <select
              id="calendar-crew"
              value={crewId}
              onChange={(event) => setCrewId(event.target.value)}
              className={`${FIELD_CLASS} sm:max-w-xs`}
            >
              <option value="">Everything in {subscription.campsiteName ?? 'the Campsite'}</option>
              {crews.map((crew) => (
                <option key={crew.id} value={crew.id}>
                  {crew.name} only
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="calendar-url"
              className="mb-1.5 block text-[13px] font-medium text-ink"
            >
              Subscribe link
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <input
                id="calendar-url"
                readOnly
                value={url}
                onFocus={(event) => event.target.select()}
                className={`${FIELD_CLASS} font-mono text-[12.5px] sm:max-w-lg`}
              />
              <Button variant="secondary" size="sm" onClick={() => void copy()}>
                {copied ? (
                  <>
                    <Check aria-hidden="true" className="h-3.5 w-3.5" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy aria-hidden="true" className="h-3.5 w-3.5" />
                    Copy
                  </>
                )}
              </Button>
            </div>

            <p className="mt-1.5 text-[12.5px] text-ink-subtle">
              Anyone with this link can see every event on the calendar, without
              signing in. Share it the way you would share a password, and reset
              it below if it ends up somewhere it should not be.
            </p>
          </div>

          <div>
            {/* webcal:// hands the URL straight to the calendar app. Offered
                alongside the copyable link rather than instead of it: Google
                Calendar on the web ignores the handler entirely. */}
            <a
              href={webcalUrl(subscription.token, crewId || null)}
              className="text-[13px] font-medium text-accent-ink underline underline-offset-2"
            >
              Open in my calendar app
            </a>
          </div>

          <div className="rounded-control border border-border-subtle bg-surface-muted p-4">
            <h3 className="text-[13px] font-semibold text-ink">How to add it</h3>
            <dl className="mt-3 flex flex-col gap-4">
              {INSTRUCTIONS.map(({ app, steps }) => (
                <div key={app}>
                  <dt className="text-[12.5px] font-medium text-ink">{app}</dt>
                  <dd>
                    <ol className="mt-1 list-decimal pl-5 text-[12.5px] text-ink-subtle">
                      {steps.map((step) => (
                        <li key={step} className="mt-0.5">
                          {step}
                        </li>
                      ))}
                    </ol>
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-[12.5px] text-ink-subtle">
              Calendar apps decide their own refresh schedule. Google usually
              checks every few hours, so a new event will not appear instantly.
            </p>
          </div>

          <div className="border-t border-border-subtle pt-4">
            <Button variant="secondary" size="sm" onClick={() => setResetOpen(true)}>
              Reset link
            </Button>
            <p className="mt-1.5 text-[12.5px] text-ink-subtle">
              Creates a new link and stops the old one working. Everyone who
              subscribed with the old link will need the new one.
            </p>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-3 flex items-start gap-2 text-sm text-status-danger">
          <TriangleAlert aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      )}

      <ConfirmDialog
        open={resetOpen}
        title="Reset the calendar link?"
        description="Every calendar already subscribed to this Campsite will stop updating. They keep the events they have already downloaded, but receive no new ones until they subscribe again with the new link."
        confirmLabel={resetting ? 'Resetting…' : 'Reset link'}
        onCancel={() => setResetOpen(false)}
        onConfirm={() => void reset()}
      />
    </SettingsCard>
  )
}
