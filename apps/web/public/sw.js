# PWA service worker — cache-first for static assets, network-first for API.
# Hosted at /sw.js so it controls the entire origin scope.
self.addEventListener('install', (e) => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

const STATIC_CACHE = 'kodspot-flow-static-v1';
const RUNTIME_CACHE = 'kodspot-flow-runtime-v1';

const PRECACHE_URLS = [
  '/',
  '/login',
  '/dashboard',
  '/manifest.webmanifest',
  '/favicon.ico',
  '/android-chrome-192x192.png',
  '/android-chrome-512x512.png',
  '/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) =>
      // Tolerate individual 404s during initial deploy
      Promise.all(PRECACHE_URLS.map((u) => cache.add(u).catch(() => undefined))),
    ),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== STATIC_CACHE && k !== RUNTIME_CACHE)
          .map((k) => caches.delete(k)),
      ),
    ),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Never cache auth or invoice/PDF API calls (data must be fresh + auth-gated)
  if (url.hostname.includes('api.flow.kodspot.co.in')) return;
  if (url.pathname.startsWith('/api/')) return;

  // HTML navigations: network-first, fall back to cache
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(RUNTIME_CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match('/'))),
    );
    return;
  }

  // Static assets: cache-first
  if (
    url.origin === self.location.origin &&
    /\.(?:js|css|woff2?|ttf|png|jpg|jpeg|svg|webp|ico|webmanifest)$/i.test(url.pathname)
  ) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((res) => {
          const copy = res.clone();
          caches.open(STATIC_CACHE).then((c) => c.put(req, copy));
          return res;
        });
      }),
    );
  }
});
