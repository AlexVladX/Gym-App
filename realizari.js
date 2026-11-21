// Realizări (etapa 7): nivel, obiectivul săptămânal și insignele. Totul se calculează din datele salvate
// (antrenamente, cântăriri, măsurători, poze), nu se ține separat: dacă editezi sau ștergi un antrenament,
// realizările se recalculează. Fără DOM (testat în Node, tests/realizari.test.js).
// Folosește din analiza.js: statisticiSesiune, durataSesiuneMin, recorduriNoi, exercitiiUnite, serieDeLucru, e1rm,
// cheieSaptamana, ziDinData, dataDinZi; din corp-calcul.js: valoriZilnice, mediaMobila.

// ---------- Nivel ----------
// Nivelul depinde doar de numărul de antrenamente încheiate: pragul nivelului N+1 e PRAGURI_NIVEL[N].
const PRAGURI_NIVEL = [0, 1, 5, 10, 20, 35, 50, 75, 100, 150, 200, 300, 400, 500, 750, 1000];
function nivelDin(antrenamente) {
  let n = 0;
  while (n < PRAGURI_NIVEL.length && antrenamente >= PRAGURI_NIVEL[n]) n++;
  const de = PRAGURI_NIVEL[n - 1];
  const urmator = n < PRAGURI_NIVEL.length ? PRAGURI_NIVEL[n] : null;
  return { nivel: n, antrenamente, de, urmator, progres: urmator === null ? 1 : (antrenamente - de) / (urmator - de), maxim: urmator === null };
}

// ---------- Săptămâni ----------
// Antrenamente pe săptămână (luni), în ordine: [{ luni, numar, primaData, dataN: data antrenamentului N din săptămână }]
function saptamaniCuAntrenamente(sesiuni) {
  const m = new Map();
  for (const s of [...sesiuni].sort((a, b) => a.data.localeCompare(b.data))) {
    const k = cheieSaptamana(s.data);
    if (!m.has(k)) m.set(k, { luni: k, date: [] });
    m.get(k).date.push(s.data);
  }
  return [...m.values()].sort((a, b) => a.luni.localeCompare(b.luni));
}

// Obiectivul săptămânal: câte antrenamente ai săptămâna aceasta, seria de săptămâni cu obiectivul atins
// (săptămâna curentă intră doar când e atins; până la duminică nu rupe seria) și cea mai lungă serie.
function obiectivSaptamanal(sesiuni, azi, tinta) {
  const sapt = saptamaniCuAntrenamente(sesiuni);
  const pe = new Map(sapt.map(w => [w.luni, w.date.length]));
  const luniAzi = ziDinData(cheieSaptamana(azi));
  const facute = pe.get(dataDinZi(luniAzi)) || 0;
  let z = facute >= tinta ? luniAzi : luniAzi - 7;
  let serie = 0;
  while ((pe.get(dataDinZi(z)) || 0) >= tinta) { serie++; z -= 7; }
  let maxima = 0, curenta = 0, anterioara = null;
  for (const w of sapt) {
    const zl = ziDinData(w.luni);
    if (zl === luniAzi && w.date.length < tinta) continue; // săptămâna în curs, încă neatinsă
    if (w.date.length >= tinta) {
      curenta = anterioara !== null && zl - anterioara === 7 ? curenta + 1 : 1;
      anterioara = zl;
      maxima = Math.max(maxima, curenta);
    }
  }
  return { facute, tinta, atins: facute >= tinta, serie, serieMaxima: Math.max(maxima, serie) };
}

// ---------- Insigne ----------
// Fiecare familie dă o serie cronologică { data, valoare } crescătoare (maximul de până atunci);
// o treaptă (prag) se deblochează la prima dată în care valoarea ajunge la prag.
const ZONE_PRINCIPALE = {
  Piept: 'Piept', Spate: 'Spate', Umeri: 'Umeri', Biceps: 'Brațe', Triceps: 'Brațe', Antebrațe: 'Brațe',
  Cvadricepși: 'Picioare', Femurali: 'Picioare', Fese: 'Picioare', Gambe: 'Picioare', Picioare: 'Picioare', Abdomen: 'Abdomen',
};
const NR_ZONE = 6;

