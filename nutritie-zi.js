// Nutriție — calculatorul zilei (etapa 3): ținte personale, mese planificate vs. mâncate.
// Fără DOM și fără bază de date, ca să poată fi testat în Node (tests/nutritie-zi.test.js).
//
// Ziua (store-ul zileNutritie, cheie „data”):
//   { data: 'AAAA-LL-ZZ', mese: [intrare], modificat }
//   intrare: { id, masa, idReteta, nume, portii, valoriPortie: { kcal, proteine, carbohidrati, grasimi, fibre },
//              stare: 'neinceput' | 'partial' | 'complet', portiiMancate?, adaugat, modificat }
//
// Reguli:
// - Valorile pe porție se copiază din rețetă în momentul adăugării. Dacă rețeta se editează sau se șterge mai târziu,
//   zilele deja notate nu se schimbă (istoricul rămâne așa cum a fost).
// - PLANIFICAT = toate mesele zilei, indiferent de stare (valoriPortie × porții).
// - MÂNCAT = doar ce ai marcat: „Mâncată” = toate porțiile; „Parțial” = porțiile pe care le-ai scris; „Neîncepută” = 0.
//   Nimic nu se marchează ca mâncat automat.

const STARI_MASA = [
  { id: 'neinceput', nume: 'Neîncepută' },
  { id: 'partial', nume: 'Parțial' },
  { id: 'complet', nume: 'Mâncată' },
];

const NIVELURI_ACTIVITATE = [
  { id: 'sedentar', nume: 'Sedentar', detaliu: 'birou, puțină mișcare', factor: 1.2 },
  { id: 'usor', nume: 'Ușor activ', detaliu: 'sport 1–3 zile pe săptămână', factor: 1.375 },
  { id: 'moderat', nume: 'Moderat activ', detaliu: 'sport 3–5 zile pe săptămână', factor: 1.55 },
  { id: 'activ', nume: 'Foarte activ', detaliu: 'sport 6–7 zile sau muncă fizică', factor: 1.725 },
  { id: 'extrem', nume: 'Extrem de activ', detaliu: 'muncă fizică grea și antrenamente zilnice', factor: 1.9 },
];

// Obiectivul de nutriție: ajustarea caloriilor față de necesarul estimat și proteinele pe kg corp.
const SCOPURI_NUTRITIE = [
  { id: 'masa', nume: 'Masă musculară', ajustare: 0.10, proteinePeKg: 1.8 },
  { id: 'mentinere', nume: 'Menținere', ajustare: 0, proteinePeKg: 1.6 },
  { id: 'slabire', nume: 'Slăbire', ajustare: -0.20, proteinePeKg: 2.0 },
];

const PROCENT_GRASIMI = 0.25;    // 25% din calorii
const GRASIMI_MIN_PE_KG = 0.6;   // g/kg, minimul sub care nu coborâm grăsimile
const FIBRE_PE_1000_KCAL = 14;   // g (recomandarea Dietary Guidelines for Americans)
const KCAL_MINIM = { m: 1500, f: 1200 };

function rotunjesteLa(v, pas) { return Math.round(v / pas) * pas; }

// Estimarea țintelor (Mifflin-St Jeor). Întoarce null dacă lipsesc date sau sunt în afara limitelor.
// date: { kg, inaltimeCm, varsta, sex: 'm' | 'f', activitate, scop }
function estimeazaTinte(date) {
  const { kg, inaltimeCm, varsta, sex } = date || {};
  const act = NIVELURI_ACTIVITATE.find(a => a.id === (date && date.activitate));
  const scop = SCOPURI_NUTRITIE.find(s => s.id === (date && date.scop));
  if (!(kg >= 30 && kg <= 300) || !(inaltimeCm >= 120 && inaltimeCm <= 250) || !(varsta >= 15 && varsta <= 100)) return null;
  if ((sex !== 'm' && sex !== 'f') || !act || !scop) return null;
  const bmr = 10 * kg + 6.25 * inaltimeCm - 5 * varsta + (sex === 'm' ? 5 : -161);
  const necesar = bmr * act.factor;
  let kcal = necesar * (1 + scop.ajustare);
  const minim = Math.max(KCAL_MINIM[sex], scop.ajustare < 0 ? bmr : 0);
  const limitat = kcal < minim;
  if (limitat) kcal = minim;
  kcal = rotunjesteLa(kcal, 10);
  const proteine = Math.round(kg * scop.proteinePeKg);
  const grasimi = Math.round(Math.max(kcal * PROCENT_GRASIMI / 9, kg * GRASIMI_MIN_PE_KG));
  const carbohidrati = Math.max(0, Math.round((kcal - proteine * 4 - grasimi * 9) / 4));
  const fibre = Math.round(kcal / 1000 * FIBRE_PE_1000_KCAL);
  return { kcal, proteine, carbohidrati, grasimi, fibre,
    detalii: { bmr: Math.round(bmr), necesar: Math.round(necesar), factor: act.factor, ajustare: scop.ajustare,
      proteinePeKg: scop.proteinePeKg, limitat } };
}

