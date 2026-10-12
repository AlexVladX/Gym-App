// Cache simplu: fișierele aplicației sunt păstrate local, ca aplicația să meargă fără internet.
const CACHE = 'jurnal-v4'; // schimbă numărul la fiecare modificare a fișierelor aplicației
const FISIERE = ['./', './index.html', './styles.css', './db.js', './app.js', './manifest.webmanifest', './icon.svg'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FISIERE)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(chei => Promise.all(
      chei.filter(c => c !== CACHE).map(c => caches.delete(c))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(raspuns => raspuns || fetch(e.request))
  );
});
