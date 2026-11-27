// Service worker: pornire instantanee și funcționare offline după prima încărcare.
//
// Strategii (etapa 3):
//   - fișierele cu versiune în adresă (?v=…): ÎNTÂI CACHE. Sub aceeași adresă conținutul nu se schimbă niciodată,
//     deci nu mai așteptăm rețeaua; rețeaua doar dacă lipsesc din cache (și atunci se pun în cache).
//   - pagina (index.html / navigarea): STALE-WHILE-REVALIDATE. Se afișează imediat copia din cache și se
//     actualizează în fundal; versiunea nouă se aplică la următoarea deschidere.
//   - ilustrațiile: cache propriu, cu versiunea lor (lista.json), păstrat între versiunile aplicației.
//   - fotografiile rețetelor: cache propriu, păstrat între versiuni, salvate pe măsură ce le vezi.
//   - cererile spre alte domenii (Supabase, Gemini, USDA, Open Food Facts) nu trec deloc pe aici.
//
// Actualizarea: SW-ul nou se instalează în fundal și AȘTEAPTĂ (nu se activează singur în mijlocul unui
// antrenament). Pagina îl activează (mesajul „activeaza”) la pornire, dacă nu e un antrenament în curs,
// sau când apeși „Reîncarcă” în bannerul „Versiune nouă”.
//
// La fiecare publicare: mărește VERSIUNE aici, în index.html (?v=… și data-versiune)
// și în styles.css (--versiune-css). Toate trei trebuie să fie egale.
const VERSIUNE = '56';
const CACHE = `jurnal-v${VERSIUNE}`;
const FISIERE_FIXE = ['./', './index.html', './manifest.webmanifest', './icon.svg', './icon-180.png', './icon-192.png', './icon-512.png'];
// Nucleul (încărcat la pornire) și modulele de nutriție + scanare (încărcate la cerere, vezi incarcare.js):
// toate se salvează la instalare, ca ambele moduri să meargă offline după prima vizită.
const FISIERE_VERSIONATE = [
  'styles.css', 'tema.js', 'db.js', 'validare.js', 'exercitii.js', 'analiza.js', 'statistici.js', 'corp-calcul.js', 'realizari.js',
  'nutritie-calcul.js', 'nutritie-zi.js', 'cafea.js', 'nutritie-generator.js', 'nutritie-cumparaturi.js', 'catalog.js', 'figuri.js', 'ui.js', 'navigare.js', 'incarcare.js', 'grafice.js',
  'setari.js', 'timer.js', 'sesiune.js', 'corp.js', 'progres.js', 'realizari-ui.js', 'istoric.js',
  'biblioteca.js', 'scanare-istoric.js', 'cloud-config.js', 'sincron.js', 'cloud.js', 'cloud-ui.js', 'vendor/supabase.js', 'backup.js', 'siguranta.js', 'acasa.js', 'main.js',
  // la cerere (incarcare.js → SCRIPTURI_NUTRITIE)
  'nutritie-alimente.js', 'nutritie-retete.js', 'nutritie-analiza.js', 'nutritie-imagini.js',
  'nutritie.js', 'nutritie-zi-ui.js', 'cafea-ui.js', 'nutritie-saptamana-ui.js', 'nutritie-analiza-ui.js', 'nutritie-cumparaturi-ui.js',
  'scanare.js', 'scanare-baze.js', 'scanare-ui.js', 'acasa-mealprep.js',
].map(f => `./${f}?v=${VERSIUNE}`);
// Fotografiile rețetelor și ilustrațiile stau în cache-uri separate, care NU se șterg la actualizarea aplicației.
const CACHE_FOTO = 'jurnal-foto-retete';
const CACHE_ILUSTRATII = 'jurnal-ilustratii';
const LIMITA_RETEA_MS = 3000;

// Miniaturile ilustrațiilor se salvează la instalare (doar cele care lipsesc din cache-ul lor), ca listele de
// exerciții să aibă desenele și fără semnal. Versiunea lor vine din lista.json. Dacă vreuna nu se descarcă,
// instalarea continuă; desenele mari se salvează când le deschizi prima dată.
function salveazaMiniaturi() {
  return fetch(`./ilustratii/lista.json?v=${VERSIUNE}`, { cache: 'reload' })
    .then(r => (r.ok ? r.json() : null))
    .then(lista => {
      if (!lista || !lista.versiune) return;
      return caches.open(CACHE_ILUSTRATII).then(c => Promise.allSettled((lista.miniaturi || []).map(f => {
        const url = new URL(`./ilustratii/${f}?v=${lista.versiune}`, self.location).href;
        return c.match(url).then(r => r || c.add(new Request(url, { cache: 'reload' })));
      })).then(() => curataIlustratiiVechi(c, lista.versiune)));
    })
    .catch(() => {});
}
// Ilustrațiile cu altă versiune decât cea curentă nu mai sunt folosite: se șterg.
function curataIlustratiiVechi(c, versiune) {
  return c.keys().then(chei => Promise.all(chei
    .filter(r => new URL(r.url).searchParams.get('v') !== versiune)
    .map(r => c.delete(r))));
}

