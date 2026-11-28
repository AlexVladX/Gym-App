// Modurile aplicației: Sală și Nutriție (id-urile interne rămân 'gym' / 'mealprep', pentru compatibilitate cu
// setările și backupurile). Aceeași aplicație, aceleași date, două navigări.
// Se încarcă în <head>, înaintea paginii, ca tema corectă să se aplice fără o clipă în culorile greșite.
//
// Etapa 5: ambele moduri au aceeași bază (implicit întunecată); diferă doar accentul (data-mod pe <html>:
// verde la Sală, portocaliu la Nutriție). Tema e o setare a telefonului (setari.tema: 'intunecata' | 'deschisa' |
// 'sistem'), pusă ca data-tema="deschisa" pe <html> când e cazul. Modul și tema nu se sincronizează între telefoane.

const MODURI = {
  gym: { nume: 'Sală', acasa: 'ecran-acasa' },
  mealprep: { nume: 'Nutriție', acasa: 'ecran-masa' },
};
const TEME = ['intunecata', 'deschisa', 'sistem'];
const CULOARE_BARA = { intunecata: '#0B0D10', deschisa: '#FAF8F7' };
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

function temaSalvata() {
  try { const t = (JSON.parse(localStorage.getItem('setari') || '{}') || {}).tema; return TEME.includes(t) ? t : 'intunecata'; } catch (_) { return 'intunecata'; }
}
// Tema efectivă: „Ca sistemul” urmează setarea telefonului (prefers-color-scheme).
function temaEfectiva(tema) {
  if (tema === 'sistem') return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: light)').matches ? 'deschisa' : 'intunecata';
  return tema === 'deschisa' ? 'deschisa' : 'intunecata';
}
let temaCurenta = typeof document !== 'undefined' ? temaSalvata() : 'intunecata';

let modCurent = typeof document !== 'undefined' ? modSalvat() : 'gym';
const ultimulEcranMod = { gym: MODURI.gym.acasa, mealprep: MODURI.mealprep.acasa };

function aplicaTema(mod) {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.mod = mod;
  const tema = temaEfectiva(temaCurenta);
  if (tema === 'deschisa') document.documentElement.dataset.tema = 'deschisa';
  else delete document.documentElement.dataset.tema;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', CULOARE_BARA[tema]);
  document.querySelectorAll('[data-mod-tinta]').forEach(b => {
    const activ = b.dataset.modTinta === mod;
    b.classList.toggle('activ', activ);
    b.setAttribute('aria-pressed', String(activ));
  });
}
if (typeof document !== 'undefined') {
  aplicaTema(modCurent);
  // „Ca sistemul”: când telefonul trece între luminos și întunecat, tema se schimbă pe loc.
  if (typeof matchMedia === 'function') {
    const mq = matchMedia('(prefers-color-scheme: light)');
    const laSchimbare = () => {
      if (temaCurenta !== 'sistem') return;
      aplicaTema(modCurent);
      if (typeof redeseneazaToateGraficele === 'function') redeseneazaToateGraficele();
    };
    if (mq.addEventListener) mq.addEventListener('change', laSchimbare); else if (mq.addListener) mq.addListener(laSchimbare);
  }
}

// Setări → Aspect: schimbă tema (se salvează în setări; nu se sincronizează).
function schimbaTema(tema) {
  temaCurenta = TEME.includes(tema) ? tema : 'intunecata';
  aplicaTema(modCurent);
  if (typeof redeseneazaToateGraficele === 'function') redeseneazaToateGraficele();
}

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

if (typeof module !== 'undefined') module.exports = { MODURI, ECRANE_MOD, modValid, TEME, temaEfectiva };
