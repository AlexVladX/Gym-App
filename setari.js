// Setările aplicației. Se țin în localStorage (citire sincronă la pornire)
// și se includ în backup, ca să nu se piardă la mutarea pe alt telefon.

// inaltimeCm și obiectiv (greutatea țintă) vin din ecranul Corp (etapa 6); obiectiv: { tinta, start, dela }.
// retetePreferate: id-urile rețetelor marcate ca favorite (nutriție).
// Nutriție (etapa 3): tinteNutritie { kcal, proteine?, carbohidrati?, grasimi?, fibre?, estimat? } și profilul pentru
// estimare: anNastere, sex ('m' | 'f'), activitate, scopNutritie (vezi nutritie-zi.js). Toate opționale.
// preferinteNutritie (etapa 5): { dieta[], alergii[], stil[], excluse[], preferate[], timpMaxim } (vezi nutritie-generator.js).
// mod (Faza 1 din 3.0): 'gym' | 'mealprep' — modul aplicației ales ultima dată (vezi tema.js).
// cafeleZilnice (Faza 4): cafeaua care se pune singură în fiecare zi (vezi cafea.js); limitaCofeina: mg pe zi (implicit 400, EFSA).
const SETARI_IMPLICITE = { minRep: 8, maxRep: 12, pasKg: 2.5, ecranAprins: true, pauzaSec: 90, pauzaAutomata: true, semnal: true,
  inaltimeCm: null, obiectiv: null, obiectivSaptamanal: 3, retetePreferate: [],
  tinteNutritie: null, anNastere: null, sex: null, activitate: null, scopNutritie: null, preferinteNutritie: null, mod: 'gym',
  cafeleZilnice: [], limitaCofeina: 400 };
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
  if (intreg(sursa.obiectivSaptamanal, 1, 7)) rez.obiectivSaptamanal = sursa.obiectivSaptamanal;
  const numar = (v, min, max) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
  if (numar(sursa.inaltimeCm, 100, 250)) rez.inaltimeCm = sursa.inaltimeCm;
  const o = sursa.obiectiv;
  if (o && typeof o === 'object' && numar(o.tinta, 20, 300) && numar(o.start, 20, 300) && typeof o.dela === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o.dela)) {
    rez.obiectiv = { tinta: o.tinta, start: o.start, dela: o.dela };
  }
  if (Array.isArray(sursa.retetePreferate)) {
    rez.retetePreferate = [...new Set(sursa.retetePreferate.filter(x => typeof x === 'string' && x.length > 0 && x.length <= 80))].slice(0, 1000);
  }
  const tinte = curataTinte(sursa.tinteNutritie);
  if (tinte) rez.tinteNutritie = tinte;
  if (intreg(sursa.anNastere, 1900, new Date().getFullYear() - 10)) rez.anNastere = sursa.anNastere;
  if (sursa.sex === 'm' || sursa.sex === 'f') rez.sex = sursa.sex;
  if (NIVELURI_ACTIVITATE.some(a => a.id === sursa.activitate)) rez.activitate = sursa.activitate;
  if (SCOPURI_NUTRITIE.some(s => s.id === sursa.scopNutritie)) rez.scopNutritie = sursa.scopNutritie;
  if (sursa.mod === 'gym' || sursa.mod === 'mealprep') rez.mod = sursa.mod;
  const pref = curataPreferinteNutritie(sursa.preferinteNutritie);
  if (pref) rez.preferinteNutritie = pref;
  if (Array.isArray(sursa.cafeleZilnice)) rez.cafeleZilnice = curataCafeleZilnice(sursa.cafeleZilnice);
  if (intreg(sursa.limitaCofeina, 50, 1000)) rez.limitaCofeina = sursa.limitaCofeina;
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
  if (typeof semnaleazaModificare === 'function') semnaleazaModificare();
}

function setariPentruBackup() {
  return { ...setari };
}

function aplicaSetariDinBackup(sursa) {
  Object.assign(setari, SETARI_IMPLICITE, curataSetari(sursa || {}));
  salveazaSetari();
  // Tema urmează modul din backup; ecranul Setări (comun) rămâne deschis.
  if (typeof aplicaTema === 'function' && setari.mod !== modCurent) {
    modCurent = setari.mod; aplicaTema(modCurent);
    if (typeof actualizeazaNavigatia === 'function') actualizeazaNavigatia();
  }
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
  $('set-obiectiv-sapt').value = setari.obiectivSaptamanal;
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
  const obiectivSapt = parseInt($('set-obiectiv-sapt').value, 10);
  if (obiectivSapt >= 1 && obiectivSapt <= 7) setari.obiectivSaptamanal = obiectivSapt;
  else notifica('Obiectivul săptămânal trebuie să fie între 1 și 7 antrenamente.', 'eroare');
  if (!setari.ecranAprins) elibereazaEcranul(); else tineEcranulAprins();
  salveazaSetari();
  afiseazaSetari();
  deseneazaExercitii();
}

function initSetari() {
  ['set-min-rep', 'set-max-rep', 'set-pas-kg', 'set-ecran', 'set-pauza', 'set-pauza-auto', 'set-semnal', 'set-obiectiv-sapt'].forEach(id =>
    $(id).addEventListener('change', citesteCampuriSetari));
  // Butoanele rapide pentru pauză
  document.querySelectorAll('[data-pauza]').forEach(b => b.addEventListener('click', () => {
    $('set-pauza').value = b.dataset.pauza;
    citesteCampuriSetari();
  }));
  afiseazaSetari();
}
