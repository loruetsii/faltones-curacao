const APP_CACHE = 'faltones-app-v1';
const CRESTS_CACHE = 'faltones-crests-v1';

const APP_SHELL = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(APP_CACHE)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== APP_CACHE && k !== CRESTS_CACHE)
          .map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (event.request.method !== 'GET') return;

  // Las llamadas a la API siempre van a la red (datos siempre frescos)
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/.netlify/')) {
    return;
  }

  // Escudos e imágenes externas: cache-first y se quedan guardados para siempre.
  // Así, aunque el servidor de los escudos falle más adelante, se siguen viendo.
  const isCrest = url.hostname.includes('football-data.org')
    || url.hostname.includes('crests')
    || /\.(png|jpg|jpeg|svg|webp|gif)$/i.test(url.pathname);

  if (isCrest && url.origin !== self.location.origin) {
    event.respondWith(
      caches.open(CRESTS_CACHE).then(async (cache) => {
        const cached = await cache.match(event.request);
        if (cached) return cached;
        try {
          const response = await fetch(event.request);
          if (response && (response.ok || response.type === 'opaque')) {
            cache.put(event.request, response.clone());
          }
          return response;
        } catch (e) {
          return cached || Response.error();
        }
      })
    );
    return;
  }

  // Archivos propios de la app: red primero, caché como respaldo
  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response && response.ok && url.origin === self.location.origin) {
          const copy = response.clone();
          caches.open(APP_CACHE).then(cache => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request).then(r => r || caches.match('/index.html')))
  );
});
