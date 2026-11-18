// Calcule pe istoricul sesiunilor: recorduri personale și sugestii de progresie.
// Nu atinge pagina (DOM), doar date, ca să poată fi testat separat.

// Forța estimată pentru o singură repetare (formula Epley).
function e1rm(kg, repetari) {
  return repetari > 0 ? kg * (1 + repetari / 30) : 0;
}

function serieValida(s) {
  return s.repetari > 0 && s.kg >= 0;
}

// Recordurile pe fiecare exercițiu, cheie: numele cu litere mici.
// { kg, kgRepetari, kgData, e1rm, e1rmKg, e1rmRepetari, e1rmData, repetari, repetariData, volum, volumData }
function recorduriDin(sesiuni) {
  const rec = new Map();
  for (const s of sesiuni) actualizeazaRecorduri(rec, s);
  return rec;
}

// Adaugă o sesiune la recordurile existente (folosit și pentru reluarea istoricului pas cu pas).
function actualizeazaRecorduri(rec, s) {
  for (const ex of s.exercitii) {
    const cheie = ex.nume.toLowerCase();
    let r = rec.get(cheie);
    if (!r) {
      r = { nume: ex.nume, kg: 0, kgRepetari: 0, kgData: null, e1rm: 0, e1rmKg: 0, e1rmRepetari: 0,
        e1rmData: null, repetari: 0, repetariData: null, volum: 0, volumData: null };
      rec.set(cheie, r);
    }
    let volum = 0;
    for (const se of ex.serii) {
      if (!serieValida(se)) continue;
      volum += se.kg * se.repetari;
      if (se.kg > r.kg || (se.kg === r.kg && se.repetari > r.kgRepetari)) {
        r.kg = se.kg; r.kgRepetari = se.repetari; r.kgData = s.data;
      }
      const est = e1rm(se.kg, se.repetari);
      if (est > r.e1rm) {
        r.e1rm = est; r.e1rmKg = se.kg; r.e1rmRepetari = se.repetari; r.e1rmData = s.data;
      }
      if (se.repetari > r.repetari) { r.repetari = se.repetari; r.repetariData = s.data; }
    }
    if (volum > r.volum) { r.volum = volum; r.volumData = s.data; }
  }
  return rec;
}

// Este seria un record nou față de recordurile anterioare?
// Prima dată când faci un exercițiu nu se consideră record (nu ai cu ce compara).
// Pentru exercițiile fără greutate (kg = 0) contează numărul de repetări.
function esteRecord(recorduri, nume, kg, repetari) {
  if (!(repetari > 0)) return null;
  const r = recorduri.get(nume.toLowerCase());
  if (!r) return null;
  if (kg === 0 && r.kg === 0) {
    return repetari > r.repetari ? 'repetari' : null;
  }
  if (kg > r.kg) return 'greutate';
  if (e1rm(kg, repetari) > r.e1rm + 0.05) return 'forta';
  return null;
}

// Ultima sesiune în care apare exercițiul: { data, serii } sau null.
function ultimaSesiuneCu(sesiuni, nume) {
  const cautat = nume.toLowerCase();
  for (let i = sesiuni.length - 1; i >= 0; i--) {
    const ex = sesiuni[i].exercitii.find(e => e.nume.toLowerCase() === cautat);
    if (ex) return { data: sesiuni[i].data, serii: ex.serii };
  }
  return null;
}

function rotunjeste(kg, pas) {
  return Math.round(kg / pas) * pas;
}

// Sugestie de progresie dublă: crești repetările în interval, apoi crești greutatea.
// setari: { minRep, maxRep, pasKg }
// Întoarce { kg, repetari, numarSerii, crestere, text } sau null.
function sugestieProgresie(ultima, setari) {
  if (!ultima) return null;
  const valide = ultima.serii.filter(serieValida);
  if (valide.length === 0) return null;

  const top = Math.max(...valide.map(s => s.kg));
  const deLucru = valide.filter(s => s.kg === top);
  const minRep = Math.min(...deLucru.map(s => s.repetari));
  const numarSerii = deLucru.length;

  if (top === 0) {
    const tinta = minRep + 1;
    return { kg: 0, repetari: tinta, numarSerii, crestere: false,
      text: `Încearcă ${numarSerii} × ${tinta} repetări (data trecută minimum ${minRep}).` };
  }

  if (minRep >= setari.maxRep) {
    const kgNou = rotunjeste(top + setari.pasKg, setari.pasKg);
    return { kg: kgNou, repetari: setari.minRep, numarSerii, crestere: true,
      text: `Ai făcut ${setari.maxRep}+ repetări la ${fmt(top)} kg. Crește la ${fmt(kgNou)} kg, ${numarSerii} × ${setari.minRep}.` };
  }

  const tinta = Math.min(minRep + 1, setari.maxRep);
  return { kg: top, repetari: tinta, numarSerii, crestere: false,
    text: `Rămâi la ${fmt(top)} kg și țintește ${numarSerii} × ${tinta} repetări.` };
}

