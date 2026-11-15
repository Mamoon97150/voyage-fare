/*
 * Voyage Fare's service worker (build 7 step 5, mockup pwa-v5, 15 Nov 2026).
 * Keeps the app itself on the phone (pages, scripts, fonts, drawings) so it opens without the
 * internet. Trips are NOT kept: Supabase and the map tiles always go to the network.
 * The build fills in the list of files and the version (see vite.config.ts).
 */
const VERSION = '__VERSION__'
const FILES = __FILES__
const CACHE = `vf-app-${VERSION}`

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(FILES))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k.startsWith('vf-app-') && k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // ignoreVary: the server answers "Vary: Origin", and scripts are asked for with an Origin.
  // A page (any address in the app): the network first, the kept app when there's none.
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('/index.html', { cacheName: CACHE, ignoreVary: true })))
    return
  }

  // The app's own files: from the phone first, then the network (and keep what it brings).
  event.respondWith(
    caches.match(request, { cacheName: CACHE, ignoreVary: true }).then(
      (kept) =>
        kept ||
        fetch(request).then((response) => {
          if (response.ok && response.type === 'basic') {
            const copy = response.clone()
            caches.open(CACHE).then((cache) => cache.put(request, copy))
          }
          return response
        }),
    ),
  )
})

// Admin notifications (Admin stage C): show them, and open the right page when tapped.
self.addEventListener('push', (event) => {
  let message = { title: 'Voyage Fare', body: '', url: '/admin', tag: 'voyage-fare' }
  try {
    message = { ...message, ...event.data.json() }
  } catch {
    // Not JSON: keep the default words.
  }
  event.waitUntil(
    self.registration.showNotification(message.title, {
      body: message.body,
      tag: message.tag,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: message.url },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = new URL(event.notification.data?.url ?? '/admin', self.location.origin).href
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const open = windows.find((w) => w.url.startsWith(self.location.origin))
      if (open) return open.navigate(url).then((w) => (w ?? open).focus())
      return self.clients.openWindow(url)
    }),
  )
})
