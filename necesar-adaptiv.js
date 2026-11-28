// Necesarul caloric adaptiv (etapa 7, funcția 1): cât ardem de fapt, din cântăriri și din ce am mâncat.
// Fără DOM și fără bază de date, ca să poată fi testat în Node (tests/necesar-adaptiv.test.js).
// Folosește din nutritie-zi.js: totaluriZi, impartireMacronutrienti, KCAL_MINIM, SCOPURI_NUTRITIE.
//
// Ideea: dacă în ultimele 4 săptămâni ai mâncat în medie M kcal pe zi și greutatea a crescut cu Δ kg,
// surplusul a fost aproximativ Δ × 7.700 kcal, deci necesarul ≈ M − Δ × 7.700 / zile.
// 7.700 kcal/kg e o aproximare (energia unui kg de țesut adipos, cu apă); la creșterea în masă musculară, sau când
// se schimbă apa din corp (creatină, sare, carbohidrați, ciclul de antrenament), raportul real diferă.
// De aceea rezultatul e combinat cu formula, nu se mișcă brusc și nu schimbă nimic fără confirmarea ta.

const NECESAR = {
  FEREASTRA: 28,          // zile analizate (până ieri inclusiv)
  MIN_ZILE: 10,           // zile notate complet, cel puțin
  MIN_CANTARIRI: 6,       // cântăriri în fereastră, cel puțin
  MIN_INTERVAL: 7,        // zile între prima și ultima cântărire din fereastră, cel puțin
  KCAL_PE_KG: 7700,       // aproximare (vezi mai sus)
  ALFA: 0.1,              // media exponențială a greutății: fluctuațiile de apă contează puțin
  PRAG_INCOMPLET: 0.5,    // o zi cu mai puțin de 50% din țintă nu e notată complet
  PRAG_ABERANT: 0.03,     // o cântărire care sare cu peste 3% față de vecinele ei (și revine) e o greșeală
  PAS_MAXIM: 150,         // necesarul afișat se mișcă cu cel mult 150 kcal de la o săptămână la alta
  PONDERE_MAXIMA: 0.95,   // formula nu dispare de tot
  RITM_MAXIM_KG_SAPT: 1.5,// peste atât (în plus sau în minus) datele sunt puțin probabile: se plafonează
  NECESAR_MIN: 1000,
  NECESAR_MAX: 6000,
  SAPTAMANI_ISTORIC: 26,
};

// Ritmul obiectivului (% din greutate pe săptămână): implicit și limitele setării.
const RITM_OBIECTIV = {
  masa: { implicit: 0.25, min: 0.1, max: 0.5, semn: 1 },
  slabire: { implicit: 0.5, min: 0.25, max: 1, semn: -1 },
  mentinere: { implicit: 0, min: 0, max: 0, semn: 0 },
};
const ZILE_SAPTAMANA_NUME = ['duminică', 'luni', 'marți', 'miercuri', 'joi', 'vineri', 'sâmbătă'];

function nzi() {
  if (typeof totaluriZi === 'function' && typeof impartireMacronutrienti === 'function') {
    return { totaluriZi, impartireMacronutrienti, KCAL_MINIM, SCOPURI_NUTRITIE };
  }
  return require('./nutritie-zi.js');
}

// ---------- Date calendaristice (zile întregi, fără fus orar) ----------
const ZI_NECESAR_MS = 86400000;
function ziNecesar(data) { const [a, l, z] = data.split('-').map(Number); return Math.round(Date.UTC(a, l - 1, z) / ZI_NECESAR_MS); }
function dataNecesar(n) { return new Date(n * ZI_NECESAR_MS).toISOString().slice(0, 10); }
function plusZileNecesar(data, n) { return dataNecesar(ziNecesar(data) + n); }
function ziSaptamaniiNecesar(data) { return new Date(ziNecesar(data) * ZI_NECESAR_MS).getUTCDay(); } // 0 = duminică

