// Stocare locală cu IndexedDB. Datele rămân în browser, pe telefon.
// Stores:
//   sesiuni      — sesiunile salvate (id automat)
//   exercitii    — biblioteca de exerciții, cheie: numele
//   masuratori   — măsurători corporale (id automat)
//   ciorna       — sesiunea în curs, ca să nu o pierzi la reîncărcare
//   rutine       — rutinele salvate de tine (id automat)
//   instantanee  — (v4) copii automate ale datelor, făcute înainte de restaurare și săptămânal
//   meta         — (v4) informații interne (ex. data ultimei copii automate)
//   poze         — (v5) poze de progres { id, data, unghi, imagine (Blob JPEG), latime, inaltime, creat }
//   cos          — (v6) „Șterse recent": { id, tip (store-ul de origine), inregistrare, sters (ms), eticheta }
//                  păstrate 30 de zile; nu intră în backup.
//   alimente     — (v7) alimentele tale (nutriție), cheie: id text „u-…”
//   retete       — (v7) rețetele tale, cheie: id text „u-…”
//   pozeRetete   — (v7) poza ta pentru o rețetă (din bibliotecă sau proprie): { id (= id-ul rețetei), imagine Blob, latime, inaltime, creat }
//   zileNutritie — (v8) mesele unei zile, cheie: data 'AAAA-LL-ZZ' (vezi nutritie-zi.js)
//   planuriNutritie — (v9) planurile de mese salvate, cheie: id text „u-…” (vezi nutritie-zi.js)
//   listeCumparaturi — (v10) ce ai făcut pe o listă de cumpărături (bifat, scos, cantități, articole proprii), cheie: 'de_pana'
//
// Regula de compatibilitate: înregistrările vechi nu se rescriu niciodată la actualizare.
// Câmpurile noi sunt opționale și primesc valori implicite la citire.

const DB_NUME = 'jurnal-antrenament';
const DB_VERSIUNE = 12;
const STORES_DATE = ['sesiuni', 'exercitii', 'masuratori', 'rutine', 'alimente', 'retete', 'zileNutritie', 'planuriNutritie', 'listeCumparaturi'];
const MAX_INSTANTANEE = 5;

let bazaPromise = null;

function deschideBaza() {
  return new Promise((rezolva, respinge) => {
    const cerere = indexedDB.open(DB_NUME, DB_VERSIUNE);
    // Actualizarea doar adaugă stores lipsă; nu modifică și nu șterge nimic existent.
    cerere.onupgradeneeded = () => {
      const bd = cerere.result;
      const creeaza = (nume, optiuni) => {
        if (!bd.objectStoreNames.contains(nume)) bd.createObjectStore(nume, optiuni);
      };
      creeaza('sesiuni', { keyPath: 'id', autoIncrement: true });
      creeaza('exercitii', { keyPath: 'nume' });
      creeaza('ciorna');
      creeaza('masuratori', { keyPath: 'id', autoIncrement: true });
      creeaza('rutine', { keyPath: 'id', autoIncrement: true });
      creeaza('instantanee', { keyPath: 'id', autoIncrement: true });
      creeaza('meta');
      creeaza('poze', { keyPath: 'id', autoIncrement: true });
      creeaza('cos', { keyPath: 'id', autoIncrement: true });
      creeaza('alimente', { keyPath: 'id' });
      creeaza('retete', { keyPath: 'id' });
      creeaza('pozeRetete', { keyPath: 'id' });
      creeaza('zileNutritie', { keyPath: 'data' });
      creeaza('planuriNutritie', { keyPath: 'id' });
      creeaza('listeCumparaturi', { keyPath: 'id' });
      // v11 (Gym App 3.0, Faza 2): sincronizarea cu contul. „sincron” = harta ultimei sincronizări
      // (amprentă + versiune din cloud pentru fiecare înregistrare), „conflicte” = ce așteaptă alegerea ta.
      creeaza('sincron', { keyPath: 'k' });
      creeaza('conflicte', { keyPath: 'k' });
      // v12: istoricul meselor fotografiate (doar pe acest telefon: nu se sincronizează și nu intră în backup).
      creeaza('scanari', { keyPath: 'id' });
      // Înregistrările cu cheie numerică locală primesc un id comun tuturor dispozitivelor („uid”).
      for (const nume of ['sesiuni', 'masuratori', 'rutine', 'poze']) {
        const st = cerere.transaction.objectStore(nume);
        if (!st.indexNames.contains('uid')) st.createIndex('uid', 'uid', { unique: false });
      }
    };
    cerere.onsuccess = () => {
      const bd = cerere.result;
      urmaresteScrierile(bd);
      // Dacă aplicația e deschisă și în alt tab cu o versiune mai nouă, închidem conexiunea veche.
      bd.onversionchange = () => { bd.close(); bazaPromise = null; };
      rezolva(bd);
    };
    cerere.onerror = () => { bazaPromise = null; respinge(cerere.error); };
    cerere.onblocked = () => console.warn('Actualizarea bazei de date așteaptă închiderea altui tab.');
  });
}

