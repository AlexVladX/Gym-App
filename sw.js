// Service worker: aplicația funcționează offline după prima încărcare.
// Strategie: întâi rețeaua (cu limită de 3 secunde), apoi copia locală.
// Așa, actualizările ajung imediat când ai internet, iar în sală fără semnal aplicația pornește din cache.
//
// La fiecare publicare: mărește VERSIUNE aici, în index.html (?v=… și data-versiune)
// și în styles.css (--versiune-css). Toate trei trebuie să fie egale.
const VERSIUNE = '19';
const CACHE = `jurnal-v${VERSIUNE}`;
const FISIERE_FIXE = ['./', './index.html', './manifest.webmanifest', './icon.svg'];
const FISIERE_VERSIONATE = [
  'styles.css', 'db.js', 'validare.js', 'exercitii.js', 'analiza.js', 'statistici.js', 'corp-calcul.js', 'realizari.js', 'catalog.js', 'figuri.js', 'ui.js', 'grafice.js',
  'setari.js', 'timer.js', 'sesiune.js', 'corp.js', 'progres.js', 'realizari-ui.js', 'istoric.js',
  'biblioteca.js', 'backup.js', 'acasa.js', 'main.js',
].map(f => `./${f}?v=${VERSIUNE}`);
const LIMITA_RETEA_MS = 3000;

// Miniaturile ilustrațiilor (lista e scrisă de tools/ilustratii/genereaza.js) se salvează la instalare,
// ca listele de exerciții să aibă desenele și fără semnal. Dacă vreuna nu se descarcă, instalarea continuă;
// desenele mari se salvează când le deschizi prima dată.
function salveazaMiniaturi(c) {
  return fetch(`./ilustratii/lista.json?v=${VERSIUNE}`, { cache: 'reload' })
    .then(r => (r.ok ? r.json() : { miniaturi: [] }))
    .then(lista => Promise.allSettled((lista.miniaturi || []).map(f =>
      c.add(new Request(`./ilustratii/${f}?v=${VERSIUNE}`, { cache: 'reload' })))))
    .catch(() => {});
}

self.addEventListener('install', e => {
  // cache: 'reload' ocolește cache-ul HTTP al browserului (GitHub Pages ține fișierele 10 minute),
  // ca să nu salvăm o foaie de stil veche lângă o pagină nouă.
  e.waitUntil(caches.open(CACHE).then(c =>
    c.addAll([...FISIERE_FIXE, ...FISIERE_VERSIONATE].map(u => new Request(u, { cache: 'reload' })))
      .then(() => salveazaMiniaturi(c))));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(chei => Promise.all(
      chei.filter(c => c !== CACHE).map(c => caches.delete(c))
    )).then(() => self.clients.claim())
  );
});

// Cererea spre rețea verifică mereu la server (no-cache), nu folosește copia HTTP veche.
function dinRetea(cerere) {
  return new Promise((rezolva, respinge) => {
    const limita = setTimeout(() => respinge(new Error('timeout')), LIMITA_RETEA_MS);
    fetch(cerere.url, { cache: 'no-cache', credentials: 'same-origin' }).then(raspuns => {
      clearTimeout(limita);
      if (raspuns && raspuns.ok) {
        const copie = raspuns.clone();
        caches.open(CACHE).then(c => c.put(cerere.url, copie)).catch(() => {});
      }
      rezolva(raspuns);
    }, err => { clearTimeout(limita); respinge(err); });
  });
}

// Ilustrațiile au versiunea în adresă și nu se schimbă în cadrul unei versiuni: întâi copia locală.
function ilustratie(cerere) {
  return caches.match(cerere.url).then(r => r || dinRetea(cerere));
}

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.includes('/ilustratii/') && url.searchParams.has('v')) {
    e.respondWith(ilustratie(e.request).catch(() => Response.error()));
    return;
  }
  e.respondWith(
    // Căutarea în cache se face cu adresa exactă (inclusiv ?v=…), ca să nu primim o versiune greșită.
    dinRetea(e.request).catch(() =>
      caches.match(e.request.url).then(r =>
        r || (e.request.mode === 'navigate' ? caches.match('./index.html') : Response.error())))
  );
});