// ---------- Greutatea: o valoare pe zi, cântăririle aberante, interpolare, tendință ----------

// Cântăririle valide (tip „Greutate”), una pe zi (media zilei), în ordine.
function cantaririZilnice(masuratori) {
  const pe = new Map();
  for (const m of masuratori || []) {
    if (!m || typeof m.tip !== 'string' || m.tip.toLowerCase() !== 'greutate' || typeof m.data !== 'string') continue;
    const v = Number(m.valoare);
    if (!(v >= 20 && v <= 300)) continue;
    const r = pe.get(m.data) || { suma: 0, n: 0 };
    r.suma += v; r.n++;
    pe.set(m.data, r);
  }
  return [...pe.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([data, r]) => ({ data, kg: r.suma / r.n }));
}

// O cântărire e aberantă dacă sare cu peste 3% față de cântărirea dinainte ȘI față de cea de după (în aceeași
// direcție), iar acelea două sunt apropiate între ele: un vârf izolat, nu o schimbare reală.
function marcheazaAberante(cantariri) {
  const p = NECESAR.PRAG_ABERANT;
  return cantariri.map((c, i) => {
    const a = cantariri[i - 1], b = cantariri[i + 1];
    if (!a || !b) return { ...c, aberant: false };
    const da = (c.kg - a.kg) / a.kg, db = (c.kg - b.kg) / b.kg;
    const aberant = Math.abs(da) > p && Math.abs(db) > p && Math.sign(da) === Math.sign(db) && Math.abs(a.kg - b.kg) / a.kg <= p;
    return { ...c, aberant };
  });
}

// Seria zilnică de la prima cântărire până la `panaLa`: zilele fără cântărire se interpolează liniar între cântăririle
// vecine (după ultima: rămâne ultima valoare). tendinta = media exponențială (α = 0,1).
function serieGreutate(masuratori, panaLa) {
  const toate = marcheazaAberante(cantaririZilnice(masuratori));
  const bune = toate.filter(c => !c.aberant);
  const aberante = toate.filter(c => c.aberant).map(c => ({ data: c.data, kg: c.kg }));
  if (!bune.length) return { zile: [], aberante };
  const z0 = ziNecesar(bune[0].data);
  const zSf = Math.max(ziNecesar(panaLa || bune[bune.length - 1].data), ziNecesar(bune[bune.length - 1].data));
  const pe = new Map(bune.map(c => [ziNecesar(c.data), c.kg]));
  const zile = [];
  let k = 0, tend = null;
  for (let z = z0; z <= zSf; z++) {
    while (k + 1 < bune.length && ziNecesar(bune[k + 1].data) <= z) k++;
    const a = bune[k], b = bune[k + 1];
    let kg;
    if (pe.has(z)) kg = pe.get(z);
    else if (b) { const za = ziNecesar(a.data), zb = ziNecesar(b.data); kg = a.kg + (b.kg - a.kg) * (z - za) / (zb - za); }
    else kg = a.kg;
    tend = tend === null ? kg : tend + NECESAR.ALFA * (kg - tend);
    zile.push({ data: dataNecesar(z), kg, cantarit: pe.has(z), tendinta: tend });
  }
  return { zile, aberante };
}

// Panta (kg/zi) a dreptei celei mai apropiate de puncte (x = ziua, y = kg). Pentru ritm folosim dreapta pe valorile
// zilnice, nu diferența dintre capetele mediei exponențiale: media exponențială rămâne în urmă ~9 zile la început
// (1/α − 1) și ar subestima ritmul într-o fereastră de 4 săptămâni.
function pantaRegresie(puncte) {
  if (puncte.length < 2) return null;
  const mx = puncte.reduce((s, p) => s + p.x, 0) / puncte.length;
  const my = puncte.reduce((s, p) => s + p.y, 0) / puncte.length;
  let num = 0, den = 0;
  for (const p of puncte) { num += (p.x - mx) * (p.y - my); den += (p.x - mx) ** 2; }
  return den > 0 ? num / den : null;
}