// Țintele salvate: fiecare câmp e opțional (poți urmări doar caloriile și proteinele, de ex.).
const LIMITE_TINTE = { kcal: [800, 6000], proteine: [20, 400], carbohidrati: [0, 900], grasimi: [10, 300], fibre: [5, 100] };
function curataTinte(t) {
  if (!t || typeof t !== 'object') return null;
  const rez = {};
  for (const [camp, [min, max]] of Object.entries(LIMITE_TINTE)) {
    const v = t[camp];
    if (typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max) rez[camp] = Math.round(v);
  }
  if (!('kcal' in rez)) return null;
  if (t.estimat === true) rez.estimat = true;
  return rez;
}

function valoriZero() { return { kcal: 0, proteine: 0, carbohidrati: 0, grasimi: 0, fibre: 0 }; }
const CAMPURI_VALORI = ['kcal', 'proteine', 'carbohidrati', 'grasimi', 'fibre'];

function valoriInmultite(v, f) {
  const rez = valoriZero();
  for (const c of CAMPURI_VALORI) rez[c] = (Number(v && v[c]) || 0) * f;
  return rez;
}
function valoriAdunate(a, b) {
  const rez = valoriZero();
  for (const c of CAMPURI_VALORI) rez[c] = (a[c] || 0) + (b[c] || 0);
  return rez;
}

// O intrare nouă: copiază numele și valorile pe porție ale rețetei de acum.
function intrareMasa({ id, masa, reteta, valoriPortieReteta, portii = 1, acum = Date.now() }) {
  const vp = {};
  for (const c of CAMPURI_VALORI) vp[c] = Math.round((Number(valoriPortieReteta[c]) || 0) * 10) / 10;
  return { id, masa, idReteta: reteta.id, nume: reteta.nume, portii, valoriPortie: vp, stare: 'neinceput', adaugat: acum, modificat: acum };
}

function valoriPlanificateIntrare(i) { return valoriInmultite(i.valoriPortie, i.portii); }

// Porțiile mâncate dintr-o intrare, după stare. „Parțial” fără cantitate scrisă = 0 (nu ghicim).
function portiiMancateIntrare(i) {
  if (i.stare === 'complet') return i.portii;
  if (i.stare === 'partial') return Math.max(0, Math.min(Number(i.portiiMancate) || 0, i.portii));
  return 0;
}
function valoriMancateIntrare(i) { return valoriInmultite(i.valoriPortie, portiiMancateIntrare(i)); }

function totaluriZi(zi) {
  let planificat = valoriZero(), mancat = valoriZero();
  const mese = (zi && zi.mese) || [];
  for (const i of mese) {
    planificat = valoriAdunate(planificat, valoriPlanificateIntrare(i));
    mancat = valoriAdunate(mancat, valoriMancateIntrare(i));
  }
  const terminate = mese.filter(i => i.stare === 'complet').length;
  return { planificat, mancat, numar: mese.length, terminate };
}

// Per masă (mic dejun, gustări, prânz, cină).
function totaluriPeMasa(zi, idMasa) {
  return totaluriZi({ mese: ((zi && zi.mese) || []).filter(i => i.masa === idMasa) });
}

