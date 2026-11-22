// Nutriție — analiza și istoricul (etapa 9). Fără DOM, testabil în Node (tests/nutritie-analiza.test.js).
//
// Toate cifrele vin din zilele salvate (store-ul zileNutritie). Fiecare intrare păstrează valorile din momentul
// adăugării (valoriPortie), deci istoricul nu se schimbă dacă rețeta e editată sau ștearsă mai târziu.
//
// Reguli:
// - „Mâncat” = doar ce ai marcat (Mâncată = toate porțiile, Parțial = porțiile scrise). Planificatul nu se numără ca mâncat.
// - Mediile de „mâncat” se fac pe zilele în care ai notat ceva mâncat (o zi fără notări nu înseamnă 0 kcal mâncate,
//   ci că nu știm). Numărul de zile notate e afișat separat. Mediile de „planificat” se fac pe zilele cu plan.
// - O zi e „în țintă” la calorii dacă mâncatul e în ±10% din țintă; proteinele sunt atinse dacă mâncatul ≥ ținta − 10 g.
// - Zilele viitoare nu intră în analiză.

const PERIOADE_NUTRITIE = [
  { cheie: '7', nume: '7 zile', zile: 7 },
  { cheie: '30', nume: '30 de zile', zile: 30 },
  { cheie: '90', nume: '90 de zile', zile: 90 },
  { cheie: 'personalizat', nume: 'Personalizat', zile: null },
];

function calculeZiAnaliza() {
  if (typeof totaluriZi === 'function') return { totaluriZi, valoriZero, zileSaptamana };
  return require('./nutritie-zi.js');
}

