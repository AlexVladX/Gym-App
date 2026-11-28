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
  assert.equal(e.proteine, 144);                       // 1,8 g/kg (etapa 7)
  assert.equal(e.grasimi, Math.round(2760 * 0.25 / 9)); // 77
  assert.equal(e.carbohidrati, Math.round((2760 - 144 * 4 - 2760 * 0.25) / 4)); // 373 g = 4,7 g/kg, sub plafonul de 6
  assert.equal(e.fibre, Math.round(2.76 * 14));
  // energia macronutrienților ≈ caloriile (diferență doar din rotunjire)
  assert.ok(Math.abs(e.proteine * 4 + e.carbohidrati * 4 + e.grasimi * 9 - e.kcal) <= 6);
});

test('estimare: femeie, masă musculară și slăbire; limita minimă', () => {
  const baza = { kg: 60, inaltimeCm: 165, varsta: 28, sex: 'f', activitate: 'usor' };
  const bmr = 10 * 60 + 6.25 * 165 - 5 * 28 - 161; // 1330,25
  const masa = z.estimeazaTinte({ ...baza, scop: 'masa' });
  assert.equal(masa.kcal, Math.round(bmr * 1.375 * 1.1 / 10) * 10);
  assert.equal(masa.proteine, 120); // 2,0 g/kg (etapa 7)
  const slab = z.estimeazaTinte({ ...baza, scop: 'slabire' });
  assert.equal(slab.proteine, 132); // 2,2 g/kg (etapa 7)
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

// ---------- Etapa 4: generarea aleatorie ----------
function rngFix(seed = 1) { let x = seed; return () => { x = (x * 16807) % 2147483647; return (x - 1) / 2147483646; }; }
function idGen() { let n = 0; return () => `t-${++n}`; }
const valoriPentru = r => c.valoriPortie(r, idx);

test('generarea: exact 5 mese, câte una pe categorie, fără repetări, cu ingrediente și timp', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const rez = z.genereazaPlanZi({ zi: { data: '2026-11-22', mese: [] }, retete: RETETE_BAZA, valoriPentru, preferate: new Set(), rng: rngFix(seed), idNou: idGen(), acum: 5 });
    assert.deepEqual(rez.mese.map(i => i.masa), ['mic-dejun', 'gustare-1', 'pranz', 'gustare-2', 'cina']);
    assert.equal(new Set(rez.mese.map(i => i.idReteta)).size, 5);
    for (const i of rez.mese) {
      const r = RETETE_BAZA.find(x => x.id === i.idReteta);
      assert.equal(r.masa, i.masa);
      assert.equal(i.stare, 'neinceput');
      assert.equal(i.timp, r.timp);
      assert.equal(i.ingredientePortie.length, r.ingrediente.length);
      // valorile din ingredientele pe porție ≈ valorile pe porție ale rețetei
      aproape(c.valoriIngrediente(i.ingredientePortie, idx).total.kcal, i.valoriPortie.kcal, 1.5);
    }
    assert.deepEqual(rez.lipsa, []);
  }
});

test('generarea păstrează mesele blocate și pe cele începute; nu le repetă rețetele', () => {
  const gen = z.genereazaPlanZi({ zi: { data: 'x', mese: [] }, retete: RETETE_BAZA, valoriPentru, rng: rngFix(7), idNou: idGen() });
  const blocat = { ...gen.mese[0], blocat: true };
  const mancat = z.schimbaStareIntrare(gen.mese[2], 'complet');
  const zi = { data: 'x', mese: [blocat, gen.mese[1], mancat, gen.mese[3], gen.mese[4]] };
  for (let seed = 2; seed < 20; seed++) {
    const rez = z.genereazaPlanZi({ zi, retete: RETETE_BAZA, valoriPentru, rng: rngFix(seed), idNou: idGen() });
    assert.deepEqual(rez.pastrate.sort(), ['mic-dejun', 'pranz']);
    assert.deepEqual(rez.mese.find(i => i.masa === 'mic-dejun'), blocat);
    assert.deepEqual(rez.mese.find(i => i.masa === 'pranz'), mancat);
    assert.equal(rez.mese.length, 5);
    assert.equal(new Set(rez.mese.map(i => i.idReteta)).size, 5);
  }
});

