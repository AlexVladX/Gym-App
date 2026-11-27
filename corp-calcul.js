// Calcule pentru ecranul Corp (etapa 6): tipurile de măsurători și unitățile lor, media mobilă a greutății,
// IMC, obiectivul de greutate, ultimele valori și compararea a două date.
// Fără DOM (testat în Node, tests/corp.test.js). Folosește din analiza.js: ziDinData, dataDinZi.

// Măsurătorile standard, în ordinea afișării. Tipurile scrise de tine rămân și ele (fără unitate cunoscută).
const TIPURI_MASURATORI = [
  { tip: 'Greutate', unitate: 'kg', min: 20, max: 300 },
  { tip: 'Grăsime corporală', unitate: '%', min: 2, max: 70 },
  { tip: 'Gât', unitate: 'cm', min: 20, max: 80 },
  { tip: 'Umeri', unitate: 'cm', min: 70, max: 200 },
  { tip: 'Piept', unitate: 'cm', min: 50, max: 200 },
  { tip: 'Talie', unitate: 'cm', min: 40, max: 200 },
  { tip: 'Șolduri', unitate: 'cm', min: 50, max: 200 },
  { tip: 'Braț', unitate: 'cm', min: 15, max: 70 },
  { tip: 'Antebraț', unitate: 'cm', min: 15, max: 60 },
  { tip: 'Coapsă', unitate: 'cm', min: 30, max: 100 },
  { tip: 'Gambă', unitate: 'cm', min: 20, max: 70 },
];
const UNGHIURI_POZA = [
  { cheie: 'fata', nume: 'Față' },
  { cheie: 'lateral', nume: 'Profil' },
  { cheie: 'spate', nume: 'Spate' },
];

function definitieTip(tip) {
  const t = String(tip || '').toLowerCase();
  return TIPURI_MASURATORI.find(d => d.tip.toLowerCase() === t) || null;
}
function unitateTip(tip) { return definitieTip(tip)?.unitate || ''; }

// O valoare e plauzibilă pentru tipul ei? (tipurile proprii: orice număr pozitiv rezonabil)
function valoarePlauzibila(tip, v) {
  if (!Number.isFinite(v) || v <= 0) return false;
  const d = definitieTip(tip);
  return d ? v >= d.min && v <= d.max : v < 100000;
}

// Valorile unui tip, una pe zi (media, dacă ai notat de mai multe ori în aceeași zi), în ordine cronologică.
function valoriZilnice(masuratori, tip) {
  const t = String(tip).toLowerCase();
  const pe = new Map();
  for (const m of masuratori) {
    if (!m || typeof m.tip !== 'string' || m.tip.toLowerCase() !== t || !Number.isFinite(m.valoare) || typeof m.data !== 'string') continue;
    const r = pe.get(m.data) || { data: m.data, suma: 0, n: 0 };
    r.suma += m.valoare; r.n++;
    pe.set(m.data, r);
  }
  return [...pe.values()].sort((a, b) => a.data.localeCompare(b.data)).map(r => ({ data: r.data, valoare: r.suma / r.n }));
}

// Media mobilă pe `zile` zile, în fiecare zi cu cântărire: media cântăririlor din ultimele `zile` zile până atunci.
function mediaMobila(zilnice, zile = 7) {
  const rez = [];
  let start = 0, suma = 0;
  for (let i = 0; i < zilnice.length; i++) {
    suma += zilnice[i].valoare;
    const z = ziDinData(zilnice[i].data);
    while (ziDinData(zilnice[start].data) <= z - zile) { suma -= zilnice[start].valoare; start++; }
    rez.push({ data: zilnice[i].data, valoare: suma / (i - start + 1) });
  }
  return rez;
}

// IMC = kg / (înălțimea în m)². Categoriile OMS pentru adulți.
function imc(kg, inaltimeCm) {
  if (!(kg > 0) || !(inaltimeCm >= 100 && inaltimeCm <= 250)) return null;
  const v = kg / ((inaltimeCm / 100) ** 2);
  const categorie = v < 18.5 ? 'subponderal' : v < 25 ? 'greutate normală' : v < 30 ? 'supraponderal' : 'obezitate';
  return { valoare: v, categorie };
}

