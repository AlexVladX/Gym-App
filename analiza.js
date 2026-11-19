// Calcule pe istoricul sesiunilor: recorduri personale și sugestii de progresie.
// Nu atinge pagina (DOM), doar date, ca să poată fi testat separat.

// Forța estimată pentru o singură repetare (formula Epley).
function e1rm(kg, repetari) {
  return repetari > 0 ? kg * (1 + repetari / 30) : 0;
}

// O serie e „validă" dacă are ceva făcut: repetări, timp sau distanță.
// Câmpurile durataSec și distantaM apar doar la exercițiile pe timp sau distanță (din etapa 3).
function serieValida(s) {
  return !!s && s.kg >= 0 && (s.repetari > 0 || s.durataSec > 0 || s.distantaM > 0);
}

// Tipul seriei: 'normal' (implicit, și pentru datele vechi), 'incalzire', 'drop', 'esec'.
function tipSerie(s) {
  return s.tip === 'incalzire' || s.tip === 'drop' || s.tip === 'esec' ? s.tip : 'normal';
}

// Seriile de lucru: valide și care nu sunt de încălzire.
// Încălzirea nu contează la recorduri, la numărul de serii, la sugestii și (din etapa 5) la volum.
function serieDeLucru(s) {
  return serieValida(s) && tipSerie(s) !== 'incalzire';
}

// ---------- Contextul calculelor de volum ----------
// Volumul exercițiilor cu greutatea corpului folosește greutatea ta din Corp de la data antrenamentului.
// Aplicația îl setează la încărcarea istoricului (configureazaCalcul); fără el, greutatea corpului contează 0.
//   greutateCorpLa(data) → kg sau null; tipExercitiu(nume) → 'greutate' | 'corp' | 'timp' | 'distanta' | null
const contextCalcul = { greutateCorpLa: null, tipExercitiu: null };
function configureazaCalcul(c) { Object.assign(contextCalcul, c); }

// Funcție care dă greutatea corporală la o dată: ultima cântărire din ziua aceea sau dinainte;
// dacă nu există niciuna înainte, prima de după. null dacă nu ai nicio cântărire.
function functieGreutateCorp(masuratori) {
  const g = masuratori.filter(m => m.tip === 'Greutate' && Number.isFinite(m.valoare) && m.valoare > 0 && typeof m.data === 'string')
    .sort((a, b) => a.data.localeCompare(b.data) || (a.creat || 0) - (b.creat || 0));
  if (!g.length) return () => null;
  return data => {
    let lo = 0, hi = g.length - 1, gasit = -1;
    while (lo <= hi) { const m = (lo + hi) >> 1; if (g[m].data <= data) { gasit = m; lo = m + 1; } else hi = m - 1; }
    return g[gasit >= 0 ? gasit : 0].valoare;
  };
}

// Tipul exercițiului într-o sesiune. Din etapa 3 (versiune 2) tipul e salvat (lipsa = greutate);
// în sesiunile mai vechi se ia din bibliotecă.
function tipEfectiv(ex, s) {
  if (ex && ex.tip) return ex.tip;
  if (s && s.versiune >= 2) return 'greutate';
  return (ex && contextCalcul.tipExercitiu && contextCalcul.tipExercitiu(ex.nume)) || 'greutate';
}

// Volumul unei serii (etapa 5): doar seriile de lucru cu repetări (fără încălzire).
// Greutate: kg × repetări. Greutatea corpului: (greutatea corpului la data sesiunii + kg în plus) × repetări.
// Seriile pe timp sau distanță dau 0. ex și s sunt opționale (fără ele: kg × repetări).
function volumSerie(se, ex = null, data = null, s = null) {
  if (!serieDeLucru(se) || !(se.repetari > 0)) return 0;
  const kg = Number.isFinite(se.kg) && se.kg > 0 ? se.kg : 0;
  if (ex && tipEfectiv(ex, s) === 'corp') {
    const corp = data && contextCalcul.greutateCorpLa ? contextCalcul.greutateCorpLa(data) : null;
    return ((corp || 0) + kg) * se.repetari;
  }
  return kg * se.repetari;
}