// Orice scriere terminată într-un store sincronizat anunță sincronizarea (cloud.js), care o trimite
// după câteva secunde, dacă ești conectat la cont. Scrierile făcute chiar de sincronizare sunt marcate și nu contează.
const STORES_SINCRONIZATE = new Set(['sesiuni', 'masuratori', 'rutine', 'poze', 'exercitii', 'alimente', 'retete', 'pozeRetete', 'zileNutritie', 'planuriNutritie', 'listeCumparaturi']);
function urmaresteScrierile(bd) {
  const original = bd.transaction.bind(bd);
  bd.transaction = (stores, mod, ...rest) => {
    const t = original(stores, mod, ...rest);
    if (mod === 'readwrite' && [].concat(stores).some(s => STORES_SINCRONIZATE.has(s))) {
      t.addEventListener('complete', () => {
        if (!t.__dinSincron && typeof semnaleazaModificare === 'function') semnaleazaModificare();
      });
    }
    return t;
  };
}

function baza() {
  if (!bazaPromise) bazaPromise = deschideBaza();
  return bazaPromise;
}

// Rulează o operație pe un store și întoarce rezultatul când tranzacția s-a terminat.
async function cere(numeStore, mod, operatie) {
  const bd = await baza();
  return new Promise((rezolva, respinge) => {
    const tranzactie = bd.transaction(numeStore, mod);
    const cerere = operatie(tranzactie.objectStore(numeStore));
    tranzactie.oncomplete = () => rezolva(cerere ? cerere.result : undefined);
    tranzactie.onerror = () => respinge(tranzactie.error);
    tranzactie.onabort = () => respinge(tranzactie.error);
  });
}

// ----- Sesiuni -----
function salveazaSesiune(sesiune) {
  return cere('sesiuni', 'readwrite', st => st.add(sesiune));
}

// O înregistrare stricată (de ex. dintr-un backup vechi) nu trebuie să blocheze aplicația:
// o sărim la afișare, dar nu o ștergem, ca să poată fi recuperată.
function sesiuneLizibila(s) {
  return s && typeof s.data === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s.data) && Array.isArray(s.exercitii);
}

// Sesiunile în ordine cronologică. Sortăm după dată, apoi după id,
// ca o sesiune corectată sau restaurată să rămână la locul ei.
async function toateSesiunile() {
  const lista = await cere('sesiuni', 'readonly', st => st.getAll());
  const bune = lista.filter(sesiuneLizibila);
  if (bune.length !== lista.length) {
    console.warn(`${lista.length - bune.length} sesiuni ilizibile au fost ignorate la afișare.`);
  }
  for (const s of bune) {
    s.exercitii = s.exercitii.filter(ex => ex && typeof ex.nume === 'string' && Array.isArray(ex.serii));
  }
  return bune.sort((a, b) => a.data.localeCompare(b.data) || a.id - b.id);
}

function actualizeazaSesiune(sesiune) {
  return cere('sesiuni', 'readwrite', st => st.put(sesiune));
}

// Ștergerea nu e definitivă: înregistrarea se mută în „Șterse recent" (store-ul cos), în aceeași tranzacție.
function stergeSesiune(id, eticheta) {
  return mutaInCos('sesiuni', id, eticheta);
}

// ----- Șterse recent (v6) -----
const STORES_CU_COS = ['sesiuni', 'masuratori', 'poze', 'rutine', 'alimente', 'retete', 'pozeRetete', 'planuriNutritie'];
// Stores cu cheie text (fără numerotare automată): la restaurare, un id ocupat primește un sufix.
const STORES_CHEIE_TEXT = ['alimente', 'retete', 'pozeRetete', 'planuriNutritie'];
const ZILE_IN_COS = 30;