// ---------- Zilele notate complet ----------

// Din zilele de nutriție dintre `dela` și `panaLa`: cele care intră în medie și motivele pentru celelalte.
// Contează doar ce e bifat ca mâncat. O zi fără nimic mâncat, marcată „nu e notată complet” sau cu mai puțin de 50%
// din țintă (fără țintă: din mediana zilelor notate) nu intră.
function zileNotateComplet(zileNutritie, { dela, panaLa, tintaKcal }) {
  const { totaluriZi } = nzi();
  const pe = new Map((zileNutritie || []).filter(z => z && typeof z.data === 'string').map(z => [z.data, z]));
  const brute = [];
  for (let z = ziNecesar(dela); z <= ziNecesar(panaLa); z++) {
    const data = dataNecesar(z);
    const zi = pe.get(data);
    const kcal = zi ? totaluriZi(zi, panaLa).mancat.kcal : 0;
    brute.push({ data, kcal, marcata: Boolean(zi && zi.incompleta) });
  }
  const notate = brute.filter(x => x.kcal > 0 && !x.marcata).map(x => x.kcal).sort((a, b) => a - b);
  const mediana = notate.length ? notate[Math.floor(notate.length / 2)] : 0;
  const referinta = tintaKcal > 0 ? tintaKcal : mediana;
  const valide = [], excluse = [];
  for (const x of brute) {
    if (x.marcata) excluse.push({ data: x.data, kcal: x.kcal, motiv: 'marcata' });
    else if (!(x.kcal > 0)) excluse.push({ data: x.data, kcal: 0, motiv: 'goala' });
    else if (referinta > 0 && x.kcal < referinta * NECESAR.PRAG_INCOMPLET) excluse.push({ data: x.data, kcal: x.kcal, motiv: 'putin' });
    else valide.push({ data: x.data, kcal: x.kcal });
  }
  return { valide, excluse, referinta };
}

// ---------- Estimarea necesarului ----------

