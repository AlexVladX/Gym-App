// Scanarea meselor, etapa 4: istoricul (validare, căutare, comparare), păstrarea pozelor, limita ta și costul estimat.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../scanare-istoric.js');

const art = (nume, kcal) => ({ nume, cantitate: 100, unitate: 'g', grame: 100, estimat: true, valori: { kcal, proteine: 10, carbohidrati: 5, grasimi: 2, fibre: 1 }, sursa: { tip: 'usda', eticheta: 'USDA', nume: 'x', id: '1', url: '', preluat: '' } });
const rec = (o = {}) => ({ id: 's-1', creat: 1000, data: '2026-11-27', ora: '13:05', masa: 'pranz', nume: 'Pui cu orez', idIntrare: 'u-1', articole: [art('Piept de pui', 165), art('Orez fiert', 130)], total: { kcal: 295, proteine: 20, carbohidrati: 10, grasimi: 4, fibre: 2 }, poza: null, tokeni: { intrare: 1300, iesire: 450 }, ...o });

test('istoric: înregistrările se validează; cele stricate nu apar', () => {
  const r = H.curataInregistrareScanare(rec());
  assert.equal(r.articole.length, 2);
  assert.deepEqual(r.tokeni, { intrare: 1300, iesire: 450 });
  assert.equal(H.curataInregistrareScanare({ ...rec(), id: '' }), null);
  assert.equal(H.curataInregistrareScanare({ ...rec(), articole: [] }), null);
  assert.equal(H.curataInregistrareScanare(rec({ data: 'ieri', ora: 'x' })).data, '');
});

test('istoric: căutare după masă sau aliment, fără diacritice', () => {
  const l = [rec(), rec({ id: 's-2', nume: 'Sarmale', articole: [art('Sarmale cu porc', 200)] })];
  assert.deepEqual(H.filtreazaScanari(l, 'orez').map(s => s.id), ['s-1']);
  assert.deepEqual(H.filtreazaScanari(l, 'SARMALE porc').map(s => s.id), ['s-2']);
  assert.deepEqual(H.filtreazaScanari(l, 'piept pui').map(s => s.id), ['s-1']);
  assert.equal(H.filtreazaScanari(l, '').length, 2);
});

test('istoric: comparare (b față de a)', () => {
  const c = H.comparaScanari(rec(), rec({ total: { kcal: 400, proteine: 25.5, carbohidrati: 10, grasimi: 1, fibre: 2 } }));
  assert.deepEqual(c.map(x => x.diferenta), [105, 5.5, 0, -3, 0]);
});

test('păstrarea pozelor: nu / 30 / 90 de zile / mereu; setarea e validată', () => {
  const acum = 100 * 86400000;
  assert.equal(H.limitaPozeScanare('mereu', acum), null);
  assert.equal(H.limitaPozeScanare('nu', acum), Infinity);
  assert.equal(H.limitaPozeScanare('30', acum), 70 * 86400000);
  assert.equal(H.limitaPozeScanare('90', acum), 10 * 86400000);
  assert.deepEqual(H.OPTIUNI_POZE_SCANARE.map(o => o.id), ['nu', '30', '90', 'mereu']);
});

test('contor: scanările de azi (după server), tokenii lunii, costul estimat; luna nouă pornește de la zero', () => {
  let c = H.actualizeazaContorScanari(null, { utilizare: { azi: 1, limita: 20 }, tokeni: { intrare: 1300, iesire: 500 } }, new Date(2026, 10, 27, 13));
  c = H.actualizeazaContorScanari(c, { utilizare: { azi: 2, limita: 20 }, tokeni: { intrare: 1200, iesire: 400 } }, new Date(2026, 10, 27, 14));
  assert.deepEqual([c.zi, c.aziServer, c.limitaServer, c.luna, c.scanariLuna, c.intrare, c.iesire], ['2026-11-27', 2, 20, '2026-11', 2, 2500, 900]);
  assert.ok(Math.abs(H.costEstimatScanari(c) - (2500 * 0.25 + 900 * 1.5) / 1e6) < 1e-12);
  const d = H.actualizeazaContorScanari(c, { utilizare: { azi: 1, limita: 20 }, tokeni: { intrare: 10, iesire: 10 } }, new Date(2026, 11, 1, 9));
  assert.deepEqual([d.luna, d.scanariLuna, d.intrare], ['2026-12', 1, 10]);
});

test('limita ta: blochează doar când azi ai atins-o (după numărul serverului)', () => {
  const c = { zi: '2026-11-27', aziServer: 5 };
  assert.equal(H.verificaLimitaProprie(c, null, '2026-11-27'), null, 'fără limită proprie');
  assert.equal(H.verificaLimitaProprie(c, 10, '2026-11-27'), null);
  assert.equal(H.verificaLimitaProprie(c, 5, '2026-11-27').cod, 'limita_proprie');
  assert.equal(H.verificaLimitaProprie(c, 5, '2026-11-28'), null, 'altă zi');
});

// Recuperarea meselor șterse din istoricul scanărilor.
test('recuperare: fiecare scanare revine în ziua ei, la masa și ora ei, ca mâncată; ce există nu se dublează', () => {
  const Z = require('../nutritie-zi.js');
  const s1 = H.curataInregistrareScanare(rec());
  const s2 = H.curataInregistrareScanare(rec({ id: 's-2', creat: 2000, masa: 'cina', ora: '20:10', nume: 'Ouă și mămăligă', idIntrare: 'u-2' }));
  const s3 = H.curataInregistrareScanare(rec({ id: 's-3', creat: 3000, data: '2026-11-26', idIntrare: 'u-3' }));
  const deja = H.curataInregistrareScanare(rec({ id: 's-4', creat: 4000, idIntrare: 'u-4' }));
  const faraZi = H.curataInregistrareScanare(rec({ id: 's-5', data: '', idIntrare: 'u-5' }));
  const dublura = H.curataInregistrareScanare(rec({ id: 's-6', creat: 5000, idIntrare: 'u-1' }));
  const zile = new Map([['2026-11-27', { data: '2026-11-27', mese: [{ id: 'u-4', masa: 'pranz', nume: 'x' }], cafele: [{ id: 'c' }] }]]);
  const plan = H.planRecuperareScanari([s3, s2, s1, deja, faraZi, dublura], zile, { acum: 9 });
  assert.deepEqual([...plan.keys()].sort(), ['2026-11-26', '2026-11-27']);
  const z27 = plan.get('2026-11-27');
  assert.deepEqual(z27.map(i => i.id), ['u-1', 'u-2']);
  const i = z27[0];
  assert.equal(i.stare, 'complet');
  assert.equal(i.masa, 'pranz');
  assert.equal(i.ora, '13:05');
  assert.equal(i.nume, 'Pui cu orez');
  assert.equal(i.adaugat, 1000);
  assert.equal(i.valoriPortie.kcal, 295);
  assert.equal(i.scanare.articole.length, 2);
  assert.ok(Z.curataIntrareMasa(i), 'intrarea refăcută trece validarea zilei');
  assert.equal(z27[1].masa, 'cina');
  assert.deepEqual(plan.get('2026-11-26').map(x => x.id), ['u-3']);
  // a doua rulare, după ce intrările au fost puse înapoi: nimic de adăugat
  const dupa = new Map([['2026-11-27', { data: '2026-11-27', mese: [...zile.get('2026-11-27').mese, ...z27] }], ['2026-11-26', { data: '2026-11-26', mese: plan.get('2026-11-26') }]]);
  assert.equal(H.planRecuperareScanari([s1, s2, s3], dupa).size, 0);
});
