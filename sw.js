// Service worker: aplicația funcționează offline după prima încărcare.
// Strategie: întâi rețeaua (cu limită de 3 secunde), apoi copia locală.
// Așa, actualizările ajung imediat când ai internet, iar în sală fără semnal aplicația pornește din cache.
const CACHE = 'jurnal-v9'; // schimbă numărul la fiecare modificare a fișierelor aplicației
const FISIERE = [
  './', './index.html', './styles.css', './manifest.webmanifest', './icon.svg',
  './db.js', './validare.js', './exercitii.js', './analiza.js', './ui.js', './grafice.js',
  './setari.js', './timer.js', './sesiune.js', './corp.js', './progres.js', './istoric.js',
  './biblioteca.js', './backup.js', './main.js',
];
const LIMITA_RETEA_MS = 3000;

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

function dinRetea(cerere) {
  return new Promise((rezolva, respinge) => {
    const limita = setTimeout(() => respinge(new Error('timeout')), LIMITA_RETEA_MS);
    fetch(cerere).then(raspuns => {
      clearTimeout(limita);
      if (raspuns && raspuns.ok) {
        const copie = raspuns.clone();
        caches.open(CACHE).then(c => c.put(cerere, copie)).catch(() => {});
      }
      rezolva(raspuns);
    }, err => { clearTimeout(limita); respinge(err); });
  });
}

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  if (new URL(e.request.url).origin !== self.location.origin) return;
  e.respondWith(
    dinRetea(e.request).catch(() =>
      caches.match(e.request, { ignoreSearch: true }).then(r =>
        r || (e.request.mode === 'navigate' ? caches.match('./index.html') : Response.error())))
  );
});
