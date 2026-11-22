// Teste pentru generarea inteligentă (nutritie-generator.js, etapa 5).
const test = require('node:test');
const assert = require('node:assert/strict');
const g = require('../nutritie-generator.js');
const c = require('../nutritie-calcul.js');
const z = require('../nutritie-zi.js');
const v = require('../validare.js');
const aproape = (x, y, eps = 1e-6) => assert.ok(Math.abs(x - y) < eps, `${x} ≠ ${y}`);
const { ALIMENTE_BAZA } = require('../nutritie-alimente.js');
const { RETETE_BAZA } = require('../nutritie-retete.js');

const idx = c.indexAlimente(ALIMENTE_BAZA);
function rngFix(seed = 1) { let x = seed; return () => { x = (x * 16807) % 2147483647; return (x - 1) / 2147483646; }; }
function idGen() { let n = 0; return () => `g-${++n}`; }
const ZI_GOALA = { data: '2026-11-22', mese: [] };
function genereaza(extra = {}) {
  return g.genereazaInteligent({ zi: ZI_GOALA, retete: RETETE_BAZA, idx, rng: rngFix(extra.seed || 1), idNou: idGen(), porniri: 12, ...extra });
}

const SCENARII = [
  ['masa', { kcal: 3000, proteine: 150, carbohidrati: 400, grasimi: 85 }],
  ['slabire', { kcal: 1800, proteine: 150, carbohidrati: 170, grasimi: 55 }],
  ['mentinere', { kcal: 2400, proteine: 130, carbohidrati: 290, grasimi: 75 }],
];

test('planul atinge țintele în toleranță pentru cele trei obiective', () => {
  for (const [scop, tinte] of SCENARII) {
    for (const seed of [1, 2, 3]) {
      const rez = genereaza({ tinte, scop, seed });
      assert.equal(rez.mese.length, 5, scop);
      assert.equal(new Set(rez.mese.map(i => i.idReteta)).size, 5, scop);
      const t = z.totaluriZi({ mese: rez.mese }).planificat;
      assert.ok(Math.abs(t.kcal - tinte.kcal) <= tinte.kcal * 0.10, `${scop}: kcal ${t.kcal}`);
      assert.ok(t.proteine >= tinte.proteine - 10, `${scop}: proteine ${t.proteine}`);
      // raportul calculează aceleași totaluri
      assert.ok(Math.abs(rez.raport.totaluri.kcal - t.kcal) < 1e-6);
      for (const i of rez.mese) assert.ok(g.PORTII_GEN.includes(i.portii), `${i.portii}`);
    }
  }
});

test('slăbire: caloriile nu trec mult peste țintă; masă: proteinele nu rămân sub țintă', () => {
  for (const seed of [4, 5, 6, 7]) {
    const s = genereaza({ tinte: SCENARII[1][1], scop: 'slabire', seed });
    assert.ok(s.raport.totaluri.kcal <= 1800 * 1.05, `slăbire ${s.raport.totaluri.kcal}`);
    const m = genereaza({ tinte: SCENARII[0][1], scop: 'masa', seed });
    assert.ok(m.raport.totaluri.proteine >= 150 - 10, `masă ${m.raport.totaluri.proteine}`);
  }
});

test('caloriile sunt împărțite rezonabil pe mese (gustările mai mici decât mesele principale)', () => {
  for (const seed of [1, 2, 3, 4]) {
    const rez = genereaza({ tinte: SCENARII[2][1], scop: 'mentinere', seed });
    const k = Object.fromEntries(rez.mese.map(i => [i.masa, i.valoriPortie.kcal * i.portii]));
    assert.ok(k['gustare-1'] < k.pranz && k['gustare-2'] < k.cina, JSON.stringify(k));
    for (const m of Object.keys(k)) assert.ok(k[m] / 2400 < 0.5, `${m}: ${k[m]}`);
  }
});