function cumulat(evenimente) {
  // evenimente: [{ data, plus }] → [{ data, valoare }] cumulat, în ordine
  let v = 0;
  return evenimente.sort((a, b) => a.data.localeCompare(b.data)).map(e => ({ data: e.data, valoare: (v += e.plus) }));
}
function maximPanaAcum(evenimente) {
  let v = -Infinity;
  const rez = [];
  for (const e of evenimente.sort((a, b) => a.data.localeCompare(b.data))) {
    if (e.valoare > v) { v = e.valoare; rez.push({ data: e.data, valoare: v }); }
  }
  return rez;
}
function seriiSaptamani(sesiuni, conditie) {
  // pentru fiecare săptămână care îndeplinește condiția: lungimea seriei consecutive, la data la care a fost îndeplinită
  const ev = [];
  let curenta = 0, anterioara = null;
  for (const w of saptamaniCuAntrenamente(sesiuni)) {
    const data = conditie(w);
    if (!data) continue;
    const zl = ziDinData(w.luni);
    curenta = anterioara !== null && zl - anterioara === 7 ? curenta + 1 : 1;
    anterioara = zl;
    ev.push({ data, valoare: curenta });
  }
  return maximPanaAcum(ev);
}

// Forța față de greutatea corpului: cel mai bun 1RM estimat / greutatea ta la data sesiunii.
function raportForta(sesiuni, nume, greutateLa) {
  if (!greutateLa) return [];
  const ev = [];
  for (const s of sesiuni) {
    for (const ex of exercitiiUnite(s)) {
      if (!nume.includes(ex.nume.toLowerCase())) continue;
      const corp = greutateLa(s.data);
      if (!(corp > 0)) continue;
      let best = 0;
      for (const se of ex.serii) if (serieDeLucru(se) && se.repetari > 0 && se.kg > 0) best = Math.max(best, e1rm(se.kg, se.repetari));
      if (best > 0) ev.push({ data: s.data, valoare: Math.round(best / corp * 100) / 100 });
    }
  }
  return maximPanaAcum(ev);
}

