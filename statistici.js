// Statistici avansate (etapa 5): perioade, rezumate, evoluție pe săptămâni/luni, distribuția pe grupe,
// progresia pe exercițiu, recorduri pe repetări, forța pe exercițiile principale.
// Fără DOM: doar calcule pe sesiunile salvate (testat în Node, tests/statistici.test.js).
// Folosește din analiza.js: e1rm, serieDeLucru, volumSerie, exercitiiUnite, statisticiSesiune, durataSesiuneMin,
// ziDinData, dataDinZi, cheieSaptamana, recorduriNoi.

const PERIOADE = [
  { cheie: '4s', nume: '4 săpt.', zile: 28 },
  { cheie: '3l', nume: '3 luni', zile: 91 },
  { cheie: '6l', nume: '6 luni', zile: 182 },
  { cheie: '1a', nume: '1 an', zile: 365 },
  { cheie: 'tot', nume: 'Tot', zile: null },
];
const LUNI_STATISTICI = ['ian', 'feb', 'mar', 'apr', 'mai', 'iun', 'iul', 'aug', 'sep', 'oct', 'nov', 'dec'];

// Intervalul unei perioade: { start, sfarsit, zile } (date „AAAA-LL-ZZ", inclusiv capetele).
// „Tot" începe la primul antrenament (sau azi, dacă nu ai niciunul).
function intervalPerioada(cheie, azi, sesiuni) {
  const p = PERIOADE.find(x => x.cheie === cheie) || PERIOADE[0];
  const z = ziDinData(azi);
  if (p.zile === null) {
    const prima = sesiuni.length ? sesiuni.reduce((m, s) => (s.data < m ? s.data : m), sesiuni[0].data) : azi;
    const start = prima < azi ? prima : azi;
    return { start, sfarsit: azi, zile: z - ziDinData(start) + 1, tot: true };
  }
  return { start: dataDinZi(z - p.zile + 1), sfarsit: azi, zile: p.zile, tot: false };
}

// Perioada de aceeași lungime, imediat dinainte (pentru comparație).
function intervalAnterior(iv) {
  const z = ziDinData(iv.start);
  return { start: dataDinZi(z - iv.zile), sfarsit: dataDinZi(z - 1), zile: iv.zile };
}

function sesiuniIn(sesiuni, iv) {
  return sesiuni.filter(s => s.data >= iv.start && s.data <= iv.sfarsit);
}

// Rezumatul unei perioade.
// antrenamente, serii (de lucru), volum, minute (active), zileActive, pePeSaptamana (antrenamente / săptămână),
// volumPeAntrenament.
function rezumatPerioada(sesiuni, iv) {
  const din = sesiuniIn(sesiuni, iv);
  let serii = 0, volum = 0, minute = 0;
  const zile = new Set();
  for (const s of din) {
    const st = statisticiSesiune(s);
    serii += st.serii;
    volum += st.volum;
    minute += durataSesiuneMin(s) || 0;
    zile.add(s.data);
  }
  const saptamani = Math.max(1, iv.zile / 7);
  return {
    antrenamente: din.length, serii, volum, minute, zileActive: zile.size,
    peSaptamana: din.length / saptamani,
    volumPeAntrenament: din.length ? volum / din.length : 0,
  };
}

// Recordurile noi bătute într-o perioadă (aceleași reguli ca insigna din antrenament).
function recorduriInPerioada(sesiuni, iv) {
  return recorduriNoi(sesiuni).filter(e => e.data >= iv.start && e.data <= iv.sfarsit);
}

// Etichetă pentru o săptămână (ziua de luni) sau o lună.
function etichetaSaptamana(luni) {
  const [, l, z] = luni.split('-').map(Number);
  return `${z} ${LUNI_STATISTICI[l - 1]}`;
}
function etichetaLuna(cheie, cuAn = false) {
  const [a, l] = cheie.split('-').map(Number);
  return cuAn ? `${LUNI_STATISTICI[l - 1]} ${String(a).slice(2)}` : LUNI_STATISTICI[l - 1];
}

