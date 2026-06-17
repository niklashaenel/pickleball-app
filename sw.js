// Service Worker: macht die App nach dem ersten Laden offline nutzbar.
const CACHE = 'pickleball-v10';
const VOICE = [
  'zu', 'seitenwechsel', 'verlaengerung', 'es-geht-bis', 'aufschlag', 'spiel', 'gewinnt',
  'spiel-fuer', 'satzstand', 'match', 'gewinnt-das-match', 'team-a', 'team-b'
];
const ASSETS = [
  './', './index.html', './styles.css', './app.js', './manifest.json', './icon.svg'
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
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
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