test('alergiile nu se încalcă niciodată (nici „poate conține”), nici când țintele nu se pot atinge', () => {
  const pref = g.curataPreferinteNutritie({ alergii: ['lapte', 'gluten', 'oua', 'nuci', 'arahide', 'soia'] });
  for (const seed of [1, 2, 3, 4, 5]) {
    const rez = genereaza({ tinte: { kcal: 3500, proteine: 220 }, scop: 'masa', pref, seed });
    for (const i of rez.mese) {
      const r = RETETE_BAZA.find(x => x.id === i.idReteta);
      const al = c.alergeniReteta(r, idx);
      for (const a of pref.alergii) assert.ok(!al.contine.includes(a) && !al.urme.includes(a), `${r.id}: ${a}`);
    }
    // explicație pentru ce nu s-a putut
    assert.ok(rez.raport.mesaje.length > 0);
  }
});

test('dieta, ingredientele excluse și timpul maxim sunt respectate', () => {
  const pref = g.curataPreferinteNutritie({ dieta: ['vegan'], excluse: ['naut'], timpMaxim: 30 });
  const rez = genereaza({ tinte: { kcal: 2500, proteine: 120 }, scop: 'mentinere', pref, seed: 3 });
  for (const i of rez.mese) {
    const r = RETETE_BAZA.find(x => x.id === i.idReteta);
    assert.ok(c.eticheteReteta(r, idx).includes('vegan'), r.id);
    assert.ok(!r.ingrediente.some(([id]) => id === 'naut'), r.id);
    assert.ok(r.timp <= 30, r.id);
  }
});

test('o masă fără rețete compatibile rămâne goală și e explicată', () => {
  // excludem toate rețetele de cină cu un timp maxim imposibil pentru ele, prin filtrarea listei
  const retete = RETETE_BAZA.filter(r => r.masa !== 'cina');
  const rez = g.genereazaInteligent({ zi: ZI_GOALA, retete, idx, tinte: { kcal: 2200 }, rng: rngFix(1), idNou: idGen(), porniri: 6 });
  assert.deepEqual(rez.lipsa, ['cina']);
  assert.equal(rez.mese.length, 4);
  assert.ok(rez.raport.mesaje.some(m => m.tip === 'eroare' && m.text.includes('cină')));
  // alergie care elimină tot micul dejun
  const tot = g.filtreazaReteteGen(RETETE_BAZA, idx, g.curataPreferinteNutritie({ alergii: ['gluten', 'lapte', 'oua', 'nuci', 'arahide', 'soia', 'susan'], dieta: ['vegan'], timpMaxim: 10 }));
  if (!tot.candidate['mic-dejun'].length) assert.ok(tot.excluse['mic-dejun'].alergii + tot.excluse['mic-dejun'].dieta + tot.excluse['mic-dejun'].timp > 0);
});

test('mesele blocate sau începute rămân și intră în calculul țintelor', () => {
  const baza = genereaza({ tinte: SCENARII[2][1], seed: 9 });
  const blocat = { ...baza.mese[2], blocat: true, portii: 2 };
  const zi = { data: '2026-11-22', mese: [blocat] };
  const rez = g.genereazaInteligent({ zi, retete: RETETE_BAZA, idx, tinte: SCENARII[2][1], scop: 'mentinere', rng: rngFix(2), idNou: idGen(), porniri: 12 });
  assert.deepEqual(rez.pastrate, ['pranz']);
  assert.deepEqual(rez.mese.find(i => i.masa === 'pranz'), blocat);
  assert.equal(rez.mese.length, 5);
  assert.ok(!rez.mese.filter(i => i.masa !== 'pranz').some(i => i.idReteta === blocat.idReteta));
  const t = z.totaluriZi({ mese: rez.mese }).planificat.kcal;
  assert.ok(Math.abs(t - 2400) <= 240, `${t}`);
});

test('rețetele din ultimele 2 zile sunt evitate când există alternative', () => {
  const ieri = genereaza({ tinte: SCENARII[2][1], seed: 11 });
  const zile = [{ data: '2026-11-21', mese: ieri.mese }, { data: '2026-11-10', mese: [] }];
  const recente = g.reteteRecente(zile, '2026-11-22');
  assert.equal(recente.size, 5);
  assert.equal(g.reteteRecente(zile, '2026-11-25').size, 0);
  for (const seed of [1, 2, 3]) {
    const azi = genereaza({ tinte: SCENARII[2][1], seed, recente });
    assert.ok(azi.mese.filter(i => recente.has(i.idReteta)).length <= 1, `seed ${seed}`);
  }
});

