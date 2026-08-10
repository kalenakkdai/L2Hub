import { apiFetch } from '../api/client'

/**
 * Web push, from the browser's side.
 *
 * The environment checks are the bulk of this file, and that is proportionate:
 * push is the feature where "it silently does nothing" is the default failure,
 * and where the reason differs per platform. Every state a camper can land in
 * gets a name here so the settings card can explain it instead of showing a
 * switch that does not work.
 */

export type PushAvailability =
  /** No service worker or no Push API — an old browser, or Firefox in a
   *  private window. Nothing to offer. */
  | 'unsupported'
  /** iOS Safari, but the site is open in a tab rather than from the home
   *  screen. Safari delivers push ONLY to home-screen installs, so asking for
   *  permission here throws or silently fails depending on iOS version. */
  | 'ios-needs-home-screen'
  /** The camper said no, and the browser will not ask again. Only their own
   *  site settings can undo it. */
  | 'denied'
  /** No VAPID key on the server, so a subscription could never be pushed to. */
  | 'not-configured'
  /** Ready to ask, or already granted. */
  | 'available'

export type PushConfig = {
  vapidPublicKey: string | null
  enabled: boolean
}

export type PushDevice = {
  id: string
  endpointSuffix: string
  userAgent: string | null
  createdAt: string | null
  lastUsedAt: string | null
}

const SERVICE_WORKER_URL = '/sw.js'

/**
 * True on iPhone, iPad, and iPod.
 *
 * iPadOS 13 and later report a desktop Macintosh user agent, so the UA test
 * alone misses every modern iPad — which is a device campers actually use.
 * A Macintosh reporting more than one touch point is an iPad; a real Mac
 * reports zero even with a trackpad.
 */
export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  if (/iPhone|iPad|iPod/.test(ua)) return true
  // Coalesced: `maxTouchPoints` is absent in some embedded webviews, where
  // `undefined > 1` would be false anyway but reads as an accident.
  return /Macintosh/.test(ua) && (navigator.maxTouchPoints ?? 0) > 1
}

/**
 * True when the app is running as a home-screen install rather than a tab.
 *
 * Two checks because the two platforms disagree: `display-mode: standalone`
 * is the standard and works on Android and desktop; `navigator.standalone` is
 * Safari's own non-standard property and is the only one iOS sets.
 */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  const iosStandalone = (navigator as { standalone?: boolean }).standalone === true
  const displayMode =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(display-mode: standalone)').matches
  return iosStandalone || displayMode
}

/** Whether this browser has the APIs at all. */
export function pushSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    typeof window !== 'undefined' &&
    'PushManager' in window &&
    'Notification' in window
  )
}

/**
 * Which of the named states this browser is in.
 *
 * Order matters. The iOS check comes before the support check because iOS
 * Safari in a tab reports `PushManager` as present on recent versions — it is
 * there, it just never delivers. Checking support first would classify an
 * iPhone as 'available' and produce exactly the broken permission prompt this
 * whole state machine exists to avoid.
 */
export function availability(config: PushConfig | null): PushAvailability {
  if (isIOS() && !isStandalone()) return 'ios-needs-home-screen'
  if (!pushSupported()) return 'unsupported'
  if (config && !config.enabled) return 'not-configured'
  if (typeof Notification !== 'undefined' && Notification.permission === 'denied') {
    return 'denied'
  }
  return 'available'
}

export function getPushConfig(): Promise<PushConfig> {
  return apiFetch<PushConfig>('/push/config')
}

export function listDevices(): Promise<{ devices: PushDevice[] }> {
  return apiFetch<{ devices: PushDevice[] }>('/push/subscriptions')
}

export function sendTestPush(): Promise<{ sent: number }> {
  return apiFetch<{ sent: number }>('/push/test', { method: 'POST' })
}

/**
 * Decodes a base64url VAPID key into the Uint8Array `subscribe` requires.
 *
 * The Push API will not take the string form. base64url swaps '+/' for '-_'
 * and drops the padding, so both have to be put back before atob will parse
 * it — and atob on an unconverted key throws an InvalidCharacterError that
 * looks nothing like "your key is in the wrong alphabet".
 */
export function decodeVapidKey(base64Url: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4)
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  // Backed by an explicit ArrayBuffer so the type is Uint8Array<ArrayBuffer>
  // rather than Uint8Array<ArrayBufferLike>. `applicationServerKey` accepts a
  // BufferSource, which excludes a SharedArrayBuffer-backed view — and
  // `new Uint8Array(length)` alone widens to ArrayBufferLike.
  const output = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i)
  }
  return output
}

/** Registers the worker, or returns the existing registration. */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration> {
  const registration = await navigator.serviceWorker.register(SERVICE_WORKER_URL)
  // `register` resolves as soon as the file is fetched, but `pushManager` is
  // only usable once a worker is active. Subscribing before then rejects with
  // an InvalidStateError.
  await navigator.serviceWorker.ready
  return registration
}

export class PushPermissionDeniedError extends Error {
  constructor() {
    super('Notifications are blocked for this site.')
    this.name = 'PushPermissionDeniedError'
  }
}

/**
 * Asks for permission and subscribes this browser.
 *
 * Called ONLY from a click handler. Browsers increasingly refuse a permission
 * prompt that is not tied to a user gesture, and Chrome permanently blocks
 * sites that ask on load — so the prompt lives behind a button in Settings
 * and nowhere else.
 */
export async function subscribe(vapidPublicKey: string): Promise<PushSubscription> {
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    throw new PushPermissionDeniedError()
  }

  const registration = await registerServiceWorker()

  // An existing subscription is reused rather than replaced. Calling
  // subscribe() twice with different keys throws, and a camper who already
  // granted permission should not be re-prompted.
  const existing = await registration.pushManager.getSubscription()
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      // Required to be true by every browser that implements this: a silent
      // push is not allowed, and passing false throws.
      userVisibleOnly: true,
      applicationServerKey: decodeVapidKey(vapidPublicKey),
    }))

  const json = subscription.toJSON()
  await apiFetch('/push/subscribe', {
    method: 'POST',
    body: JSON.stringify({
      endpoint: subscription.endpoint,
      keys: { p256dh: json.keys?.p256dh, auth: json.keys?.auth },
      userAgent: navigator.userAgent,
    }),
  })

  return subscription
}

/**
 * Unsubscribes this browser, on both sides.
 *
 * The server is told first. If the browser-side unsubscribe succeeded but the
 * API call failed, the row would linger and every push to it would fail
 * silently until something noticed the 410 — whereas a server row removed
 * while the browser subscription survives simply stops receiving, which is
 * what was asked for.
 */
export async function unsubscribe(): Promise<boolean> {
  const registration = await navigator.serviceWorker.getRegistration(SERVICE_WORKER_URL)
  const subscription = await registration?.pushManager.getSubscription()
  if (!subscription) return false

  await apiFetch('/push/unsubscribe', {
    method: 'POST',
    body: JSON.stringify({ endpoint: subscription.endpoint }),
  })

  return subscription.unsubscribe()
}

/** Whether this browser currently holds a subscription. */
export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null
  const registration = await navigator.serviceWorker.getRegistration(SERVICE_WORKER_URL)
  return (await registration?.pushManager.getSubscription()) ?? null
}
