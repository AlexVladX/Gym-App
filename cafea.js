// Cafeaua (Faza 4 din 3.0): cafele notate în zi și cafeaua zilnică (recurentă).
// Doar calcule și validări (testabile în Node); afișarea e în cafea-ui.js.
//
// Valorile vin din bibliotecă (USDA SR28): cafeaua din alimentele cafea-*, laptele din „lapte” / „lapte-soia”,
// zahărul din „zahar”. Cofeina (mg/100 g) e din USDA FoodData Central (SR Legacy), vezi tools/nutritie/ingrediente.js.
// Mililitrii se transformă în grame cu densitatea din USDA (măsura „1 cup” a fiecărui aliment).
//
// O cafea din zi (zi.cafele[]):
//   { id, nume, tip, cantitate, lapte, lapteMl, zaharG, valori {kcal, proteine, carbohidrati, grasimi, fibre}, cofeina,
//     ora?, baut?, idZilnica?, adaugat? }
//   baut lipsește la cafeaua zilnică pusă automat: atunci contează ca băută în zilele de până azi și planificată în viitor.
// zi.cafeleSarite[]: id-urile cafelelor zilnice scoase din ziua aceea (nu se mai pun la loc).
// Cafeaua zilnică (setari.cafeleZilnice[]): { id, nume, tip, cantitate, lapte, lapteMl, zaharG, valori, cofeina, ora?, dela, activ }
//   Valorile se calculează când o salvezi, așa că ziua primește exact aceleași cifre pe orice dispozitiv.

const TIPURI_CAFEA = [
  { id: 'espresso', nume: 'Espresso', aliment: 'cafea-espresso', unitate: 'ml', implicit: 30, max: 500, densitate: 1 },
  { id: 'filtru', nume: 'Cafea la filtru', aliment: 'cafea-filtru', unitate: 'ml', implicit: 200, max: 1000, densitate: 1 },
  { id: 'instant', nume: 'Cafea instant', aliment: 'cafea-instant', unitate: 'g', implicit: 2, max: 30, densitate: 1,
    nota: 'grame de praf; apa nu adaugă calorii' },
  { id: 'decaf', nume: 'Decofeinizată', aliment: 'cafea-decaf', unitate: 'ml', implicit: 200, max: 1000, densitate: 1 },
];
// Densitatea laptelui: USDA, 1 cup (236,6 ml) = 244 g (lapte 2%) și 243 g (băutura de soia).
const LAPTE_CAFEA = [
  { id: 'lapte', nume: 'Lapte', densitate: 244 / 236.6 },
  { id: 'lapte-soia', nume: 'Băutură de soia', densitate: 243 / 236.6 },
];
const ZAHAR_CAFEA = 'zahar';

// Variante rapide; cantitățile sunt doar puncte de plecare, le schimbi în formular.
const PRESETURI_CAFEA = [
  { id: 'espresso', nume: 'Espresso', tip: 'espresso', cantitate: 30, lapte: null, lapteMl: 0 },
  { id: 'espresso-dublu', nume: 'Espresso dublu', tip: 'espresso', cantitate: 60, lapte: null, lapteMl: 0 },
  { id: 'cappuccino', nume: 'Cappuccino', tip: 'espresso', cantitate: 30, lapte: 'lapte', lapteMl: 120 },
  { id: 'latte', nume: 'Latte', tip: 'espresso', cantitate: 30, lapte: 'lapte', lapteMl: 200 },
  { id: 'filtru', nume: 'Cafea la filtru', tip: 'filtru', cantitate: 200, lapte: null, lapteMl: 0 },
  { id: 'filtru-lapte', nume: 'Cafea cu lapte', tip: 'filtru', cantitate: 200, lapte: 'lapte', lapteMl: 50 },
  { id: 'instant', nume: 'Cafea instant', tip: 'instant', cantitate: 2, lapte: null, lapteMl: 0 },
  { id: 'decaf', nume: 'Decofeinizată', tip: 'decaf', cantitate: 200, lapte: null, lapteMl: 0 },
];

// EFSA (2015, Scientific Opinion on the safety of caffeine): pentru adulții sănătoși, până la 400 mg/zi și
// doze unice de până la 200 mg nu ridică probleme de siguranță; în sarcină, până la 200 mg/zi.
const LIMITA_COFEINA_ZI = 400;
const DOZA_COFEINA_UNICA = 200;