// Mută o înregistrare în coș. Întoarce id-ul din coș (pentru „Anulează"), sau null dacă nu exista.
async function mutaInCos(numeStore, id, eticheta = '') {
  const bd = await baza();
  return new Promise((rezolva, respinge) => {
    const tranzactie = bd.transaction([numeStore, 'cos'], 'readwrite');
    const st = tranzactie.objectStore(numeStore);
    let idCos = null;
    const citire = st.get(id);
    citire.onsuccess = () => {
      const inregistrare = citire.result;
      if (!inregistrare) return;
      const adaugare = tranzactie.objectStore('cos').add({ tip: numeStore, inregistrare, sters: Date.now(), eticheta });
      adaugare.onsuccess = () => { idCos = adaugare.result; };
      st.delete(id);
    };
    tranzactie.oncomplete = () => rezolva(idCos);
    tranzactie.onerror = () => respinge(tranzactie.error);
    tranzactie.onabort = () => respinge(tranzactie.error);
  });
}

// Pune înregistrarea înapoi. Dacă între timp id-ul ei e ocupat (de ex. după o restaurare), primește un id nou.
async function restaureazaDinCos(idCos) {
  const bd = await baza();
  return new Promise((rezolva, respinge) => {
    let element = null;
    const tranzactie = bd.transaction([...STORES_CU_COS, 'cos'], 'readwrite');
    const cos = tranzactie.objectStore('cos');
    const citire = cos.get(idCos);
    citire.onsuccess = () => {
      element = citire.result;
      if (!element || !STORES_CU_COS.includes(element.tip)) { element = null; return; }
      const st = tranzactie.objectStore(element.tip);
      const rec = { ...element.inregistrare };
      const ocupat = st.get(rec.id);
      ocupat.onsuccess = () => {
        if (ocupat.result) {
          if (STORES_CHEIE_TEXT.includes(element.tip)) rec.id = `${rec.id}-${Date.now().toString(36)}`;
          else delete rec.id;
        }
        st.add(rec);
        cos.delete(idCos);
      };
    };
    tranzactie.oncomplete = () => rezolva(element);
    tranzactie.onerror = () => respinge(tranzactie.error);
    tranzactie.onabort = () => respinge(tranzactie.error);
  });
}

async function toateDinCos() {
  const lista = await cere('cos', 'readonly', st => st.getAll());
  return lista.filter(x => x && STORES_CU_COS.includes(x.tip) && x.inregistrare).sort((a, b) => b.sters - a.sters);
}

function stergeDinCos(idCos) {
  return cere('cos', 'readwrite', st => st.delete(idCos)).then(() => curataPozeReteteOrfane());
}

// Poza unei rețete proprii șterse definitiv nu mai are cui să aparțină: o ștergem și pe ea.
// (O rețetă din coș își păstrează poza, ca la restaurare să fie ca înainte.)
async function curataPozeReteteOrfane() {
  const [poze, retete, cos] = await Promise.all([
    cere('pozeRetete', 'readonly', st => st.getAllKeys()),
    cere('retete', 'readonly', st => st.getAllKeys()),
    cere('cos', 'readonly', st => st.getAll()),
  ]);
  const vii = new Set(retete);
  for (const x of cos) if (x && x.tip === 'retete' && x.inregistrare) vii.add(x.inregistrare.id);
  const orfane = poze.filter(id => String(id).startsWith('u-') && !vii.has(id));
  if (orfane.length) await cere('pozeRetete', 'readwrite', st => { for (const id of orfane) st.delete(id); });
  return orfane.length;
}

// Șterge definitiv ce a stat în coș mai mult de ZILE_IN_COS zile. Întoarce câte au fost șterse.
async function golesteCosulVechi(acum = Date.now()) {
  const lista = await cere('cos', 'readonly', st => st.getAll());
  const vechi = lista.filter(x => !x || !(x.sters > acum - ZILE_IN_COS * 86400000));
  if (vechi.length) {
    await cere('cos', 'readwrite', st => { for (const x of vechi) st.delete(x.id); });
    await curataPozeReteteOrfane();
  }
  return vechi.length;
}

