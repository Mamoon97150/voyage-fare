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
