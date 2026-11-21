// Setările aplicației. Se țin în localStorage (citire sincronă la pornire)
// și se includ în backup, ca să nu se piardă la mutarea pe alt telefon.

// inaltimeCm și obiectiv (greutatea țintă) vin din ecranul Corp (etapa 6); obiectiv: { tinta, start, dela }.
const SETARI_IMPLICITE = { minRep: 8, maxRep: 12, pasKg: 2.5, ecranAprins: true, pauzaSec: 90, pauzaAutomata: true, semnal: true,
  inaltimeCm: null, obiectiv: null };
const setari = { ...SETARI_IMPLICITE };

// Corectează valorile venite din stocare sau dintr-un backup; ce nu e valid revine la implicit.
function curataSetari(sursa) {
  const rez = {};
  const intreg = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;
  if (intreg(sursa.minRep, 1, 50)) rez.minRep = sursa.minRep;
  if (intreg(sursa.maxRep, 1, 50)) rez.maxRep = sursa.maxRep;
  if (rez.minRep && rez.maxRep && rez.minRep > rez.maxRep) { delete rez.minRep; delete rez.maxRep; }
  if (typeof sursa.pasKg === 'number' && sursa.pasKg > 0 && sursa.pasKg <= 20) rez.pasKg = sursa.pasKg;
  if (typeof sursa.ecranAprins === 'boolean') rez.ecranAprins = sursa.ecranAprins;
  if (typeof sursa.pauzaAutomata === 'boolean') rez.pauzaAutomata = sursa.pauzaAutomata;
  if (typeof sursa.semnal === 'boolean') rez.semnal = sursa.semnal;
  if (intreg(sursa.pauzaSec, 10, 600)) rez.pauzaSec = sursa.pauzaSec;
  const numar = (v, min, max) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
  if (numar(sursa.inaltimeCm, 100, 250)) rez.inaltimeCm = sursa.inaltimeCm;
  const o = sursa.obiectiv;
  if (o && typeof o === 'object' && numar(o.tinta, 20, 300) && numar(o.start, 20, 300) && typeof o.dela === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o.dela)) {
    rez.obiectiv = { tinta: o.tinta, start: o.start, dela: o.dela };
  }
  return rez;
}

function citesteSetari() {
  try {
    Object.assign(setari, curataSetari(JSON.parse(localStorage.getItem('setari') || '{}')));
    // Durata pauzei era ținută separat în versiunile vechi.
    const pauzaVeche = parseInt(localStorage.getItem('pauzaSec'), 10);
    if (setari.pauzaSec === SETARI_IMPLICITE.pauzaSec && pauzaVeche >= 10 && pauzaVeche <= 600) setari.pauzaSec = pauzaVeche;
  } catch (_) { /* rămân valorile implicite */ }
}

function salveazaSetari() {
  try {
    localStorage.setItem('setari', JSON.stringify(setari));
    localStorage.setItem('pauzaSec', String(setari.pauzaSec)); // compatibil cu versiunea veche
  } catch (_) { /* stocare indisponibilă: setările rămân până la închidere */ }
}

function setariPentruBackup() {
  return { ...setari };
}

function aplicaSetariDinBackup(sursa) {
  Object.assign(setari, SETARI_IMPLICITE, curataSetari(sursa || {}));
  salveazaSetari();
  afiseazaSetari();
}

// ---------- Ecranul Setări ----------
function afiseazaSetari() {
  $('set-min-rep').value = setari.minRep;
  $('set-max-rep').value = setari.maxRep;
  $('set-pas-kg').value = setari.pasKg;
  $('set-ecran').checked = setari.ecranAprins;
  $('set-pauza').value = setari.pauzaSec;
  $('set-pauza-auto').checked = setari.pauzaAutomata;
  $('set-semnal').checked = setari.semnal;
}

function citesteCampuriSetari() {
  const minRep = parseInt($('set-min-rep').value, 10);
  const maxRep = parseInt($('set-max-rep').value, 10);
  const pasKg = parseFloat($('set-pas-kg').value);
  const pauza = parseInt($('set-pauza').value, 10);
  if (minRep >= 1 && maxRep >= minRep && maxRep <= 50) {
    setari.minRep = minRep;
    setari.maxRep = maxRep;
  } else {
    notifica('Intervalul de repetări nu e valid: minimul trebuie să fie cel mult cât maximul (1–50).', 'eroare');
  }
  if (pasKg > 0 && pasKg <= 20) setari.pasKg = pasKg;
  else notifica('Pasul de greutate trebuie să fie între 0,5 și 20 kg.', 'eroare');
  if (pauza >= 10 && pauza <= 600) setari.pauzaSec = pauza;
  else notifica('Pauza trebuie să fie între 10 și 600 de secunde.', 'eroare');
  setari.ecranAprins = $('set-ecran').checked;
  setari.pauzaAutomata = $('set-pauza-auto').checked;
  setari.semnal = $('set-semnal').checked;
  if (!setari.ecranAprins) elibereazaEcranul(); else tineEcranulAprins();
  salveazaSetari();
  afiseazaSetari();
  deseneazaExercitii();
}

function initSetari() {
  ['set-min-rep', 'set-max-rep', 'set-pas-kg', 'set-ecran', 'set-pauza', 'set-pauza-auto', 'set-semnal'].forEach(id =>
    $(id).addEventListener('change', citesteCampuriSetari));
  // Butoanele rapide pentru pauză
  document.querySelectorAll('[data-pauza]').forEach(b => b.addEventListener('click', () => {
    $('set-pauza').value = b.dataset.pauza;
    citesteCampuriSetari();
  }));
  afiseazaSetari();
}