// Numărul de înregistrări din fiecare store și câte dintre ele se pot afișa (verificarea datelor).
async function diagnosticBaza() {
  const brut = {};
  for (const nume of [...STORES_DATE, 'poze', 'pozeRetete', 'cos']) brut[nume] = await cere(nume, 'readonly', st => st.getAll());
  const [sesiuni, masuratori, rutine, poze, alimente, retete, pozeRetete, zileNutritie, planuriNutritie, listeCumparaturi] = await Promise.all([toateSesiunile(), toateMasuratorile(),
    toateRutinele(), toatePozele(), toateAlimenteleMele(), toateReteteleMele(), toatePozeleRetetelor(), toateZileleNutritie(), toatePlanurileNutritie(), cere('listeCumparaturi', 'readonly', st => st.getAll()).then(l => l.map(curataListaCumparaturi).filter(Boolean))]);
  const lizibile = { sesiuni: sesiuni.length, masuratori: masuratori.length, rutine: rutine.length, poze: poze.length,
    exercitii: brut.exercitii.filter(e => e && typeof e.nume === 'string').length, cos: brut.cos.length,
    alimente: alimente.length, retete: retete.length, pozeRetete: pozeRetete.length, zileNutritie: zileNutritie.length, planuriNutritie: planuriNutritie.length,
    listeCumparaturi: listeCumparaturi.length };
  return Object.fromEntries(Object.keys(brut).map(k => [k, { total: brut[k].length, lizibile: lizibile[k] }]));
}

// ----- Biblioteca de exerciții -----
// Adaugă exercițiul și, dacă e dată, îi setează grupa. Grupa existentă se păstrează.
async function adaugaInBiblioteca(nume, grupa) {
  const bd = await baza();
  return new Promise((rezolva, respinge) => {
    const tranzactie = bd.transaction('exercitii', 'readwrite');
    const st = tranzactie.objectStore('exercitii');
    const citire = st.get(nume);
    citire.onsuccess = () => {
      const existent = citire.result || { nume };
      st.put({ ...existent, nume, grupa: grupa || existent.grupa || null });
    };
    tranzactie.oncomplete = () => rezolva();
    tranzactie.onerror = () => respinge(tranzactie.error);
    tranzactie.onabort = () => respinge(tranzactie.error);
  });
}

// Modifică un exercițiu din biblioteca proprie (ex. { tip: 'timp' }), creându-l dacă lipsește.
async function seteazaInBiblioteca(nume, modificari) {
  const bd = await baza();
  return new Promise((rezolva, respinge) => {
    const tranzactie = bd.transaction('exercitii', 'readwrite');
    const st = tranzactie.objectStore('exercitii');
    const citire = st.get(nume);
    citire.onsuccess = () => {
      const existent = citire.result || { nume, grupa: null };
      st.put({ ...existent, ...modificari, nume });
    };
    tranzactie.oncomplete = () => rezolva();
    tranzactie.onerror = () => respinge(tranzactie.error);
    tranzactie.onabort = () => respinge(tranzactie.error);
  });
}

// Înlocuiește complet înregistrarea unui exercițiu din biblioteca ta.
function scrieInBiblioteca(inregistrare) {
  return cere('exercitii', 'readwrite', st => st.put(inregistrare));
}

// Șterge exercițiul din biblioteca ta, inclusiv înregistrările cu același nume scris cu alte litere.
async function stergeDinBiblioteca(nume) {
  const bd = await baza();
  const cheie = nume.toLowerCase();
  return new Promise((rezolva, respinge) => {
    const tranzactie = bd.transaction('exercitii', 'readwrite');
    tranzactie.objectStore('exercitii').openCursor().onsuccess = e => {
      const c = e.target.result;
      if (!c) return;
      if (String(c.key).toLowerCase() === cheie) c.delete();
      c.continue();
    };
    tranzactie.oncomplete = () => rezolva();
    tranzactie.onerror = () => respinge(tranzactie.error);
    tranzactie.onabort = () => respinge(tranzactie.error);
  });
}