const tipCafea = id => TIPURI_CAFEA.find(t => t.id === id) || null;
const lapteCafea = id => LAPTE_CAFEA.find(l => l.id === id) || null;
const rot1 = v => Math.round(v * 10) / 10;

// Valorile unei cafele din compoziție. idx: Map id → aliment (indexNutritie).
// Întoarce { valori, cofeina, lipsa[] } — lipsa: alimentele care nu sunt în bibliotecă (nu se ghicește nimic).
function valoriCafea({ tip, cantitate, lapte, lapteMl = 0, zaharG = 0 }, idx) {
  const t = tipCafea(tip);
  const valori = { kcal: 0, proteine: 0, carbohidrati: 0, grasimi: 0, fibre: 0 };
  const lipsa = [];
  let cofeina = 0;
  const adauga = (id, g) => {
    if (!(g > 0)) return null;
    const a = idx.get(id);
    if (!a) { lipsa.push(id); return null; }
    for (const c of Object.keys(valori)) valori[c] += (Number(a[c]) || 0) * g / 100;
    return a;
  };
  if (t) {
    const g = (Number(cantitate) || 0) * t.densitate;
    const a = adauga(t.aliment, g);
    if (a && Number.isFinite(a.cofeina)) cofeina += a.cofeina * g / 100;
  }
  const l = lapteCafea(lapte);
  if (l) adauga(l.id, (Number(lapteMl) || 0) * l.densitate);
  adauga(ZAHAR_CAFEA, Number(zaharG) || 0);
  for (const c of Object.keys(valori)) valori[c] = rot1(valori[c]);
  return { valori, cofeina: Math.round(cofeina), lipsa };
}

function numeImplicitCafea({ tip, lapte, lapteMl }) {
  const t = tipCafea(tip);
  const baza = t ? t.nume : 'Cafea';
  return lapte && lapteMl > 0 ? `${baza} cu ${lapte === 'lapte-soia' ? 'băutură de soia' : 'lapte'}` : baza;
}

// Validarea compoziției (formular, backup, cloud). Întoarce compoziția curată sau aruncă o eroare cu mesaj pe înțeles.
function curataCompozitieCafea(c) {
  if (!c || typeof c !== 'object') throw new Error('Cafea invalidă.');
  const t = tipCafea(c.tip);
  if (!t) throw new Error('Alege felul cafelei.');
  const cantitate = Number(c.cantitate);
  if (!(cantitate > 0 && cantitate <= t.max)) throw new Error(`Cantitatea trebuie să fie între 1 și ${t.max} ${t.unitate}.`);
  const lapte = c.lapte ? String(c.lapte) : null;
  if (lapte && !lapteCafea(lapte)) throw new Error('Alege laptele din listă.');
  const lapteMl = lapte ? Number(c.lapteMl) || 0 : 0;
  if (!(lapteMl >= 0 && lapteMl <= 1000)) throw new Error('Laptele trebuie să fie între 0 și 1000 ml.');
  const zaharG = Number(c.zaharG) || 0;
  if (!(zaharG >= 0 && zaharG <= 100)) throw new Error('Zahărul trebuie să fie între 0 și 100 g.');
  const rez = { tip: t.id, cantitate: rot1(cantitate), lapte: lapte && lapteMl > 0 ? lapte : null, lapteMl: lapte ? rot1(lapteMl) : 0, zaharG: rot1(zaharG) };
  const nume = typeof c.nume === 'string' ? c.nume.trim().slice(0, 60) : '';
  rez.nume = nume || numeImplicitCafea(rez);
  if (typeof c.ora === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(c.ora)) rez.ora = c.ora;
  return rez;
}

const DATA_CAFEA_RE = /^\d{4}-\d{2}-\d{2}$/;

function curataValoriCafea(v) {
  if (!v || typeof v !== 'object') return null;
  const rez = {};
  for (const c of ['kcal', 'proteine', 'carbohidrati', 'grasimi', 'fibre']) {
    const x = Number(v[c]);
    if (!Number.isFinite(x) || x < 0 || x > (c === 'kcal' ? 3000 : 300)) return null;
    rez[c] = x;
  }
  return rez;
}