test('apăsări repetate dau planuri diferite (nu mereu același plan)', () => {
  const planuri = new Set();
  for (let seed = 1; seed <= 8; seed++) planuri.add(genereaza({ tinte: SCENARII[2][1], seed }).mese.map(i => i.idReteta).join(','));
  assert.ok(planuri.size >= 4, `${planuri.size}`);
});

test('fără ținte: planul respectă filtrele, porția 1, fără abateri', () => {
  const rez = genereaza({ tinte: null, pref: g.curataPreferinteNutritie({ dieta: ['vegetarian'] }) });
  assert.equal(rez.mese.length, 5);
  assert.ok(rez.mese.every(i => i.portii === 1));
  assert.deepEqual(rez.raport.abateri, []);
  for (const i of rez.mese) assert.ok(c.eticheteReteta(RETETE_BAZA.find(x => x.id === i.idReteta), idx).includes('vegetarian'));
});

test('preferințele: validare și conflictele unei rețete', () => {
  assert.equal(g.curataPreferinteNutritie(null), null);
  const p = g.curataPreferinteNutritie({ dieta: ['vegan', 'keto'], alergii: ['lapte', 'lapte', 'x'], stil: ['proteic', 'ieftin'],
    excluse: ['pui-piept'], preferate: ['pui-piept', 'ovaz'], timpMaxim: 17 });
  assert.deepEqual(p, { dieta: ['vegan'], alergii: ['lapte'], stil: ['proteic'], excluse: ['pui-piept'], preferate: ['ovaz'], timpMaxim: null });
  const r = RETETE_BAZA.find(x => x.id === 'pr-pui-orez-broccoli');
  const conf = g.conflicteReteta(r, idx, g.curataPreferinteNutritie({ dieta: ['vegetarian'], excluse: ['pui-piept'], timpMaxim: 10 }));
  assert.deepEqual(conf.excluse, ['pui-piept']);
  assert.deepEqual(conf.dieta, ['vegetarian']);
  assert.equal(conf.timp, r.timp > 10);
});

// ---------- Etapa 6: înlocuirea inteligentă ----------
const PLAN6 = g.genereazaInteligent({ zi: ZI_GOALA, retete: RETETE_BAZA, idx, tinte: { kcal: 2600, proteine: 150, carbohidrati: 300, grasimi: 80 },
  scop: 'mentinere', rng: rngFix(21), idNou: idGen(), porniri: 12 });

test('înlocuire: alternative din aceeași masă, fără rețete deja în zi, ordonate după asemănare', () => {
  for (const i of PLAN6.mese) {
    const a = g.alternativeInlocuire({ intrare: i, zi: PLAN6, retete: RETETE_BAZA, idx, pref: g.preferinteGoale() });
    const inZi = new Set(PLAN6.mese.map(x => x.idReteta));
    for (const alt of [...a.potrivite, ...a.apropiate]) {
      assert.equal(alt.r.masa, i.masa);
      assert.ok(!inZi.has(alt.r.id));
      assert.ok(g.PORTII_GEN.includes(alt.portii));
    }
    for (let k = 1; k < a.potrivite.length; k++) assert.ok(a.potrivite[k - 1].rang >= a.potrivite[k].rang);
    // „potrivite” înseamnă toate cele 4 valori în toleranță; valorile sunt chiar ale rețetei × porția sugerată
    for (const alt of a.potrivite) {
      assert.ok(alt.toate);
      assert.ok(Math.abs(alt.dif.kcal) <= Math.max(a.tinta.kcal * 0.1, 20));
      assert.ok(Math.abs(alt.dif.proteine) <= 10 && Math.abs(alt.dif.carbohidrati) <= 15 && Math.abs(alt.dif.grasimi) <= 10);
      const v = c.valoriPortie(alt.r, idx);
      assert.ok(Math.abs(alt.valori.kcal - v.kcal * alt.portii) < 1e-6);
    }
    assert.ok(a.potrivite.length >= 1, `${i.masa}: cel puțin o alternativă potrivită`);
  }
});