// Definițiile familiilor de insigne. f(ctx) → seria de valori. format: cum se afișează o valoare.
const FAMILII_INSIGNE = [
  { id: 'antrenamente', categorie: 'Consecvență', nume: 'Antrenamente', descriere: 'Antrenamente încheiate',
    praguri: [1, 10, 25, 50, 100, 250, 500], format: v => String(v),
    serie: c => cumulat(c.sesiuni.map(s => ({ data: s.data, plus: 1 }))) },
  { id: 'saptamani', categorie: 'Consecvență', nume: 'Săptămâni la rând', descriere: 'Săptămâni consecutive cu cel puțin un antrenament',
    praguri: [2, 4, 8, 12, 26, 52], format: v => String(v),
    serie: c => seriiSaptamani(c.sesiuni, w => w.date[0]) },
  { id: 'obiectiv', categorie: 'Consecvență', nume: 'Obiectivul săptămânal', descriere: 'Săptămâni consecutive cu obiectivul săptămânal atins',
    praguri: [2, 4, 8, 12, 26], format: v => String(v),
    serie: c => seriiSaptamani(c.sesiuni, w => (w.date.length >= c.tinta ? w.date[c.tinta - 1] : null)) },
  { id: 'volum', categorie: 'Volum', nume: 'Tone ridicate', descriere: 'Volum total (greutate × repetări), în tone',
    praguri: [10, 50, 100, 250, 500, 1000], format: v => (v >= 100 ? String(Math.floor(v)) : String(Math.floor(v * 10) / 10)),
    serie: c => cumulat(c.sesiuni.map(s => ({ data: s.data, plus: statisticiSesiune(s).volum / 1000 }))) },
  { id: 'ore', categorie: 'Volum', nume: 'Ore de antrenament', descriere: 'Timp activ total, în ore',
    praguri: [10, 25, 50, 100, 250], format: v => String(Math.floor(v)),
    serie: c => cumulat(c.sesiuni.map(s => ({ data: s.data, plus: (durataSesiuneMin(s) || 0) / 60 }))) },
  { id: 'recorduri', categorie: 'Recorduri', nume: 'Recorduri personale', descriere: 'Recorduri noi bătute (greutate, 1RM estimat, repetări, timp sau distanță)',
    praguri: [1, 10, 25, 50, 100], format: v => String(v),
    serie: c => cumulat(recorduriNoi(c.sesiuni).map(e => ({ data: e.data, plus: 1 }))) },
  { id: 'exercitii', categorie: 'Varietate', nume: 'Exerciții diferite', descriere: 'Exerciții diferite încercate',
    praguri: [10, 25, 50], format: v => String(v),
    serie: c => {
      const vazute = new Set(), ev = [];
      for (const s of [...c.sesiuni].sort((a, b) => a.data.localeCompare(b.data))) {
        for (const ex of exercitiiUnite(s)) {
          const k = ex.nume.toLowerCase();
          if (!vazute.has(k) && ex.serii.some(serieDeLucru)) { vazute.add(k); ev.push({ data: s.data, plus: 1 }); }
        }
      }
      return cumulat(ev);
    } },
  { id: 'complet', categorie: 'Varietate', nume: 'Corp complet', descriere: 'Săptămâni în care ai lucrat toate cele 6 zone: piept, spate, umeri, brațe, picioare, abdomen',
    praguri: [1, 5, 20], format: v => String(v),
    serie: c => {
      const ev = [];
      for (const w of saptamaniCuAntrenamente(c.sesiuni)) {
        const zone = new Set();
        let data = null;
        for (const s of c.sesiuni.filter(x => cheieSaptamana(x.data) === w.luni).sort((a, b) => a.data.localeCompare(b.data))) {
          for (const ex of exercitiiUnite(s)) {
            if (!ex.serii.some(serieDeLucru)) continue;
            const z = ZONE_PRINCIPALE[c.grupaDe(ex.nume)];
            if (z) zone.add(z);
          }
          if (zone.size === NR_ZONE) { data = s.data; break; }
        }
        if (data) ev.push({ data, plus: 1 });
      }
      return cumulat(ev);
    } },
  { id: 'impins', categorie: 'Forță', nume: 'Împins la piept', descriere: '1RM estimat la împins cu bara pe bancă, față de greutatea ta',
    praguri: [0.75, 1, 1.25, 1.5], format: v => `${Math.round(v * 100) / 100}×`, cereGreutate: true,
    serie: c => raportForta(c.sesiuni, ['împins cu bara pe bancă'], c.greutateCorpLa) },
  { id: 'genuflexiuni', categorie: 'Forță', nume: 'Genuflexiuni', descriere: '1RM estimat la genuflexiuni cu bara, față de greutatea ta',
    praguri: [1, 1.25, 1.5, 2], format: v => `${Math.round(v * 100) / 100}×`, cereGreutate: true,
    serie: c => raportForta(c.sesiuni, ['genuflexiuni cu bara'], c.greutateCorpLa) },
  { id: 'indreptari', categorie: 'Forță', nume: 'Îndreptări', descriere: '1RM estimat la îndreptări, față de greutatea ta',
    praguri: [1.25, 1.5, 2, 2.5], format: v => `${Math.round(v * 100) / 100}×`, cereGreutate: true,
    serie: c => raportForta(c.sesiuni, ['îndreptări (deadlift)'], c.greutateCorpLa) },
  { id: 'tractiuni', categorie: 'Forță', nume: 'Tracțiuni', descriere: 'Repetări într-o serie de tracțiuni (orice priză)',
    praguri: [1, 5, 10, 15, 20], format: v => String(v),
    serie: c => {
      const ev = [];
      for (const s of c.sesiuni) for (const ex of exercitiiUnite(s)) {
        if (!['tracțiuni', 'tracțiuni cu priză supinată'].includes(ex.nume.toLowerCase())) continue;
        for (const se of ex.serii) if (serieDeLucru(se) && se.repetari > 0) ev.push({ data: s.data, valoare: se.repetari });
      }
      return maximPanaAcum(ev);
    } },
  { id: 'cantariri', categorie: 'Corp', nume: 'Cântăriri', descriere: 'Zile în care te-ai cântărit',
    praguri: [1, 10, 50, 100], format: v => String(v),
    serie: c => cumulat(valoriZilnice(c.masuratori, 'Greutate').map(z => ({ data: z.data, plus: 1 }))) },
  { id: 'masurari', categorie: 'Corp', nume: 'Măsurări complete', descriere: 'Zile cu cel puțin 5 măsurători (în afară de greutate)',
    praguri: [1, 5, 12], format: v => String(v),
    serie: c => {
      const pe = new Map();
      for (const m of c.masuratori) {
        if (!m || typeof m.tip !== 'string' || m.tip.toLowerCase() === 'greutate') continue;
        if (!pe.has(m.data)) pe.set(m.data, new Set());
        pe.get(m.data).add(m.tip.toLowerCase());
      }
      return cumulat([...pe.entries()].filter(([, t]) => t.size >= 5).map(([data]) => ({ data, plus: 1 })));
    } },
  { id: 'poze', categorie: 'Corp', nume: 'Poze de progres', descriere: 'Zile cu poze de progres',
    praguri: [1, 3, 10], format: v => String(v),
    serie: c => cumulat([...new Set(c.poze.map(p => p.data))].map(data => ({ data, plus: 1 }))) },
  { id: 'tinta', categorie: 'Corp', nume: 'Greutatea țintă', descriere: 'Ai ajuns la greutatea țintă (media pe 7 zile)',
    praguri: [1], format: v => (v ? 'atinsă' : 'încă nu'), cereObiectiv: true,
    serie: c => {
      const o = c.obiectiv;
      if (!o) return [];
      const medie = mediaMobila(valoriZilnice(c.masuratori, 'Greutate'), 7).filter(x => x.data >= o.dela);
      const atinsa = medie.find(x => (o.tinta < o.start ? x.valoare <= o.tinta : x.valoare >= o.tinta));
      return atinsa ? [{ data: atinsa.data, valoare: 1 }] : [];
    } },
];

