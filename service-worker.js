const CACHE = 'tonys-timers-v7';
const ASSETS = [
  '.',
  'index.html',
  'shared.css',
  'app.js',
  'engine.js',
  'manifest.webmanifest',
  'icons/icon.svg',
  'timers/ui.js',
  'timers/timers.css',
  'timers/hiit.js',
  'timers/tabata.js',
  'timers/emom.js',
  'timers/amrap.js',
  'timers/rest.js',
  'timers/pomodoro.js',
  'timers/meditation.js',
  'timers/fasting.js',
  'timers/prayer.js',
  'timers/chess.js',
  'timers/presentation.js',
  'timers/cooking.js'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
