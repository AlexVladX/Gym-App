// Faza 3: rețetele românești — valori calculate din ingrediente, câmpurile noi, integrarea în generator și listă.
const test = require('node:test');
const assert = require('node:assert/strict');
const c = require('../nutritie-calcul.js');
const g = require('../nutritie-generator.js');
const l = require('../nutritie-cumparaturi.js');
const { ALIMENTE_BAZA } = require('../nutritie-alimente.js');
const { RETETE_BAZA } = require('../nutritie-retete.js');
const idx = c.indexAlimente(ALIMENTE_BAZA);
const RO = RETETE_BAZA.filter(r => r.bucatarie === 'romaneasca');

test('rețetele românești au toate câmpurile cerute', () => {
  assert.ok(RO.length >= 5);
  for (const r of RO) {
    assert.ok(r.nume && r.numeEn && r.descriere && r.fel, r.id);
    assert.equal(r.timpPregatire + r.timpGatire, r.timp, r.id);
    assert.ok(r.gatit.greutateGatita > 0 && r.gatit.nota, r.id);
    assert.ok(r.pasi.length >= 3 && r.ingrediente.length >= 5, r.id);
    for (const [id, gr] of r.ingrediente) assert.ok(idx.has(id) && gr > 0, `${r.id}: ${id}`);
  }
});

test('valorile se calculează din ingrediente (USDA): sarmale de porc, verificate de mână', () => {
  const r = RO.find(x => x.id === 'ro-sarmale-porc');
  const v = c.valoriPortie(r, idx);
  // 1000 g porc tocat (263 kcal/100 g) + 100 g afumătură (417) + … , împărțit la 10 porții
  const kcal = r.ingrediente.reduce((s, [id, gr]) => s + idx.get(id).kcal * gr / 100, 0) / r.portii;
  assert.ok(Math.abs(v.kcal - kcal) < 1e-6);
  assert.ok(v.kcal > 350 && v.kcal < 450, String(v.kcal));
  assert.ok(Math.abs(idx.get('porc-tocat').kcal - 263) < 1e-9 && idx.get('porc-tocat').ndb === '10219');
});

test('alergenii și etichetele dietetice vin din ingrediente', () => {
  const al = r => c.alergeniReteta(RO.find(x => x.id === r), idx).contine;
  assert.ok(al('ro-tochitura-moldoveneasca').includes('sulfiti'), 'vinul are sulfiți');
  assert.ok(al('ro-tochitura-moldoveneasca').includes('lapte') && al('ro-tochitura-moldoveneasca').includes('oua'));
  assert.ok(al('ro-ciorba-radauteana').includes('telina'));
  assert.ok(al('ro-papanasi').includes('gluten'));
  assert.ok(c.eticheteReteta(RO.find(x => x.id === 'ro-papanasi'), idx).includes('vegetarian'));
  assert.ok(!c.eticheteReteta(RO.find(x => x.id === 'ro-sarmale-porc'), idx).includes('vegetarian'));
});

test('generatorul le poate alege, iar filtrele stricte le exclud corect', () => {
  const pref = g.curataPreferinteNutritie({ dieta: ['vegetarian'] });
  const iduri = rez => Object.values(rez.candidate).flat().map(x => (x.r || x).id);
  const ok = iduri(g.filtreazaReteteGen(RETETE_BAZA, idx, pref));
  assert.ok(ok.includes('ro-placinte-branza') && !ok.includes('ro-sarmale-porc'));
  const fara = iduri(g.filtreazaReteteGen(RETETE_BAZA, idx, g.curataPreferinteNutritie({ alergii: ['sulfiti'] })));
  assert.ok(!fara.includes('ro-tochitura-moldoveneasca'));
});

test('lista de cumpărături adună ingredientele crude ale rețetei', () => {
  const r = RO.find(x => x.id === 'ro-sarmale-porc');
  const z = require('../nutritie-zi.js');
  const i = z.intrareMasa({ id: 'a', masa: r.masa, reteta: r, valoriPortieReteta: c.valoriPortie(r, idx), portii: 2 });
  const lista = l.construiesteLista({ zile: [{ data: '2026-11-23', mese: [i] }], idx, retete: RETETE_BAZA, stare: l.stareListaGoala('2026-11-23', '2026-11-23') });
  const porc = lista.categorii.flatMap(k => k.articole).find(a => a.id === 'porc-tocat');
  assert.equal(porc.grame, 200);
});
