import { afterEach, describe, expect, it, vi } from 'vitest'
import { availability, decodeVapidKey, isIOS, isStandalone, pushSupported } from './push'

/**
 * Environment detection.
 *
 * Everything here is simulated. No real browser, no real Push API, no real
 * iPhone — these assert the branching logic, not that Safari behaves the way
 * the branches assume.
 */

const REAL_UA = navigator.userAgent

function setEnvironment({
  ua,
  touchPoints = 0,
  standalone,
  displayMode = false,
  serviceWorker = true,
  pushManager = true,
  notification = 'default' as NotificationPermission | null,
}: {
  ua: string
  touchPoints?: number
  standalone?: boolean
  displayMode?: boolean
  serviceWorker?: boolean
  pushManager?: boolean
  notification?: NotificationPermission | null
}) {
  // defineProperty, not spyOn: jsdom's navigator has no `maxTouchPoints` at
  // all, and spyOn refuses to stub a property that does not exist.
  Object.defineProperty(navigator, 'userAgent', { value: ua, configurable: true })
  Object.defineProperty(navigator, 'maxTouchPoints', {
    value: touchPoints,
    configurable: true,
  })

  if (standalone === undefined) {
    delete (navigator as { standalone?: boolean }).standalone
  } else {
    ;(navigator as { standalone?: boolean }).standalone = standalone
  }

  vi.stubGlobal('matchMedia', () => ({ matches: displayMode }))

  if (serviceWorker) {
    Object.defineProperty(navigator, 'serviceWorker', {
      value: {},
      configurable: true,
    })
  } else {
    // @ts-expect-error — removing a property the type says is always present
    delete navigator.serviceWorker
  }

  // Deleted rather than stubbed to undefined. `pushSupported` asks
  // `'PushManager' in window`, and stubGlobal(name, undefined) still creates
  // the key — so a stub would report the API as present.
  if (pushManager) vi.stubGlobal('PushManager', class {})
  else Reflect.deleteProperty(globalThis, 'PushManager')

  if (notification === null) Reflect.deleteProperty(globalThis, 'Notification')
  else vi.stubGlobal('Notification', { permission: notification })
}

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
const IPAD_DESKTOP_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
const ANDROID =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36'

const CONFIGURED = { vapidPublicKey: 'BKxQ', enabled: true }

afterEach(() => {
  Object.defineProperty(navigator, 'userAgent', {
    value: REAL_UA,
    configurable: true,
  })
  vi.unstubAllGlobals()
})

describe('isIOS', () => {
  it('detects an iPhone', () => {
    setEnvironment({ ua: IPHONE })
    expect(isIOS()).toBe(true)
  })

  it('detects a modern iPad, which lies and claims to be a Mac', () => {
    // iPadOS 13+ reports a desktop UA. Touch points are the giveaway, and
    // getting this wrong would send every iPad down the Android path.
    setEnvironment({ ua: IPAD_DESKTOP_UA, touchPoints: 5 })
    expect(isIOS()).toBe(true)
  })

  it('does not mistake a real Mac for an iPad', () => {
    setEnvironment({ ua: IPAD_DESKTOP_UA, touchPoints: 0 })
    expect(isIOS()).toBe(false)
  })

  it('does not fire on Android', () => {
    setEnvironment({ ua: ANDROID })
    expect(isIOS()).toBe(false)
  })
})

describe('isStandalone', () => {
  it('reads navigator.standalone, which is the only signal iOS sets', () => {
    setEnvironment({ ua: IPHONE, standalone: true })
    expect(isStandalone()).toBe(true)
  })

  it('reads display-mode for Android and desktop', () => {
    setEnvironment({ ua: ANDROID, displayMode: true })
    expect(isStandalone()).toBe(true)
  })

  it('is false in an ordinary tab', () => {
    setEnvironment({ ua: IPHONE })
    expect(isStandalone()).toBe(false)
  })
})

describe('availability', () => {
  it('sends iOS Safari in a tab to the Home Screen instructions', () => {
    setEnvironment({ ua: IPHONE })
    expect(availability(CONFIGURED)).toBe('ios-needs-home-screen')
  })

  it('sends an iPad in a tab there too', () => {
    setEnvironment({ ua: IPAD_DESKTOP_UA, touchPoints: 5 })
    expect(availability(CONFIGURED)).toBe('ios-needs-home-screen')
  })

  it('allows iOS once installed to the Home Screen', () => {
    setEnvironment({ ua: IPHONE, standalone: true })
    expect(availability(CONFIGURED)).toBe('available')
  })

  it('prefers the iOS branch even when PushManager is present', () => {
    // Recent iOS Safari exposes PushManager in a plain tab but never
    // delivers. Checking support first would call this 'available' and show
    // the broken prompt this branch exists to prevent.
    setEnvironment({ ua: IPHONE, pushManager: true })
    expect(availability(CONFIGURED)).toBe('ios-needs-home-screen')
  })

  it('reports unsupported when there is no service worker', () => {
    setEnvironment({ ua: ANDROID, serviceWorker: false })
    expect(availability(CONFIGURED)).toBe('unsupported')
  })

  it('reports unsupported when there is no PushManager', () => {
    setEnvironment({ ua: ANDROID, pushManager: false })
    expect(availability(CONFIGURED)).toBe('unsupported')
  })

  it('reports not-configured when the server has no VAPID key', () => {
    setEnvironment({ ua: ANDROID })
    expect(availability({ vapidPublicKey: null, enabled: false })).toBe('not-configured')
  })

  it('reports denied so the card can explain how to undo it', () => {
    setEnvironment({ ua: ANDROID, notification: 'denied' })
    expect(availability(CONFIGURED)).toBe('denied')
  })

  it('is available on granted Android Chrome', () => {
    setEnvironment({ ua: ANDROID, notification: 'granted' })
    expect(availability(CONFIGURED)).toBe('available')
  })
})

describe('pushSupported', () => {
  it('needs all three APIs, not just one', () => {
    setEnvironment({ ua: ANDROID, notification: null })
    expect(pushSupported()).toBe(false)
  })
})

describe('decodeVapidKey', () => {
  it('restores base64url padding that the Push API would otherwise reject', () => {
    // 'BA==' base64 is one byte, 0x04. base64url drops the '=' padding.
    expect(Array.from(decodeVapidKey('BA'))).toEqual([4])
  })

  it('translates the base64url alphabet back to base64', () => {
    // '-' and '_' are base64url's stand-ins for '+' and '/'. atob rejects
    // them outright, which is the bug this exists to prevent.
    const decoded = decodeVapidKey('-_8')
    expect(Array.from(decoded)).toEqual([251, 255])
  })

  it('produces a Uint8Array, which is what subscribe() requires', () => {
    expect(decodeVapidKey('BA')).toBeInstanceOf(Uint8Array)
  })
})
