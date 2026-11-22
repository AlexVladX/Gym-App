// Nutriție — calculatorul zilei (etapa 3): ținte personale, mese planificate vs. mâncate.
// Fără DOM și fără bază de date, ca să poată fi testat în Node (tests/nutritie-zi.test.js).
//
// Ziua (store-ul zileNutritie, cheie „data”):
//   { data: 'AAAA-LL-ZZ', mese: [intrare], modificat }
//   intrare: { id, masa, idReteta, nume, portii, valoriPortie: { kcal, proteine, carbohidrati, grasimi, fibre },
//              stare: 'neinceput' | 'partial' | 'complet', portiiMancate?, adaugat, modificat,
//              (etapa 4, opționale) ingredientePortie: [[idAliment, grame pe porție]], timp (min), blocat }
//
// Planurile salvate (store-ul planuriNutritie, cheie „id”, etapa 4):
//   { id, nume, favorit, mese: [{ masa, idReteta, nume, portii, valoriPortie, ingredientePortie?, timp? }], creat, modificat }
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

function valoriRotunjite(v) {
  const rez = {};
  for (const c of CAMPURI_VALORI) rez[c] = Math.round((Number(v && v[c]) || 0) * 10) / 10;
  return rez;
}

// O intrare nouă: copiază numele, valorile pe porție, ingredientele pe porție și timpul rețetei de acum.
function intrareMasa({ id, masa, reteta, valoriPortieReteta, portii = 1, acum = Date.now() }) {
  const nrPortii = reteta.portii > 0 ? reteta.portii : 1;
  const rez = { id, masa, idReteta: reteta.id, nume: reteta.nume, portii, valoriPortie: valoriRotunjite(valoriPortieReteta),
    stare: 'neinceput', adaugat: acum, modificat: acum };
  if (Array.isArray(reteta.ingrediente)) {
    rez.ingredientePortie = reteta.ingrediente.map(([idA, g]) => [idA, Math.round(g / nrPortii * 10) / 10]);
  }
  if (reteta.timp > 0) rez.timp = reteta.timp;
  return rez;
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
  if ('ingredientePortie' in i) {
    const ing = curataIngredientePortie(i.ingredientePortie);
    if (ing) rez.ingredientePortie = ing; else delete rez.ingredientePortie;
  }
  if ('timp' in i && !(Number.isFinite(i.timp) && i.timp > 0 && i.timp <= 1440)) delete rez.timp;
  if ('blocat' in i && typeof i.blocat !== 'boolean') delete rez.blocat;
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

function curataIngredientePortie(lista) {
  if (!Array.isArray(lista) || lista.length > 60) return null;
  const rez = [];
  for (const x of lista) {
    if (!Array.isArray(x) || typeof x[0] !== 'string' || !x[0] || x[0].length > 80) return null;
    const g = Number(x[1]);
    if (!(g >= 0 && g <= 5000)) return null;
    rez.push([x[0], g]);
  }
  return rez;
}

// ---------- Etapa 4: generarea aleatorie, regenerare, blocare, ajustare, planuri ----------

// O intrare se poate înlocui (la generare, regenerare sau încărcarea unui plan) doar dacă nu e blocată și n-ai început-o.
function intrareModificabila(i) { return !i.blocat && i.stare === 'neinceput'; }

// Alege o rețetă la întâmplare pentru o masă; preferatele au șanse duble. exclude: Set de id-uri de rețete.
function alegeRetetaAleatorie({ retete, masa, exclude = new Set(), preferate = new Set(), rng = Math.random }) {
  const candidate = retete.filter(r => r.masa === masa && !exclude.has(r.id));
  if (!candidate.length) return null;
  const ponderi = candidate.map(r => (preferate.has(r.id) ? 2 : 1));
  let x = rng() * ponderi.reduce((a, b) => a + b, 0);
  for (let k = 0; k < candidate.length; k++) { x -= ponderi[k]; if (x < 0) return candidate[k]; }
  return candidate[candidate.length - 1];
}

function ordoneazaDupaMasa(mese) {
  const ordine = MESE_ZI.map(m => m.id);
  return [...mese].sort((a, b) => ordine.indexOf(a.masa) - ordine.indexOf(b.masa));
}

const MESE_ZI = [{ id: 'mic-dejun' }, { id: 'gustare-1' }, { id: 'pranz' }, { id: 'gustare-2' }, { id: 'cina' }];

// Planul zilei: exact câte o rețetă pentru fiecare din cele 5 mese. Mesele care au o intrare blocată sau începută
// rămân cum sunt (cu toate intrările lor); celelalte primesc o rețetă nouă. Nicio rețetă nu se repetă în zi.
// valoriPentru(reteta) → valorile pe porție. Întoarce { mese, pastrate (id-urile meselor păstrate), lipsa (mese fără rețete) }.
function genereazaPlanZi({ zi, retete, valoriPentru, preferate, rng = Math.random, idNou, acum = Date.now() }) {
  const existente = (zi && zi.mese) || [];
  const pastrate = existente.filter(i => !intrareModificabila(i));
  const meseCuPastrate = new Set(pastrate.map(i => i.masa));
  const folosite = new Set(pastrate.map(i => i.idReteta));
  const noi = [];
  const lipsa = [];
  for (const m of MESE_ZI) {
    if (meseCuPastrate.has(m.id)) continue;
    const r = alegeRetetaAleatorie({ retete, masa: m.id, exclude: folosite, preferate, rng });
    if (!r) { lipsa.push(m.id); continue; }
    folosite.add(r.id);
    noi.push(intrareMasa({ id: idNou(), masa: m.id, reteta: r, valoriPortieReteta: valoriPentru(r), portii: 1, acum }));
  }
  return { mese: ordoneazaDupaMasa([...pastrate, ...noi]), pastrate: [...meseCuPastrate], lipsa };
}

// Altă rețetă pentru o singură intrare (aceeași masă, aceleași porții). Celelalte intrări nu se ating.
// Întoarce ziua nouă sau null dacă nu mai există altă rețetă potrivită sau intrarea nu se poate schimba.
function regenereazaIntrare({ zi, idIntrare, retete, valoriPentru, preferate, rng = Math.random, idNou, acum = Date.now() }) {
  const i = zi.mese.find(x => x.id === idIntrare);
  if (!i || !intrareModificabila(i)) return null;
  const folosite = new Set(zi.mese.map(x => x.idReteta));
  const r = alegeRetetaAleatorie({ retete, masa: i.masa, exclude: folosite, preferate, rng });
  if (!r) return null;
  const noua = intrareMasa({ id: idNou(), masa: i.masa, reteta: r, valoriPortieReteta: valoriPentru(r), portii: i.portii, acum });
  return { ...zi, mese: zi.mese.map(x => (x.id === idIntrare ? noua : x)) };
}

// Cantitățile ajustate de tine: valorile pe porție se recalculează din ingrediente (grame pe porție).
// valoriDin(ingredientePortie) → { total, lipsa } (valoriIngrediente din nutritie-calcul.js).
function ajusteazaIngredienteIntrare(i, ingredientePortie, valoriDin, acum = Date.now()) {
  const ing = curataIngredientePortie(ingredientePortie);
  if (!ing || !ing.some(([, g]) => g > 0)) throw new Error('Rețeta trebuie să aibă cel puțin un ingredient cu cantitate.');
  const { total } = valoriDin(ing.filter(([, g]) => g > 0));
  return { ...i, ingredientePortie: ing.filter(([, g]) => g > 0), valoriPortie: valoriRotunjite(total), ajustat: true, modificat: acum };
}

// Un plan salvat: copia meselor zilei (fără stări, fără blocări).
function planDinZi(zi, { id, nume, favorit = false, acum = Date.now() }) {
  const mese = ordoneazaDupaMasa(zi.mese).map(i => {
    const m = { masa: i.masa, idReteta: i.idReteta, nume: i.nume, portii: i.portii, valoriPortie: { ...i.valoriPortie } };
    if (i.ingredientePortie) m.ingredientePortie = i.ingredientePortie.map(x => [...x]);
    if (i.timp) m.timp = i.timp;
    return m;
  });
  return { id, nume, favorit, mese, creat: acum, modificat: acum };
}

// Încarcă un plan într-o zi: aceeași regulă ca la generare (mesele blocate sau începute rămân, iar mesele planului
// pentru ele se sar). Întoarce { mese, sarite: [id masă] }.
function aplicaPlan({ zi, plan, idNou, acum = Date.now() }) {
  const existente = (zi && zi.mese) || [];
  const pastrate = existente.filter(i => !intrareModificabila(i));
  const meseCuPastrate = new Set(pastrate.map(i => i.masa));
  const sarite = new Set();
  const noi = [];
  for (const m of plan.mese) {
    if (meseCuPastrate.has(m.masa)) { sarite.add(m.masa); continue; }
    const i = { id: idNou(), masa: m.masa, idReteta: m.idReteta, nume: m.nume, portii: m.portii, valoriPortie: { ...m.valoriPortie },
      stare: 'neinceput', adaugat: acum, modificat: acum };
    if (m.ingredientePortie) i.ingredientePortie = m.ingredientePortie.map(x => [...x]);
    if (m.timp) i.timp = m.timp;
    noi.push(i);
  }
  return { mese: ordoneazaDupaMasa([...pastrate, ...noi]), sarite: [...sarite] };
}

function curataPlanNutritie(p) {
  if (!p || typeof p !== 'object' || typeof p.id !== 'string' || !p.id || p.id.length > 80) return null;
  if (typeof p.nume !== 'string' || !p.nume.trim() || p.nume.length > 120 || !Array.isArray(p.mese)) return null;
  const mese = [];
  for (const m of p.mese) {
    const c = curataIntrareMasa({ ...m, id: 'x', stare: 'neinceput' });
    if (!c) continue;
    const { id, stare, ...rest } = c;
    mese.push(rest);
  }
  if (!mese.length) return null;
  return { ...p, nume: p.nume.trim(), favorit: p.favorit === true, mese };
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
    intrareModificabila, alegeRetetaAleatorie, genereazaPlanZi, regenereazaIntrare, ajusteazaIngredienteIntrare,
    planDinZi, aplicaPlan, curataPlanNutritie, curataIngredientePortie,
  };
}