// Treapta după poziție: bronz, argint, aur; ultima dintr-o familie de 4+ e platină.
function metal(i, total) {
  if (total >= 4 && i === total - 1) return 'platina';
  if (total === 1) return 'aur';
  return ['bronz', 'argint', 'aur'][Math.min(2, Math.floor(i * 3 / (total - (total >= 4 ? 1 : 0))))];
}

// Toate insignele, cu starea fiecărei trepte.
// ctx: { sesiuni, masuratori, poze, tinta, grupaDe, greutateCorpLa, obiectiv }
function calculeazaInsigne(ctx) {
  const c = { masuratori: [], poze: [], tinta: 3, grupaDe: () => null, greutateCorpLa: null, obiectiv: null, ...ctx };
  return FAMILII_INSIGNE.map(f => {
    const serie = f.serie(c);
    const valoare = serie.length ? serie[serie.length - 1].valoare : 0;
    const trepte = f.praguri.map((prag, i) => {
      const e = serie.find(x => x.valoare >= prag - 1e-9);
      return { prag, data: e ? e.data : null, metal: metal(i, f.praguri.length), eticheta: f.format(prag) };
    });
    const urmatoarea = trepte.find(t => !t.data) || null;
    const indisponibil = (f.cereGreutate && !c.greutateCorpLa) ? 'Notează-ți greutatea în Corp.'
      : (f.cereObiectiv && !c.obiectiv) ? 'Setează o greutate țintă în Corp.' : null;
    return {
      id: f.id, categorie: f.categorie, nume: f.nume, descriere: f.descriere, valoare, valoareText: f.format(valoare), trepte,
      deblocate: trepte.filter(t => t.data).length,
      urmatoarea, progres: urmatoarea ? Math.max(0, Math.min(1, valoare / urmatoarea.prag)) : 1,
      indisponibil,
    };
  });
}

// Treptele deblocate, cele mai recente întâi: [{ id, nume, prag, eticheta, metal, data }]
function deblocateRecent(insigne) {
  const r = [];
  for (const i of insigne) for (const t of i.trepte) if (t.data) r.push({ id: i.id, nume: i.nume, prag: t.prag, eticheta: t.eticheta, metal: t.metal, data: t.data });
  return r.sort((a, b) => b.data.localeCompare(a.data) || b.prag - a.prag);
}

// Ce s-a deblocat între două calcule (de ex. înainte și după salvarea unui antrenament).
function deblocateNoi(inainte, dupa) {
  const aveam = new Set();
  for (const i of inainte) for (const t of i.trepte) if (t.data) aveam.add(`${i.id}:${t.prag}`);
  const noi = [];
  for (const i of dupa) for (const t of i.trepte) if (t.data && !aveam.has(`${i.id}:${t.prag}`)) noi.push({ id: i.id, nume: i.nume, eticheta: t.eticheta, metal: t.metal });
  return noi;
}

// Insigna cea mai apropiată de deblocare (pentru ecranul Acasă): cea cu cel mai mare progres, care se poate obține.
function urmatoareaInsigna(insigne) {
  return insigne.filter(i => i.urmatoarea && !i.indisponibil && i.valoare > 0)
    .sort((a, b) => b.progres - a.progres)[0] || null;
}

if (typeof module !== 'undefined') {
  module.exports = { PRAGURI_NIVEL, nivelDin, obiectivSaptamanal, FAMILII_INSIGNE, calculeazaInsigne, deblocateRecent, deblocateNoi,
    urmatoareaInsigna, metal, saptamaniCuAntrenamente };
}