// Obiectivul de greutate. obiectiv: { tinta, start, dela } (start = greutatea când l-ai setat).
// curenta: greutatea de acum (media pe 7 zile); kgPeSaptamana: tendința (sau null).
// Întoarce { progres (0..1), ramas, directie ('slabire' | 'crestere'), atins, estimare (dată sau null), saptamani }.
function progresObiectiv(obiectiv, curenta, kgPeSaptamana, azi) {
  if (!obiectiv || !(obiectiv.tinta > 0) || !(obiectiv.start > 0) || !(curenta > 0)) return null;
  const { tinta, start } = obiectiv;
  const directie = tinta < start ? 'slabire' : 'crestere';
  const total = Math.abs(start - tinta);
  const facut = directie === 'slabire' ? start - curenta : curenta - start;
  const atins = directie === 'slabire' ? curenta <= tinta : curenta >= tinta;
  const progres = total === 0 ? 1 : Math.max(0, Math.min(1, facut / total));
  const ramas = atins ? 0 : Math.abs(tinta - curenta);
  let estimare = null, saptamani = null;
  // estimarea doar dacă tendința merge spre obiectiv (cel puțin 0,05 kg/săpt.) și ar dura cel mult 2 ani
  if (!atins && Number.isFinite(kgPeSaptamana) && Math.abs(kgPeSaptamana) >= 0.05 && Math.sign(tinta - curenta) === Math.sign(kgPeSaptamana)) {
    saptamani = (tinta - curenta) / kgPeSaptamana;
    if (saptamani > 0 && saptamani <= 104) estimare = dataDinZi(ziDinData(azi) + Math.ceil(saptamani * 7));
    else saptamani = null;
  }
  return { progres, ramas, directie, atins, estimare, saptamani };
}

// Pentru fiecare tip: ultima valoare, cea dinainte, prima, și diferențele.
// [{ tip, unitate, ultima, dataUltima, anterioara, dataAnterioara, prima, dataPrima, fataDeAnterioara, fataDePrima, numar }]
function ultimeleValori(masuratori) {
  const tipuri = new Map();
  for (const m of masuratori) {
    if (!m || typeof m.tip !== 'string') continue;
    const k = m.tip.toLowerCase();
    if (!tipuri.has(k)) tipuri.set(k, definitieTip(m.tip)?.tip || m.tip);
  }
  const ordine = t => { const i = TIPURI_MASURATORI.findIndex(d => d.tip === t); return i < 0 ? 100 : i; };
  return [...tipuri.values()]
    .sort((a, b) => ordine(a) - ordine(b) || a.localeCompare(b, 'ro'))
    .map(tip => {
      const z = valoriZilnice(masuratori, tip);
      if (!z.length) return null;
      const u = z[z.length - 1], a = z.length > 1 ? z[z.length - 2] : null, p = z[0];
      return { tip, unitate: unitateTip(tip), ultima: u.valoare, dataUltima: u.data,
        anterioara: a ? a.valoare : null, dataAnterioara: a ? a.data : null, prima: p.valoare, dataPrima: p.data,
        fataDeAnterioara: a ? u.valoare - a.valoare : null, fataDePrima: z.length > 1 ? u.valoare - p.valoare : null, numar: z.length };
    })
    .filter(Boolean);
}

// Datele în care ai notat măsurători (fără greutate, care se notează des), cele mai recente întâi.
function dateCuMasuratori(masuratori, faraGreutate = true) {
  const d = new Set();
  for (const m of masuratori) {
    if (!m || typeof m.data !== 'string' || typeof m.tip !== 'string') continue;
    if (faraGreutate && m.tip.toLowerCase() === 'greutate') continue;
    d.add(m.data);
  }
  return [...d].sort().reverse();
}

