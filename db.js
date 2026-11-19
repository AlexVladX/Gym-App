// Stocare locală cu IndexedDB. Datele rămân în browser, pe telefon.
// Stores:
//   sesiuni      — sesiunile salvate (id automat)
//   exercitii    — biblioteca de exerciții, cheie: numele
//   masuratori   — măsurători corporale (id automat)
//   ciorna       — sesiunea în curs, ca să nu o pierzi la reîncărcare
//   rutine       — rutinele salvate de tine (id automat)
//   instantanee  — (v4) copii automate ale datelor, făcute înainte de restaurare și săptămânal
//   meta         — (v4) informații interne (ex. data ultimei copii automate)
//
// Regula de compatibilitate: înregistrările vechi nu se rescriu niciodată la actualizare.
// Câmpurile noi sunt opționale și primesc valori implicite la citire.

const DB_NUME = 'jurnal-antrenament';
const DB_VERSIUNE = 4;
const STORES_DATE = ['sesiuni', 'exercitii', 'masuratori', 'rutine'];
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
    };
    cerere.onsuccess = () => {
      const bd = cerere.result;
      // Dacă aplicația e deschisă și în alt tab cu o versiune mai nouă, închidem conexiunea veche.
      bd.onversionchange = () => { bd.close(); bazaPromise = null; };
      rezolva(bd);
    };
    cerere.onerror = () => { bazaPromise = null; respinge(cerere.error); };
    cerere.onblocked = () => console.warn('Actualizarea bazei de date așteaptă închiderea altui tab.');
  });
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

function stergeSesiune(id) {
  return cere('sesiuni', 'readwrite', st => st.delete(id));
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

function stergeRutina(id) {
  return cere('rutine', 'readwrite', st => st.delete(id));
}

// ----- Măsurători -----
function salveazaMasuratoare(m) {
  return cere('masuratori', 'readwrite', st => st.add(m));
}

async function toateMasuratorile() {
  const lista = await cere('masuratori', 'readonly', st => st.getAll());
  return lista.filter(m => m && typeof m.data === 'string' && typeof m.tip === 'string' && Number.isFinite(m.valoare));
}

function stergeMasuratoare(id) {
  return cere('masuratori', 'readwrite', st => st.delete(id));
}

// ----- Ciornă -----
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
  const [sesiuni, exercitii, masuratori, rutine] = await Promise.all(
    STORES_DATE.map(nume => cere(nume, 'readonly', st => st.getAll())));
  return { sesiuni, exercitii, masuratori, rutine };
}

// Înlocuiește conținutul stores-urilor de date, într-o singură tranzacție.
// Dacă ceva eșuează, nimic nu se schimbă. Un backup fără rutine nu șterge rutinele existente.
async function inlocuiesteToate(date) {
  const bd = await baza();
  return new Promise((rezolva, respinge) => {
    const tranzactie = bd.transaction(STORES_DATE, 'readwrite');
    for (const nume of STORES_DATE) {
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

// ----- Ștergerea tuturor datelor -----
async function stergeToateDatele() {
  const bd = await baza();
  const toate = [...STORES_DATE, 'ciorna', 'instantanee', 'meta'];
  return new Promise((rezolva, respinge) => {
    const tranzactie = bd.transaction(toate, 'readwrite');
    for (const nume of toate) tranzactie.objectStore(nume).clear();
    tranzactie.oncomplete = () => rezolva();
    tranzactie.onerror = () => respinge(tranzactie.error);
    tranzactie.onabort = () => respinge(tranzactie.error);
  });
}