test('înlocuire: filtrele stricte se respectă', () => {
  const pref = g.curataPreferinteNutritie({ alergii: ['lapte'], dieta: ['vegetarian'] });
  for (const i of PLAN6.mese) {
    const a = g.alternativeInlocuire({ intrare: i, zi: PLAN6, retete: RETETE_BAZA, idx, pref, toateMesele: true });
    for (const alt of [...a.potrivite, ...a.apropiate]) {
      const al = c.alergeniReteta(alt.r, idx);
      assert.ok(!al.contine.includes('lapte') && !al.urme.includes('lapte'), alt.r.id);
      assert.ok(c.eticheteReteta(alt.r, idx).includes('vegetarian'), alt.r.id);
    }
  }
});

test('înlocuire: aceeași masă are prioritate; „toate mesele” adaugă și alte rețete', () => {
  const i = PLAN6.mese[2];
  const doar = g.alternativeInlocuire({ intrare: i, zi: PLAN6, retete: RETETE_BAZA, idx, pref: g.preferinteGoale() });
  const toate = g.alternativeInlocuire({ intrare: i, zi: PLAN6, retete: RETETE_BAZA, idx, pref: g.preferinteGoale(), toateMesele: true });
  assert.ok(toate.totalCandidate > doar.totalCandidate);
  // la scor egal, rețetele aceleiași mese sunt înaintea celorlalte (penalizare de rang)
  const alte = toate.potrivite.filter(a => !a.aceeasiMasa);
  for (const a of alte) assert.equal(a.rang, a.scor - 15);
});

test('înlocuire: fără potriviri reale nu se pretinde o potrivire', () => {
  // o intrare imposibilă: 3000 kcal la o gustare
  const i = { ...PLAN6.mese[1], valoriPortie: { kcal: 3000, proteine: 5, carbohidrati: 10, grasimi: 330, fibre: 0 }, portii: 1 };
  const a = g.alternativeInlocuire({ intrare: i, zi: PLAN6, retete: RETETE_BAZA, idx, pref: g.preferinteGoale() });
  assert.equal(a.potrivite.length, 0);
  assert.ok(a.apropiate.every(x => !x.toate && x.scor < 75));
});

test('asemănarea: 100 pentru identic, 75 la limita toleranțelor', () => {
  const t = { kcal: 500, proteine: 30, carbohidrati: 50, grasimi: 20 };
  assert.equal(g.comparaValori({ ...t }, t).scor, 100);
  const limita = g.comparaValori({ kcal: 550, proteine: 40, carbohidrati: 65, grasimi: 30 }, t);
  assert.equal(limita.scor, 75);
  assert.equal(limita.toate, true);
  assert.equal(g.comparaValori({ kcal: 560, proteine: 30, carbohidrati: 50, grasimi: 20 }, t).toate, false);
});

// ---------- Etapa 8: săptămâna ----------
test('zilele săptămânii: luni–duminică, peste schimbarea lunii și a anului', () => {
  assert.deepEqual(z.zileSaptamana('2026-11-22'), ['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22']);
  assert.deepEqual(z.zileSaptamana('2026-11-16')[0], '2026-11-16');
  assert.deepEqual(z.zileSaptamana('2027-01-01'), ['2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02', '2027-01-03']);
});

const TINTE8 = { kcal: 2500, proteine: 140, carbohidrati: 300, grasimi: 80 };
function saptamana(seed = 1, extra = {}) {
  const date = z.zileSaptamana('2026-11-23');
  return { date, ...g.genereazaSaptamana({ date, zileExistente: {}, retete: RETETE_BAZA, idx, tinte: TINTE8, scop: 'mentinere',
    pref: g.preferinteGoale(), preferateReteta: new Set(), rng: rngFix(seed), idNou: idGen(), porniri: 8, ...extra }) };
}

