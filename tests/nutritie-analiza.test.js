// Teste pentru analiza nutriției (nutritie-analiza.js, etapa 9).
const test = require('node:test');
const assert = require('node:assert/strict');
const an = require('../nutritie-analiza.js');
const z = require('../nutritie-zi.js');
const c = require('../nutritie-calcul.js');
const { ALIMENTE_BAZA } = require('../nutritie-alimente.js');
const { RETETE_BAZA } = require('../nutritie-retete.js');

const idx = c.indexAlimente(ALIMENTE_BAZA);
const aproape = (x, y, eps = 1e-6) => assert.ok(Math.abs(x - y) < eps, `${x} ≠ ${y}`);

// O intrare cu valori fixe (ușor de verificat de mână).
function intrare(id, kcal, proteine, stare = 'complet', portii = 1, portiiMancate) {
  let i = { id, masa: 'pranz', idReteta: 'r-' + id, nume: 'R ' + id, portii,
    valoriPortie: { kcal, proteine, carbohidrati: 10, grasimi: 5, fibre: 2 }, stare: 'neinceput', adaugat: 1, modificat: 1 };
  if (stare !== 'neinceput') i = z.schimbaStareIntrare(i, stare, portiiMancate);
  return i;
}

test('intervalul perioadelor: 7/30/90 de zile până azi; personalizat ordonat și fără viitor', () => {
  assert.deepEqual(an.intervalNutritie('7', '2026-11-22'), { de: '2026-11-16', pana: '2026-11-22' });
  assert.deepEqual(an.intervalNutritie('30', '2026-11-22'), { de: '2026-10-24', pana: '2026-11-22' });
  assert.equal(an.listaDate(...Object.values(an.intervalNutritie('90', '2026-11-22'))).length, 90);
  assert.deepEqual(an.intervalNutritie('personalizat', '2026-11-22', { de: '2026-11-30', pana: '2026-11-01' }), { de: '2026-11-01', pana: '2026-11-22' });
  assert.deepEqual(an.intervalNutritie('personalizat', '2026-11-22', null), { de: '2026-10-24', pana: '2026-11-22' });
});

test('mediile de „mâncat” se fac doar pe zilele notate; planificatul nu se numără ca mâncat', () => {
  const zile = [
    { data: '2026-11-20', mese: [intrare('a', 2000, 150), intrare('b', 500, 20, 'neinceput')] },
    { data: '2026-11-21', mese: [intrare('c', 1000, 100, 'partial', 2, 1)] }, // a mâncat 1 din 2 porții → 1000
    { data: '2026-11-22', mese: [intrare('d', 3000, 50, 'neinceput')] },      // doar plan
  ];
  const a = an.analizaNutritie(zile, { de: '2026-11-16', pana: '2026-11-22', tinte: { kcal: 2000, proteine: 140 } });
  assert.equal(a.zileInterval, 7);
  assert.equal(a.zileCuMancare, 2);
  assert.equal(a.zileCuPlan, 3);
  aproape(a.medieMancat.kcal, (2000 + 1000) / 2);
  aproape(a.medieMancat.proteine, (150 + 100) / 2);
  aproape(a.mediePlanificat.kcal, (2500 + 2000 + 3000) / 3);
  // obiective: 20.11 în țintă (2000), 21.11 sub (1000); proteine atinse doar 20.11 (150 ≥ 130)
  assert.deepEqual([a.obiective.kcalInTinta, a.obiective.kcalSub, a.obiective.kcalPeste, a.obiective.proteineAtinse], [1, 1, 0, 1]);
  aproape(a.obiective.procentKcal, 0.5);
  // planificat vs mâncat: doar zilele cu ambele (20 și 21)
  assert.equal(a.planVsMancat.zile, 2);
  aproape(a.planVsMancat.planificat, 2500 + 2000);
  aproape(a.planVsMancat.mancat, 3000);
  // consecvență: 2 din 4 intrări planificate mâncate (complet), seria: 21 notat, 22 (azi) nenotat nu rupe → 2
  assert.equal(a.consecventa.intrariPlan, 4);
  assert.equal(a.consecventa.intrariTerminate, 1);
  assert.equal(a.consecventa.serie, 2);
  assert.equal(a.consecventa.serieMax, 2);
});

test('distribuția macronutrienților dă 100% și urmează 4/4/9 kcal pe gram', () => {
  const d = an.distributieMacro({ proteine: 100, carbohidrati: 200, grasimi: 50 }); // 400 + 800 + 450 = 1650
  aproape(d.proteine + d.carbohidrati + d.grasimi, 1);
  aproape(d.proteine, 400 / 1650);
  aproape(d.grasimi, 450 / 1650);
  assert.deepEqual(an.distributieMacro({ proteine: 0, carbohidrati: 0, grasimi: 0 }), { proteine: 0, carbohidrati: 0, grasimi: 0 });
});

test('mediile pe săptămâni (luni–duminică) și pe luni', () => {
  const zile = [
    { data: '2026-10-30', mese: [intrare('a', 1800, 100)] },
    { data: '2026-11-02', mese: [intrare('b', 2200, 120)] }, // luni
    { data: '2026-11-03', mese: [intrare('c', 2000, 140)] },
  ];
  const a = an.analizaNutritie(zile, { de: '2026-10-26', pana: '2026-11-08', tinte: { kcal: 2000 } });
  assert.deepEqual(a.saptamani.map(s => s.cheie), ['2026-10-26', '2026-11-02']);
  aproape(a.saptamani[0].medieMancat.kcal, 1800);
  aproape(a.saptamani[1].medieMancat.kcal, 2100);
  assert.equal(a.saptamani[1].zileNotate, 2);
  assert.equal(a.saptamani[1].zileInTinta, 2);
  assert.equal(a.saptamani[0].zileInTinta, 1); // 1800 = exact −10% din 2000 → încă în țintă
  assert.deepEqual(a.luni.map(l => l.cheie), ['2026-10', '2026-11']);
  aproape(a.luni[1].medieMancat.kcal, 2100);
});

test('istoricul nu se schimbă când rețeta e editată sau ștearsă', () => {
  const r = JSON.parse(JSON.stringify(RETETE_BAZA.find(x => x.id === 'pr-pui-orez-broccoli')));
  const i = z.schimbaStareIntrare(z.intrareMasa({ id: 'x', masa: 'pranz', reteta: r, valoriPortieReteta: c.valoriPortie(r, idx) }), 'complet');
  const zile = [{ data: '2026-11-20', mese: [i] }];
  const inainte = an.analizaNutritie(zile, { de: '2026-11-20', pana: '2026-11-20' }).medieMancat.kcal;
  r.ingrediente = []; // rețeta „ștearsă”/golită
  const dupa = an.analizaNutritie(zile, { de: '2026-11-20', pana: '2026-11-20' }).medieMancat.kcal;
  assert.equal(dupa, inainte);
  assert.ok(inainte > 0);
});

test('fără ținte: obiectivele lipsesc; fără date: medii 0 și zile 0', () => {
  const a = an.analizaNutritie([], { de: '2026-11-01', pana: '2026-11-07' });
  assert.equal(a.obiective, null);
  assert.equal(a.zileCuMancare, 0);
  assert.equal(a.medieMancat.kcal, 0);
  assert.equal(a.consecventa.procentMese, null);
  assert.equal(a.planVsMancat.raport, null);
});
