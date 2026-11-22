// Teste pentru calculatorul zilei (nutritie-zi.js): ținte, planificat vs. mâncat, validare, backup.
const test = require('node:test');
const assert = require('node:assert/strict');
const z = require('../nutritie-zi.js');
const c = require('../nutritie-calcul.js');
const v = require('../validare.js');
const { ALIMENTE_BAZA } = require('../nutritie-alimente.js');
const { RETETE_BAZA } = require('../nutritie-retete.js');

const idx = c.indexAlimente(ALIMENTE_BAZA);
const aproape = (x, y, eps = 1e-6) => assert.ok(Math.abs(x - y) < eps, `${x} ≠ ${y}`);

test('estimare Mifflin-St Jeor: bărbat 80 kg, 180 cm, 30 de ani, moderat, menținere', () => {
  const e = z.estimeazaTinte({ kg: 80, inaltimeCm: 180, varsta: 30, sex: 'm', activitate: 'moderat', scop: 'mentinere' });
  // BMR = 10·80 + 6,25·180 − 5·30 + 5 = 1780; necesar = 1780 × 1,55 = 2759
  assert.equal(e.detalii.bmr, 1780);
  assert.equal(e.detalii.necesar, 2759);
  assert.equal(e.kcal, 2760);
  assert.equal(e.proteine, 128);                       // 1,6 g/kg
  assert.equal(e.grasimi, Math.round(2760 * 0.25 / 9)); // 77
  assert.equal(e.carbohidrati, Math.round((2760 - 128 * 4 - 77 * 9) / 4));
  assert.equal(e.fibre, Math.round(2.76 * 14));
  // energia macronutrienților ≈ caloriile (diferență doar din rotunjire)
  assert.ok(Math.abs(e.proteine * 4 + e.carbohidrati * 4 + e.grasimi * 9 - e.kcal) <= 6);
});

test('estimare: femeie, masă musculară și slăbire; limita minimă', () => {
  const baza = { kg: 60, inaltimeCm: 165, varsta: 28, sex: 'f', activitate: 'usor' };
  const bmr = 10 * 60 + 6.25 * 165 - 5 * 28 - 161; // 1330,25
  const masa = z.estimeazaTinte({ ...baza, scop: 'masa' });
  assert.equal(masa.kcal, Math.round(bmr * 1.375 * 1.1 / 10) * 10);
  assert.equal(masa.proteine, 108); // 1,8 g/kg
  const slab = z.estimeazaTinte({ ...baza, scop: 'slabire' });
  assert.equal(slab.proteine, 120); // 2,0 g/kg
  // −20% din 1829 = 1463 > BMR și > 1200: nu e limitat
  assert.equal(slab.detalii.limitat, false);
  // sedentară, scundă, slăbire: −20% ar coborî sub metabolismul bazal → se oprește la BMR
  const mic = z.estimeazaTinte({ kg: 48, inaltimeCm: 152, varsta: 60, sex: 'f', activitate: 'sedentar', scop: 'slabire' });
  assert.equal(mic.detalii.limitat, true);
  assert.ok(mic.kcal >= 1200 && mic.kcal >= mic.detalii.bmr - 5);
});

test('estimare: date lipsă sau în afara limitelor → null', () => {
  const ok = { kg: 80, inaltimeCm: 180, varsta: 30, sex: 'm', activitate: 'moderat', scop: 'mentinere' };
  assert.ok(z.estimeazaTinte(ok));
  for (const stricat of [{ kg: null }, { inaltimeCm: 90 }, { varsta: 12 }, { sex: 'x' }, { activitate: 'zbor' }, { scop: '' }]) {
    assert.equal(z.estimeazaTinte({ ...ok, ...stricat }), null, JSON.stringify(stricat));
  }
  assert.equal(z.estimeazaTinte(null), null);
});

test('ținte: doar caloriile sunt obligatorii; valorile din afara limitelor se scot', () => {
  assert.equal(z.curataTinte({ proteine: 150 }), null);
  assert.deepEqual(z.curataTinte({ kcal: 2500.4, proteine: 150, grasimi: 5000, fibre: 'x' }), { kcal: 2500, proteine: 150 });
  assert.deepEqual(z.curataTinte({ kcal: 2000, estimat: true }), { kcal: 2000, estimat: true });
  assert.equal(z.curataTinte({ kcal: 100 }), null);
});

function intrare(id, masa, reteta, portii = 1) {
  return z.intrareMasa({ id, masa, reteta, valoriPortieReteta: c.valoriPortie(reteta, idx), portii, acum: 1 });
}

