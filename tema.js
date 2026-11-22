// Modurile aplicației (Faza 1): GYM MODE și MEAL PREP. Aceeași aplicație, aceleași date, două teme și două navigări.
// Se încarcă în <head>, înaintea paginii, ca tema corectă să se aplice fără o clipă în culorile celeilalte.
//
// Tema = atributul data-mod pe <html>; culorile vin din variabilele CSS (styles.css: :root = GYM MODE,
// [data-mod="mealprep"] = MEAL PREP). Modul ales se ține în setări (setari.mod), deci intră în backup
// și, mai târziu, poate merge cu contul în cloud.

const MODURI = {
  gym: { nume: 'GYM MODE', acasa: 'ecran-acasa', culoareBara: '#0B0D10' },
  mealprep: { nume: 'MEAL PREP', acasa: 'ecran-masa', culoareBara: '#FAF8F7' },
};
// Ce ecrane aparțin fiecărui mod. Setările sunt comune.
const ECRANE_MOD = {
  'ecran-acasa': 'gym', 'ecran-sesiune': 'gym', 'ecran-biblioteca': 'gym', 'ecran-progres': 'gym', 'ecran-masuratori': 'gym',
  'ecran-masa': 'mealprep', 'ecran-nutritie': 'mealprep',
};

function modValid(m) { return Object.prototype.hasOwnProperty.call(MODURI, m) ? m : 'gym'; }

// Citirea timpurie (înainte de setari.js): direct din localStorage, fără să depindă de alt fișier.
function modSalvat() {
  try { return modValid((JSON.parse(localStorage.getItem('setari') || '{}') || {}).mod); } catch (_) { return 'gym'; }
}

let modCurent = typeof document !== 'undefined' ? modSalvat() : 'gym';
const ultimulEcranMod = { gym: MODURI.gym.acasa, mealprep: MODURI.mealprep.acasa };

function aplicaTema(mod) {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.mod = mod;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', MODURI[mod].culoareBara);
  document.querySelectorAll('[data-mod-tinta]').forEach(b => {
    const activ = b.dataset.modTinta === mod;
    b.classList.toggle('activ', activ);
    b.setAttribute('aria-pressed', String(activ));
  });
}
if (typeof document !== 'undefined') aplicaTema(modCurent);

// Schimbă modul: tema, navigarea și ecranul (ultimul ecran deschis în modul respectiv). Datele nu se ating;
// antrenamentul în curs rămâne în ciornă și cronometrul merge mai departe.
function schimbaMod(mod, { ecran = null } = {}) {
  mod = modValid(mod);
  const schimbat = mod !== modCurent;
  if (schimbat && typeof ecranCurent !== 'undefined' && ECRANE_MOD[ecranCurent] === modCurent) ultimulEcranMod[modCurent] = ecranCurent;
  modCurent = mod;
  aplicaTema(mod);
  if (typeof setari !== 'undefined' && setari.mod !== mod) {
    setari.mod = mod;
    if (typeof salveazaSetari === 'function') salveazaSetari();
  }
  if (schimbat && typeof redeseneazaToateGraficele === 'function') redeseneazaToateGraficele();
  // Ultimul ecran ținut minte se folosește doar dacă e chiar al acestui mod (altfel, Acasă al modului).
  const ultim = ultimulEcranMod[mod];
  const tinta = ecran || (schimbat && (ECRANE_MOD[ultim] === mod || ultim === 'ecran-setari') ? ultim : MODURI[mod].acasa);
  if (typeof arataEcran === 'function') arataEcran(tinta);
}

// Dacă un ecran din celălalt mod e deschis dintr-o legătură, modul se schimbă odată cu el.
function asiguraModulEcranului(idEcran) {
  const m = ECRANE_MOD[idEcran];
  if (m && m !== modCurent) {
    if (typeof ecranCurent !== 'undefined' && ECRANE_MOD[ecranCurent] === modCurent) ultimulEcranMod[modCurent] = ecranCurent;
    modCurent = m;
    aplicaTema(m);
    if (typeof setari !== 'undefined') { setari.mod = m; if (typeof salveazaSetari === 'function') salveazaSetari(); }
    if (typeof redeseneazaToateGraficele === 'function') redeseneazaToateGraficele();
  }
}

if (typeof module !== 'undefined') module.exports = { MODURI, ECRANE_MOD, modValid };
