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
  for (const s of sesiuni) {
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

if (typeof module !== 'undefined') {
  module.exports = { e1rm, recorduriDin, esteRecord, ultimaSesiuneCu, sugestieProgresie, rezumatSerii,
    seriiPeGrupa, tendintaGreutate };
}