// Necesarul la o dată: fereastra se termină la `panaLa` (ieri, de obicei). necesarFormula: Mifflin-St Jeor × activitate
// (fără ajustarea obiectivului), sau null dacă profilul nu e complet (atunci contează doar datele).
// Întoarce { stare: 'insuficient', … cât lipsește } sau { stare: 'ok', necesar (brut, combinat), … detalii }.
function estimeazaNecesar({ zileNutritie, masuratori, panaLa, tintaKcal = 0, necesarFormula = null, fereastra = NECESAR.FEREASTRA, serie = null }) {
  const dela = plusZileNecesar(panaLa, -(fereastra - 1));
  const zn = zileNotateComplet(zileNutritie, { dela, panaLa, tintaKcal });
  const sg = serie || serieGreutate(masuratori, panaLa);
  const inFereastra = sg.zile.filter(z => z.data >= dela && z.data <= panaLa);
  const cantarite = inFereastra.filter(z => z.cantarit);
  const aberante = sg.aberante.filter(a => a.data >= dela && a.data <= panaLa);
  const interval = cantarite.length ? ziNecesar(cantarite[cantarite.length - 1].data) - ziNecesar(cantarite[0].data) : 0;
  const baza = { dela, panaLa, fereastra, zileValide: zn.valide.length, cantariri: cantarite.length, aberante, excluse: zn.excluse };
  const lipsaZile = Math.max(0, NECESAR.MIN_ZILE - zn.valide.length);
  const lipsaCantariri = Math.max(0, NECESAR.MIN_CANTARIRI - cantarite.length);
  if (lipsaZile || lipsaCantariri || interval < NECESAR.MIN_INTERVAL) {
    return { ...baza, stare: 'insuficient', lipsaZile, lipsaCantariri, intervalPreaScurt: !lipsaCantariri && interval < NECESAR.MIN_INTERVAL };
  }
  const avertizari = [];
  const mediaKcal = zn.valide.reduce((s, x) => s + x.kcal, 0) / zn.valide.length;
  // ritmul: dreapta prin valorile zilnice dintre prima și ultima cântărire din fereastră (fără capetele prelungite)
  const intre = inFereastra.filter(z => z.data >= cantarite[0].data && z.data <= cantarite[cantarite.length - 1].data);
  let kgPeZi = pantaRegresie(intre.map(z => ({ x: ziNecesar(z.data), y: z.kg }))) || 0;
  const maxZi = NECESAR.RITM_MAXIM_KG_SAPT / 7;
  if (Math.abs(kgPeZi) > maxZi) { avertizari.push('ritm'); kgPeZi = Math.sign(kgPeZi) * maxZi; }
  if (aberante.length) avertizari.push('aberante');
  let necesarDate = mediaKcal - kgPeZi * NECESAR.KCAL_PE_KG;
  if (necesarDate < NECESAR.NECESAR_MIN || necesarDate > NECESAR.NECESAR_MAX) {
    avertizari.push('plafonat');
    necesarDate = Math.min(NECESAR.NECESAR_MAX, Math.max(NECESAR.NECESAR_MIN, necesarDate));
  }
  const formula = necesarFormula > 0 ? necesarFormula : null;
  // ponderea datelor crește cu zilele notate: 10 zile ≈ 36%, 28 de zile = 95% (restul, formula)
  const pondere = formula ? Math.min(NECESAR.PONDERE_MAXIMA, zn.valide.length / NECESAR.FEREASTRA) : 1;
  const necesar = pondere * necesarDate + (1 - pondere) * (formula || 0);
  const ultima = inFereastra[inFereastra.length - 1];
  return { ...baza, stare: 'ok', mediaKcal, kgPeZi, kgPeSapt: kgPeZi * 7, necesarDate, necesarFormula: formula, pondere, necesar,
    tendintaKg: ultima ? ultima.tendinta : null, avertizari };
}

// Data verificării săptămânale la care suntem: cea mai recentă zi `ziVerificare` (0 = duminică … 6) până azi inclusiv.
function dataVerificarii(azi, ziVerificare = 1) {
  const d = ((ziSaptamaniiNecesar(azi) - ziVerificare) % 7 + 7) % 7;
  return plusZileNecesar(azi, -d);
}

// Istoricul săptămânal: necesarul la fiecare verificare din ultimele 26 de săptămâni (fereastra se termină în ziua
// dinaintea verificării). Valoarea afișată se mișcă cu cel mult 150 kcal față de săptămâna dinainte; prima e cea calculată.
// Se recalculează de fiecare dată din date (nu se salvează), deci o zi corectată corectează și istoricul.
function istoricNecesar({ zileNutritie, masuratori, azi, ziVerificare = 1, tintaKcal = 0, necesarFormula = null, saptamani = NECESAR.SAPTAMANI_ISTORIC }) {
  const ultima = dataVerificarii(azi, ziVerificare);
  const serie = serieGreutate(masuratori, plusZileNecesar(ultima, -1));
  const rez = [];
  let anterior = null;
  for (let k = saptamani - 1; k >= 0; k--) {
    const data = plusZileNecesar(ultima, -7 * k);
    const e = estimeazaNecesar({ zileNutritie, masuratori, panaLa: plusZileNecesar(data, -1), tintaKcal, necesarFormula, serie });
    if (e.stare !== 'ok') { if (k === 0) rez.push({ data, ...e, afisat: anterior }); continue; }
    const afisat = anterior === null ? e.necesar : Math.min(anterior + NECESAR.PAS_MAXIM, Math.max(anterior - NECESAR.PAS_MAXIM, e.necesar));
    const r = { data, ...e, afisat: Math.round(afisat / 10) * 10, limitatPas: anterior !== null && Math.abs(afisat - e.necesar) > 0.5 };
    anterior = afisat;
    rez.push(r);
  }
  return rez;
}

