// Nutriție — lista de cumpărături (etapa 10). Fără DOM, testabilă în Node (tests/nutritie-cumparaturi.test.js).
//
// Lista se CALCULEAZĂ de fiecare dată din mesele planificate în intervalul ales (o zi, o săptămână), deci se
// actualizează singură când schimbi planul. Ce faci tu pe listă se păstrează separat (store-ul listeCumparaturi,
// cheie = intervalul): ce ai bifat ca cumpărat, ce ai scos, cantitățile modificate și articolele adăugate de tine.
//
// Regula: intră mesele neîncepute (cele mâncate sau parțiale au fost deja gătite, deci cumpărate). Cantitățile sunt
// ale ingredientelor crude, din intrarea din zi (cu cantitățile ajustate de tine), × porțiile planificate.
//
// Înregistrarea salvată: { id: 'AAAA-LL-ZZ_AAAA-LL-ZZ', de, pana, cumparate: { idAliment: true }, eliminate: { idAliment: true },
//   cantitati: { idAliment: { grame, laPlan } }, personalizate: [{ id, nume, cantitate, cat, cumparat }], modificat }

const CATEGORII_CUMPARATURI = [
  { id: 'carne', nume: 'Carne și pește' }, { id: 'lactate', nume: 'Lactate și ouă' }, { id: 'legume', nume: 'Legume' },
  { id: 'fructe', nume: 'Fructe' }, { id: 'cereale', nume: 'Cereale' }, { id: 'nuci', nume: 'Nuci și semințe' },
  { id: 'altele', nume: 'Alte ingrediente' },
];

function stareListaGoala(de, pana) {
  return { id: `${de}_${pana}`, de, pana, cumparate: {}, eliminate: {}, cantitati: {}, personalizate: [] };
}

// Cantitatea de cumpărat, rotunjită în sus (nu cumperi 37 g): până la 50 g din 5 în 5, până la 500 g din 10 în 10, apoi din 50 în 50.
function rotunjesteCumparare(g) {
  if (!(g > 0)) return 0;
  const pas = g <= 50 ? 5 : g <= 500 ? 10 : 50;
  return Math.ceil(g / pas - 1e-9) * pas;
}

// exact: cantitatea scrisă de utilizator se afișează cum a scris-o, fără rotunjire.
function textCantitateCumparare(aliment, grame, { exact = false } = {}) {
  const g = exact ? Math.round(grame) : rotunjesteCumparare(grame);
  const textG = g >= 1000 ? `${String(Math.round(g / 100) / 10).replace('.', ',')} kg` : `${g} g`;
  if (aliment && Array.isArray(aliment.buc)) {
    const [gBuc, unu, multe] = aliment.buc;
    const n = Math.max(1, Math.ceil(grame / gBuc - 0.05)); // toleranță mică: 1,03 bucăți = 1 bucată
    return `${n} ${n === 1 ? unu : multe} (${textG})`;
  }
  return textG;
}

// Ingredientele meselor neîncepute din zile, adunate pe aliment.
// retete: pentru intrările vechi fără ingredientePortie se iau ingredientele rețetei (dacă mai există).
function ingredienteDinZile(zile, { retete = [], includeIncepute = false } = {}) {
  const dupaId = new Map(retete.map(r => [r.id, r]));
  const total = new Map();
  let mese = 0, faraIngrediente = 0, excluseMancate = 0;
  for (const zi of zile || []) {
    for (const i of (zi && zi.mese) || []) {
      if (i.stare !== 'neinceput' && !includeIncepute) { excluseMancate++; continue; }
      let ing = i.ingredientePortie;
      if (!ing) {
        const r = dupaId.get(i.idReteta);
        if (r) ing = r.ingrediente.map(([id, g]) => [id, g / (r.portii || 1)]);
      }
      if (!ing || !ing.length) { faraIngrediente++; continue; }
      mese++;
      for (const [id, g] of ing) {
        const grame = (Number(g) || 0) * i.portii;
        if (!(grame > 0)) continue;
        if (!total.has(id)) total.set(id, { id, grame: 0, surse: [] });
        const t = total.get(id);
        t.grame += grame;
        t.surse.push({ data: zi.data, masa: i.masa, nume: i.nume, grame });
      }
    }
  }
  return { ingrediente: total, mese, faraIngrediente, excluseMancate };
}