test('regenerarea unei mese nu schimbă celelalte; nu merge pe mese blocate sau începute', () => {
  const gen = z.genereazaPlanZi({ zi: { data: 'x', mese: [] }, retete: RETETE_BAZA, valoriPentru, rng: rngFix(3), idNou: idGen() });
  const zi = { data: 'x', mese: gen.mese.map((i, k) => (k === 2 ? { ...i, portii: 1.5 } : i)) };
  const noua = z.regenereazaIntrare({ zi, idIntrare: zi.mese[2].id, retete: RETETE_BAZA, valoriPentru, rng: rngFix(9), idNou: idGen() });
  for (const k of [0, 1, 3, 4]) assert.deepEqual(noua.mese[k], zi.mese[k]);
  assert.notEqual(noua.mese[2].idReteta, zi.mese[2].idReteta);
  assert.equal(noua.mese[2].masa, 'pranz');
  assert.equal(noua.mese[2].portii, 1.5);
  assert.equal(new Set(noua.mese.map(i => i.idReteta)).size, 5);
  assert.equal(z.regenereazaIntrare({ zi: { ...zi, mese: zi.mese.map((i, k) => (k === 2 ? { ...i, blocat: true } : i)) }, idIntrare: zi.mese[2].id, retete: RETETE_BAZA, valoriPentru, idNou: idGen() }), null);
  assert.equal(z.regenereazaIntrare({ zi: { ...zi, mese: zi.mese.map((i, k) => (k === 2 ? z.schimbaStareIntrare(i, 'complet') : i)) }, idIntrare: zi.mese[2].id, retete: RETETE_BAZA, valoriPentru, idNou: idGen() }), null);
  // o singură rețetă disponibilă pentru masă, deja folosită → null
  const doar = RETETE_BAZA.filter(r => r.masa !== 'cina' || r.id === zi.mese[4].idReteta);
  assert.equal(z.regenereazaIntrare({ zi, idIntrare: zi.mese[4].id, retete: doar, valoriPentru, idNou: idGen() }), null);
});

test('generarea anunță mesele fără rețete disponibile', () => {
  const fara = RETETE_BAZA.filter(r => r.masa !== 'gustare-2');
  const rez = z.genereazaPlanZi({ zi: { data: 'x', mese: [] }, retete: fara, valoriPentru, rng: rngFix(1), idNou: idGen() });
  assert.deepEqual(rez.lipsa, ['gustare-2']);
  assert.equal(rez.mese.length, 4);
});

test('alegerea aleatorie: favoritele au șanse duble, exclude respectat', () => {
  const retete = [{ id: 'a', masa: 'cina' }, { id: 'b', masa: 'cina' }, { id: 'c', masa: 'pranz' }];
  let a = 0;
  const rng = rngFix(11);
  for (let k = 0; k < 6000; k++) if (z.alegeRetetaAleatorie({ retete, masa: 'cina', preferate: new Set(['a']), rng }).id === 'a') a++;
  assert.ok(a / 6000 > 0.62 && a / 6000 < 0.71, `${a / 6000}`); // ≈ 2/3
  for (let k = 0; k < 50; k++) assert.equal(z.alegeRetetaAleatorie({ retete, masa: 'cina', exclude: new Set(['a']), rng }).id, 'b');
  assert.equal(z.alegeRetetaAleatorie({ retete, masa: 'cina', exclude: new Set(['a', 'b']), rng }), null);
});