// Ce a mai rămas din fiecare țintă (negativ = peste țintă). Doar pentru țintele setate.
function ramasDinTinte(tinte, mancat) {
  const rez = {};
  if (!tinte) return rez;
  for (const c of CAMPURI_VALORI) if (typeof tinte[c] === 'number') rez[c] = tinte[c] - (mancat[c] || 0);
  return rez;
}

// Progresul (0…) față de țintă; null dacă ținta lipsește.
function progresTinta(tinta, valoare) {
  if (!(tinta > 0)) return null;
  return valoare / tinta;
}

// Starea unei intrări, cu validare: la „parțial” porțiile mâncate trebuie să fie între 0 și porțiile planificate.
function schimbaStareIntrare(i, stare, portiiMancate, acum = Date.now()) {
  if (!STARI_MASA.some(s => s.id === stare)) throw new Error('Stare necunoscută');
  const rez = { ...i, stare, modificat: acum };
  delete rez.portiiMancate;
  if (stare === 'partial') {
    const p = Number(portiiMancate);
    if (!(p > 0 && p < i.portii)) throw new Error('Porțiile mâncate trebuie să fie mai mari ca 0 și mai mici decât cele planificate.');
    rez.portiiMancate = Math.round(p * 100) / 100;
  }
  return rez;
}

// Validarea unei zile (backup și citirea din bază). Intrările stricate se scot; ziua fără dată validă e ignorată.
const DATA_ZI_RE = /^\d{4}-\d{2}-\d{2}$/;
function curataIntrareMasa(i) {
  if (!i || typeof i !== 'object') return null;
  if (typeof i.id !== 'string' || !i.id || i.id.length > 80) return null;
  if (typeof i.masa !== 'string' || !i.masa || typeof i.nume !== 'string' || !i.nume.trim()) return null;
  const portii = Number(i.portii);
  if (!(portii > 0 && portii <= 20)) return null;
  if (!i.valoriPortie || typeof i.valoriPortie !== 'object') return null;
  const vp = {};
  for (const c of CAMPURI_VALORI) {
    const v = Number(i.valoriPortie[c]);
    if (!Number.isFinite(v) || v < 0 || v > (c === 'kcal' ? 10000 : 1000)) return null;
    vp[c] = v;
  }
  const stare = STARI_MASA.some(s => s.id === i.stare) ? i.stare : 'neinceput';
  const rez = { ...i, portii, valoriPortie: vp, stare };
  if (stare === 'partial') {
    const p = Number(i.portiiMancate);
    if (p > 0 && p < portii) rez.portiiMancate = p; else { rez.stare = 'neinceput'; delete rez.portiiMancate; }
  } else delete rez.portiiMancate;
  return rez;
}
function curataZiNutritie(z) {
  if (!z || typeof z !== 'object' || typeof z.data !== 'string' || !DATA_ZI_RE.test(z.data)) return null;
  if (!Number.isFinite(Date.parse(z.data + 'T12:00:00'))) return null;
  const mese = Array.isArray(z.mese) ? z.mese.map(curataIntrareMasa).filter(Boolean) : [];
  const vazute = new Set();
  return { ...z, mese: mese.filter(i => (vazute.has(i.id) ? false : (vazute.add(i.id), true))) };
}

// Vârsta împlinită la o dată, din anul nașterii (aproximare: fără zi și lună, poate fi cu 1 an mai mare).
function varstaDinAn(anNastere, azi = new Date()) {
  if (!Number.isInteger(anNastere)) return null;
  const v = azi.getFullYear() - anNastere;
  return v >= 0 && v <= 120 ? v : null;
}

if (typeof module !== 'undefined') {
  module.exports = {
    STARI_MASA, NIVELURI_ACTIVITATE, SCOPURI_NUTRITIE, LIMITE_TINTE, FIBRE_PE_1000_KCAL,
    estimeazaTinte, curataTinte, valoriZero, intrareMasa, valoriPlanificateIntrare, portiiMancateIntrare,
    valoriMancateIntrare, totaluriZi, totaluriPeMasa, ramasDinTinte, progresTinta, schimbaStareIntrare,
    curataIntrareMasa, curataZiNutritie, varstaDinAn,
  };
}