// Lista afișată: ingredientele calculate + ce ai făcut tu pe listă.
function construiesteLista({ zile, idx, retete, stare }) {
  const s = stare || stareListaGoala('', '');
  const { ingrediente, mese, faraIngrediente, excluseMancate } = ingredienteDinZile(zile, { retete });
  const categorii = new Map(CATEGORII_CUMPARATURI.map(c => [c.id, { ...c, articole: [] }]));
  let eliminate = 0;
  for (const t of ingrediente.values()) {
    if (s.eliminate[t.id]) { eliminate++; continue; }
    const a = idx.get(t.id);
    const ed = s.cantitati[t.id];
    // cantitatea ta rămâne, dar dacă planul s-a schimbat de când ai modificat-o, arătăm noua cantitate din plan
    const grame = ed ? ed.grame : t.grame;
    const planSchimbat = ed ? Math.abs(rotunjesteCumparare(ed.laPlan) - rotunjesteCumparare(t.grame)) > 0 : false;
    const art = { cheie: t.id, id: t.id, nume: a ? a.nume : 'Aliment șters din bibliotecă', grame, grameDinPlan: t.grame,
      text: textCantitateCumparare(a, grame, { exact: Boolean(ed) }), textPlan: textCantitateCumparare(a, t.grame), editat: Boolean(ed), planSchimbat,
      cumparat: Boolean(s.cumparate[t.id]), surse: t.surse, personalizat: false };
    const cat = categorii.get(a && categorii.has(a.cat) ? a.cat : 'altele');
    cat.articole.push(art);
  }
  for (const p of s.personalizate) {
    const cat = categorii.get(categorii.has(p.cat) ? p.cat : 'altele');
    cat.articole.push({ cheie: p.id, id: p.id, nume: p.nume, text: p.cantitate || '', cumparat: Boolean(p.cumparat), personalizat: true, surse: [] });
  }
  for (const c of categorii.values()) c.articole.sort((x, y) => (x.cumparat - y.cumparat) || x.nume.localeCompare(y.nume, 'ro'));
  const lista = [...categorii.values()].filter(c => c.articole.length);
  const toate = lista.flatMap(c => c.articole);
  return { categorii: lista, total: toate.length, cumparate: toate.filter(x => x.cumparat).length, mese, faraIngrediente, excluseMancate, eliminate };
}

// Lista ca text simplu (pentru partajare, notițe, mesaj).
function textLista(lista, titlu) {
  const randuri = [titlu, ''];
  for (const c of lista.categorii) {
    randuri.push(c.nume.toUpperCase());
    for (const a of c.articole) randuri.push(`${a.cumparat ? '☑' : '☐'} ${a.nume}${a.text ? ` — ${a.text}` : ''}`);
    randuri.push('');
  }
  randuri.push(`${lista.total} articole · ${lista.cumparate} cumpărate`);
  return randuri.join('\n');
}

function curataListaCumparaturi(l) {
  const DATA = /^\d{4}-\d{2}-\d{2}$/;
  if (!l || typeof l !== 'object' || !DATA.test(l.de || '') || !DATA.test(l.pana || '')) return null;
  const obiect = (o, f) => {
    const rez = {};
    if (o && typeof o === 'object' && !Array.isArray(o)) for (const [k, v] of Object.entries(o)) if (typeof k === 'string' && k.length <= 80 && f(v)) rez[k] = v;
    return rez;
  };
  const rez = { ...l, id: `${l.de}_${l.pana}`,
    cumparate: obiect(l.cumparate, v => v === true),
    eliminate: obiect(l.eliminate, v => v === true),
    cantitati: obiect(l.cantitati, v => v && Number.isFinite(v.grame) && v.grame > 0 && v.grame <= 100000 && Number.isFinite(v.laPlan)),
    personalizate: (Array.isArray(l.personalizate) ? l.personalizate : []).filter(p => p && typeof p.id === 'string' && p.id.length <= 80 &&
      typeof p.nume === 'string' && p.nume.trim() && p.nume.length <= 120).map(p => ({ id: p.id, nume: p.nume.trim(),
      cantitate: typeof p.cantitate === 'string' ? p.cantitate.slice(0, 60) : '', cat: CATEGORII_CUMPARATURI.some(c => c.id === p.cat) ? p.cat : 'altele',
      cumparat: p.cumparat === true })).slice(0, 300) };
  return rez;
}

if (typeof module !== 'undefined') {
  module.exports = { CATEGORII_CUMPARATURI, stareListaGoala, rotunjesteCumparare, textCantitateCumparare, ingredienteDinZile,
    construiesteLista, textLista, curataListaCumparaturi };
}