// Redenumește un exercițiu propriu peste tot: în bibliotecă, în istoric și în rutine, într-o singură tranzacție.
// Dacă ceva eșuează, nu se schimbă nimic. inregistrareNoua: noua înregistrare din bibliotecă (cu numele nou).
// Întoarce numărul de sesiuni și rutine modificate.
async function redenumesteExercitiu(numeVechi, inregistrareNoua) {
  const bd = await baza();
  const vechi = numeVechi.toLowerCase();
  const nou = inregistrareNoua.nume;
  return new Promise((rezolva, respinge) => {
    const tranzactie = bd.transaction(['exercitii', 'sesiuni', 'rutine'], 'readwrite');
    const rezultat = { sesiuni: 0, rutine: 0 };
    // Toate înregistrările vechi (și cele scrise cu alte litere) se șterg, apoi se scrie cea nouă.
    const lib = tranzactie.objectStore('exercitii');
    lib.openCursor().onsuccess = e => {
      const c = e.target.result;
      if (!c) { lib.put(inregistrareNoua); return; }
      if (String(c.key).toLowerCase() === vechi) c.delete();
      c.continue();
    };
    const ses = tranzactie.objectStore('sesiuni');
    ses.openCursor().onsuccess = e => {
      const c = e.target.result;
      if (!c) return;
      const s = c.value;
      if (s && Array.isArray(s.exercitii) && s.exercitii.some(x => x && typeof x.nume === 'string' && x.nume.toLowerCase() === vechi)) {
        s.exercitii = s.exercitii.map(x => (x && typeof x.nume === 'string' && x.nume.toLowerCase() === vechi ? { ...x, nume: nou } : x));
        c.update(s);
        rezultat.sesiuni++;
      }
      c.continue();
    };
    const rut = tranzactie.objectStore('rutine');
    rut.openCursor().onsuccess = e => {
      const c = e.target.result;
      if (!c) return;
      const r = c.value;
      if (r && Array.isArray(r.exercitii) && r.exercitii.some(x => typeof x === 'string' && x.toLowerCase() === vechi)) {
        r.exercitii = r.exercitii.map(x => (typeof x === 'string' && x.toLowerCase() === vechi ? nou : x));
        c.update(r);
        rezultat.rutine++;
      }
      c.continue();
    };
    tranzactie.oncomplete = () => rezolva(rezultat);
    tranzactie.onerror = () => respinge(tranzactie.error);
    tranzactie.onabort = () => respinge(tranzactie.error);
  });
}

async function bibliotecaExercitii() {
  const lista = await cere('exercitii', 'readonly', st => st.getAll());
  return lista.filter(e => e && typeof e.nume === 'string');
}

// ----- Rutine -----
function salveazaRutina(rutina) {
  return cere('rutine', 'readwrite', st => st.add(rutina));
}

async function toateRutinele() {
  const lista = await cere('rutine', 'readonly', st => st.getAll());
  return lista.filter(r => r && typeof r.nume === 'string' && Array.isArray(r.exercitii));
}

function stergeRutina(id, eticheta) {
  return mutaInCos('rutine', id, eticheta);
}

// ----- Măsurători -----
function salveazaMasuratoare(m) {
  return cere('masuratori', 'readwrite', st => st.add(m));
}

async function toateMasuratorile() {
  const lista = await cere('masuratori', 'readonly', st => st.getAll());
  return lista.filter(m => m && typeof m.data === 'string' && typeof m.tip === 'string' && Number.isFinite(m.valoare));
}

// Corectarea unei înregistrări (valoare sau dată); păstrează celelalte câmpuri.
function actualizeazaMasuratoare(m) {
  return cere('masuratori', 'readwrite', st => st.put(m));
}

// ----- Poze de progres (v5) -----
function salveazaPoza(p) {
  return cere('poze', 'readwrite', st => st.add(p));
}

// Pozele lizibile (cu dată și imagine), fără să le ștergem pe celelalte.
async function toatePozele() {
  const lista = await cere('poze', 'readonly', st => st.getAll());
  return lista.filter(p => p && typeof p.data === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p.data) && p.imagine instanceof Blob);
}

function stergePoza(id, eticheta) {
  return mutaInCos('poze', id, eticheta);
}

function stergeMasuratoare(id, eticheta) {
  return mutaInCos('masuratori', id, eticheta);
}