// Compară două date: pentru fiecare tip, valoarea la data A și la data B (media zilei) și diferența B − A.
// Greutatea se ia din cântărirea cea mai apropiată de fiecare dată, dar nu mai departe de 3 zile.
function comparaDate(masuratori, dataA, dataB) {
  const rez = [];
  for (const u of ultimeleValori(masuratori)) {
    const z = valoriZilnice(masuratori, u.tip);
    const la = data => {
      const exact = z.find(x => x.data === data);
      if (exact) return exact.valoare;
      if (u.tip !== 'Greutate') return null;
      let cea = null, dist = Infinity;
      for (const x of z) { const d = Math.abs(ziDinData(x.data) - ziDinData(data)); if (d < dist) { dist = d; cea = x; } }
      return cea && dist <= 3 ? cea.valoare : null;
    };
    const a = la(dataA), b = la(dataB);
    if (a === null && b === null) continue;
    rez.push({ tip: u.tip, unitate: u.unitate, a, b, diferenta: a !== null && b !== null ? b - a : null });
  }
  return rez;
}

// Pozele grupate pe date (cele mai recente întâi), cu unghiurile în ordinea față, profil, spate.
function pozePeDate(poze) {
  const m = new Map();
  for (const p of poze) {
    if (!p || typeof p.data !== 'string') continue;
    if (!m.has(p.data)) m.set(p.data, []);
    m.get(p.data).push(p);
  }
  const ord = u => { const i = UNGHIURI_POZA.findIndex(x => x.cheie === u); return i < 0 ? 9 : i; };
  return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0]))
    .map(([data, lista]) => ({ data, poze: lista.sort((a, b) => ord(a.unghi) - ord(b.unghi) || (a.creat || 0) - (b.creat || 0)) }));
}

// ---------- Profilul (etapa 4): un singur loc pentru înălțime, anul nașterii, sex, nivel de activitate ----------
// Folosit de Corp (IMC), de ținte și de estimări; editabil din Corp și din ghidul țintelor.
// setari.profil e sursa. Câmpurile vechi (inaltimeCm, anNastere, sex, activitate) rămân ca oglindă pentru versiunile
// vechi ale aplicației (alt telefon sincronizat, backupuri vechi). Versiunea nouă le scrie mereu pe amândouă, deci o
// oglindă care diferă de profil a fost schimbată după aceea de o versiune veche: e valoarea mai recentă și se preia.
// (Greutatea țintă rămâne în setari.obiectiv — are și punctul de plecare și data — dar se editează în același card.)
const CAMPURI_PROFIL = ['inaltimeCm', 'anNastere', 'sex', 'activitate'];
const ACTIVITATI_PROFIL = ['sedentar', 'usor', 'moderat', 'activ', 'extrem']; // aceleași id-uri ca NIVELURI_ACTIVITATE

function campProfilValid(camp, v, an = new Date().getFullYear()) {
  if (camp === 'inaltimeCm') return typeof v === 'number' && Number.isFinite(v) && v >= 100 && v <= 250;
  if (camp === 'anNastere') return Number.isInteger(v) && v >= 1900 && v <= an - 10;
  if (camp === 'sex') return v === 'm' || v === 'f';
  if (camp === 'activitate') return ACTIVITATI_PROFIL.includes(v);
  return false;
}

function curataProfil(p) {
  const rez = {};
  if (!p || typeof p !== 'object') return rez;
  for (const c of CAMPURI_PROFIL) if (campProfilValid(c, p[c])) rez[c] = p[c];
  return rez;
}

// Profilul de folosit, din setări (cu migrarea de mai sus). Lipsurile rămân lipsuri (nu inventăm).
function profilDinSetari(s) {
  const p = curataProfil(s && s.profil);
  for (const c of CAMPURI_PROFIL) {
    const vechi = s ? s[c] : undefined;
    if (campProfilValid(c, vechi) && vechi !== p[c]) p[c] = vechi;
  }
  return p;
}

// Setările cu profilul nou: obiectul profil + oglinda în câmpurile vechi (null unde lipsește).
function setariCuProfil(s, profil) {
  const p = curataProfil(profil);
  const rez = { ...s, profil: p };
  for (const c of CAMPURI_PROFIL) rez[c] = c in p ? p[c] : null;
  return rez;
}

if (typeof module !== 'undefined') {
  module.exports = { CAMPURI_PROFIL, ACTIVITATI_PROFIL, curataProfil, profilDinSetari, setariCuProfil, TIPURI_MASURATORI, UNGHIURI_POZA, definitieTip, unitateTip, valoarePlauzibila, valoriZilnice, mediaMobila,
    imc, progresObiectiv, ultimeleValori, dateCuMasuratori, comparaDate, pozePeDate };
}