function dataPlusZile(data, n) {
  const [a, l, z] = data.split('-').map(Number);
  const d = new Date(a, l - 1, z + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Intervalul unei perioade, care se termină azi (sau la data aleasă, dar nu în viitor).
function intervalNutritie(cheie, azi, personalizat) {
  const p = PERIOADE_NUTRITIE.find(x => x.cheie === cheie) || PERIOADE_NUTRITIE[1];
  if (p.cheie === 'personalizat' && personalizat && personalizat.de && personalizat.pana) {
    let de = personalizat.de, pana = personalizat.pana;
    if (de > pana) [de, pana] = [pana, de];
    if (pana > azi) pana = azi;
    if (de > pana) de = pana;
    return { de, pana };
  }
  const zile = p.zile || 30;
  return { de: dataPlusZile(azi, -(zile - 1)), pana: azi };
}

function listaDate(de, pana) {
  const rez = [];
  for (let d = de; d <= pana && rez.length < 3700; d = dataPlusZile(d, 1)) rez.push(d);
  return rez;
}

const CAMPURI_ANALIZA = ['kcal', 'proteine', 'carbohidrati', 'grasimi', 'fibre'];
function medieValori(lista) {
  const Z = calculeZiAnaliza();
  const rez = Z.valoriZero();
  if (!lista.length) return rez;
  for (const v of lista) for (const c of CAMPURI_ANALIZA) rez[c] += v[c] || 0;
  for (const c of CAMPURI_ANALIZA) rez[c] /= lista.length;
  return rez;
}

function distributieMacro(v) {
  const p = v.proteine * 4, c = v.carbohidrati * 4, g = v.grasimi * 9;
  const s = p + c + g;
  if (!(s > 0)) return { proteine: 0, carbohidrati: 0, grasimi: 0 };
  return { proteine: p / s, carbohidrati: c / s, grasimi: g / s };
}

// zile: toate zilele salvate. tinte: setari.tinteNutritie (poate lipsi).
function analizaNutritie(zile, { de, pana, tinte }) {
  const Z = calculeZiAnaliza();
  const dupaData = new Map((zile || []).map(z => [z.data, z]));
  const date = listaDate(de, pana);
  const pe = date.map(data => {
    const zi = dupaData.get(data) || { data, mese: [] };
    const t = Z.totaluriZi(zi);
    return { data, planificat: t.planificat, mancat: t.mancat, intrari: t.numar, terminate: t.terminate,
      partiale: zi.mese.filter(i => i.stare === 'partial').length,
      arePlan: t.numar > 0, areMancare: zi.mese.some(i => i.stare !== 'neinceput') };
  });
  const cuMancare = pe.filter(z => z.areMancare);
  const cuPlan = pe.filter(z => z.arePlan);
  const medieMancat = medieValori(cuMancare.map(z => z.mancat));
  const mediePlanificat = medieValori(cuPlan.map(z => z.planificat));

  // Obiective (doar pe zilele cu mâncare notată)
  let obiective = null;
  if (tinte && tinte.kcal) {
    const inTinta = cuMancare.filter(z => Math.abs(z.mancat.kcal - tinte.kcal) <= tinte.kcal * 0.10).length;
    const sub = cuMancare.filter(z => z.mancat.kcal < tinte.kcal * 0.90).length;
    const peste = cuMancare.filter(z => z.mancat.kcal > tinte.kcal * 1.10).length;
    const proteine = tinte.proteine ? cuMancare.filter(z => z.mancat.proteine >= tinte.proteine - 10).length : null;
    obiective = { zile: cuMancare.length, kcalInTinta: inTinta, kcalSub: sub, kcalPeste: peste, proteineAtinse: proteine,
      procentKcal: cuMancare.length ? inTinta / cuMancare.length : null,
      procentProteine: proteine !== null && cuMancare.length ? proteine / cuMancare.length : null };
  }

  // Consecvența: zile notate, mese mâncate din cele planificate (pe zilele cu plan), seria curentă și cea mai lungă.
  const intrariPlan = cuPlan.reduce((s, z) => s + z.intrari, 0);
  const intrariTerminate = cuPlan.reduce((s, z) => s + z.terminate, 0);
  let serie = 0, serieMax = 0, curenta = 0;
  for (const z of pe) { if (z.areMancare) { curenta++; serieMax = Math.max(serieMax, curenta); } else curenta = 0; }
  for (let k = pe.length - 1; k >= 0; k--) {
    if (pe[k].areMancare) serie++;
    else if (k === pe.length - 1) continue; // azi încă nenotat nu rupe seria
    else break;
  }
  // Planificat vs mâncat: pe zilele care au și plan, și mâncare notată.
  const ambele = pe.filter(z => z.arePlan && z.areMancare);
  const sumaPlan = ambele.reduce((s, z) => s + z.planificat.kcal, 0);
  const sumaMancat = ambele.reduce((s, z) => s + z.mancat.kcal, 0);

  // Medii pe săptămâni (luni–duminică) și pe luni calendaristice, din zilele cu mâncare notată.
  const grupeaza = cheie => {
    const m = new Map();
    for (const z of pe) {
      const k = cheie(z.data);
      if (!m.has(k)) m.set(k, { cheie: k, de: z.data, pana: z.data, mancat: [], planificat: [] });
      const g = m.get(k);
      g.pana = z.data;
      if (z.areMancare) g.mancat.push(z.mancat);
      if (z.arePlan) g.planificat.push(z.planificat);
    }
    const inT = v => tinte && tinte.kcal && Math.abs(v.kcal - tinte.kcal) <= tinte.kcal * 0.10;
    return [...m.values()].map(g => ({ cheie: g.cheie, de: g.de, pana: g.pana, zileNotate: g.mancat.length,
      zileInTinta: tinte && tinte.kcal ? g.mancat.filter(inT).length : null,
      medieMancat: medieValori(g.mancat), mediePlanificat: medieValori(g.planificat) }));
  };
  const saptamani = grupeaza(d => Z.zileSaptamana(d)[0]);
  const luni = grupeaza(d => d.slice(0, 7));

  return {
    de, pana, zileInterval: pe.length, pe,
    zileCuMancare: cuMancare.length, zileCuPlan: cuPlan.length,
    medieMancat, mediePlanificat, distributie: distributieMacro(medieMancat),
    obiective,
    consecventa: { zileNotate: cuMancare.length, zileInterval: pe.length, intrariPlan, intrariTerminate,
      procentMese: intrariPlan ? intrariTerminate / intrariPlan : null, serie, serieMax },
    planVsMancat: { zile: ambele.length, planificat: sumaPlan, mancat: sumaMancat, raport: sumaPlan ? sumaMancat / sumaPlan : null },
    saptamani, luni,
  };
}

if (typeof module !== 'undefined') {
  module.exports = { PERIOADE_NUTRITIE, intervalNutritie, listaDate, analizaNutritie, distributieMacro, medieValori, dataPlusZile };
}
