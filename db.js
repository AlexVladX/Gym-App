// Stocare locală cu IndexedDB. Datele rămân în browser, pe telefon.
// Stores:
//   sesiuni     — sesiunile salvate (id automat)
//   exercitii   — biblioteca de exerciții, cheie: numele
//   masuratori  — măsurători corporale (id automat)
//   ciorna      — sesiunea în curs, ca să nu o pierzi la reîncărcare
//   rutine      — rutinele salvate de tine (id automat)

const DB_NUME = 'jurnal-antrenament';
const DB_VERSIUNE = 3;
const STORES_DATE = ['sesiuni', 'exercitii', 'masuratori', 'rutine'];

let bazaPromise = null;

function deschideBaza() {
  return new Promise((rezolva, respinge) => {
    const cerere = indexedDB.open(DB_NUME, DB_VERSIUNE);
    cerere.onupgradeneeded = () => {
      const bd = cerere.result;
      if (!bd.objectStoreNames.contains('sesiuni')) {
        bd.createObjectStore('sesiuni', { keyPath: 'id', autoIncrement: true });
      }
      if (!bd.objectStoreNames.contains('exercitii')) {
        bd.createObjectStore('exercitii', { keyPath: 'nume' });
      }
      if (!bd.objectStoreNames.contains('ciorna')) {
        bd.createObjectStore('ciorna');
      }
      if (!bd.objectStoreNames.contains('masuratori')) {
        bd.createObjectStore('masuratori', { keyPath: 'id', autoIncrement: true });
      }
      if (!bd.objectStoreNames.contains('rutine')) {
        bd.createObjectStore('rutine', { keyPath: 'id', autoIncrement: true });
      }
    };
    cerere.onsuccess = () => rezolva(cerere.result);
    cerere.onerror = () => respinge(cerere.error);
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

// Sesiunile în ordine cronologică. Sortăm după dată, apoi după id,
// ca o sesiune corectată sau restaurată să rămână la locul ei.
async function toateSesiunile() {
  const lista = await cere('sesiuni', 'readonly', st => st.getAll());
  return lista.sort((a, b) => a.data.localeCompare(b.data) || a.id - b.id);
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

function bibliotecaExercitii() {
  return cere('exercitii', 'readonly', st => st.getAll());
}

// ----- Rutine -----
function salveazaRutina(rutina) {
  return cere('rutine', 'readwrite', st => st.add(rutina));
}

function toateRutinele() {
  return cere('rutine', 'readonly', st => st.getAll());
}

function stergeRutina(id) {
  return cere('rutine', 'readwrite', st => st.delete(id));
}

// ----- Măsurători -----
function salveazaMasuratoare(m) {
  return cere('masuratori', 'readwrite', st => st.add(m));
}

function toateMasuratorile() {
  return cere('masuratori', 'readonly', st => st.getAll());
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

// ----- Backup -----
async function exportaToate() {
  const [sesiuni, exercitii, masuratori, rutine] = await Promise.all([
    toateSesiunile(), bibliotecaExercitii(), toateMasuratorile(), toateRutinele(),
  ]);
  return { versiune: 2, exportat: new Date().toISOString(), sesiuni, exercitii, masuratori, rutine };
}

// Înlocuiește conținutul stores-urilor de date, într-o singură tranzacție.
// Dacă ceva eșuează, nimic nu se schimbă. Un backup vechi, fără rutine, nu șterge rutinele existente.
async function inlocuiesteToate(date) {
  const bd = await baza();
  return new Promise((rezolva, respinge) => {
    const tranzactie = bd.transaction(STORES_DATE, 'readwrite');
    for (const nume of STORES_DATE) {
      if (!Array.isArray(date[nume])) continue;
      const st = tranzactie.objectStore(nume);
      st.clear();
      for (const item of (date[nume] || [])) st.put(item);
    }
    tranzactie.oncomplete = () => rezolva();
    tranzactie.onerror = () => respinge(tranzactie.error);
    tranzactie.onabort = () => respinge(tranzactie.error);
  });
}