// ----- Ciornă -----
// ----- Nutriție (v7) -----
// Înregistrările care nu trec validarea (ex. scrise de o versiune viitoare, stricate) nu se afișează,
// dar rămân în bază și în backup (regula 3).
function salveazaAlimentMeu(a) {
  return cere('alimente', 'readwrite', st => st.put(a));
}
async function toateAlimenteleMele() {
  const lista = await cere('alimente', 'readonly', st => st.getAll());
  return lista.map(curataAliment).filter(Boolean);
}
function stergeAlimentMeu(id, eticheta) {
  return mutaInCos('alimente', id, eticheta);
}
function salveazaRetetaMea(r) {
  return cere('retete', 'readwrite', st => st.put(r));
}
async function toateReteteleMele() {
  const lista = await cere('retete', 'readonly', st => st.getAll());
  return lista.map(curataReteta).filter(Boolean);
}
function stergeRetetaMea(id, eticheta) {
  return mutaInCos('retete', id, eticheta);
}
// ----- Ziua de nutriție (v8) -----
async function citesteZiNutritie(data) {
  const z = await cere('zileNutritie', 'readonly', st => st.get(data));
  const zi = (z && curataZiNutritie(z)) || { data, mese: [] };
  // Cafeaua zilnică (Faza 4) apare în orice zi de la data ei de început; se scrie în bază când salvezi ziua
  // (sau, pentru zilele de până azi, la completarea istoricului din cafea-ui.js).
  if (typeof aplicaCafeleZilnice === 'function' && setari.cafeleZilnice && setari.cafeleZilnice.length) {
    return aplicaCafeleZilnice(zi, setari.cafeleZilnice).zi;
  }
  return zi;
}
// Ziua exact cum e salvată (fără cafeaua zilnică adăugată în memorie).
async function citesteZiNutritieSalvata(data) {
  const z = await cere('zileNutritie', 'readonly', st => st.get(data));
  return (z && curataZiNutritie(z)) || null;
}
function salveazaZiNutritie(zi) {
  return cere('zileNutritie', 'readwrite', st => st.put({ ...zi, modificat: Date.now() }));
}
async function toateZileleNutritie() {
  const lista = await cere('zileNutritie', 'readonly', st => st.getAll());
  return lista.map(curataZiNutritie).filter(Boolean);
}

// ----- Listele de cumpărături (v10) -----
async function citesteListaCumparaturi(de, pana) {
  const l = await cere('listeCumparaturi', 'readonly', st => st.get(`${de}_${pana}`));
  return (l && curataListaCumparaturi(l)) || stareListaGoala(de, pana);
}
function salveazaListaCumparaturi(l) {
  return cere('listeCumparaturi', 'readwrite', st => st.put({ ...l, modificat: Date.now() }));
}

// ----- Planurile de mese salvate (v9) -----
async function toatePlanurileNutritie() {
  const lista = await cere('planuriNutritie', 'readonly', st => st.getAll());
  return lista.map(curataPlanNutritie).filter(Boolean);
}
function salveazaPlanNutritie(p) {
  return cere('planuriNutritie', 'readwrite', st => st.put(p));
}
function stergePlanNutritie(id, eticheta) {
  return mutaInCos('planuriNutritie', id, eticheta);
}

function salveazaPozaReteta(p) {
  return cere('pozeRetete', 'readwrite', st => st.put(p));
}
async function toatePozeleRetetelor() {
  const lista = await cere('pozeRetete', 'readonly', st => st.getAll());
  return lista.filter(p => p && typeof p.id === 'string' && p.imagine instanceof Blob);
}
function stergePozaReteta(id, eticheta) {
  return mutaInCos('pozeRetete', id, eticheta);
}
function exportaPozeRetete() {
  return cere('pozeRetete', 'readonly', st => st.getAll());
}

function salveazaCiorna(date) {
  return cere('ciorna', 'readwrite', st => st.put(date, 'curenta'));
}

function citesteCiorna() {
  return cere('ciorna', 'readonly', st => st.get('curenta'));
}

function stergeCiorna() {
  return cere('ciorna', 'readwrite', st => st.delete('curenta'));
}

// ----- Meta -----
function citesteMeta(cheie) {
  return cere('meta', 'readonly', st => st.get(cheie));
}

function scrieMeta(cheie, valoare) {
  return cere('meta', 'readwrite', st => st.put(valoare, cheie));
}

// ----- Backup -----
// Datele brute din stores (fără setări). Setările se adaugă în backup.js.
// Citim direct, nu prin funcțiile filtrate de mai sus, ca backupul să conțină tot ce e în bază.
async function exportaDate() {
  const [sesiuni, exercitii, masuratori, rutine, alimente, retete, zileNutritie, planuriNutritie, listeCumparaturi] = await Promise.all(
    STORES_DATE.map(nume => cere(nume, 'readonly', st => st.getAll())));
  return { sesiuni, exercitii, masuratori, rutine, alimente, retete, zileNutritie, planuriNutritie, listeCumparaturi };
}