function fmt(kg) {
  return (Math.round(kg * 100) / 100).toString();
}

// Rezumat scurt al seriilor: "3×8 @ 80 kg" sau "80×8, 85×6".
function rezumatSerii(serii) {
  const valide = serii.filter(serieValida);
  if (valide.length === 0) return '—';
  const toateLaFel = valide.every(s => s.kg === valide[0].kg && s.repetari === valide[0].repetari);
  if (toateLaFel) {
    const s = valide[0];
    return s.kg > 0 ? `${valide.length}×${s.repetari} @ ${fmt(s.kg)} kg` : `${valide.length}×${s.repetari}`;
  }
  return valide.map(s => s.kg > 0 ? `${fmt(s.kg)}×${s.repetari}` : `${s.repetari}`).join(', ');
}

// Numărul de serii pe grupă musculară, din sesiunile date (de obicei o săptămână).
// grupaDe(nume) întoarce grupa principală a exercițiului sau null.
// Se numără doar seriile cu repetări; exercițiile fără grupă merg la „Nealocat".
function seriiPeGrupa(sesiuni, grupaDe) {
  const rezultat = {};
  for (const s of sesiuni) {
    for (const ex of s.exercitii) {
      const n = ex.serii.filter(serieValida).length;
      if (n === 0) continue;
      const g = grupaDe(ex.nume) || 'Nealocat';
      rezultat[g] = (rezultat[g] || 0) + n;
    }
  }
  return rezultat;
}

const ZI_MS = 86400000;

// Tendința greutății corporale.
// masuratori: [{ data: 'AAAA-LL-ZZ', valoare }], doar tipul „Greutate".
// Întoarce { ultima, dataUltima, media7, kgPeSaptamana, zile, puncte } sau null.
// kgPeSaptamana e null dacă nu sunt destule date (minimum 3 cântăriri pe cel puțin 7 zile, din ultimele 28).
function tendintaGreutate(masuratori) {
  if (!masuratori.length) return null;
  const zi = d => Date.parse(d + 'T12:00:00') / ZI_MS;
  const sortate = [...masuratori].sort((a, b) => a.data.localeCompare(b.data));
  const ultima = sortate[sortate.length - 1];
  const ziUltima = zi(ultima.data);

  const ultimele7 = sortate.filter(m => ziUltima - zi(m.data) < 7);
  const media7 = ultimele7.reduce((t, m) => t + m.valoare, 0) / ultimele7.length;

  const fereastra = sortate.filter(m => ziUltima - zi(m.data) < 28);
  const xs = fereastra.map(m => zi(m.data));
  const ys = fereastra.map(m => m.valoare);
  const zile = Math.round(Math.max(...xs) - Math.min(...xs));

  let kgPeSaptamana = null;
  if (fereastra.length >= 3 && zile >= 7) {
    const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
    const my = ys.reduce((a, b) => a + b, 0) / ys.length;
    let num = 0, den = 0;
    for (let i = 0; i < xs.length; i++) {
      num += (xs[i] - mx) * (ys[i] - my);
      den += (xs[i] - mx) ** 2;
    }
    if (den > 0) kgPeSaptamana = (num / den) * 7;
  }
  return { ultima: ultima.valoare, dataUltima: ultima.data, media7, kgPeSaptamana, zile, puncte: fereastra.length };
}


// ================= Panou (Acasă) =================
// Reguli: o serie „completă" are repetări > 0. Volum = kg × repetări (exercițiile cu greutatea corpului dau 0).
// Datele sunt șiruri „AAAA-LL-ZZ" (ziua locală); calculele pe zile folosesc UTC ca să nu depindă de fusul orar.

