/* Offline cache for solo modes. Duel MQTT still needs network. */
const CACHE = 'roulette-trainer-v27';
const ASSETS = [
  './', './index.html', './manifest.webmanifest',
  './css/base.css', './css/components.css', './css/board.css', './css/animations.css', './css/reference.css',
  './js/utils.js', './js/settings.js', './js/ui.js', './js/stats.js', './js/payout-catalog.js', './js/patterns.js',
  './js/modes/multiplication.js', './js/modes/addition.js', './js/modes/blackjack.js',
  './js/modes/counting.js', './js/modes/payouts.js', './js/modes/poker.js',
  './js/modes/duel.js', './js/modes/reference.js', './js/app.js',
  './icons/icon-192.png', './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.protocol === 'ws:' || url.protocol === 'wss:' || url.hostname.includes('unpkg.com')) return;

  const isDocument = request.mode === 'navigate' || request.destination === 'document';
  event.respondWith((isDocument ? fetch(request) : caches.match(request))
    .then((response) => {
      if (response) {
        if (url.origin === self.location.origin && response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      }
      return fetch(request);
    })
    .catch(() => caches.match(request)));
});