// Pozele, așa cum sunt în bază (cu imaginea ca Blob); backup.js le transformă în text pentru fișier.
function exportaPoze() {
  return cere('poze', 'readonly', st => st.getAll());
}

// Înlocuiește conținutul stores-urilor de date, într-o singură tranzacție.
// Dacă ceva eșuează, nimic nu se schimbă. Un backup fără rutine nu șterge rutinele existente;
// la fel, un backup fără poze (date.poze lipsă) nu atinge pozele, iar unul fără nutriție
// (alimente, retete, pozeRetete lipsă — ex. făcut înainte de modulul de nutriție) nu atinge nutriția.
async function inlocuiesteToate(date) {
  const bd = await baza();
  const stores = [...STORES_DATE];
  if (Array.isArray(date.poze)) stores.push('poze');
  if (Array.isArray(date.pozeRetete)) stores.push('pozeRetete');
  return new Promise((rezolva, respinge) => {
    const tranzactie = bd.transaction(stores, 'readwrite');
    for (const nume of stores) {
      if (!Array.isArray(date[nume])) continue;
      const st = tranzactie.objectStore(nume);
      st.clear();
      for (const item of date[nume]) st.put(item);
    }
    tranzactie.oncomplete = () => rezolva();
    tranzactie.onerror = () => respinge(tranzactie.error);
    tranzactie.onabort = () => respinge(tranzactie.error);
  });
}

// ----- Copii automate (instantanee) -----
// continut: obiectul complet de backup. Păstrăm doar ultimele MAX_INSTANTANEE.
async function salveazaInstantaneu(motiv, continut) {
  const bd = await baza();
  return new Promise((rezolva, respinge) => {
    const tranzactie = bd.transaction('instantanee', 'readwrite');
    const st = tranzactie.objectStore('instantanee');
    st.add({ creat: Date.now(), motiv, continut });
    const chei = st.getAllKeys();
    chei.onsuccess = () => {
      const toate = chei.result.sort((a, b) => a - b);
      for (const id of toate.slice(0, Math.max(0, toate.length - MAX_INSTANTANEE))) st.delete(id);
    };
    tranzactie.oncomplete = () => rezolva();
    tranzactie.onerror = () => respinge(tranzactie.error);
    tranzactie.onabort = () => respinge(tranzactie.error);
  });
}

async function toateInstantaneele() {
  const lista = await cere('instantanee', 'readonly', st => st.getAll());
  return lista.sort((a, b) => b.creat - a.creat);
}

function citesteInstantaneu(id) {
  return cere('instantanee', 'readonly', st => st.get(id));
}

// ----- Istoricul scanărilor (v12) -----
// { id, creat, data, ora, masa, nume, idIntrare, articole (copia), total, poza (Blob JPEG mic) | null, tokeni }
function salveazaScanareIstoric(s) { return cere('scanari', 'readwrite', st => st.put(s)); }
async function toateScanarileIstoric() {
  const l = await cere('scanari', 'readonly', st => st.getAll());
  return l.map(curataInregistrareScanare).filter(Boolean).sort((a, b) => b.creat - a.creat);
}
function stergeScanareIstoric(id) { return cere('scanari', 'readwrite', st => st.delete(id)); }
// Scoate pozele (dar păstrează valorile) din scanările mai vechi decât „inainte” (ms); Infinity = toate.
async function stergePozeScanariIstoric(inainte = Infinity) {
  const l = await cere('scanari', 'readonly', st => st.getAll());
  let n = 0;
  for (const x of l) if (x && x.poza && x.creat < inainte) { await cere('scanari', 'readwrite', st => st.put({ ...x, poza: null })); n++; }
  return n;
}

// ----- Ștergerea tuturor datelor -----
async function stergeToateDatele() {
  const bd = await baza();
  const toate = [...STORES_DATE, 'ciorna', 'instantanee', 'meta', 'poze', 'pozeRetete', 'cos', 'sincron', 'conflicte', 'scanari'];
  return new Promise((rezolva, respinge) => {
    const tranzactie = bd.transaction(toate, 'readwrite');
    tranzactie.__dinSincron = true; // ștergerea de pe telefon nu se trimite în cont
    for (const nume of toate) tranzactie.objectStore(nume).clear();
    tranzactie.oncomplete = () => rezolva();
    tranzactie.onerror = () => respinge(tranzactie.error);
    tranzactie.onabort = () => respinge(tranzactie.error);
  });
}
