/*
 * Voyage Fare's service worker (build 7 step 5, mockup pwa-v5, 15 Nov 2026).
 * Keeps the app itself on the phone (pages, scripts, fonts, drawings) so it opens without the
 * internet. Build 10 (16 Nov): the trips you open are kept too (read-only offline): what Supabase
 * answered last is saved, the network always comes first. Cleared on sign-out, or when "Keep my
 * trips on this phone" is turned off in Me. Map tiles still always go to the network.
 * The build fills in the list of files and the version (see vite.config.ts).
 */
const VERSION = '__VERSION__'
const FILES = __FILES__
const CACHE = `vf-app-${VERSION}`
const DATA = 'vf-data'
const OFF = '/__vf-keep-trips-off'
// Functions that only read (safe to answer from the phone): the trip's money, Your trips.
const READ_RPC = new Set(['trip_settlement', 'trip_cards', 'am_i_admin', 'shared_trip'])

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

// ── Trips, read-only offline (build 10) ──────────────────────────────────────
// Supabase's data (rest/v1: tables, views and the read-only functions) — never auth or storage.
const isData = (url) => url.hostname.endsWith('.supabase.co') && url.pathname.startsWith('/rest/v1/')

async function keyFor(request) {
  if (request.method === 'GET') return request.url
  // A function call (POST): the same call = the same address + the same body.
  const body = await request.clone().text()
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(body))
  const hex = [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('')
  return `${request.url}#${hex}`
}

async function keepingOn(cache) {
  return !(await cache.match(OFF))
}

async function networkFirst(request) {
  const key = await keyFor(request)
  const cache = await caches.open(DATA)
  try {
    const response = await fetch(request)
    if (response.ok && (await keepingOn(cache))) cache.put(key, response.clone())
    return response
  } catch (error) {
    const kept = await cache.match(key)
    if (kept) return kept
    throw error
  }
}

self.addEventListener('message', (event) => {
  const type = event.data?.type
  if (type === 'forget-trips') event.waitUntil(caches.delete(DATA))
  if (type === 'keep-trips') {
    event.waitUntil(
      caches.open(DATA).then(async (cache) => {
        if (event.data.on) return cache.delete(OFF)
        // Off: forget everything kept, and remember not to keep more.
        for (const k of await cache.keys()) await cache.delete(k)
        return cache.put(OFF, new Response('off'))
      }),
    )
  }
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  const url = new URL(request.url)
  if (isData(url)) {
    const rpc = url.pathname.startsWith('/rest/v1/rpc/') ? url.pathname.slice('/rest/v1/rpc/'.length) : null
    if (request.method === 'GET' || (request.method === 'POST' && rpc && READ_RPC.has(rpc))) {
      event.respondWith(networkFirst(request))
    }
    return
  }
  if (request.method !== 'GET') return
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