// Evoluția pe săptămâni sau luni, continuă (inclusiv săptămânile/lunile fără antrenament).
// Întoarce [{ cheie, eticheta, start, antrenamente, serii, volum, minute }].
function evolutie(sesiuni, iv, pas = 'saptamana') {
  const grupuri = [];
  const index = new Map();
  if (pas === 'luna') {
    let [a, l] = iv.start.split('-').map(Number);
    const [aF, lF] = iv.sfarsit.split('-').map(Number);
    const multiAni = a !== aF;
    while (a < aF || (a === aF && l <= lF)) {
      const cheie = `${a}-${String(l).padStart(2, '0')}`;
      index.set(cheie, grupuri.length);
      grupuri.push({ cheie, eticheta: etichetaLuna(cheie, multiAni && (l === 1 || grupuri.length === 0)), start: `${cheie}-01`, antrenamente: 0, serii: 0, volum: 0, minute: 0 });
      l++; if (l > 12) { l = 1; a++; }
    }
  } else {
    let z = ziDinData(cheieSaptamana(iv.start));
    const zF = ziDinData(cheieSaptamana(iv.sfarsit));
    for (; z <= zF; z += 7) {
      const cheie = dataDinZi(z);
      index.set(cheie, grupuri.length);
      grupuri.push({ cheie, eticheta: etichetaSaptamana(cheie), start: cheie, antrenamente: 0, serii: 0, volum: 0, minute: 0 });
    }
  }
  for (const s of sesiuniIn(sesiuni, iv)) {
    const cheie = pas === 'luna' ? s.data.slice(0, 7) : cheieSaptamana(s.data);
    const i = index.get(cheie);
    if (i === undefined) continue;
    const st = statisticiSesiune(s);
    const g = grupuri[i];
    g.antrenamente++; g.serii += st.serii; g.volum += st.volum; g.minute += durataSesiuneMin(s) || 0;
  }
  return grupuri;
}

// Distribuția pe grupe musculare: serii de lucru și volum pe grupa principală a fiecărui exercițiu.
// Întoarce [{ grupa, serii, volum, procent (din serii) }], descrescător după serii.
function distributieGrupe(sesiuni, iv, grupaDe) {
  const m = new Map();
  for (const s of sesiuniIn(sesiuni, iv)) {
    for (const ex of exercitiiUnite(s)) {
      let serii = 0, volum = 0;
      for (const se of ex.serii) {
        if (!serieDeLucru(se)) continue;
        serii++;
        volum += volumSerie(se, ex, s.data, s);
      }
      if (!serii) continue;
      const g = grupaDe(ex.nume) || 'Nealocat';
      const r = m.get(g) || { grupa: g, serii: 0, volum: 0 };
      r.serii += serii; r.volum += volum;
      m.set(g, r);
    }
  }
  const total = [...m.values()].reduce((t, r) => t + r.serii, 0);
  return [...m.values()].map(r => ({ ...r, procent: total ? r.serii / total * 100 : 0 }))
    .sort((a, b) => b.serii - a.serii || a.grupa.localeCompare(b.grupa, 'ro'));
}

// Progresia unui exercițiu: un punct pe sesiune în care are serii de lucru.
// { data, e1rm, e1rmSerie, kgMax, kgMaxRepetari, volum, repetariMax, serii, durataMax, distantaMax, sesiune }
function progresieExercitiu(sesiuni, nume) {
  const cautat = String(nume).toLowerCase();
  const puncte = [];
  for (const s of sesiuni) {
    const ex = exercitiiUnite(s).find(e => e.nume.toLowerCase() === cautat);
    if (!ex) continue;
    const p = { data: s.data, e1rm: 0, e1rmSerie: null, kgMax: 0, kgMaxRepetari: 0, volum: 0, repetariMax: 0,
      serii: 0, durataMax: 0, distantaMax: 0, seriiLucru: [], sesiune: s };
    for (const se of ex.serii) {
      if (!serieDeLucru(se)) continue;
      p.serii++;
      p.seriiLucru.push(se);
      p.volum += volumSerie(se, ex, s.data, s);
      if (se.durataSec > p.durataMax) p.durataMax = se.durataSec;
      if (se.distantaM > p.distantaMax) p.distantaMax = se.distantaM;
      if (!(se.repetari > 0)) continue;
      const kg = se.kg > 0 ? se.kg : 0;
      const est = e1rm(kg, se.repetari);
      if (est > p.e1rm) { p.e1rm = est; p.e1rmSerie = se; }
      if (kg > p.kgMax || (kg === p.kgMax && se.repetari > p.kgMaxRepetari)) { p.kgMax = kg; p.kgMaxRepetari = se.repetari; }
      if (se.repetari > p.repetariMax) p.repetariMax = se.repetari;
    }
    if (p.serii) puncte.push(p);
  }
  return puncte;
}

// Metricile disponibile pentru un exercițiu, după ce date are.
const METRICI = {
  e1rm: { nume: '1RM estimat', unitate: 'kg', valoare: p => p.e1rm },
  kgMax: { nume: 'Greutate maximă', unitate: 'kg', valoare: p => p.kgMax },
  volum: { nume: 'Volum', unitate: 'kg', valoare: p => p.volum },
  repetariMax: { nume: 'Repetări maxime', unitate: '', valoare: p => p.repetariMax },
  durataMax: { nume: 'Cel mai lung timp', unitate: 's', valoare: p => p.durataMax },
  distantaMax: { nume: 'Distanța maximă', unitate: 'm', valoare: p => p.distantaMax },
};
function metriciDisponibile(puncte) {
  const are = k => puncte.some(p => METRICI[k].valoare(p) > 0);
  return Object.keys(METRICI).filter(are);
}

