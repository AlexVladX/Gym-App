// Ilustrațiile exercițiilor: fișiere SVG individuale din dosarul ilustratii/, generate de
// tools/ilustratii/genereaza.js (un desen anatomic cu poziția de start și cea finală, plus o miniatură).
//   ilustratii/<nume>.svg        – ambele poziții, pentru detaliile exercițiului
//   ilustratii/<nume>-mini.svg   – o singură poziție, pentru liste
//   ilustratii/grupa-<grupa>…    – desenul implicit al grupei, pentru exercițiile create de tine
// Partea fără DOM (numele fișierelor) e testată în Node (tests/figuri.test.js).

// Același nume de fișier ca în generator: fără diacritice, litere mici, cratime.
function numeFisierIlustratie(nume) {
  return String(nume || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

const GRUPE_CU_ILUSTRATIE = ['Piept', 'Spate', 'Umeri', 'Biceps', 'Triceps', 'Antebrațe', 'Cvadricepși', 'Femurali', 'Fese', 'Gambe', 'Abdomen', 'Picioare'];

// Calea ilustrației (fără versiune) pentru un exercițiu: din catalog după nume, altfel desenul grupei.
// tip: 'mini' (o poziție) sau 'mare' (start și final). null dacă nu există niciuna potrivită.
function caleIlustratie(nume, grupa, catalog, tip = 'mini') {
  const sufix = tip === 'mini' ? '-mini' : '';
  const n = String(nume || '').toLowerCase();
  const dinCatalog = (catalog || []).find(e => e.nume.toLowerCase() === n);
  if (dinCatalog) return `ilustratii/${numeFisierIlustratie(dinCatalog.nume)}${sufix}.svg`;
  if (grupa && GRUPE_CU_ILUSTRATIE.includes(grupa)) return `ilustratii/grupa-${numeFisierIlustratie(grupa)}${sufix}.svg`;
  return null;
}

// ---------- În pagină ----------
function versiuneIlustratii() {
  return (typeof document !== 'undefined' && document.body && document.body.dataset.versiune) || '1';
}

// Datele exercițiului: biblioteca unificată (cu grupa aleasă de tine), apoi catalogul.
function dateFigura(nume) {
  const u = typeof exercitiuDupaNume === 'function' ? exercitiuDupaNume(nume) : null;
  if (u) return u;
  const c = BIBLIOTECA.find(e => e.nume.toLowerCase() === String(nume).toLowerCase());
  return c ? { nume: c.nume, grupa: c.grupa } : null;
}

// Elementul cu ilustrația unui exercițiu, sau null dacă nu are niciuna.
// clasa: 'figura-mica' (listă), 'figura' (card), 'ilustratie-mare' (detalii, ambele poziții).
function creeazaFigura(_poza, nume, clasa = 'figura') {
  const e = dateFigura(nume) || { nume, grupa: null };
  const tip = clasa === 'ilustratie-mare' ? 'mare' : 'mini';
  const cale = caleIlustratie(e.nume || nume, e.grupa, typeof BIBLIOTECA !== 'undefined' ? BIBLIOTECA : [], tip);
  if (!cale) return null;
  const rama = document.createElement('div');
  rama.className = `${clasa} figura-ilustratie`;
  const img = document.createElement('img');
  img.src = `${cale}?v=${versiuneIlustratii()}`;
  img.alt = tip === 'mare' ? `${e.nume || nume}: poziția de start și poziția finală` : '';
  if (tip === 'mini') img.setAttribute('aria-hidden', 'true');
  img.decoding = 'async';
  img.loading = tip === 'mare' ? 'eager' : 'lazy';
  img.draggable = false;
  // dacă fișierul lipsește (de ex. offline, înainte să fi fost salvat), rama rămâne goală, fără imagine ruptă
  img.addEventListener('error', () => { img.remove(); rama.classList.add('figura-lipsa'); }, { once: true });
  rama.append(img);
  return rama;
}

// Miniatură pentru un nume de exercițiu, altfel un element gol.
function miniatura(nume, clasa = 'figura-mica') {
  return creeazaFigura(null, nume, clasa) || document.createElement('span');
}

if (typeof module !== 'undefined') {
  module.exports = { numeFisierIlustratie, caleIlustratie, GRUPE_CU_ILUSTRATIE };
}