// O cafea salvată în zi (citire din bază, backup, cloud). Ce e stricat se scoate (null).
function curataCafeaZi(c) {
  if (!c || typeof c !== 'object' || typeof c.id !== 'string' || !c.id || c.id.length > 120) return null;
  let comp;
  try { comp = curataCompozitieCafea(c); } catch (_) { return null; }
  const valori = curataValoriCafea(c.valori);
  const cofeina = Number(c.cofeina);
  if (!valori || !(cofeina >= 0 && cofeina <= 5000)) return null;
  const rez = { id: c.id, ...comp, valori, cofeina };
  if (typeof c.idZilnica === 'string' && c.idZilnica && c.idZilnica.length <= 80) rez.idZilnica = c.idZilnica;
  if (typeof c.baut === 'boolean') rez.baut = c.baut;
  if (Number.isFinite(c.adaugat)) rez.adaugat = c.adaugat;
  if (Number.isFinite(c.modificat)) rez.modificat = c.modificat;
  return rez;
}

function curataListaCafele(lista) {
  if (!Array.isArray(lista)) return [];
  const vazute = new Set();
  return lista.slice(0, 50).map(curataCafeaZi).filter(c => c && !vazute.has(c.id) && vazute.add(c.id));
}
function curataCafeleSarite(lista) {
  if (!Array.isArray(lista)) return [];
  return [...new Set(lista.filter(x => typeof x === 'string' && x && x.length <= 120))].slice(0, 50);
}

// Cafeaua zilnică din setări.
function curataCafeaZilnica(z) {
  if (!z || typeof z !== 'object' || typeof z.id !== 'string' || !/^[a-z0-9-]{1,40}$/i.test(z.id)) return null;
  if (typeof z.dela !== 'string' || !DATA_CAFEA_RE.test(z.dela)) return null;
  let comp;
  try { comp = curataCompozitieCafea(z); } catch (_) { return null; }
  const valori = curataValoriCafea(z.valori);
  const cofeina = Number(z.cofeina);
  if (!valori || !(cofeina >= 0 && cofeina <= 5000)) return null;
  return { id: z.id, ...comp, valori, cofeina, dela: z.dela, activ: z.activ !== false };
}
function curataCafeleZilnice(lista) {
  if (!Array.isArray(lista)) return [];
  const vazute = new Set();
  return lista.slice(0, 20).map(curataCafeaZilnica).filter(z => z && !vazute.has(z.id) && vazute.add(z.id));
}

// O cafea nouă din compoziție (pentru zi sau pentru cafeaua zilnică). Aruncă eroare dacă lipsesc alimente.
function cafeaDinCompozitie(c, idx) {
  const comp = curataCompozitieCafea(c);
  const { valori, cofeina, lipsa } = valoriCafea(comp, idx);
  if (lipsa.length) throw new Error('Unele alimente nu sunt în bibliotecă; valorile nu pot fi calculate.');
  return { ...comp, valori, cofeina };
}

// Id-ul cafelei zilnice într-o zi: același pe toate dispozitivele, ca să nu apară de două ori după sincronizare.
const idCafeaZilnica = (idZilnica, data) => `cz-${idZilnica}-${data}`;

// Cafeaua zilnică așa cum intră în zi. Fără marcaje de timp: conținutul e identic pe orice dispozitiv.
function intrareCafeaZilnica(z, data) {
  const rez = { id: idCafeaZilnica(z.id, data), idZilnica: z.id, nume: z.nume, tip: z.tip, cantitate: z.cantitate, lapte: z.lapte,
    lapteMl: z.lapteMl, zaharG: z.zaharG, valori: { ...z.valori }, cofeina: z.cofeina };
  if (z.ora) rez.ora = z.ora;
  return rez;
}

// Pune cafelele zilnice active în zi (de la data lor de început), dacă nu sunt deja și nu le-ai scos din ziua aceea.
// Întoarce { zi, schimbat }.
function aplicaCafeleZilnice(zi, zilnice) {
  const cafele = Array.isArray(zi.cafele) ? zi.cafele : [];
  const sarite = new Set(Array.isArray(zi.cafeleSarite) ? zi.cafeleSarite : []);
  const existente = new Set(cafele.map(c => c.id));
  const noi = [];
  for (const z of zilnice || []) {
    if (!z.activ || z.dela > zi.data) continue;
    const id = idCafeaZilnica(z.id, zi.data);
    if (existente.has(id) || sarite.has(id)) continue;
    noi.push(intrareCafeaZilnica(z, zi.data));
  }
  if (!noi.length) return { zi, schimbat: false };
  return { zi: { ...zi, cafele: ordoneazaCafele([...cafele, ...noi]) }, schimbat: true };
}

function ordoneazaCafele(lista) {
  return [...lista].sort((a, b) => (a.ora || '99').localeCompare(b.ora || '99'));
}