test('săptămâna generată: 7 zile × 5 mese, fiecare zi în țintă, fără repetări în zile consecutive, puține repetări', () => {
  const { date, zile } = saptamana(3);
  const toate = [];
  for (const d of date) {
    assert.equal(zile[d].mese.length, 5, d);
    assert.equal(new Set(zile[d].mese.map(i => i.idReteta)).size, 5, d);
    const t = z.totaluriZi(zile[d]).planificat;
    assert.ok(Math.abs(t.kcal - TINTE8.kcal) <= TINTE8.kcal * 0.1, `${d}: ${t.kcal}`);
    toate.push(...zile[d].mese.map(i => i.idReteta));
  }
  for (let k = 1; k < 7; k++) {
    const ieri = new Set(zile[date[k - 1]].mese.map(i => i.idReteta));
    const comune = zile[date[k]].mese.filter(i => ieri.has(i.idReteta)).length;
    assert.ok(comune <= 1, `${date[k]}: ${comune} comune cu ziua dinainte`);
  }
  // 35 de mese din 150 de rețete: cel puțin 25 de rețete diferite
  assert.ok(new Set(toate).size >= 25, `${new Set(toate).size}`);
  const tot = z.totaluriSaptamana(date.map(d => zile[d]), TINTE8);
  assert.equal(tot.zileCuMese, 7);
  assert.equal(tot.intrari, 35);
  assert.ok(Math.abs(tot.abateri.kcal) <= 250);
  aproape(tot.mediePlanificat.kcal * 7, tot.planificat.kcal, 1e-6);
});

test('săptămâna: zilele existente cu mese blocate/începute rămân; alergiile se respectă în toată săptămâna', () => {
  const date = z.zileSaptamana('2026-11-23');
  const baza = saptamana(5);
  const blocat = { ...baza.zile[date[2]].mese[0], blocat: true };
  const mancat = z.schimbaStareIntrare(baza.zile[date[4]].mese[3], 'complet');
  const pref = g.curataPreferinteNutritie({ alergii: ['lapte'] });
  const rez = g.genereazaSaptamana({ date, zileExistente: { [date[2]]: { data: date[2], mese: [blocat] }, [date[4]]: { data: date[4], mese: [mancat] } },
    retete: RETETE_BAZA, idx, tinte: TINTE8, scop: 'mentinere', pref, preferateReteta: new Set(), rng: rngFix(2), idNou: idGen(), porniri: 6 });
  assert.deepEqual(rez.zile[date[2]].mese.find(i => i.masa === 'mic-dejun'), blocat);
  assert.deepEqual(rez.zile[date[4]].mese.find(i => i.masa === 'gustare-2'), mancat);
  for (const d of date) for (const i of rez.zile[d].mese) {
    if (i === blocat || i === mancat) continue;
    const al = c.alergeniReteta(RETETE_BAZA.find(r => r.id === i.idReteta), idx);
    assert.ok(!al.contine.includes('lapte') && !al.urme.includes('lapte'), `${d} ${i.idReteta}`);
  }
});

test('copierea unei mese și planurile de săptămână', () => {
  const { date, zile } = saptamana(7);
  const i = { ...zile[date[0]].mese[1], blocat: true };
  const mancata = z.schimbaStareIntrare(i, 'partial', 0.5);
  const copie = z.copiazaIntrarea(mancata, { id: 'nou', acum: 1 });
  assert.equal(copie.id, 'nou');
  assert.equal(copie.stare, 'neinceput');
  assert.equal(copie.portiiMancate, undefined);
  assert.equal(copie.blocat, undefined);
  assert.deepEqual(copie.valoriPortie, i.valoriPortie);
  const plan = z.planSaptamanaDinZile(date.map(d => zile[d]), { id: 'u-s', nume: 'S1', favorit: true });
  assert.equal(plan.tip, 'saptamana');
  assert.equal(plan.zile.length, 7);
  const curat = z.curataPlanNutritie(JSON.parse(JSON.stringify(plan)));
  assert.equal(curat.zile.length, 7);
  assert.equal(curat.zile[3].length, 5);
  assert.equal(curat.mese, undefined);
  assert.equal(z.curataPlanNutritie({ ...plan, zile: plan.zile.slice(0, 6) }), null);
  assert.equal(z.curataPlanNutritie({ ...plan, zile: [[], [], [], [], [], [], []] }), null);
  // încărcarea unei zile din planul săptămânal în altă zi
  const rez = z.aplicaPlan({ zi: { data: 'x', mese: [] }, plan: { mese: curat.zile[2] }, idNou: idGen() });
  assert.deepEqual(rez.mese.map(x => x.idReteta), zile[date[2]].mese.map(x => x.idReteta));
  // backup
  const b = v.valideazaBackup({ versiune: 3, sesiuni: [], exercitii: [], masuratori: [], planuriNutritie: [plan] });
  assert.equal(b.date.planuriNutritie[0].zile.length, 7);
});
