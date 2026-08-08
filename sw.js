// AKSU Smart Hub — Service Worker
const CACHE_NAME = 'aksu-smart-hub-v1';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png'
];

// Install — pre-cache the app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

// Activate — clear out old cache versions
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch strategy:
//  - API calls (anything not same-origin, or containing /api/, /campus/, /ai/, /quiz/) -> network only, never cached (data must stay fresh)
//  - App shell / static files -> cache-first, falling back to network, and re-caching what we fetch
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  const isApiCall = url.origin !== self.location.origin ||
    /\/(api|campus|ai|quiz)\//.test(url.pathname);

  if (isApiCall) {
    // Always go to the network for live data; do not cache
    event.respondWith(
      fetch(req).catch(() => new Response(
        JSON.stringify({ detail: 'You are offline. Please reconnect and try again.' }),
        { headers: { 'Content-Type': 'application/json' }, status: 503 }
      ))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res && res.status === 200 && req.method === 'GET') {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
        }
        return res;
      }).catch(() => {
        // Offline and not cached — fall back to the shell for navigations
        if (req.mode === 'navigate') return caches.match('./index.html');
      });
    })
  );
});
