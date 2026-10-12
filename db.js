// Stocare locală cu IndexedDB. Datele rămân în browser, pe telefon.
// Stores:
//   sesiuni     — sesiunile salvate (id automat)
//   exercitii   — biblioteca de exerciții, cheie: numele
//   masuratori  — măsurători corporale (id automat)
//   ciorna      — sesiunea în curs, ca să nu o pierzi la reîncărcare

const DB_NUME = 'jurnal-antrenament';
const DB_VERSIUNE = 2;
const STORES_DATE = ['sesiuni', 'exercitii', 'masuratori'];

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

// Sesiunile în ordine cronologică (id-ul crește odată cu timpul).
function toateSesiunile() {
  return cere('sesiuni', 'readonly', st => st.getAll());
}

// ----- Biblioteca de exerciții -----
function adaugaInBiblioteca(nume) {
  return cere('exercitii', 'readwrite', st => st.put({ nume }));
}

function bibliotecaExercitii() {
  return cere('exercitii', 'readonly', st => st.getAll());
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
  const [sesiuni, exercitii, masuratori] = await Promise.all([
    toateSesiunile(), bibliotecaExercitii(), toateMasuratorile(),
  ]);
  return { versiune: 1, exportat: new Date().toISOString(), sesiuni, exercitii, masuratori };
}

// Înlocuiește tot conținutul celor trei stores, într-o singură tranzacție.
// Dacă ceva eșuează, nimic nu se schimbă.
async function inlocuiesteToate(date) {
  const bd = await baza();
  return new Promise((rezolva, respinge) => {
    const tranzactie = bd.transaction(STORES_DATE, 'readwrite');
    for (const nume of STORES_DATE) {
      const st = tranzactie.objectStore(nume);
      st.clear();
      for (const item of (date[nume] || [])) st.put(item);
    }
    tranzactie.oncomplete = () => rezolva();
    tranzactie.onerror = () => respinge(tranzactie.error);
    tranzactie.onabort = () => respinge(tranzactie.error);
  });
}