// Scoate o cafea din zi; cafeaua zilnică rămâne scoasă doar din ziua aceea.
function scoateCafeaDinZi(zi, id) {
  const c = (zi.cafele || []).find(x => x.id === id);
  if (!c) return zi;
  const rez = { ...zi, cafele: zi.cafele.filter(x => x.id !== id) };
  if (c.idZilnica) rez.cafeleSarite = [...new Set([...(zi.cafeleSarite || []), id])];
  return rez;
}

function azi_() {
  if (typeof dataLocala === 'function') return dataLocala();
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Băută? Explicit dacă ai bifat; altfel (cafeaua zilnică) da în zilele de până azi, planificată în viitor.
function cafeaBauta(c, data, azi = azi_()) {
  return typeof c.baut === 'boolean' ? c.baut : data <= azi;
}

// Totalurile cafelei într-o zi.
function totalCafeaZi(zi, azi = azi_()) {
  const zero = () => ({ kcal: 0, proteine: 0, carbohidrati: 0, grasimi: 0, fibre: 0 });
  const planificat = zero(), baut = zero();
  let cofeina = 0, cofeinaPlan = 0, bauteNr = 0, dozaMaxima = 0;
  const lista = (zi && zi.cafele) || [];
  for (const c of lista) {
    const b = cafeaBauta(c, zi.data, azi);
    for (const k of Object.keys(planificat)) {
      planificat[k] += c.valori[k] || 0;
      if (b) baut[k] += c.valori[k] || 0;
    }
    cofeinaPlan += c.cofeina;
    if (b) { cofeina += c.cofeina; bauteNr++; dozaMaxima = Math.max(dozaMaxima, c.cofeina); }
  }
  return { planificat, baut, cofeina, cofeinaPlan, numar: lista.length, baute: bauteNr, dozaMaxima };
}

// Mesajele despre cofeină, față de limita ta (implicit cea EFSA pentru adulți).
function avertizariCofeina(t, limita = LIMITA_COFEINA_ZI) {
  const rez = [];
  if (t.cofeina > limita) rez.push({ tip: 'peste', text: `Ai trecut de limita ta de ${limita} mg de cofeină pe zi.` });
  else if (t.cofeinaPlan > limita) rez.push({ tip: 'atentie', text: `Cu tot ce ai planificat azi ajungi la ${t.cofeinaPlan} mg, peste limita ta de ${limita} mg.` });
  if (t.dozaMaxima > DOZA_COFEINA_UNICA) rez.push({ tip: 'atentie', text: `O singură cafea are peste ${DOZA_COFEINA_UNICA} mg de cofeină (doza unică de referință EFSA).` });
  return rez;
}

// Generatorul de mese: cafeaua planificată în zi se adună la ce e deja fix, ca mesele să completeze restul țintei.
function valoriCafeaPlanificate(zi) {
  return totalCafeaZi(zi).planificat;
}

// Zilele pentru care cafeaua zilnică trebuie scrisă în istoric: de la cea mai veche dată de început (cel mult `maxZile` în urmă) până azi.
function zileDeCompletatCafea(zilnice, azi, maxZile = 120) {
  const active = (zilnice || []).filter(z => z.activ && z.dela <= azi);
  if (!active.length) return [];
  const [a, l, d] = azi.split('-').map(Number);
  const fmt = x => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  const start = active.reduce((m, z) => (z.dela < m ? z.dela : m), azi);
  const rez = [];
  for (let k = 0; k < maxZile; k++) {
    const data = fmt(new Date(a, l - 1, d - k));
    if (data < start) break;
    rez.push(data);
  }
  return rez.reverse();
}

if (typeof module !== 'undefined') {
  module.exports = {
    TIPURI_CAFEA, LAPTE_CAFEA, PRESETURI_CAFEA, LIMITA_COFEINA_ZI, DOZA_COFEINA_UNICA,
    tipCafea, lapteCafea, valoriCafea, numeImplicitCafea, curataCompozitieCafea, curataCafeaZi, curataListaCafele, curataCafeleSarite,
    curataCafeaZilnica, curataCafeleZilnice, cafeaDinCompozitie, idCafeaZilnica, intrareCafeaZilnica, aplicaCafeleZilnice,
    ordoneazaCafele, scoateCafeaDinZi, cafeaBauta, totalCafeaZi, avertizariCofeina, valoriCafeaPlanificate, zileDeCompletatCafea,
  };
}
