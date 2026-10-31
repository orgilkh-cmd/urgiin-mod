// Service worker: makes the app open offline. Generated into dist/sw.js at build time;
// The cache version and file list are filled in by the plugin in vite.config.ts.
// Only app files are cached here. Family data lives in IndexedDB and never passes through.
const CACHE = 'urgiin-mod-__VERSION__'
const PRECACHE = __PRECACHE__

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('urgiin-mod-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return

  // Pages: network first so updates arrive, cached copy when offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          caches.open(CACHE).then((cache) => cache.put('./', copy))
          return response
        })
        .catch(() => caches.match('./', { ignoreVary: true })),
    )
    return
  }

  // Everything else: hashed or static files, cache first. Module scripts send an Origin header,
  // which would miss entries stored with "Vary: Origin" — the files are the same either way.
  event.respondWith(caches.match(request, { ignoreVary: true }).then((hit) => hit ?? fetch(request)))
})
