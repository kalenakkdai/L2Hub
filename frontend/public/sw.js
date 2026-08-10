/**
 * The Quad service worker.
 *
 * Deliberately hand-written and deliberately tiny. This worker exists for two
 * events — `push` and `notificationclick` — and does no caching at all.
 *
 * Why not vite-plugin-pwa: that plugin's job is offline precaching, which
 * would put a Workbox precache manifest in front of the built SPA. On a site
 * that deploys often, that trades a problem we do not have (offline access)
 * for one we would have to manage forever (campers on a stale bundle after a
 * deploy, and a cache-invalidation strategy to go with it). A file in public/
 * is copied to dist/ verbatim, un-hashed, at a stable root-scoped URL, which
 * is exactly what a service worker registration needs.
 *
 * No build step touches this file, so it must stay plain ES5-compatible-ish
 * browser JavaScript with no imports.
 */

self.addEventListener('install', () => {
  // Take over without waiting for every old tab to close. There is no cached
  // content to invalidate, so the usual reason for caution does not apply.
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
  // A push with no payload is legal — some services send one to wake the
  // worker. Show something honest rather than crashing on JSON.parse.
  let data = {}
  if (event.data) {
    try {
      data = event.data.json()
    } catch (_error) {
      data = { title: 'The Quad', body: event.data.text() }
    }
  }

  const title = data.title || 'The Quad'
  const options = {
    body: data.body || '',
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    // Same tag replaces rather than stacks, so a re-announced event does not
    // leave two copies in the tray.
    tag: data.tag || undefined,
    data: { url: data.url || '/' },
  }

  // waitUntil keeps the worker alive until the notification is actually
  // shown. Without it the browser may kill the worker first, and on most
  // platforms a push that shows nothing eventually costs the site its
  // permission.
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const target = (event.notification.data && event.notification.data.url) || '/'

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        // Prefer focusing a tab that is already open over spawning a third
        // copy of the app.
        for (const client of clients) {
          if ('focus' in client) {
            client.navigate(target)
            return client.focus()
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(target)
        }
        return undefined
      }),
  )
})
