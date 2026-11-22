// Teste pentru generarea inteligentă (nutritie-generator.js, etapa 5).
const test = require('node:test');
const assert = require('node:assert/strict');
const g = require('../nutritie-generator.js');
const c = require('../nutritie-calcul.js');
const z = require('../nutritie-zi.js');
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