test('planificat vs mâncat: nimic nu se numără automat; complet, parțial, neînceput', () => {
  const r1 = RETETE_BAZA.find(r => r.masa === 'mic-dejun');
  const r2 = RETETE_BAZA.find(r => r.masa === 'pranz');
  const a = intrare('a', 'mic-dejun', r1, 1);
  const b = intrare('b', 'pranz', r2, 2);
  let zi = { data: '2026-11-22', mese: [a, b] };
  let t = z.totaluriZi(zi);
  assert.equal(t.mancat.kcal, 0);
  aproape(t.planificat.kcal, a.valoriPortie.kcal + 2 * b.valoriPortie.kcal);
  assert.equal(a.stare, 'neinceput');

  zi = { ...zi, mese: [z.schimbaStareIntrare(a, 'complet', null, 2), z.schimbaStareIntrare(b, 'partial', 0.5, 2)] };
  t = z.totaluriZi(zi);
  aproape(t.mancat.kcal, a.valoriPortie.kcal + 0.5 * b.valoriPortie.kcal);
  aproape(t.mancat.proteine, a.valoriPortie.proteine + 0.5 * b.valoriPortie.proteine);
  aproape(t.planificat.kcal, a.valoriPortie.kcal + 2 * b.valoriPortie.kcal); // planificatul nu se schimbă
  assert.equal(t.terminate, 1);
  // per masă
  aproape(z.totaluriPeMasa(zi, 'pranz').mancat.kcal, 0.5 * b.valoriPortie.kcal);
  // înapoi la neînceput: nimic mâncat, cantitatea parțială dispare
  const inapoi = z.schimbaStareIntrare(zi.mese[1], 'neinceput');
  assert.equal(inapoi.portiiMancate, undefined);
  assert.equal(z.valoriMancateIntrare(inapoi).kcal, 0);
});

test('parțial: cantitatea trebuie să fie între 0 și porțiile planificate', () => {
  const a = intrare('a', 'cina', RETETE_BAZA.find(r => r.masa === 'cina'), 1);
  assert.throws(() => z.schimbaStareIntrare(a, 'partial', 0));
  assert.throws(() => z.schimbaStareIntrare(a, 'partial', 1));
  assert.throws(() => z.schimbaStareIntrare(a, 'partial', 'x'));
  assert.throws(() => z.schimbaStareIntrare(a, 'mancata'));
  assert.equal(z.schimbaStareIntrare(a, 'partial', 0.333).portiiMancate, 0.33);
});

test('valorile se copiază la adăugare: editarea rețetei nu schimbă ziua notată', () => {
  const r = JSON.parse(JSON.stringify(RETETE_BAZA.find(x => x.masa === 'pranz')));
  const a = intrare('a', 'pranz', r, 1);
  const inainte = z.valoriPlanificateIntrare(a).kcal;
  r.ingrediente = r.ingrediente.map(([id, g]) => [id, g * 3]); // rețeta se schimbă
  assert.equal(z.valoriPlanificateIntrare(a).kcal, inainte);
  assert.equal(a.nume, r.nume);
  // valorile copiate sunt cele pe porție, rotunjite la 0,1
  aproape(a.valoriPortie.kcal, Math.round(c.valoriPortie(RETETE_BAZA.find(x => x.id === r.id), idx).kcal * 10) / 10);
});

test('ce a rămas și progresul față de ținte', () => {
  const ramas = z.ramasDinTinte({ kcal: 2000, proteine: 150 }, { kcal: 2200, proteine: 100, carbohidrati: 50, grasimi: 0, fibre: 0 });
  assert.deepEqual(ramas, { kcal: -200, proteine: 50 });
  assert.equal(z.progresTinta(150, 75), 0.5);
  assert.equal(z.progresTinta(undefined, 75), null);
});

test('validarea unei zile: intrări stricate scoase, parțial fără cantitate → neînceput, id-uri unice', () => {
  const r = RETETE_BAZA[0];
  const bun = intrare('a', r.masa, r, 1);
  const zi = z.curataZiNutritie({ data: '2026-11-22', mese: [
    bun, { ...bun }, // id dublu
    { ...bun, id: 'b', portii: 0 },
    { ...bun, id: 'c', valoriPortie: { kcal: -5 } },
    { ...bun, id: 'd', stare: 'partial' },
    { ...bun, id: 'e', stare: 'partial', portiiMancate: 0.5 },
    { ...bun, id: 'f', stare: 'ciudat', campNou: 1 },
  ] });
  assert.deepEqual(zi.mese.map(i => i.id), ['a', 'd', 'e', 'f']);
  assert.equal(zi.mese[1].stare, 'neinceput');
  assert.equal(zi.mese[2].portiiMancate, 0.5);
  assert.equal(zi.mese[3].stare, 'neinceput');
  assert.equal(zi.mese[3].campNou, 1); // câmpurile necunoscute se păstrează
  assert.equal(z.curataZiNutritie({ data: '22.11.2026', mese: [] }), null);
  assert.deepEqual(z.curataZiNutritie({ data: '2026-11-22' }).mese, []);
});

test('backup: zilele de nutriție sunt opționale, validate și unice pe dată', () => {
  const r = RETETE_BAZA[0];
  const baza = { versiune: 3, sesiuni: [], exercitii: [], masuratori: [] };
  const fara = v.valideazaBackup(baza);
  assert.equal(fara.ok, true);
  assert.equal(fara.date.zileNutritie, undefined);
  assert.equal(fara.rezumat.zileNutritie, null);
  const cu = v.valideazaBackup({ ...baza, zileNutritie: [
    { data: '2026-11-21', mese: [intrare('a', r.masa, r, 1)] },
    { data: '2026-11-21', mese: [] },
    { data: 'ieri', mese: [] },
  ] });
  assert.equal(cu.ok, true);
  assert.equal(cu.date.zileNutritie.length, 1);
  assert.equal(cu.ignorate, 1);
  assert.equal(cu.rezumat.zileNutritie, 1);
});

test('vârsta din anul nașterii', () => {
  assert.equal(z.varstaDinAn(1990, new Date(2026, 10, 22)), 36);
  assert.equal(z.varstaDinAn(null), null);
  assert.equal(z.varstaDinAn(3000, new Date(2026, 0, 1)), null);
});