function ziDinData(data) {
  const [a, l, z] = data.split('-').map(Number);
  return Math.round(Date.UTC(a, l - 1, z) / ZI_MS);
}

function dataDinZi(n) {
  return new Date(n * ZI_MS).toISOString().slice(0, 10);
}

// Ziua de luni a săptămânii în care cade data.
function cheieSaptamana(data) {
  const n = ziDinData(data);
  const zi = (new Date(n * ZI_MS).getUTCDay() + 6) % 7; // 0 = luni
  return dataDinZi(n - zi);
}

function statisticiSesiune(s) {
  let serii = 0;
  let volum = 0;
  for (const ex of s.exercitii) {
    for (const se of ex.serii) {
      if (!serieValida(se)) continue;
      serii++;
      volum += se.kg * se.repetari;
    }
  }
  return { serii, volum };
}

function totaluri(sesiuni) {
  let serii = 0;
  let volum = 0;
  for (const s of sesiuni) {
    const st = statisticiSesiune(s);
    serii += st.serii;
    volum += st.volum;
  }
  return { antrenamente: sesiuni.length, serii, volum };
}

// Ultimele n săptămâni (cea curentă inclusă), de la cea mai veche la cea curentă.
function rezumatSaptamani(sesiuni, azi, n = 8) {
  const curenta = ziDinData(cheieSaptamana(azi));
  const saptamani = [];
  for (let i = n - 1; i >= 0; i--) {
    saptamani.push({ luni: dataDinZi(curenta - 7 * i), antrenamente: 0, serii: 0, volum: 0 });
  }
  const index = new Map(saptamani.map((s, i) => [s.luni, i]));
  for (const s of sesiuni) {
    const i = index.get(cheieSaptamana(s.data));
    if (i === undefined) continue;
    const st = statisticiSesiune(s);
    saptamani[i].antrenamente++;
    saptamani[i].serii += st.serii;
    saptamani[i].volum += st.volum;
  }
  return saptamani;
}

// Câte săptămâni la rând ai avut cel puțin un antrenament.
// Săptămâna curentă, dacă încă nu are antrenamente, nu rupe seria (mai ai timp).
function serieSaptamani(sesiuni, azi) {
  const cuAntrenament = new Set(sesiuni.map(s => cheieSaptamana(s.data)));
  let luni = ziDinData(cheieSaptamana(azi));
  const curentaActiva = cuAntrenament.has(dataDinZi(luni));
  if (!curentaActiva) luni -= 7;
  let n = 0;
  while (cuAntrenament.has(dataDinZi(luni))) { n++; luni -= 7; }
  return { saptamani: n, curentaActiva };
}

// Zilele săptămânii curente (luni → duminică) în care ai avut antrenament.
function zileActiveSaptamana(sesiuni, azi) {
  const luni = ziDinData(cheieSaptamana(azi));
  const zile = Array(7).fill(false);
  for (const s of sesiuni) {
    const d = ziDinData(s.data) - luni;
    if (d >= 0 && d < 7) zile[d] = true;
  }
  return zile;
}

// Sesiunile din ultimele `zile` zile, inclusiv azi.
function sesiuniRecente(sesiuni, azi, zile) {
  const limita = ziDinData(azi) - zile + 1;
  return sesiuni.filter(s => ziDinData(s.data) >= limita && ziDinData(s.data) <= ziDinData(azi));
}