// ---------- Ținta din obiectiv ----------

function ritmObiectiv(scop, ritmProcent) {
  const r = RITM_OBIECTIV[scop] || RITM_OBIECTIV.mentinere;
  if (!r.semn) return 0;
  const v = Number(ritmProcent);
  const p = v >= r.min && v <= r.max ? v : r.implicit;
  return r.semn * p;
}

// Ținta de calorii = necesarul + surplusul/deficitul ritmului ales (kg/săpt. × 7.700 / 7), cu macronutrienții împărțiți
// ca la estimarea din profil. Nu coboară sub minimul sigur (KCAL_MINIM; sex necunoscut: minimul mai mic).
function tintaDinNecesar({ necesar, kg, scop = 'mentinere', ritmProcent, sex, proteinePeKg }) {
  const { impartireMacronutrienti, KCAL_MINIM, SCOPURI_NUTRITIE } = nzi();
  const s = SCOPURI_NUTRITIE.find(x => x.id === scop) || SCOPURI_NUTRITIE.find(x => x.id === 'mentinere');
  const procent = ritmObiectiv(s.id, ritmProcent);
  const ritmKgSapt = kg * procent / 100;
  const ajustareKcal = ritmKgSapt * NECESAR.KCAL_PE_KG / 7;
  const minim = KCAL_MINIM[sex] || Math.min(KCAL_MINIM.m, KCAL_MINIM.f);
  let kcal = Math.round((necesar + ajustareKcal) / 10) * 10;
  const limitat = kcal < minim;
  if (limitat) kcal = minim;
  const ppk = proteinePeKg >= 1.2 && proteinePeKg <= 3 ? proteinePeKg : s.proteinePeKg;
  const m = impartireMacronutrienti({ kcal, kg, proteinePeKg: ppk });
  return { kcal, proteine: m.proteine, carbohidrati: m.carbohidrati, grasimi: m.grasimi, fibre: m.fibre,
    ritmProcent: procent, ritmKgSapt, ajustareKcal, proteinePeKg: ppk, plafonCarbo: m.plafonCarbo, limitat };
}

// ---------- Verificarea săptămânii ----------

// Cardul apare dacă funcția e pornită și n-ai răspuns încă pentru verificarea de acum (Aplică / Păstrez).
function verificareDeAratat({ azi, setare }) {
  const s = curataNecesarAdaptiv(setare);
  if (!s.pornit) return null;
  const data = dataVerificarii(azi, s.ziVerificare);
  return s.raspunsLa && s.raspunsLa >= data ? null : data;
}

// Diferențele dintre țintele actuale și cele propuse (pentru card: „+120 kcal”).
function diferenteTinte(actuale, propuse) {
  const rez = {};
  for (const c of ['kcal', 'proteine', 'carbohidrati', 'grasimi', 'fibre']) {
    if (typeof propuse[c] === 'number') rez[c] = actuale && typeof actuale[c] === 'number' ? propuse[c] - actuale[c] : null;
  }
  return rez;
}

// ---------- Setarea și istoricul (backup, sincronizare) ----------

function curataNecesarAdaptiv(s) {
  const x = s && typeof s === 'object' ? s : {};
  const rez = { pornit: x.pornit !== false, ziVerificare: Number.isInteger(x.ziVerificare) && x.ziVerificare >= 0 && x.ziVerificare <= 6 ? x.ziVerificare : 1 };
  const nr = (v, min, max) => (typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? Math.round(v * 100) / 100 : undefined);
  const rm = nr(x.ritmMasa, RITM_OBIECTIV.masa.min, RITM_OBIECTIV.masa.max);
  const rs = nr(x.ritmSlabire, RITM_OBIECTIV.slabire.min, RITM_OBIECTIV.slabire.max);
  const pk = nr(x.proteinePeKg, 1.2, 3);
  if (rm !== undefined) rez.ritmMasa = rm;
  if (rs !== undefined) rez.ritmSlabire = rs;
  if (pk !== undefined) rez.proteinePeKg = pk;
  if (typeof x.raspunsLa === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x.raspunsLa)) rez.raspunsLa = x.raspunsLa;
  return rez;
}

