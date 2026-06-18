// Service Worker: macht die App nach dem ersten Laden offline nutzbar.
// Eigene Cache-Familie für die v2-App (eigener Ordner /v2/). Wichtig: github.io teilt sich
// den Cache-Speicher über alle Pfade -> wir räumen NUR unsere eigene Familie auf, damit die
// alte App im Root ihren Offline-Cache behält.
const CACHE_PREFIX = 'pickleball-v2-';
const CACHE = CACHE_PREFIX + '3';
const VOICE = [
  'zu', 'seitenwechsel', 'verlaengerung', 'es-geht-bis', 'aufschlag', 'spiel', 'gewinnt',
  'spiel-fuer', 'satzstand', 'match', 'gewinnt-das-match', 'team-a', 'team-b'
];
const ASSETS = [
  './', './index.html', './styles.css', './app.js', './manifest.json', './icon.svg', './silent.wav'
].concat(
  Array.from({ length: 31 }, (_, i) => './voice/' + i + '.mp3'),
  VOICE.map((n) => './voice/' + n + '.mp3')
);

self.addEventListener('install', (event) => {
  // Einzeln cachen, damit ein fehlender Schnipsel die Installation nicht abbricht
  event.waitUntil(caches.open(CACHE).then((c) =>
    Promise.all(ASSETS.map((u) => c.add(u).catch(() => {})))
  ));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys
        .filter((k) => k.startsWith(CACHE_PREFIX) && k !== CACHE)
        .map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// "Zuerst Netzwerk, dann Cache": online immer die neueste Version,
// offline die zuletzt geladene.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request)
      .then((resp) => {
        const copy = resp.clone();
        caches.open(CACHE).then((c) => c.put(event.request, copy));
        return resp;
      })
      .catch(() => caches.match(event.request))
  );
});
