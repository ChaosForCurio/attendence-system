const CACHE_NAME = 'attendance-pwa-v2';
const ASSETS_TO_CACHE = [
  '/manifest.json',
  '/favicon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // 1. Only handle GET requests
  if (req.method !== 'GET') {
    return;
  }

  const url = new URL(req.url);

  // 2. Only handle http/https requests
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // 3. Always fetch API endpoints live from server
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // 4. Do not intercept HTML document navigation requests (allows SSR redirects like / -> /login to work natively)
  if (req.mode === 'navigate') {
    return;
  }

  // 5. Stale-while-revalidate / Cache-first strategy for static assets
  event.respondWith(
    caches.match(req).then((cachedResponse) => {
      const fetchPromise = fetch(req)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, responseToCache));
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});