test('ajustarea cantităților recalculează valorile; doar ingredientele > 0 rămân', () => {
  const r = RETETE_BAZA.find(x => x.id === 'pr-pui-orez-broccoli');
  const i = intrare('a', 'pranz', r, 1);
  const ing = i.ingredientePortie.map(([id, g], k) => [id, k === 0 ? g * 2 : g]);
  ing[ing.length - 1][1] = 0;
  const noua = z.ajusteazaIngredienteIntrare(i, ing, x => c.valoriIngrediente(x, idx));
  assert.equal(noua.ingredientePortie.length, i.ingredientePortie.length - 1);
  aproape(noua.valoriPortie.kcal, Math.round(c.valoriIngrediente(ing.filter(([, g]) => g > 0), idx).total.kcal * 10) / 10);
  assert.ok(noua.valoriPortie.proteine > i.valoriPortie.proteine);
  assert.equal(noua.ajustat, true);
  assert.throws(() => z.ajusteazaIngredienteIntrare(i, ing.map(([id]) => [id, 0]), x => c.valoriIngrediente(x, idx)));
});

test('planuri: salvare și încărcare păstrează rețetele, porțiile și cantitățile; mesele începute rămân', () => {
  const gen = z.genereazaPlanZi({ zi: { data: 'x', mese: [] }, retete: RETETE_BAZA, valoriPentru, rng: rngFix(5), idNou: idGen() });
  const zi = { data: 'x', mese: gen.mese.map((i, k) => (k === 1 ? { ...i, portii: 2, blocat: true } : i)) };
  const plan = z.planDinZi(zi, { id: 'u-p', nume: ' Ziua grea ', favorit: true, acum: 9 });
  assert.equal(plan.mese.length, 5);
  assert.ok(plan.mese.every(m => !('stare' in m) && !('blocat' in m) && !('id' in m)));
  assert.deepEqual(z.curataPlanNutritie(plan).nume, 'Ziua grea');
  // altă zi, cu prânzul deja mâncat
  const alta = z.genereazaPlanZi({ zi: { data: 'y', mese: [] }, retete: RETETE_BAZA, valoriPentru, rng: rngFix(99), idNou: idGen() });
  const pranzMancat = z.schimbaStareIntrare(alta.mese[2], 'complet');
  const rez = z.aplicaPlan({ zi: { data: 'y', mese: [alta.mese[0], pranzMancat] }, plan, idNou: idGen(), acum: 10 });
  assert.deepEqual(rez.sarite, ['pranz']);
  assert.equal(rez.mese.length, 5);
  assert.deepEqual(rez.mese.find(i => i.masa === 'pranz'), pranzMancat);
  const g1 = rez.mese.find(i => i.masa === 'gustare-1');
  assert.equal(g1.portii, 2);
  assert.equal(g1.idReteta, zi.mese[1].idReteta);
  assert.equal(g1.stare, 'neinceput');
  assert.equal(g1.blocat, undefined);
  assert.deepEqual(z.totaluriZi({ mese: [g1] }).planificat, z.totaluriZi({ mese: [zi.mese[1]] }).planificat);
});

test('validare planuri și backup', () => {
  const r = RETETE_BAZA[0];
  const bun = z.planDinZi({ mese: [intrare('a', r.masa, r, 1)] }, { id: 'u-1', nume: 'P' });
  assert.ok(z.curataPlanNutritie(bun));
  assert.equal(z.curataPlanNutritie({ ...bun, nume: '' }), null);
  assert.equal(z.curataPlanNutritie({ ...bun, mese: [{ masa: 'cina' }] }), null);
  assert.equal(z.curataPlanNutritie({ ...bun, id: 5 }), null);
  const zi = z.curataZiNutritie({ data: '2026-11-22', mese: [{ ...intrare('a', r.masa, r, 1), ingredientePortie: [['x', -3]], timp: 'lung', blocat: 'da' }] });
  assert.equal(zi.mese[0].ingredientePortie, undefined);
  assert.equal(zi.mese[0].timp, undefined);
  assert.equal(zi.mese[0].blocat, undefined);
  const b = v.valideazaBackup({ versiune: 3, sesiuni: [], exercitii: [], masuratori: [], planuriNutritie: [bun, bun, { id: 'stricat' }] });
  assert.equal(b.ok, true);
  assert.equal(b.date.planuriNutritie.length, 1);
  assert.equal(b.ignorate, 1);
  assert.equal(b.rezumat.planuriNutritie, 1);
});