// Momentele în care ai bătut un record, în ordine cronologică.
// Un eveniment pe exercițiu pe sesiune: cel mai puternic tip (greutate > 1RM estimat > repetări).
// Prima sesiune cu un exercițiu nu e record (nu ai cu ce compara), la fel ca în timpul antrenamentului.
// sesiuni: sortate cronologic. Întoarce [{ data, nume, tip, kg, repetari, e1rm }].
function recorduriNoi(sesiuni) {
  const rec = new Map();
  const evenimente = [];
  const prioritate = { greutate: 3, forta: 2, repetari: 1 };
  for (const s of sesiuni) {
    for (const ex of s.exercitii) {
      let cel = null;
      for (const se of ex.serii) {
        if (!serieValida(se)) continue;
        const tip = esteRecord(rec, ex.nume, se.kg, se.repetari);
        if (!tip) continue;
        const candidat = { data: s.data, nume: ex.nume, tip, kg: se.kg, repetari: se.repetari, e1rm: e1rm(se.kg, se.repetari) };
        if (!cel || prioritate[tip] > prioritate[cel.tip] ||
          (tip === cel.tip && (tip === 'greutate' ? se.kg > cel.kg : tip === 'forta' ? candidat.e1rm > cel.e1rm : se.repetari > cel.repetari))) {
          cel = candidat;
        }
      }
      if (cel) evenimente.push(cel);
    }
    actualizeazaRecorduri(rec, s);
  }
  return evenimente;
}

// Ce antrenament urmează, după istoric.
// 1. Dacă ai rutine: cea făcută cel mai demult (sau niciodată). O rutină „s-a făcut" într-o sesiune
//    care conține cel puțin jumătate din exercițiile ei.
// 2. Fără rutine: grupele musculare pe care le-ai lucrat vreodată, dar cel mai demult (maxim 3).
// 3. Fără istoric: null.
function urmatorulAntrenament(rutine, sesiuni, grupaDe, azi) {
  const ziAzi = ziDinData(azi);
  if (rutine.length > 0) {
    const variante = rutine.map(r => {
      const nume = new Set(r.exercitii.map(e => e.toLowerCase()));
      const prag = Math.max(1, Math.ceil(nume.size / 2));
      let ultimaData = null;
      for (const s of sesiuni) {
        const comune = new Set(s.exercitii.filter(e => nume.has(e.nume.toLowerCase())).map(e => e.nume.toLowerCase()));
        if (comune.size >= prag && (!ultimaData || s.data > ultimaData)) ultimaData = s.data;
      }
      return { rutina: r, ultimaData, zile: ultimaData ? ziAzi - ziDinData(ultimaData) : null };
    });
    variante.sort((a, b) => {
      if (a.ultimaData === b.ultimaData) return (a.rutina.creat || 0) - (b.rutina.creat || 0);
      if (!a.ultimaData) return -1;
      if (!b.ultimaData) return 1;
      return a.ultimaData.localeCompare(b.ultimaData);
    });
    return { tip: 'rutina', ...variante[0] };
  }
  if (sesiuni.length > 0) {
    const ultima = new Map();
    for (const s of sesiuni) {
      for (const ex of s.exercitii) {
        if (!ex.serii.some(serieValida)) continue;
        const g = grupaDe(ex.nume);
        if (g && (!ultima.has(g) || s.data > ultima.get(g))) ultima.set(g, s.data);
      }
    }
    if (ultima.size === 0) return null;
    const grupe = [...ultima.entries()]
      .map(([grupa, data]) => ({ grupa, ultimaData: data, zile: ziAzi - ziDinData(data) }))
      .sort((a, b) => b.zile - a.zile || a.grupa.localeCompare(b.grupa))
      .slice(0, 3);
    return { tip: 'grupe', grupe };
  }
  return null;
}

// Schimbarea greutății corporale în ultimele `zile` zile: prima și ultima cântărire din interval.
function schimbareGreutate(masuratori, azi, zile = 30) {
  const limita = ziDinData(azi) - zile + 1;
  const din = masuratori.filter(m => ziDinData(m.data) >= limita).sort((a, b) => a.data.localeCompare(b.data));
  if (din.length < 2) return null;
  const prima = din[0];
  const ultima = din[din.length - 1];
  if (prima.data === ultima.data) return null;
  return { de: prima.valoare, dela: prima.data, la: ultima.valoare, ladata: ultima.data, diferenta: ultima.valoare - prima.valoare };
}

if (typeof module !== 'undefined') {
  module.exports = { e1rm, recorduriDin, esteRecord, ultimaSesiuneCu, sugestieProgresie, rezumatSerii,
    seriiPeGrupa, tendintaGreutate, actualizeazaRecorduri, ziDinData, dataDinZi, cheieSaptamana, statisticiSesiune,
    totaluri, rezumatSaptamani, serieSaptamani, zileActiveSaptamana, sesiuniRecente, recorduriNoi, urmatorulAntrenament,
    schimbareGreutate };
}