const MAX_ISTORIC_TINTE = 52;
function curataIstoricTinte(lista) {
  if (!Array.isArray(lista)) return [];
  const t = v => (v && typeof v === 'object' && typeof v.kcal === 'number' ? Object.fromEntries(
    ['kcal', 'proteine', 'carbohidrati', 'grasimi', 'fibre'].filter(c => typeof v[c] === 'number' && Number.isFinite(v[c])).map(c => [c, Math.round(v[c])])) : null);
  return lista.filter(x => x && typeof x.data === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x.data) && t(x.noi))
    .map(x => ({ data: x.data, vechi: t(x.vechi), noi: t(x.noi), ...(typeof x.necesar === 'number' ? { necesar: Math.round(x.necesar) } : {}) }))
    .slice(-MAX_ISTORIC_TINTE);
}
function adaugaInIstoricTinte(lista, intrare) {
  return curataIstoricTinte([...(Array.isArray(lista) ? lista : []), intrare]);
}

// ---------- Texte (pentru card și pentru „Cum s-a calculat?”) ----------

function fmtNecesar(v, zec = 0) {
  const r = Math.round(Math.abs(v) * 10 ** zec) / 10 ** zec;
  const [i, d] = r.toFixed(zec).split('.');
  return (v < 0 && r > 0 ? '−' : '') + i.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + (d ? ',' + d : '');
}

// „Greutatea ta crește cu 0,4 kg/săpt. (ținta: 0,2)”
function textRitm(kgPeSapt, tintaKgSapt) {
  const v = Math.round(kgPeSapt * 10) / 10;
  const baza = v === 0 ? 'Greutatea ta e stabilă' : `Greutatea ta ${v > 0 ? 'crește' : 'scade'} cu ${fmtNecesar(Math.abs(v), 1)} kg/săpt.`;
  if (tintaKgSapt === null || tintaKgSapt === undefined) return baza + '.';
  const t = Math.round(tintaKgSapt * 100) / 100;
  return `${baza} (ținta: ${t === 0 ? 'stabilă' : `${t > 0 ? '+' : '−'}${fmtNecesar(Math.abs(t), 2).replace(/,?0+$/, '') || '0'}`})`;
}