// Exercițiile unei sesiuni, cu intrările care au același nume unite într-una singură
// (un exercițiu adăugat de două ori în același antrenament se numără o dată, cu toate seriile).
function exercitiiUnite(s) {
  const m = new Map();
  for (const ex of s.exercitii || []) {
    if (!ex || typeof ex.nume !== 'string' || !Array.isArray(ex.serii)) continue;
    const cheie = ex.nume.toLowerCase();
    const u = m.get(cheie);
    if (u) u.serii = u.serii.concat(ex.serii);
    else m.set(cheie, { ...ex, serii: ex.serii.slice() });
  }
  return [...m.values()];
}

// Recordurile pe fiecare exercițiu, cheie: numele cu litere mici.
// { kg, kgRepetari, kgData, e1rm, e1rmKg, e1rmRepetari, e1rmData, repetari, repetariData, volum, volumData,
//   durata, durataData, distanta, distantaData }
// Se iau în calcul doar seriile de lucru (fără încălzire).
function recorduriDin(sesiuni) {
  const rec = new Map();
  for (const s of sesiuni) actualizeazaRecorduri(rec, s);
  return rec;
}

// Adaugă o sesiune la recordurile existente (folosit și pentru reluarea istoricului pas cu pas).
function actualizeazaRecorduri(rec, s) {
  for (const ex of exercitiiUnite(s)) {
    const cheie = ex.nume.toLowerCase();
    let r = rec.get(cheie);
    if (!r) {
      r = { nume: ex.nume, kg: 0, kgRepetari: 0, kgData: null, e1rm: 0, e1rmKg: 0, e1rmRepetari: 0,
        e1rmData: null, repetari: 0, repetariData: null, volum: 0, volumData: null,
        durata: 0, durataData: null, distanta: 0, distantaData: null };
      rec.set(cheie, r);
    }
    let volum = 0;
    for (const se of ex.serii) {
      if (!serieDeLucru(se)) continue;
      volum += volumSerie(se, ex, s.data, s);
      if (se.durataSec > r.durata) { r.durata = se.durataSec; r.durataData = s.data; }
      if (se.distantaM > r.distanta) { r.distanta = se.distantaM; r.distantaData = s.data; }
      if (!(se.repetari > 0)) continue;
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

// Tipul de record pentru o serie (obiect), sau null. Încălzirea nu poate fi record.
// Serii cu repetări: ca esteRecord. Serii pe timp: durata mai lungă. Pe distanță: distanța mai mare.
function recordPentruSerie(recorduri, nume, s) {
  if (!serieValida(s) || tipSerie(s) === 'incalzire') return null;
  if (s.repetari > 0) return esteRecord(recorduri, nume, s.kg, s.repetari);
  const r = recorduri.get(nume.toLowerCase());
  if (!r) return null;
  if (s.durataSec > 0) return r.durata > 0 && s.durataSec > r.durata ? 'durata' : null;
  if (s.distantaM > 0) return r.distanta > 0 && s.distantaM > r.distanta ? 'distanta' : null;
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
  // Doar seriile de lucru cu repetări (fără încălzire, fără serii pe timp sau distanță).
  const valide = ultima.serii.filter(s => serieDeLucru(s) && s.repetari > 0);
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

// O serie ca text scurt: „80×8", „+10×8" (corp cu greutate), „45 s", „30 kg × 40 m".
function formatSerie(s) {
  if (s.durataSec > 0) return `${fmt(s.durataSec)} s` + (s.kg > 0 ? ` @ ${fmt(s.kg)} kg` : '');
  if (s.distantaM > 0) return s.kg > 0 ? `${fmt(s.kg)} kg × ${fmt(s.distantaM)} m` : `${fmt(s.distantaM)} m`;
  return s.kg > 0 ? `${fmt(s.kg)}×${s.repetari}` : `${s.repetari}`;
}

// Rezumat scurt al seriilor de lucru: "3×8 @ 80 kg" sau "80×8, 85×6". Încălzirea se notează separat.
function rezumatSerii(serii) {
  const valide = serii.filter(serieDeLucru);
  const incalzire = serii.filter(s => serieValida(s) && tipSerie(s) === 'incalzire').length;
  const sufix = incalzire ? ` (+${incalzire} încălz.)` : '';
  if (valide.length === 0) return incalzire ? `${incalzire} încălz.` : '—';
  const cheie = s => formatSerie(s);
  const toateLaFel = valide.every(s => cheie(s) === cheie(valide[0]));
  if (toateLaFel && valide.length > 1) {
    const s = valide[0];
    if (s.repetari > 0) return (s.kg > 0 ? `${valide.length}×${s.repetari} @ ${fmt(s.kg)} kg` : `${valide.length}×${s.repetari}`) + sufix;
    return `${valide.length} × ${formatSerie(s)}` + sufix;
  }
  return valide.map(formatSerie).join(', ') + sufix;
}

// Numărul de serii pe grupă musculară, din sesiunile date (de obicei o săptămână).
// grupaDe(nume) întoarce grupa principală a exercițiului sau null.
// Se numără doar seriile cu repetări; exercițiile fără grupă merg la „Nealocat".
function seriiPeGrupa(sesiuni, grupaDe) {
  const rezultat = {};
  for (const s of sesiuni) {
    for (const ex of s.exercitii) {
      const n = ex.serii.filter(serieDeLucru).length;
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
// Reguli: o serie „completă" are repetări > 0. Volumul: vezi volumSerie (doar serii de lucru; corp = greutatea ta + lest).
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
  for (const ex of exercitiiUnite(s)) {
    for (const se of ex.serii) {
      if (!serieValida(se)) continue;
      volum += volumSerie(se, ex, s.data, s);
      if (tipSerie(se) !== 'incalzire') serii++;
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
  const prioritate = { greutate: 3, forta: 2, repetari: 1, durata: 1, distanta: 1 };
  for (const s of sesiuni) {
    for (const ex of exercitiiUnite(s)) {
      let cel = null;
      for (const se of ex.serii) {
        const tip = recordPentruSerie(rec, ex.nume, se);
        if (!tip) continue;
        const candidat = { data: s.data, nume: ex.nume, tip, kg: se.kg, repetari: se.repetari, e1rm: e1rm(se.kg, se.repetari),
          durataSec: se.durataSec || 0, distantaM: se.distantaM || 0 };
        if (!cel || prioritate[tip] > prioritate[cel.tip] ||
          (tip === cel.tip && (tip === 'greutate' ? se.kg > cel.kg : tip === 'forta' ? candidat.e1rm > cel.e1rm
            : tip === 'durata' ? se.durataSec > cel.durataSec : tip === 'distanta' ? se.distantaM > cel.distantaM
              : se.repetari > cel.repetari))) {
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
        if (!ex.serii.some(serieDeLucru)) continue;
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

// Durata activă a unui antrenament, în ms: de la început până la `sfarsit`, fără pauze.
// pauze: [{ start, sfarsit }]; pauzaStart: începutul unei pauze în curs (sau null).
function durataActiva(inceput, sfarsit, pauze = [], pauzaStart = null) {
  if (!Number.isFinite(inceput) || !Number.isFinite(sfarsit)) return 0;
  let pe = 0;
  for (const p of pauze || []) {
    if (!p || !Number.isFinite(p.start)) continue;
    const a = Math.max(p.start, inceput);
    const b = Math.min(Number.isFinite(p.sfarsit) ? p.sfarsit : sfarsit, sfarsit);
    if (b > a) pe += b - a;
  }
  if (Number.isFinite(pauzaStart) && pauzaStart < sfarsit) pe += sfarsit - Math.max(pauzaStart, inceput);
  return Math.max(0, sfarsit - inceput - pe);
}

// Durata unei sesiuni salvate, în minute (activă dacă e salvată, altfel sfârșit − început). null dacă lipsește.
function durataSesiuneMin(s) {
  if (Number.isFinite(s.durataActivaMs)) return Math.max(1, Math.round(s.durataActivaMs / 60000));
  if (Number.isFinite(s.inceput) && Number.isFinite(s.sfarsit) && s.sfarsit > s.inceput) return Math.max(1, Math.round((s.sfarsit - s.inceput) / 60000));
  return null;
}

if (typeof module !== 'undefined') {
  module.exports = { e1rm, recorduriDin, esteRecord, ultimaSesiuneCu, sugestieProgresie, rezumatSerii,
    seriiPeGrupa, tendintaGreutate, actualizeazaRecorduri, ziDinData, dataDinZi, cheieSaptamana, statisticiSesiune,
    totaluri, rezumatSaptamani, serieSaptamani, zileActiveSaptamana, sesiuniRecente, recorduriNoi, urmatorulAntrenament,
    schimbareGreutate, serieValida, tipSerie, serieDeLucru, volumSerie, recordPentruSerie, formatSerie,
    durataActiva, durataSesiuneMin, configureazaCalcul, functieGreutateCorp, tipEfectiv, exercitiiUnite };
}
