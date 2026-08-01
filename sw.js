/* Offline cache for solo modes. Duel MQTT still needs network. */
const CACHE = 'roulette-trainer-v14';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/base.css',
  './css/components.css',
  './css/board.css',
  './css/animations.css',
  './css/reference.css',
  './css/roulette3d.css',
  './js/utils.js',
  './js/settings.js',
  './js/ui.js',
  './js/stats.js',
  './js/patterns.js',
  './js/roulette3d-rules.js',
  './js/modes/multiplication.js',
  './js/modes/addition.js',
  './js/modes/blackjack.js',
  './js/modes/counting.js',
  './js/modes/roulette3d.js',
  './js/modes/payouts.js',
  './js/modes/poker.js',
  './js/modes/duel.js',
  './js/modes/reference.js',
  './js/app.js',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') {
    return;
  }
  const url = new URL(request.url);
  // Don't cache MQTT / CDN mqtt for duel
  if (url.protocol === 'ws:' || url.protocol === 'wss:' || url.hostname.includes('unpkg.com')) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response && response.ok && url.origin === self.location.origin) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