self.addEventListener('install', e => {
  // cache: 'reload' ocolește cache-ul HTTP al browserului (GitHub Pages ține fișierele 10 minute),
  // ca să nu salvăm o foaie de stil veche lângă o pagină nouă.
  e.waitUntil(caches.open(CACHE).then(c =>
    c.addAll([...FISIERE_FIXE, ...FISIERE_VERSIONATE].map(u => new Request(u, { cache: 'reload' }))))
    .then(() => salveazaMiniaturi()));
  // Fără skipWaiting aici: pagina decide când se activează versiunea nouă (vezi mai sus).
});

self.addEventListener('message', e => {
  if (e.data && e.data.tip === 'activeaza') self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(chei => Promise.all(
      chei.filter(c => c !== CACHE && c !== CACHE_FOTO && c !== CACHE_ILUSTRATII).map(c => caches.delete(c))
    )).then(() => self.clients.claim())
  );
});

function cuLimita(promisiune, ms) {
  return new Promise((rezolva, respinge) => {
    const t = setTimeout(() => respinge(new Error('timeout')), ms);
    promisiune.then(r => { clearTimeout(t); rezolva(r); }, err => { clearTimeout(t); respinge(err); });
  });
}

// Întâi cache-ul dat; dacă lipsește, rețeaua, iar răspunsul bun se pune în cache.
// oriceCache: caută adresa în toate cache-urile (o pagină nouă, salvată în fundal, poate cere fișiere pe care le are
// deja SW-ul nou, instalat și în așteptare, în cache-ul lui).
function intaiCache(cerere, numeCache, limitaMs = 0, oriceCache = false) {
  return caches.open(numeCache).then(c => (oriceCache ? caches.match(cerere.url) : c.match(cerere.url)).then(r => {
    if (r) return r;
    const retea = fetch(cerere.url, { credentials: 'same-origin' }).then(raspuns => {
      if (raspuns && raspuns.ok) c.put(cerere.url, raspuns.clone()).catch(() => {});
      return raspuns;
    });
    return limitaMs ? cuLimita(retea, limitaMs) : retea;
  }));
}

// Pagina: copia din cache imediat; în fundal se cere cea nouă (no-cache = verifică la server) și se salvează.
function pagina(e) {
  const actualizare = fetch('./index.html', { cache: 'no-cache', credentials: 'same-origin' }).then(raspuns => {
    if (raspuns && raspuns.ok) caches.open(CACHE).then(c => c.put('./index.html', raspuns.clone())).catch(() => {});
    return raspuns;
  });
  e.waitUntil(actualizare.catch(() => {}));
  return caches.match('./index.html', { cacheName: CACHE })
    .then(r => r || caches.match('./index.html'))
    .then(r => r || cuLimita(actualizare, LIMITA_RETEA_MS * 3));
}

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return; // Supabase, Gemini, USDA, Open Food Facts: direct, fără cache
  const versionat = url.searchParams.has('v');
  if (url.pathname.includes('/foto-retete/') && versionat) {
    e.respondWith(intaiCache(e.request, CACHE_FOTO, LIMITA_RETEA_MS * 3).catch(() => Response.error()));
    return;
  }
  if (url.pathname.includes('/ilustratii/') && url.pathname.endsWith('.svg') && versionat) {
    e.respondWith(intaiCache(e.request, CACHE_ILUSTRATII).catch(() => Response.error()));
    return;
  }
  if (e.request.mode === 'navigate') {
    e.respondWith(pagina(e).catch(() => Response.error()));
    return;
  }
  if (versionat) {
    e.respondWith(intaiCache(e.request, CACHE, 0, true).catch(() => Response.error()));
    return;
  }
  // Restul (manifest, iconițe, lista.json): rețeaua, cu copia locală ca rezervă.
  e.respondWith(cuLimita(fetch(e.request.url, { cache: 'no-cache', credentials: 'same-origin' }), LIMITA_RETEA_MS)
    .then(r => { if (r && r.ok) { const copie = r.clone(); caches.open(CACHE).then(c => c.put(e.request.url, copie)).catch(() => {}); } return r; })
    .catch(() => caches.match(e.request.url).then(r => r || Response.error())));
});

// Notificarea odihnei: butonul „Serie făcută” bifează seria următoare; un tap pe notificare deschide aplicația.
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(lista => {
    const client = lista[0];
    if (e.action === 'serie' && client) { client.postMessage({ tip: 'serie-facuta' }); return; }
    if (client) return client.focus();
    return self.clients.openWindow('./');
  }));
});