// Pașii calculului, cu cifrele tale.
function pasiCalcul(e, tinta) {
  const pasi = [];
  pasi.push(`Am analizat ${e.fereastra} de zile (${e.dela} – ${e.panaLa}): ${e.zileValide} ${e.zileValide === 1 ? 'zi notată' : 'zile notate'} complet și ${e.cantariri} ${e.cantariri === 1 ? 'cântărire' : 'cântăriri'}.`);
  const excl = e.excluse || [];
  const nr = m => excl.filter(x => x.motiv === m).length;
  if (excl.length) {
    const parti = [];
    if (nr('goala')) parti.push(`${nr('goala')} fără nimic bifat ca mâncat`);
    if (nr('putin')) parti.push(`${nr('putin')} cu mai puțin de jumătate din țintă`);
    if (nr('marcata')) parti.push(`${nr('marcata')} marcate de tine „nu e notată complet”`);
    pasi.push(`Zile lăsate deoparte: ${parti.join(', ')}.`);
  }
  if (e.aberante && e.aberante.length) pasi.push(`Cântăriri ignorate (sar față de zilele vecine și revin): ${e.aberante.map(a => `${a.data} (${fmtNecesar(a.kg, 1)} kg)`).join(', ')}.`);
  pasi.push(`Media caloriilor mâncate: ${fmtNecesar(e.mediaKcal)} kcal pe zi.`);
  pasi.push(`Ritmul greutății (dreapta prin valorile zilnice, zilele fără cântărire completate din vecine): ${e.kgPeSapt >= 0 ? '+' : '−'}${fmtNecesar(Math.abs(e.kgPeSapt), 2)} kg/săpt., adică ${fmtNecesar(e.kgPeZi * NECESAR.KCAL_PE_KG)} kcal pe zi (× 7.700 kcal/kg, o aproximare).`);
  pasi.push(`Necesarul din date: ${fmtNecesar(e.mediaKcal)} ${e.kgPeZi >= 0 ? '−' : '+'} ${fmtNecesar(Math.abs(e.kgPeZi * NECESAR.KCAL_PE_KG))} = ${fmtNecesar(e.necesarDate)} kcal.`);
  if (e.necesarFormula) pasi.push(`Combinat cu formula (${fmtNecesar(e.necesarFormula)} kcal): datele contează ${Math.round(e.pondere * 100)}%, formula ${100 - Math.round(e.pondere * 100)}% → ${fmtNecesar(e.necesar)} kcal. Cu cât notezi mai multe zile, cu atât contează mai mult datele.`);
  if (e.limitatPas) pasi.push(`Ca să nu sară de la o săptămână la alta, necesarul afișat se mișcă cu cel mult ${NECESAR.PAS_MAXIM} kcal: ${fmtNecesar(e.afisat)} kcal.`);
  if (e.avertizari && e.avertizari.includes('ritm')) pasi.push(`Ritmul a ieșit peste ${fmtNecesar(NECESAR.RITM_MAXIM_KG_SAPT, 1)} kg/săpt., puțin probabil: l-am plafonat. Verifică cântăririle.`);
  if (e.avertizari && e.avertizari.includes('plafonat')) pasi.push(`Rezultatul din date a ieșit în afara limitelor (${fmtNecesar(NECESAR.NECESAR_MIN)}–${fmtNecesar(NECESAR.NECESAR_MAX)} kcal) și a fost plafonat. Verifică zilele notate și cântăririle.`);
  if (tinta) {
    pasi.push(tinta.ritmKgSapt
      ? `Obiectivul: ${tinta.ritmKgSapt > 0 ? '+' : '−'}${fmtNecesar(Math.abs(tinta.ritmProcent), 2).replace(/,?0+$/, '')}% din greutate pe săptămână = ${fmtNecesar(Math.abs(tinta.ritmKgSapt), 2)} kg/săpt. → ${tinta.ajustareKcal > 0 ? '+' : '−'}${fmtNecesar(Math.abs(tinta.ajustareKcal))} kcal pe zi. Ținta: ${fmtNecesar(tinta.kcal)} kcal.`
      : `Obiectivul: menținere, deci ținta e chiar necesarul: ${fmtNecesar(tinta.kcal)} kcal.`);
    if (tinta.limitat) pasi.push('Ținta a fost ridicată la minimul sigur pentru o estimare generală.');
    pasi.push(`Macronutrienți: proteine ${fmtNecesar(tinta.proteinePeKg, 1)} g/kg, grăsimi 25% din calorii (cel puțin 0,6 g/kg), restul carbohidrați, cel mult 6 g/kg${tinta.plafonCarbo ? ' (plafonul a fost atins: surplusul a trecut la proteine și grăsimi)' : ''}.`);
  }
  return pasi;
}

if (typeof module !== 'undefined') {
  module.exports = { NECESAR, RITM_OBIECTIV, ZILE_SAPTAMANA_NUME, cantaririZilnice, marcheazaAberante, serieGreutate, pantaRegresie,
    zileNotateComplet, estimeazaNecesar, dataVerificarii, istoricNecesar, ritmObiectiv, tintaDinNecesar, verificareDeAratat,
    diferenteTinte, curataNecesarAdaptiv, curataIstoricTinte, adaugaInIstoricTinte, textRitm, pasiCalcul, fmtNecesar, plusZileNecesar };
}