// Schimbarea unei metrici într-o listă de puncte: prima sesiune față de ultima.
// null dacă sunt mai puțin de două sesiuni cu valoare.
function schimbareMetrica(puncte, cheie) {
  const v = puncte.map(p => METRICI[cheie].valoare(p)).filter(x => x > 0);
  if (v.length < 2) return null;
  const de = v[0], la = v[v.length - 1];
  return { de, la, diferenta: la - de, procent: de > 0 ? (la - de) / de * 100 : null, sesiuni: v.length };
}

// Cea mai mare greutate ridicată pentru cel puțin N repetări (o serie de 60×10 contează și la 8 repetări).
// Toate sesiunile (recorduri absolute). Întoarce [{ repetari, kg, repetariFacute, data }] (kg 0 = nimic încă).
function recorduriPeRepetari(sesiuni, nume, praguri = [1, 3, 5, 8, 10, 12]) {
  const cautat = String(nume).toLowerCase();
  const rez = praguri.map(r => ({ repetari: r, kg: 0, repetariFacute: 0, data: null }));
  for (const s of sesiuni) {
    for (const ex of exercitiiUnite(s)) {
      if (ex.nume.toLowerCase() !== cautat) continue;
      for (const se of ex.serii) {
        if (!serieDeLucru(se) || !(se.repetari > 0) || !(se.kg > 0)) continue;
        for (const r of rez) {
          if (se.repetari >= r.repetari && se.kg > r.kg) { r.kg = se.kg; r.repetariFacute = se.repetari; r.data = s.data; }
        }
      }
    }
  }
  return rez;
}

// Forța pe exercițiile făcute cel mai des în perioadă (cu greutate): 1RM estimat la prima și la ultima sesiune,
// plus cel mai bun 1RM din toate timpurile. [{ nume, sesiuni, de, la, procent, recordAbsolut, dataRecord }]
function fortaPrincipale(sesiuni, iv, limita = 6) {
  const din = sesiuniIn(sesiuni, iv);
  const frecventa = new Map();
  for (const s of din) {
    for (const ex of exercitiiUnite(s)) {
      if (!ex.serii.some(se => serieDeLucru(se) && se.repetari > 0 && se.kg > 0)) continue;
      const k = ex.nume.toLowerCase();
      const f = frecventa.get(k) || { nume: ex.nume, n: 0 };
      f.n++; frecventa.set(k, f);
    }
  }
  return [...frecventa.values()]
    .sort((a, b) => b.n - a.n || a.nume.localeCompare(b.nume, 'ro'))
    .slice(0, limita)
    .map(f => {
      const toate = progresieExercitiu(sesiuni, f.nume).filter(p => p.e1rm > 0);
      const inPerioada = toate.filter(p => p.data >= iv.start && p.data <= iv.sfarsit);
      const de = inPerioada[0].e1rm, la = inPerioada[inPerioada.length - 1].e1rm;
      const rec = toate.reduce((b, p) => (p.e1rm > b.e1rm ? p : b), toate[0]);
      return { nume: f.nume, sesiuni: inPerioada.length, de, la, procent: inPerioada.length > 1 && de > 0 ? (la - de) / de * 100 : null,
        recordAbsolut: rec.e1rm, dataRecord: rec.data };
    });
}

// Lista recordurilor personale (din recorduriDin), cu recordul principal al fiecărui exercițiu și data lui,
// cele mai recente întâi. [{ nume, tip, valoare, detaliu, data }]
function listaRecorduri(rec) {
  const lista = [];
  for (const r of rec.values()) {
    if (r.kg > 0) lista.push({ nume: r.nume, tip: 'forta', valoare: r.e1rm, kg: r.kg, kgRepetari: r.kgRepetari, kgData: r.kgData, e1rmKg: r.e1rmKg, e1rmRepetari: r.e1rmRepetari, data: r.e1rmData > r.kgData ? r.e1rmData : r.kgData });
    else if (r.repetari > 0) lista.push({ nume: r.nume, tip: 'repetari', valoare: r.repetari, data: r.repetariData });
    else if (r.durata > 0) lista.push({ nume: r.nume, tip: 'durata', valoare: r.durata, data: r.durataData });
    else if (r.distanta > 0) lista.push({ nume: r.nume, tip: 'distanta', valoare: r.distanta, data: r.distantaData });
  }
  return lista.sort((a, b) => (b.data || '').localeCompare(a.data || '') || a.nume.localeCompare(b.nume, 'ro'));
}

if (typeof module !== 'undefined') {
  module.exports = { PERIOADE, intervalPerioada, intervalAnterior, sesiuniIn, rezumatPerioada, recorduriInPerioada,
    evolutie, distributieGrupe, progresieExercitiu, METRICI, metriciDisponibile, schimbareMetrica, recorduriPeRepetari,
    fortaPrincipale, listaRecorduri, etichetaSaptamana, etichetaLuna };
}
